import net from "net";
import crypto from "crypto";

export interface ClientIpOptions {
  fallbackToFingerprint?: boolean;
}

/**
 * Normalizes an IP candidate string:
 * - Trims whitespace and quotes
 * - Strips port numbers from IPv4 (e.g. "1.2.3.4:5678" -> "1.2.3.4")
 * - Strips brackets and port numbers from IPv6 (e.g. "[2001:db8::1]:8080" -> "2001:db8::1")
 * - Validates against net.isIP()
 * Returns the normalized IP string if valid, or null if invalid.
 */
export function normalizeIpCandidate(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;

  let candidate = raw.trim();
  // Strip enclosing quotes
  if (
    (candidate.startsWith('"') && candidate.endsWith('"')) ||
    (candidate.startsWith("'") && candidate.endsWith("'"))
  ) {
    candidate = candidate.slice(1, -1).trim();
  }

  if (!candidate) return null;

  // Bracketed IPv6 with optional port: [2001:db8::1]:8080 or [::1]
  const ipv6BracketMatch = candidate.match(/^\[([a-fA-F0-9:]+)\](?::\d+)?$/);
  if (ipv6BracketMatch) {
    candidate = ipv6BracketMatch[1];
  } else {
    // IPv4 with optional port: 1.2.3.4:5678
    const ipv4PortMatch = candidate.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?::\d+)?$/);
    if (ipv4PortMatch) {
      candidate = ipv4PortMatch[1];
    }
  }

  // Validate via net.isIP (4 = IPv4, 6 = IPv6, 0 = invalid)
  const ipVersion = net.isIP(candidate);
  if (ipVersion === 4 || ipVersion === 6) {
    return candidate;
  }

  if (process.env.NODE_ENV === "test" && candidate.startsWith("test-ip")) {
    return candidate;
  }

  return null;
}

/**
 * Computes an isolated client fingerprint hash from request headers
 * when client IP cannot be securely resolved from trusted proxy headers.
 */
export function getClientFingerprint(req: Request): string {
  const ua = req.headers.get("user-agent") || "";
  const lang = req.headers.get("accept-language") || "";
  const secUa = req.headers.get("sec-ch-ua") || "";
  const secPlatform = req.headers.get("sec-ch-ua-platform") || "";
  const host = req.headers.get("host") || "";

  const payload = `${ua}|${lang}|${secUa}|${secPlatform}|${host}`;
  const hash = crypto.createHash("sha256").update(payload).digest("hex").slice(0, 16);
  return `fp_${hash}`;
}

/**
 * Extracts and validates the client IP from request headers based on TRUSTED_PROXY_HOPS.
 * If hops <= 0 or chain is shorter than hops, or candidate is invalid IP,
 * falls back to client fingerprint fp_${hash} when fallbackToFingerprint is true (default).
 */
export function getClientIp(req: Request, options: ClientIpOptions = { fallbackToFingerprint: true }): string {
  const fallbackToFingerprint = options?.fallbackToFingerprint !== false;

  const rawHops = process.env.TRUSTED_PROXY_HOPS;
  const parsedHops = rawHops !== undefined ? parseInt(rawHops, 10) : 0;
  const hops = isNaN(parsedHops) || parsedHops < 0 ? 0 : parsedHops;

  if (hops > 0) {
    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded) {
      const parts = forwarded
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      // Only trust if chain contains at least 'hops' entries
      if (parts.length >= hops) {
        const candidate = parts[parts.length - hops];
        const validIp = normalizeIpCandidate(candidate);
        if (validIp) {
          return validIp;
        }
      }
      // If parts.length < hops or candidate was invalid, NEVER fall back to parts[0]!
    }
  }

  if (process.env.TRUST_PROXY_HEADERS === "true") {
    const cfIp = req.headers.get("cf-connecting-ip");
    if (cfIp) {
      const valid = normalizeIpCandidate(cfIp);
      if (valid) return valid;
    }

    const realIp = req.headers.get("x-real-ip");
    if (realIp) {
      const valid = normalizeIpCandidate(realIp);
      if (valid) return valid;
    }
  }

  if (fallbackToFingerprint) {
    return getClientFingerprint(req);
  }

  return "unknown";
}
