"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Laptop, Lock, LogOut, RefreshCw, Unlock } from "lucide-react";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  type DataTableColumn,
  PageHeader,
  StatCard,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui";

interface SecurityStats {
  activeSessionsCount: number;
  failedAttemptsCount: number;
  lockedIpsCount: number;
  blockedUsersCount: number;
}

interface ActiveSessionItem {
  id: string;
  userId: string;
  deviceId: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    platformRole: string;
  };
}

interface FailedLoginItem {
  id: string;
  email: string;
  ip: string;
  attempts: number;
  lockoutUntil: string | null;
  updatedAt: string;
}

interface BlockedAccountItem {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  platformRole: string;
  isActive: boolean;
  deletedAt: string | null;
  deletedReason: string | null;
  updatedAt: string;
}

export default function PlatformSecurityPage() {
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [activeSessions, setActiveSessions] = useState<ActiveSessionItem[]>([]);
  const [failedLogins, setFailedLogins] = useState<FailedLoginItem[]>([]);
  const [blockedAccounts, setBlockedAccounts] = useState<BlockedAccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"sessions" | "attempts" | "blocked">("sessions");

  const [pendingRevokeId, setPendingRevokeId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  const fetchSecurityData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/platform/security");
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setActiveSessions(data.activeSessions || []);
        setFailedLogins(data.failedLogins || []);
        setBlockedAccounts(data.blockedAccounts || []);
      } else {
        setError(data.error || "Не удалось загрузить данные безопасности");
      }
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSecurityData();
  }, [fetchSecurityData]);

  const confirmRevokeSession = async () => {
    if (!pendingRevokeId) return;
    setRevokingId(pendingRevokeId);
    setActionError(null);
    try {
      const res = await fetch(`/api/platform/security/sessions/${pendingRevokeId}/revoke`, {
        method: "POST",
      });
      if (res.ok) {
        fetchSecurityData();
      } else {
        const d = await res.json();
        setActionError(d.error || "Ошибка завершения сессии");
      }
    } catch {
      setActionError("Ошибка сети");
    } finally {
      setRevokingId(null);
      setPendingRevokeId(null);
    }
  };

  const handleResetLockout = async (id: string) => {
    setResettingId(id);
    setActionError(null);
    try {
      const res = await fetch("/api/platform/security/reset-lockout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        fetchSecurityData();
      } else {
        const d = await res.json();
        setActionError(d.error || "Ошибка сброса блокировки");
      }
    } catch {
      setActionError("Ошибка сети");
    } finally {
      setResettingId(null);
    }
  };

  const sessionColumns: DataTableColumn<ActiveSessionItem>[] = [
    {
      id: "user",
      header: "Пользователь",
      isMobilePrimary: true,
      cell: (s) => (
        <div>
          <div className="font-medium text-foreground">{s.user.fullName}</div>
          <div className="text-xs text-muted-foreground">{s.user.email}</div>
        </div>
      ),
    },
    {
      id: "ip",
      header: "IP-адрес",
      cell: (s) => <span className="font-mono text-xs text-muted-foreground">{s.ipAddress || "—"}</span>,
    },
    {
      id: "agent",
      header: "Устройство / Браузер",
      hideOnMobile: true,
      cell: (s) => (
        <span className="inline-flex max-w-xs items-center gap-1.5 truncate text-xs text-muted-foreground">
          <Laptop className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{s.userAgent || "—"}</span>
        </span>
      ),
    },
    {
      id: "lastSeen",
      header: "Последняя активность",
      cell: (s) => (
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {new Date(s.lastSeenAt).toLocaleString("ru-RU")}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Действие",
      align: "right",
      hideable: false,
      cell: (s) => (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => setPendingRevokeId(s.id)}
          disabled={revokingId === s.id}
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{revokingId === s.id ? "Выход..." : "Завершить"}</span>
        </Button>
      ),
    },
  ];

  const attemptColumns: DataTableColumn<FailedLoginItem>[] = [
    {
      id: "email",
      header: "Email",
      isMobilePrimary: true,
      cell: (item) => <span className="font-medium text-foreground">{item.email}</span>,
    },
    {
      id: "ip",
      header: "IP-адрес",
      cell: (item) => <span className="font-mono text-xs text-muted-foreground">{item.ip}</span>,
    },
    {
      id: "attempts",
      header: "Ошибок",
      cell: (item) => (
        <Badge variant={item.attempts >= 5 ? "destructive" : "warning"}>{item.attempts}</Badge>
      ),
    },
    {
      id: "status",
      header: "Статус блокировки",
      cell: (item) => {
        const isLocked = item.lockoutUntil && new Date(item.lockoutUntil) > new Date();
        return isLocked ? (
          <Badge variant="destructive">
            <Lock className="h-3 w-3" aria-hidden="true" />
            <span>Заблокирован до {new Date(item.lockoutUntil!).toLocaleTimeString("ru-RU")}</span>
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">Активен</span>
        );
      },
    },
    {
      id: "updatedAt",
      header: "Последняя попытка",
      hideOnMobile: true,
      cell: (item) => (
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {new Date(item.updatedAt).toLocaleString("ru-RU")}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Действие",
      align: "right",
      hideable: false,
      cell: (item) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleResetLockout(item.id)}
          disabled={resettingId === item.id}
        >
          <Unlock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{resettingId === item.id ? "Сброс..." : "Сбросить"}</span>
        </Button>
      ),
    },
  ];

  const blockedColumns: DataTableColumn<BlockedAccountItem>[] = [
    {
      id: "user",
      header: "Пользователь",
      isMobilePrimary: true,
      cell: (acc) => (
        <div>
          <div className="font-medium text-foreground">{acc.fullName}</div>
          <div className="text-xs text-muted-foreground">{acc.email}</div>
        </div>
      ),
    },
    {
      id: "phone",
      header: "Телефон",
      cell: (acc) => <span className="font-mono text-xs text-muted-foreground">{acc.phone || "—"}</span>,
    },
    {
      id: "role",
      header: "Роль платформы",
      cell: (acc) => <span className="text-xs text-muted-foreground">{acc.platformRole}</span>,
    },
    {
      id: "status",
      header: "Статус",
      cell: (acc) =>
        acc.deletedAt ? (
          <Badge variant="neutral">Удалён</Badge>
        ) : (
          <Badge variant="destructive">Заблокирован</Badge>
        ),
    },
    {
      id: "reason",
      header: "Причина блокировки / удаления",
      cell: (acc) => (
        <span className="text-xs text-muted-foreground">{acc.deletedReason || "Не указана"}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Мониторинг безопасности и сессий"
        description="Контроль активных авторизаций, неудачных попыток входа и блокировок"
        actions={
          <Button type="button" variant="outline" size="sm" onClick={fetchSecurityData} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            <span>Обновить</span>
          </Button>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {actionError && (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Активных сессий"
            value={stats.activeSessionsCount}
            hint="Авторизованные браузеры и приложения"
          />
          <StatCard
            label="Неудачных логинов"
            value={stats.failedAttemptsCount}
            hint="Зафиксировано в журнале попыток"
          />
          <StatCard
            label="Временных блокировок IP"
            value={stats.lockedIpsCount}
            hint="Превышен лимит 5 ошибок за 15 мин"
          />
          <StatCard
            label="Заблокировано аккаунтов"
            value={stats.blockedUsersCount}
            hint="Деактивировано или удалено"
          />
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "sessions" | "attempts" | "blocked")}>
        <TabsList>
          <TabsTrigger value="sessions">
            Активные сессии ({activeSessions.length})
          </TabsTrigger>
          <TabsTrigger value="attempts">
            Попытки входа и блокировки ({failedLogins.length})
          </TabsTrigger>
          <TabsTrigger value="blocked">
            Заблокированные аккаунты ({blockedAccounts.length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === "sessions" && (
        <DataTable
          data={activeSessions}
          columns={sessionColumns}
          getRowId={(s) => s.id}
          loading={loading}
          emptyTitle="Нет активных сессий"
        />
      )}

      {activeTab === "attempts" && (
        <DataTable
          data={failedLogins}
          columns={attemptColumns}
          getRowId={(a) => a.id}
          loading={loading}
          emptyTitle="Неудачных попыток входа не зафиксировано"
        />
      )}

      {activeTab === "blocked" && (
        <DataTable
          data={blockedAccounts}
          columns={blockedColumns}
          getRowId={(b) => b.id}
          loading={loading}
          emptyTitle="Заблокированных аккаунтов нет"
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingRevokeId)}
        onOpenChange={(next) => !next && setPendingRevokeId(null)}
        title="Завершить сессию"
        description="Принудительно завершить эту сессию пользователя?"
        variant="destructive"
        loading={Boolean(revokingId)}
        onConfirm={confirmRevokeSession}
      />
    </div>
  );
}
