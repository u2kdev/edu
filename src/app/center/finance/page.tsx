import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireTenantPageAccess } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { getCenterPlanFeatures } from "@/lib/plan-features";
import { calculateAccountBalance } from "@/lib/finance";
import { calculateCenterStudentBalances } from "@/lib/billing";
import { getCenterFinanceAnalytics } from "@/lib/finance-analytics";
import { t } from "@/i18n";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import CenterFinanceManager, {
  AccountItem,
  CategoryItem,
  TransactionItem,
  StudentDebtItem,
  PeriodItem,
  SalaryRateItem,
} from "@/components/finance/CenterFinanceManager";

export const dynamic = "force-dynamic";

export default async function CenterFinancePage() {
  const tenantCtx = await requireTenantPageAccess();
  const actorRole = tenantCtx.membership?.role;
  const locale = tenantCtx.session.user.preferredLanguage || "ru";

  const canRead =
    actorRole === "DIRECTOR" ||
    actorRole === "CENTER_ADMIN" ||
    actorRole === "ACCOUNTANT" ||
    hasPermission("finance.read", tenantCtx.session.user.platformRole, actorRole);

  if (!canRead) {
    redirect("/center");
  }

  const isDirector = actorRole === "DIRECTOR";
  const canWrite =
    isDirector ||
    actorRole === "CENTER_ADMIN" ||
    actorRole === "ACCOUNTANT" ||
    hasPermission("finance.write", tenantCtx.session.user.platformRole, actorRole);

  const tenantDb = tenantCtx.getTenantDb();
  const centerId = tenantCtx.center.id;

  const rawAccounts = await tenantDb.account.findMany({
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  const accounts: AccountItem[] = await Promise.all(
    rawAccounts.map(async (acc) => {
      const balance = await calculateAccountBalance(centerId, acc.id);
      return {
        id: acc.id,
        name: acc.name,
        type: acc.type,
        currency: acc.currency,
        balance,
        isDefault: acc.isDefault,
        isActive: acc.isActive,
      };
    })
  );

  const rawCategories = await tenantDb.financeCategory.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
  const categories: CategoryItem[] = rawCategories.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    isActive: c.isActive,
  }));

  const rawTransactions = await tenantDb.financeTransaction.findMany({
    include: {
      account: { select: { name: true, type: true } },
      targetAccount: { select: { name: true } },
      category: { select: { name: true } },
    },
    orderBy: { date: "desc" },
    take: 100,
  });

  const transactions: TransactionItem[] = rawTransactions.map((tx) => ({
    id: tx.id,
    type: tx.type,
    amount: tx.amount,
    currency: tx.currency,
    date: tx.date.toISOString(),
    description: tx.description,
    counterparty: tx.counterparty,
    accountId: tx.accountId,
    targetAccountId: tx.targetAccountId,
    categoryId: tx.categoryId,
    isReversal: tx.isReversal,
    reversalReason: tx.reversalReason,
    account: tx.account ? { name: tx.account.name, type: tx.account.type } : undefined,
    targetAccount: tx.targetAccount ? { name: tx.targetAccount.name } : undefined,
    category: tx.category ? { name: tx.category.name } : undefined,
  }));

  const unifiedBalances = await calculateCenterStudentBalances({ centerId });
  const debts: StudentDebtItem[] = unifiedBalances.slice(0, 50).map((b) => ({
    studentId: b.studentMembershipId,
    fullName: b.fullName,
    phone: b.phone,
    email: b.email,
    monthlyTuition: b.monthlyTuition,
    totalDue: b.totalAccrued,
    totalPaid: b.totalPaid,
    balance: b.balance,
    debtAmount: b.debtAmount,
    status: b.status,
    paidUntil: b.earliestPaidUntil,
    enrollments: b.enrollments.map((e) => ({
      groupName: e.groupName,
      courseTitle: e.courseTitle,
      status: e.status,
      paidUntil: e.paidUntil,
    })),
  }));

  const rawPeriods = await tenantDb.financePeriod.findMany({
    include: {
      closedBy: { select: { user: { select: { fullName: true } } } },
    },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
  const periods: PeriodItem[] = rawPeriods.map((p) => ({
    id: p.id,
    year: p.year,
    month: p.month,
    startDate: p.startDate.toISOString(),
    endDate: p.endDate.toISOString(),
    status: p.status,
    closedAt: p.closedAt ? p.closedAt.toISOString() : null,
    closedBy: p.closedBy,
  }));

  const [rawSalaryRates, planCtx, financeAnalytics] = await Promise.all([
    tenantDb.teacherSalaryRate.findMany({
      include: {
        teacher: { select: { user: { select: { fullName: true, email: true } } } },
        group: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    getCenterPlanFeatures(centerId),
    getCenterFinanceAnalytics({ centerId, period: "30d" }),
  ]);

  const financeLocked = !planCtx.features.financeAccounting;
  const canExportCsv = Boolean(planCtx.features.advancedReports);
  const salaryRates: SalaryRateItem[] = rawSalaryRates.map((r) => ({
    id: r.id,
    rateType: r.rateType,
    amount: r.amount,
    teacher: r.teacher,
    group: r.group,
  }));

  return (
    <div className="space-y-4">
      {financeLocked && (
        <Alert variant="warning">
          <AlertTitle>{t(locale, "finance.title")}</AlertTitle>
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>{t(locale, "nav.upgradePlan")}</span>
            <Button asChild size="sm" variant="outline">
              <Link href="/center/upgrade">{t(locale, "nav.upgradePlan")}</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <Suspense fallback={null}>
        <CenterFinanceManager
          initialAccounts={accounts}
          initialCategories={categories}
          initialTransactions={transactions}
          initialDebts={debts}
          initialPeriods={periods}
          initialSalaryRates={salaryRates}
          initialAnalytics={financeAnalytics}
          canExport={canExportCsv}
          canWrite={canWrite && !financeLocked}
          isDirector={isDirector}
          locale={locale}
        />
      </Suspense>
    </div>
  );
}
