"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Database, Mail, RefreshCw, Server } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  Skeleton,
} from "@/components/ui";

interface HealthData {
  dbStatus: string;
  dbPingMs: number;
  email: {
    provider: string;
    isConfigured: boolean;
    warning?: string | null;
  };
  cron: {
    lastEmailRunAt?: string | null;
    schedule: string;
  };
  queue: {
    pending: number;
    failed: number;
    sent: number;
  };
  system: {
    uptimeSeconds: number;
    memoryUsageMb: number;
    heapUsedMb: number;
    environment: string;
  };
}

export default function SystemHealthPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/platform/system/health");
      if (!res.ok) throw new Error("Не удалось загрузить данные о состоянии системы");
      const data = await res.json();
      setHealth(data.health);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка запроса");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days} д. ${hours} ч. ${minutes} мин.`;
    if (hours > 0) return `${hours} ч. ${minutes} мин.`;
    return `${minutes} мин.`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="outline" size="icon" aria-label="Назад">
          <Link href="/platform-admin">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <PageHeader
            title="Состояние системы"
            description="Мониторинг базы данных, почтового сервиса, очереди EmailOutbox и системных ресурсов"
            actions={
              <Button type="button" variant="outline" size="sm" onClick={fetchHealth} disabled={loading}>
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? "animate-spin text-primary" : ""}`}
                  aria-hidden="true"
                />
                <span>Обновить</span>
              </Button>
            }
          />
        </div>
      </div>

      {health?.email.warning && (
        <Alert variant="destructive">
          <AlertTitle>Почта не настроена</AlertTitle>
          <AlertDescription>
            {health.email.warning}. Пользователи не будут получать ссылки для сброса паролей и подтверждения.
          </AlertDescription>
        </Alert>
      )}

      {loading && !health ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : health ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">База данных</CardTitle>
              <Database className="h-4 w-4 text-primary" aria-hidden="true" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant={health.dbStatus === "HEALTHY" ? "success" : "destructive"}>
                  {health.dbStatus}
                </Badge>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  ping: {health.dbPingMs} ms
                </span>
              </div>
              <p className="border-t border-border pt-2 text-xs text-muted-foreground">
                PostgreSQL connection pooler &amp; schema OK
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Почта (Email)</CardTitle>
              <Mail className="h-4 w-4 text-primary" aria-hidden="true" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="font-mono text-sm font-semibold uppercase text-foreground">
                  {health.email.provider}
                </div>
                <span className={`text-xs font-medium ${health.email.isConfigured ? "text-success" : "text-warning"}`}>
                  {health.email.isConfigured ? "Готов к отправке" : "Режим памяти (не для прод)"}
                </span>
              </div>
              <p className="border-t border-border pt-2 text-xs text-muted-foreground">
                Провайдер: Resend / SMTP / Memory
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Очередь Outbox</CardTitle>
              <Clock className="h-4 w-4 text-warning" aria-hidden="true" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
                <div className="rounded-md border border-border bg-muted/40 p-1.5">
                  <div className="text-xs text-muted-foreground">Wait</div>
                  <div className="text-sm font-semibold text-foreground tabular-nums">{health.queue.pending}</div>
                </div>
                <div className="rounded-md border border-destructive/30 bg-destructive-subtle p-1.5">
                  <div className="text-xs text-destructive">Fail</div>
                  <div className="text-sm font-semibold text-destructive tabular-nums">{health.queue.failed}</div>
                </div>
                <div className="rounded-md border border-success/30 bg-success-subtle p-1.5">
                  <div className="text-xs text-success">Sent</div>
                  <div className="text-sm font-semibold text-success tabular-nums">{health.queue.sent}</div>
                </div>
              </div>
              <p className="border-t border-border pt-2 text-xs text-muted-foreground">
                Cron: {health.cron.schedule}{" "}
                {health.cron.lastEmailRunAt
                  ? `(посл: ${new Date(health.cron.lastEmailRunAt).toLocaleTimeString()})`
                  : ""}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Сервер</CardTitle>
              <Server className="h-4 w-4 text-success" aria-hidden="true" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm font-semibold text-foreground tabular-nums">
                  Uptime: {formatUptime(health.system.uptimeSeconds)}
                </div>
                <div className="mt-0.5 font-mono text-xs text-muted-foreground tabular-nums">
                  RAM RSS: {health.system.memoryUsageMb} MB • Heap: {health.system.heapUsedMb} MB
                </div>
              </div>
              <p className="border-t border-border pt-2 font-mono text-xs text-muted-foreground">
                Env: {health.system.environment}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
