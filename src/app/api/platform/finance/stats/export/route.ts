import { NextResponse } from "next/server";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requirePlatformPermission, handlePlatformError } from "@/lib/platformAuth";
import { calculatePlatformMRR } from "@/lib/platform-finance";

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export async function GET(req: Request) {
  try {
    await requirePlatformPermission("platform.billing.read", req);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const mrrStats = await calculatePlatformMRR();

    const [monthPayments, yearPayments, monthExpenses, yearExpenses] = await Promise.all([
      db.platformPayment.aggregate({
        where: { paidAt: { gte: startOfMonth }, status: { in: ["PAID", "REFUNDED"] } },
        _sum: { amount: true, refundAmount: true },
      }),
      db.platformPayment.aggregate({
        where: { paidAt: { gte: startOfYear }, status: { in: ["PAID", "REFUNDED"] } },
        _sum: { amount: true, refundAmount: true },
      }),
      db.platformExpense.aggregate({
        where: { date: { gte: startOfMonth }, isReversal: false },
        _sum: { amount: true },
      }),
      db.platformExpense.aggregate({
        where: { date: { gte: startOfYear }, isReversal: false },
        _sum: { amount: true },
      }),
    ]);

    const monthRev = (monthPayments._sum.amount || 0) - (monthPayments._sum.refundAmount || 0);
    const yearRev = (yearPayments._sum.amount || 0) - (yearPayments._sum.refundAmount || 0);
    const monthExp = monthExpenses._sum.amount || 0;
    const yearExp = yearExpenses._sum.amount || 0;

    const overdueSubscriptions = await db.subscription.findMany({
      where: {
        OR: [
          { status: "PAST_DUE" },
          { center: { status: { in: ["OVERDUE", "PAUSED"] } } },
          { currentPeriodEndsAt: { lt: now }, status: { in: ["ACTIVE", "TRIAL"] } },
        ],
      },
      include: {
        center: { select: { name: true, phone: true, email: true, status: true } },
        plan: { select: { name: true, priceMonthly: true } },
      },
    });

    const lines: string[] = [];
    lines.push("ФИНАНСОВЫЙ ОТЧЁТ ПЛАТФОРМЫ");
    lines.push(`Дата выгрузки,${escapeCsv(now.toISOString().slice(0, 10))}`);
    lines.push("");
    lines.push("МЕТРИКА,ЗНАЧЕНИЕ (UZS)");
    lines.push(`MRR (Ежемесячная регулярная выручка),${mrrStats.mrr}`);
    lines.push(`ARR (Годовая регулярная выручка),${mrrStats.arr}`);
    lines.push(`ARPU (Средний чек на активный центр),${mrrStats.arpu}`);
    lines.push(`Активных подписок,${mrrStats.activeSubscriptionsCount}`);
    lines.push(`Выручка за текущий месяц,${monthRev}`);
    lines.push(`Расходы за текущий месяц,${monthExp}`);
    lines.push(`Прибыль за текущий месяц,${monthRev - monthExp}`);
    lines.push(`Выручка за текущий год,${yearRev}`);
    lines.push(`Расходы за текущий год,${yearExp}`);
    lines.push(`Прибыль за текущий год,${yearRev - yearExp}`);
    lines.push("");
    lines.push("СПИСОК ДЕБИТОРОВ (ЗАДОЛЖЕННОСТЬ ПО ПОДПИСКЕ)");
    lines.push("Учебный центр,Телефон,Email,Тариф,Сумма к оплате (UZS),Дата окончания,Дней просрочки,Статус центра");

    for (const sub of overdueSubscriptions) {
      const days = Math.max(0, Math.floor((now.getTime() - sub.currentPeriodEndsAt.getTime()) / (1000 * 60 * 60 * 24)));
      lines.push([
        escapeCsv(sub.center.name),
        escapeCsv(sub.center.phone || "—"),
        escapeCsv(sub.center.email || "—"),
        escapeCsv(sub.plan.name),
        escapeCsv(Math.round(sub.plan.priceMonthly)),
        escapeCsv(sub.currentPeriodEndsAt.toISOString().slice(0, 10)),
        escapeCsv(days),
        escapeCsv(sub.center.status),
      ].join(","));
    }

    const csvContent = "\uFEFF" + lines.join("\r\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="platform-finance-report-${now.toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err) {
    return handlePlatformError(err);
  }
}
