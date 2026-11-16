import net from "net";

export interface ParsedIpEntry {
  raw: string;
  version: 4 | 6;
  ip: string;
  prefix: number;
}

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map((p) => Number(p));
  return (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0);
}

function expandIpv6(ip: string): bigint {
  // Strip IPv4-mapped suffix if present
  let work = ip.toLowerCase();
  if (work.includes(".")) {
    const lastColon = work.lastIndexOf(":");
    const v4Part = work.slice(lastColon + 1);
    if (net.isIPv4(v4Part)) {
      const n = ipv4ToInt(v4Part);
      const hi = ((n >>> 16) & 0xffff).toString(16);
      const lo = (n & 0xffff).toString(16);
      work = `${work.slice(0, lastColon + 1)}${hi}:${lo}`;
    }
  }
  const halves = work.split("::");
  const left = halves[0] ? halves[0].split(":").filter(Boolean) : [];
  const right = halves.length > 1 && halves[1] ? halves[1].split(":").filter(Boolean) : [];
  const missing = 8 - (left.length + right.length);
  const full = [...left, ...Array(Math.max(0, missing)).fill("0"), ...right];
  let acc = BigInt(0);
  for (const group of full) {
    acc = (acc << BigInt(16)) | BigInt(parseInt(group, 16) || 0);
  }
  return acc;
}

export function getRawClickAllowlistEnv(env: NodeJS.ProcessEnv = process.env): string {
  return (env.CLICK_ALLOWED_IPS ?? env.CLICK_IP_ALLOWLIST ?? "").trim();
}

export function parseClickIpAllowlist(raw: string): {
  entries: ParsedIpEntry[];
  invalidEntries: string[];
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { entries: [], invalidEntries: [] };
  }

  const tokens = trimmed.split(",").map((t) => t.trim());
  const entries: ParsedIpEntry[] = [];
  const invalidEntries: string[] = [];

  for (const token of tokens) {
    if (!token) {
      invalidEntries.push("<empty>");
      continue;
    }

    const slashIdx = token.indexOf("/");
    if (slashIdx === -1) {
      const version = net.isIP(token);
      if (version === 4) {
        entries.push({ raw: token, version: 4, ip: token, prefix: 32 });
      } else if (version === 6) {
        entries.push({ raw: token, version: 6, ip: token, prefix: 128 });
      } else {
        invalidEntries.push(token);
      }
      continue;
    }

    const ipPart = token.slice(0, slashIdx).trim();
    const prefixPart = token.slice(slashIdx + 1).trim();
    if (!/^\d+$/.test(prefixPart)) {
      invalidEntries.push(token);
      continue;
    }
    const prefix = Number(prefixPart);
    const version = net.isIP(ipPart);
    if (version === 4 && prefix >= 0 && prefix <= 32) {
      entries.push({ raw: token, version: 4, ip: ipPart, prefix });
    } else if (version === 6 && prefix >= 0 && prefix <= 128) {
      entries.push({ raw: token, version: 6, ip: ipPart, prefix });
    } else {
      invalidEntries.push(token);
    }
  }

  return { entries, invalidEntries };
}

export function isIpInAllowlist(clientIp: string, entries: ParsedIpEntry[]): boolean {
  const ip = clientIp.trim().replace(/^::ffff:/i, "");
  const version = net.isIP(ip);
  if (version === 0) return false;

  for (const entry of entries) {
    if (entry.version !== version) continue;
    if (entry.version === 4) {
      const mask = entry.prefix === 0 ? 0 : (0xffffffff << (32 - entry.prefix)) >>> 0;
      if ((ipv4ToInt(ip) & mask) === (ipv4ToInt(entry.ip) & mask)) {
        return true;
      }
    } else {
      const shift = BigInt(128 - entry.prefix);
      if ((expandIpv6(ip) >> shift) === (expandIpv6(entry.ip) >> shift)) {
        return true;
      }
    }
  }
  return false;
}
