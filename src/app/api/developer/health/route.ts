import { NextResponse } from "next/server";
// Reason: Exception: Developer routes operate on platform models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requireDeveloper, handlePlatformError } from "@/lib/platformAuth";

export async function GET() {
  try {
    await requireDeveloper();

    // Measure DB Ping
    const start = performance.now();
    await db.$queryRaw`SELECT 1`;
    const end = performance.now();
    const dbPing = Math.round(end - start);

    // Mock Redis ping since we don't have Redis configured globally in MVP yet
    const redisPing = "N/A";

    const systemStats = {
      dbStatus: dbPing < 200 ? "HEALTHY" : "DEGRADED",
      dbPingMs: dbPing,
      redisStatus: "N/A",
      redisPingMs: redisPing,
      uptimeSeconds: process.uptime(),
      memoryUsage: process.memoryUsage(),
      environment: process.env.NODE_ENV,
    };

    return NextResponse.json({ health: systemStats });
  } catch (err: any) {
    return handlePlatformError(err);
  }
}
