"use client";

import * as React from "react";
import Link from "next/link";
import { t } from "@/i18n";
import { formatUzs } from "@/lib/money";
import type { StudentPerformanceDTO } from "@/lib/dashboard-analytics";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ParentChildFilterSlot,
  ParentChildSwitcherBar,
} from "@/components/dashboard/ParentChildFilter";
import { AttentionListCard, type AttentionRowItem } from "@/components/dashboard/AttentionListCard";
import { StudentPerformanceView } from "@/components/students/StudentPerformanceView";

export interface ParentChildDashboardEntry {
  studentMembershipId: string;
  fullName: string;
  email: string | null;
  performance: StudentPerformanceDTO;
}

export interface ParentDashboardViewProps {
  childrenData: ParentChildDashboardEntry[];
  initialSelectedChildId?: string | null;
  centerSlug: string;
  locale: string;
}

export function ParentDashboardView({
  childrenData,
  initialSelectedChildId,
  centerSlug,
  locale,
}: ParentDashboardViewProps) {
  const buildChildAttention = (child: ParentChildDashboardEntry): AttentionRowItem[] => {
    const out: AttentionRowItem[] = [];
    for (const al of child.performance.attentionAlerts) {
      if (al.kind === "ABSENCE") {
        out.push({
          id: `${child.studentMembershipId}-absence`,
          severity: al.severity === "destructive" ? "critical" : al.severity,
          title: t(locale, "ui3.parentAttentionAbsences", { count: al.value }),
          actionLabel: t(locale, "ui3.parentCheckAttendance"),
          actionHref: al.href,
        });
      } else if (al.kind === "HOMEWORK_OVERDUE") {
        out.push({
          id: `${child.studentMembershipId}-hw`,
          severity: "warning",
          title: t(locale, "ui3.parentAttentionHomework", { count: al.value }),
          actionLabel: t(locale, "ui3.parentCheckHomework"),
          actionHref: al.href,
        });
      } else if (al.kind === "DEBT") {
        out.push({
          id: `${child.studentMembershipId}-debt`,
          severity: "critical",
          title: t(locale, "ui3.parentAttentionDebt", {
            amount: formatUzs(al.value, { locale }),
          }),
          actionLabel: t(locale, "ui3.parentPayNow"),
          actionHref: al.href,
        });
      } else if (al.kind === "EXPIRING") {
        out.push({
          id: `${child.studentMembershipId}-expiring`,
          severity: "warning",
          title: t(locale, "ui3.parentAttentionExpiring", { days: al.value }),
          actionLabel: t(locale, "ui3.parentPayNow"),
          actionHref: al.href,
        });
      }
    }
    return out;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(locale, "ui3.parentOverviewTitle")}
        description={`${t(locale, "ui3.parentOverviewSubtitle")} (${centerSlug})`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/center/support">{t(locale, "nav.support")}</Link>
          </Button>
        }
      />

      <ParentChildSwitcherBar
        childrenList={childrenData.map((c) => ({
          studentMembershipId: c.studentMembershipId,
          fullName: c.fullName,
        }))}
        locale={locale}
      />

      {childrenData.length === 0 ? (
        <EmptyState
          title={t(locale, "dashboard.parentNoChildrenLinked")}
          description={t(locale, "dashboard.parentLinkHint")}
          locale={locale}
        />
      ) : (
        <div className="space-y-6">
          {childrenData.map((child) => {
            const attentionItems = buildChildAttention(child);
            return (
              <ParentChildFilterSlot
                key={child.studentMembershipId}
                studentMembershipId={child.studentMembershipId}
                initialSelectedChildId={initialSelectedChildId}
              >
                <div className="space-y-5">
                  <Card>
                    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle>{child.fullName}</CardTitle>
                        {child.email && (
                          <p className="text-xs text-muted-foreground mt-0.5">{child.email}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/center/students/${child.studentMembershipId}`}>
                            {t(locale, "ui3.performanceTitle")}
                          </Link>
                        </Button>
                        <Button asChild variant="primary" size="sm">
                          <Link href="/center/payments">{t(locale, "dashboard.parentPayNext")}</Link>
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-5">
                      <AttentionListCard items={attentionItems} locale={locale} />
                      <StudentPerformanceView
                        initialData={child.performance}
                        locale={locale}
                        paymentsHref="/center/payments"
                      />
                    </CardContent>
                  </Card>
                </div>
              </ParentChildFilterSlot>
            );
          })}
        </div>
      )}
    </div>
  );
}
