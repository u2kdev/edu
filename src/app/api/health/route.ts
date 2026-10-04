import { NextResponse } from "next/server";
// Reason: Exception: Health route operates globally.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";

// GET /api/health — Health check endpoint
export async function GET() {
  const start = Date.now();
  const checks: Record<string, { status: "ok" | "error"; latencyMs?: number; error?: string }> = {};

  // Database check
  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = { status: "ok", latencyMs: Date.now() - start };
  } catch (err: any) {
    checks.database = { status: "error", error: err.message };
  }

  const allOk = Object.values(checks).every((c) => c.status === "ok");

  return NextResponse.json(
    {
      status: allOk ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "0.1.0",
      environment: process.env.NODE_ENV || "development",
      checks,
      uptime: Math.round(process.uptime()),
    },
    { status: allOk ? 200 : 503 }
  );
}
