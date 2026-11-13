import { redirect } from "next/navigation";
import { requireTenantPageAccess } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { calculateAccountBalance } from "@/lib/finance";
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

  // 1. Accounts with dynamic balances
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

  // 2. Categories
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

  // 3. Transactions
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

  // 4. Student Debts
  const rawStudents = await tenantDb.centerMembership.findMany({
    where: { role: "STUDENT", status: "ACTIVE" },
    include: {
      user: { select: { fullName: true, phone: true, email: true } },
      enrollments: {
        where: { status: "ACTIVE" },
        include: {
          group: {
            include: {
              course: { select: { title: true, priceMonthly: true } },
            },
          },
        },
      },
      payments: {
        where: { status: { in: ["PAID", "PARTIALLY_PAID"] } },
        select: { amount: true },
      },
    },
    take: 50,
  });

  const now = new Date();
  const debts: StudentDebtItem[] = rawStudents.map((s) => {
    const monthlyTuition = s.enrollments.reduce(
      (sum, e) => sum + (e.group.course?.priceMonthly || 0),
      0
    );
    const joinedDate = new Date(s.joinedAt);
    const monthsEnrolled = Math.max(
      1,
      (now.getFullYear() - joinedDate.getFullYear()) * 12 +
        (now.getMonth() - joinedDate.getMonth()) +
        1
    );
    const totalDue = monthlyTuition * monthsEnrolled;
    const totalPaid = s.payments.reduce((sum, p) => sum + Math.round(p.amount), 0);
    const balance = totalPaid - totalDue;
    const debtAmount = balance < 0 ? Math.abs(balance) : 0;
    let status: "DEBT" | "PAID" | "OVERPAID" = "PAID";
    if (balance < 0) status = "DEBT";
    else if (balance > 0) status = "OVERPAID";

    return {
      studentId: s.id,
      fullName: s.user.fullName,
      phone: s.user.phone,
      email: s.user.email,
      monthlyTuition,
      totalDue,
      totalPaid,
      balance,
      debtAmount,
      status,
      enrollments: s.enrollments.map((e) => ({
        groupName: e.group.name,
        courseTitle: e.group.course?.title,
      })),
    };
  });

  // 5. Periods
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

  // 6. Salary Rates
  const rawSalaryRates = await tenantDb.teacherSalaryRate.findMany({
    include: {
      teacher: { select: { user: { select: { fullName: true, email: true } } } },
      group: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const salaryRates: SalaryRateItem[] = rawSalaryRates.map((r) => ({
    id: r.id,
    rateType: r.rateType,
    amount: r.amount,
    teacher: r.teacher,
    group: r.group,
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <CenterFinanceManager
        initialAccounts={accounts}
        initialCategories={categories}
        initialTransactions={transactions}
        initialDebts={debts}
        initialPeriods={periods}
        initialSalaryRates={salaryRates}
        canWrite={canWrite}
        isDirector={isDirector}
      />
    </div>
  );
}
