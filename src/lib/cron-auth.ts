export function verifyCronSecret(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return false;
  }
  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}
