import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Download } from "lucide-react";
import { t } from "@/i18n";
import { calculateCenterExpectedMRR, calculateStudentDebtsSummary } from "@/lib/billing";
import { getTashkentMonthBounds, getTashkentYearMonth } from "@/lib/finance";
import { calculateTeacherSalariesReport } from "@/lib/finance-reports";
import { getCenterFinanceAnalytics, type AnalyticsPeriodPreset } from "@/lib/finance-analytics";
import { getCenterPlanFeatures } from "@/lib/plan-features";
import { formatUzs } from "@/lib/money";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CenterFinanceAnalytics } from "@/components/finance/CenterFinanceAnalytics";

export const dynamic = "force-dynamic";

function normalizePeriod(raw?: string): AnalyticsPeriodPreset {
  if (raw === "7d" || raw === "30d" || raw === "90d" || raw === "12m") return raw;
  return "30d";
}

export default async function CenterReportsPage({
  searchParams,
}: {
  searchParams?: { period?: string };
}) {
  const tenantCtx = await requireTenantPageAccess();
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = session.activeCenterId;
  if (!centerId) redirect("/center");

  const role = session.activeCenterRole;
  const canReadReports =
    tenantCtx.isPlatformStaff ||
    role === "DIRECTOR" ||
    role === "CENTER_ADMIN" ||
    role === "ACCOUNTANT" ||
    hasPermission(
      "finance.read",
      session.user.platformRole,
      role,
      tenantCtx.membership?.permissions ?? null
    );

  if (!canReadReports) {
    redirect("/center");
  }

  const locale = session.user.preferredLanguage || "ru";
  const period = normalizePeriod(searchParams?.period);

  const nowYm = getTashkentYearMonth(new Date());
  const { startDate, endDate } = getTashkentMonthBounds(nowYm.year, nowYm.month);
  const periodYm = `${nowYm.year}-${String(nowYm.month).padStart(2, "0")}`;

  const db = tenantCtx.getTenantDb();
  const [
    paidSum,
    ,
    activeStudentsCount,
    expectedMRR,
    debtsResult,
    salaryResult,
    analytics,
    planCtx,
  ] = await Promise.all([
    db.centerPayment.aggregate({
      where: { centerId, status: { in: ["PAID", "PARTIALLY_PAID"] }, deletedAt: null },
      _sum: { amount: true },
      _count: true,
    }),
    db.charge.aggregate({
      where: { centerId, status: { in: ["PENDING", "PARTIAL"] } },
      _sum: { amount: true, paidAmount: true },
      _count: true,
    }),
    db.centerMembership.count({
      where: { centerId, role: "STUDENT", status: "ACTIVE" },
    }),
    calculateCenterExpectedMRR(centerId),
    calculateStudentDebtsSummary(centerId),
    calculateTeacherSalariesReport({ centerId, startDate, endDate }),
    getCenterFinanceAnalytics({ centerId, period }),
    getCenterPlanFeatures(centerId),
  ]);

  const totalDebtDisplay = debtsResult.summary.totalDebt;
  const debtorsList = debtsResult.debts.filter((d) => d.status === "DEBT");

  const teacherMap = new Map<
    string,
    {
      teacherMembershipId: string;
      teacherName: string;
      groupsCount: number;
      conductedLessons: number;
      totalMinutes: number;
      calculatedSalary: number;
      unpaidSalary: number;
    }
  >();
  for (const row of salaryResult.teachers) {
    const existing = teacherMap.get(row.teacherMembershipId) ?? {
      teacherMembershipId: row.teacherMembershipId,
      teacherName: row.teacherName,
      groupsCount: 0,
      conductedLessons: 0,
      totalMinutes: 0,
      calculatedSalary: 0,
      unpaidSalary: 0,
    };
    existing.groupsCount += 1;
    existing.conductedLessons += row.conductedLessonsCount;
    existing.totalMinutes += row.conductedMinutes;
    existing.calculatedSalary += row.calculatedSalary;
    existing.unpaidSalary += row.unpaidSalaryAmount;
    teacherMap.set(row.teacherMembershipId, existing);
  }
  const teacherRows = Array.from(teacherMap.values());
  const canExportCsv = Boolean(planCtx?.features?.advancedReports);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(locale, "nav.reports")}
        description={t(locale, "payments.financialReport")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canExportCsv && (
              <Button asChild variant="outline" size="sm">
                <a href={`/api/finance/export?format=csv&period=${periodYm}`} download>
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t(locale, "ui3.exportCsv")}</span>
                </a>
              </Button>
            )}
            <Button asChild variant="outline" size="sm">
              <Link href="/center/finance">{t(locale, "nav.finance")}</Link>
            </Button>
          </div>
        }
      />

      {/* Cumulative Executive Summary Row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label={t(locale, "payments.totalCollected")}
          value={formatUzs(paidSum._sum.amount || 0, { locale })}
          hint={`${paidSum._count} ${t(locale, "payments.paid").toLowerCase()}`}
        />
        <StatCard
          label={t(locale, "ui3.platformMrr")}
          value={formatUzs(expectedMRR, { locale })}
          hint={`${activeStudentsCount} · ${t(locale, "ui3.kpiActiveStudents")}`}
        />
        <StatCard
          label={t(locale, "payments.totalExpected")}
          value={formatUzs(totalDebtDisplay, { locale })}
          hint={`${debtsResult.summary.debtorsCount} ${t(locale, "payments.debtors").toLowerCase()}`}
          delta={{
            value: `${debtsResult.summary.debtorsCount}`,
            tone: debtsResult.summary.debtorsCount > 0 ? "negative" : "positive",
          }}
        />
      </div>

      {/* Full Financial & Accounting Charts + 5 KPIs + Tables + CSV Export */}
      <CenterFinanceAnalytics
        initialData={analytics}
        locale={locale}
        canExport={canExportCsv}
      />

      {/* Debtors List with 1-Click WhatsApp Reminder */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle>{t(locale, "payments.debtors")}</CardTitle>
          <Badge variant={debtorsList.length > 0 ? "warning" : "success"}>
            {debtorsList.length}
          </Badge>
        </CardHeader>
        <CardContent className="pt-0">
          {debtorsList.length === 0 ? (
            <EmptyState title={t(locale, "common.noData")} locale={locale} className="py-6" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t(locale, "nav.students")}</TableHead>
                  <TableHead>{t(locale, "auth.phone")}</TableHead>
                  <TableHead>{t(locale, "groups.title")}</TableHead>
                  <TableHead className="text-right">{t(locale, "payments.amount")}</TableHead>
                  <TableHead className="text-right">{t(locale, "ui3.attentionAction")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debtorsList.map((d) => {
                  const phoneClean = d.phone ? d.phone.replace(/[^0-9]/g, "") : "";
                  const waText = encodeURIComponent(
                    `Здравствуйте, ${d.fullName}! Напоминаем об оплате обучения на сумму ${d.debtAmount} UZS.`
                  );
                  return (
                    <TableRow key={d.studentId}>
                      <TableCell className="font-medium text-foreground">{d.fullName}</TableCell>
                      <TableCell className="text-muted-foreground">{d.phone || d.email}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {d.enrollments.map((e) => e.groupName).join(", ") || "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-destructive tabular-nums">
                        {formatUzs(d.debtAmount, { locale })}
                      </TableCell>
                      <TableCell className="text-right">
                        {phoneClean ? (
                          <Button asChild variant="outline" size="sm">
                            <a
                              href={`https://wa.me/${phoneClean}?text=${waText}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              WhatsApp
                            </a>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Teacher Hours & Salary Calculation Report */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>
            {t(locale, "ui3.salariesByTeacherTitle")} ({periodYm})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {teacherRows.length === 0 ? (
            <EmptyState title={t(locale, "common.noData")} locale={locale} className="py-6" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t(locale, "schedule.teacher")}</TableHead>
                  <TableHead>{t(locale, "nav.groups")}</TableHead>
                  <TableHead>{t(locale, "ui3.teacherTodayLessonsKpi")}</TableHead>
                  <TableHead>{t(locale, "ui3.teacherMonthlyHoursKpi")}</TableHead>
                  <TableHead className="text-right">{t(locale, "ui3.salaryAccrued")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teacherRows.map((row) => (
                  <TableRow key={row.teacherMembershipId}>
                    <TableCell className="font-medium text-foreground">{row.teacherName}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{row.groupsCount}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{row.conductedLessons}</TableCell>
                    <TableCell className="tabular-nums text-foreground">
                      {t(locale, "lessons.duration", { minutes: row.totalMinutes })} ({(row.totalMinutes / 60).toFixed(1)})
                    </TableCell>
                    <TableCell className="text-right font-medium text-success tabular-nums">
                      {formatUzs(row.calculatedSalary, { locale })} · {formatUzs(row.unpaidSalary, { locale })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
