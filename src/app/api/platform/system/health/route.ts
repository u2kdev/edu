import { NextResponse } from "next/server";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requirePlatformPermission, handlePlatformError } from "@/lib/platformAuth";

export async function GET(req: Request) {
  try {
    await requirePlatformPermission("platform.system.health", req);

    // 1. Measure DB ping
    const start = performance.now();
    await db.$queryRaw`SELECT 1`;
    const end = performance.now();
    const dbPingMs = Math.round(end - start);

    // 2. Email & queue status
    const emailProvider = (process.env.EMAIL_PROVIDER || "memory").toLowerCase();
    const isEmailConfigured =
      emailProvider === "resend" || emailProvider === "smtp" || process.env.NODE_ENV !== "production";

    const [pendingEmails, failedEmails, sentEmails, lastProcessedEmail] = await Promise.all([
      db.emailOutbox.count({ where: { status: "PENDING" } }),
      db.emailOutbox.count({ where: { status: "FAILED" } }),
      db.emailOutbox.count({ where: { status: "SENT" } }),
      db.emailOutbox.findFirst({
        where: { status: "SENT" },
        orderBy: { sentAt: "desc" },
        select: { sentAt: true },
      }),
    ]);

    // 3. System stats
    const health = {
      dbStatus: dbPingMs < 200 ? "HEALTHY" : "DEGRADED",
      dbPingMs,
      email: {
        provider: emailProvider,
        isConfigured: isEmailConfigured,
        warning:
          emailProvider === "memory" && process.env.NODE_ENV === "production"
            ? "Почта не настроена, письма не отправляются (EMAIL_PROVIDER=memory)"
            : null,
      },
      cron: {
        lastEmailRunAt: lastProcessedEmail?.sentAt || null,
        schedule: "*/5 * * * *",
      },
      queue: {
        pending: pendingEmails,
        failed: failedEmails,
        sent: sentEmails,
      },
      system: {
        uptimeSeconds: Math.round(process.uptime()),
        memoryUsageMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
        heapUsedMb: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)),
        environment: process.env.NODE_ENV || "development",
      },
    };

    return NextResponse.json({ success: true, health });
  } catch (err: unknown) {
    return handlePlatformError(err);
  }
}
