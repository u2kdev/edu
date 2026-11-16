import { getAuthSession } from "@/lib/auth";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import {
  Card,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import PlatformAuditInteractive from "@/components/platform/PlatformAuditInteractive";

function formatDetails(raw: string | null): string {
  if (!raw) return "—";
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(parsed);
  } catch {
    return raw;
  }
}

export default async function PlatformAuditPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  if (session.user.platformRole !== "SUPERADMIN" && session.user.platformRole !== "DEVELOPER") {
    redirect("/platform-admin");
  }

  const logs = await db.auditLog.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
    include: {
      actor: { select: { id: true, fullName: true, email: true, platformRole: true } },
      center: { select: { id: true, name: true, slug: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Журнал аудита платформы"
        description={`Сквозной протокол действий администраторов, финансовых и системных событий • Всего записей: ${logs.length}`}
      />

      <PlatformAuditInteractive />

      <Card>
        <div className="overflow-x-auto" tabIndex={0}>
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted/60">
              <TableRow>
                <TableHead>Дата и время</TableHead>
                <TableHead>Действие</TableHead>
                <TableHead>Актор</TableHead>
                <TableHead>Центр</TableHead>
                <TableHead>Ресурс</TableHead>
                <TableHead>IP-адрес</TableHead>
                <TableHead>Детали</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Журнал аудита пуст
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => {
                  const centerText = log.center
                    ? `${log.center.name} (${log.center.slug})`
                    : "— (Платформа)";
                  const detailsFormatted = formatDetails(log.detailsJson);

                  return (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground tabular-nums">
                        {new Date(log.createdAt).toLocaleString("ru-RU")}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{log.action}</TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium text-foreground">
                          {log.actor?.fullName || "Система"}
                        </div>
                        {log.actor?.email && (
                          <div className="text-muted-foreground">{log.actor.email}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{centerText}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {log.resource}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {log.ipAddress || "—"}
                      </TableCell>
                      <TableCell className="max-w-xs truncate font-mono text-xs text-muted-foreground">
                        {detailsFormatted}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
