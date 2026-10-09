export function getClientIp(req: Request): string {
  const hops = parseInt(process.env.TRUSTED_PROXY_HOPS || "0", 10);
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
  // When hops is 0 (default), x-forwarded-for is untrusted and ignored
  return "127.0.0.1";
}
