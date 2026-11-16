import { getAuthSession } from "@/lib/auth";
// Reason: Exception: Platform dashboard summarizes global tenant counts for quick actions.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { t, formatDateLocalized } from "@/i18n";
import ImpersonateButton from "@/components/ImpersonateButton";
import PlatformDashboardInteractive from "@/components/platform/PlatformDashboardInteractive";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function PlatformAdminDashboard() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const locale = session.user.preferredLanguage || "ru";
  const isFullAccess = session.user.platformRole === "FULL_ACCESS";
  const emailMisconfigured =
    (process.env.EMAIL_PROVIDER || "memory").toLowerCase() === "memory" &&
    process.env.NODE_ENV === "production";

  const [expiringSubscriptions, recentCenters] = await Promise.all([
    db.subscription.findMany({
      where: {
        currentPeriodEndsAt: {
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        center: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            owner: { select: { fullName: true, email: true } },
          },
        },
        plan: true,
      },
      take: 5,
    }),
    db.learningCenter.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { id: true, fullName: true, email: true } },
        subscriptions: {
          include: { plan: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: {
          select: {
            memberships: true,
            courses: true,
          },
        },
      },
    }),
  ]);

  const statusBadgeVariant = (status: string): "success" | "info" | "warning" | "destructive" | "neutral" => {
    if (status === "ACTIVE") return "success";
    if (status === "TRIAL") return "info";
    if (status === "PAUSED" || status === "OVERDUE") return "warning";
    if (status === "BLOCKED") return "destructive";
    return "neutral";
  };

  const statusLabel = (status: string): string => {
    const keyMap: Record<string, string> = {
      ACTIVE: "platform.active",
      TRIAL: "platform.trial",
      PAUSED: "platform.paused",
      OVERDUE: "platform.overdue",
      BLOCKED: "platform.blocked",
      CANCELLED: "platform.cancelled",
    };
    return keyMap[status] ? t(locale, keyMap[status]) : status;
  };

  return (
    <div className="space-y-6">
      {emailMisconfigured && (
        <Alert variant="destructive">
          <AlertTitle>{t(locale, "ui3.platformHealthMail")}</AlertTitle>
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>EMAIL_PROVIDER=memory</span>
            <Button asChild size="sm" variant="destructive">
              <Link href="/platform-admin/system-health">{t(locale, "nav.systemHealth")}</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isFullAccess && (
        <Alert variant="info">
          <AlertTitle>FULL_ACCESS</AlertTitle>
          <AlertDescription>{t(locale, "ui3.platformOverviewSubtitle")}</AlertDescription>
        </Alert>
      )}

      <PlatformDashboardInteractive locale={locale} />

      {/* Expiring Subscriptions Quick Table */}
      {expiringSubscriptions.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle>{t(locale, "subscription.title")}</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href="/platform-admin/subscriptions">{t(locale, "platform.subscriptions")}</Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t(locale, "platform.centerName")}</TableHead>
                  <TableHead>{t(locale, "platform.selectPlan")}</TableHead>
                  <TableHead>{t(locale, "subscription.activeUntil")}</TableHead>
                  <TableHead className="text-right">{t(locale, "ui3.attentionAction")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expiringSubscriptions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium text-foreground">{sub.center.name}</TableCell>
                    <TableCell className="text-muted-foreground">{sub.plan.name}</TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {formatDateLocalized(sub.currentPeriodEndsAt, locale)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/platform-admin/centers/${sub.center.id}`}>{t(locale, "dashboard.moreDetails")}</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent Centers Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle>{t(locale, "ui3.platformRecentCenters")}</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href="/platform-admin/centers">{t(locale, "platform.centerManagement")}</Link>
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {recentCenters.length === 0 ? (
            <EmptyState title={t(locale, "ui3.emptyPeriod")} locale={locale} className="py-6" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t(locale, "platform.centerName")}</TableHead>
                  <TableHead>{t(locale, "platform.directorName")}</TableHead>
                  <TableHead>{t(locale, "platform.centerStatus")}</TableHead>
                  <TableHead>{t(locale, "platform.selectPlan")}</TableHead>
                  <TableHead className="text-right">{t(locale, "common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentCenters.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.slug}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-foreground">{c.owner?.fullName || "—"}</div>
                      <div className="text-xs text-muted-foreground">{c.owner?.email || "—"}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(c.status)}>{statusLabel(c.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.subscriptions[0]?.plan?.name || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-2">
                        {c.owner?.id && (
                          <ImpersonateButton
                            targetUserId={c.owner.id}
                            targetCenterId={c.id}
                            label={t(locale, "platform.impersonate")}
                          />
                        )}
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/platform-admin/centers/${c.id}`}>
                            {t(locale, "dashboard.moreDetails")}
                          </Link>
                        </Button>
                      </div>
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
