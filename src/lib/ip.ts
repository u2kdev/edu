export function getClientIp(req: Request): string {
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
      if (parts.length >= hops) {
        return parts[parts.length - hops];
      }
      if (parts.length > 0) {
        return parts[0];
      }
    }
  }

  if (process.env.TRUST_PROXY_HEADERS === "true") {
    const cfIp = req.headers.get("cf-connecting-ip");
    if (cfIp) return cfIp.trim();

    const realIp = req.headers.get("x-real-ip");
    if (realIp) return realIp.trim();
  }

  // When hops is 0 (default), untrusted headers are ignored and unknown is returned
  return "unknown";
}
