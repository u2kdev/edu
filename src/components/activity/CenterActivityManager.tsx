"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ShieldAlert, LogOut, RefreshCw, Laptop, Smartphone } from "lucide-react";
import { formatDateLocalized } from "@/i18n";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FilterBar } from "@/components/ui/filter-bar";
import { FormActions, FormField } from "@/components/ui/form-field";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Textarea } from "@/components/ui/textarea";

const SELECT_CLS =
  "flex h-9 rounded-md border border-input bg-card px-3 py-1.5 text-[13px] text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background";

interface SessionItem {
  id: string;
  deviceId?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  lastSeenAt: string;
}

interface MemberActivityItem {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role: string;
  memberStatus: string;
  lastLoginAt?: string | null;
  activeSessionsCount: number;
  isOnline: boolean;
  neverLoggedIn: boolean;
  inactiveOver7Days: boolean;
  sessions: SessionItem[];
}

interface ActivitySummary {
  totalMembers: number;
  onlineNow: number;
  hasActiveSessions: number;
  neverLoggedIn: number;
  inactiveOver7Days: number;
}

export function CenterActivityManager({ locale = "ru" }: { locale?: string }) {
  const isUz = locale === "uz" || locale === "uz-Latn";
  const [users, setUsers] = useState<MemberActivityItem[]>([]);
  const [summary, setSummary] = useState<ActivitySummary>({
    totalMembers: 0,
    onlineNow: 0,
    hasActiveSessions: 0,
    neverLoggedIn: 0,
    inactiveOver7Days: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [terminatingUser, setTerminatingUser] = useState<MemberActivityItem | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (roleFilter !== "ALL") params.append("role", roleFilter);
      if (statusFilter !== "ALL") params.append("status", statusFilter);

      const res = await fetch(`/api/tenant/activity?${params.toString()}`);
      if (!res.ok) throw new Error(isUz ? "Maʼlumot yuklab boʻlmadi" : "Не удалось загрузить активность");
      const data = await res.json();
      setUsers(data.users || []);
      if (data.summary) {
        setSummary(data.summary);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter, isUz]);

  useEffect(() => {
    void fetchActivity();
  }, [fetchActivity]);

  const handleRevokeSessions = async () => {
    if (!terminatingUser) return;
    if (revokeReason.trim().length < 5) {
      setActionError(
        isUz
          ? "Sabab kamida 5 ta belgidan iborat boʻlishi kerak"
          : "Причина должна содержать минимум 5 символов"
      );
      return;
    }

    setSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch("/api/tenant/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REVOKE_USER_SESSIONS",
          userId: terminatingUser.userId,
          reason: revokeReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to terminate sessions");

      setActionSuccess(data.message || "Сессии завершены");
      setTerminatingUser(null);
      setRevokeReason("");
      await fetchActivity();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Ошибка завершения сессий");
    } finally {
      setSubmitting(false);
    }
  };

  const getDeviceIcon = (userAgent?: string | null) => {
    const ua = (userAgent || "").toLowerCase();
    if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
      return <Smartphone className="h-3.5 w-3.5 text-info" aria-hidden="true" />;
    }
    return <Laptop className="h-3.5 w-3.5 text-primary" aria-hidden="true" />;
  };

  const columns = useMemo<DataTableColumn<MemberActivityItem>[]>(
    () => [
      {
        id: "user",
        header: isUz ? "Foydalanuvchi" : "Пользователь",
        sortable: true,
        sortValue: (item) => item.fullName,
        cell: (item) => (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold text-foreground">
              {item.fullName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-foreground">{item.fullName}</span>
                {item.isOnline && (
                  <span className="h-2 w-2 rounded-full bg-success" title="Online" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {item.email} {item.phone ? `· ${item.phone}` : ""}
              </p>
            </div>
          </div>
        ),
      },
      {
        id: "role",
        header: isUz ? "Rol" : "Роль",
        cell: (item) => <Badge variant="neutral">{item.role}</Badge>,
      },
      {
        id: "lastLoginAt",
        header: isUz ? "Oxirgi kirish" : "Последний вход",
        cell: (item) =>
          item.lastLoginAt ? (
            <div className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
              <div>{formatDateLocalized(item.lastLoginAt, locale)}</div>
              <div>
                {new Date(item.lastLoginAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          ) : (
            <span className="text-xs italic text-muted-foreground">
              {isUz ? "Hech kirmagan" : "Никогда"}
            </span>
          ),
      },
      {
        id: "sessions",
        header: isUz ? "Faol qurilmalar" : "Сессии и устройства",
        cell: (item) =>
          item.sessions.length > 0 ? (
            <div className="space-y-1">
              <Badge variant="primary" className="tabular-nums">
                {item.sessions.length} {isUz ? "ta qurilma" : "активных сессий"}
              </Badge>
              <div className="space-y-0.5">
                {item.sessions.slice(0, 2).map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground tabular-nums"
                  >
                    {getDeviceIcon(s.userAgent)}
                    <span>{s.ipAddress || "local"}</span>
                    <span>
                      (
                      {new Date(s.lastSeenAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      )
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        id: "actions",
        header: isUz ? "Amallar" : "Действия",
        align: "right",
        cell: (item) =>
          item.activeSessionsCount > 0 ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                setActionError(null);
                setTerminatingUser(item);
                setRevokeReason("Завершено директором центра в целях безопасности");
              }}
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isUz ? "Sessiyalarni yopish" : "Завершить сессии"}</span>
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
    ],
    [isUz, locale]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={isUz ? "Foydalanuvchilar faolligi va sessiyalar" : "Активность людей и сессии"}
        description={
          isUz
            ? "Tizimga kirish tarixi, faol qurilmalar va xavfsiz sessiyalarni boshqarish"
            : "История входов, мониторинг активных устройств и принудительное завершение сессий"
        }
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void fetchActivity()}
            title="Обновить"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin text-primary" : ""}`}
              aria-hidden="true"
            />
            <span>{isUz ? "Yangilash" : "Обновить"}</span>
          </Button>
        }
      />

      {actionSuccess && (
        <Alert variant="success">
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>{actionSuccess}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setActionSuccess(null)}
            >
              Закрыть
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label={isUz ? "Jami aʼzolar" : "Всего пользователей"}
          value={summary.totalMembers}
        />
        <StatCard
          label={isUz ? "Hozir tarmoqda" : "Сейчас онлайн"}
          value={summary.onlineNow}
        />
        <StatCard
          label={isUz ? "Faol sessiyalar" : "Активные сессии"}
          value={summary.hasActiveSessions}
        />
        <StatCard
          label={isUz ? "7 kundan beri kirmagan" : "Не заходили > 7 дн."}
          value={summary.inactiveOver7Days}
        />
        <StatCard
          label={isUz ? "Hech kirmagan" : "Никогда не входили"}
          value={summary.neverLoggedIn}
        />
      </div>

      <FilterBar
        locale={locale}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={
          isUz ? "Ism, email yoki telefon boʻyicha..." : "Поиск по имени, email, телефону..."
        }
        hasActiveFilters={Boolean(search || roleFilter !== "ALL" || statusFilter !== "ALL")}
        onReset={() => {
          setSearch("");
          setRoleFilter("ALL");
          setStatusFilter("ALL");
        }}
      >
        <select
          aria-label={isUz ? "Rol" : "Роль"}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className={SELECT_CLS}
        >
          <option value="ALL">{isUz ? "Barcha rollar" : "Все роли"}</option>
          <option value="DIRECTOR">{isUz ? "Direktor" : "Директор"}</option>
          <option value="CENTER_ADMIN">{isUz ? "Administrator" : "Администратор"}</option>
          <option value="TEACHER">{isUz ? "Oʻqituvchi" : "Учитель"}</option>
          <option value="STUDENT">{isUz ? "Oʻquvchi" : "Ученик"}</option>
          <option value="PARENT">{isUz ? "Ota-ona" : "Родитель"}</option>
        </select>

        <select
          aria-label={isUz ? "Holat" : "Статус"}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={SELECT_CLS}
        >
          <option value="ALL">{isUz ? "Barcha statuslar" : "Все статусы"}</option>
          <option value="ONLINE">{isUz ? "Faqat faol sessiyalar" : "Только с активными сессиями"}</option>
          <option value="INACTIVE_7D">{isUz ? "7 kundan ortiq nofaol" : "Не заходили более 7 дней"}</option>
          <option value="NEVER">{isUz ? "Hech qachon kirmagan" : "Никогда не входили"}</option>
        </select>
      </FilterBar>

      <DataTable
        data={users}
        columns={columns}
        getRowId={(item) => item.id}
        locale={locale}
        loading={loading && users.length === 0}
        error={loadError}
        onRetry={() => void fetchActivity()}
        emptyTitle={isUz ? "Foydalanuvchilar topilmadi" : "Пользователи не найдены"}
        mobileCardRender={(item) => (
          <div className="space-y-2 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium text-foreground">{item.fullName}</div>
                <div className="text-muted-foreground">{item.email}</div>
              </div>
              <Badge variant="neutral">{item.role}</Badge>
            </div>
            <div className="flex items-center justify-between gap-2 text-muted-foreground tabular-nums">
              <span>
                {item.lastLoginAt ? formatDateLocalized(item.lastLoginAt, locale) : "Никогда"}
              </span>
              {item.sessions.length > 0 && (
                <Badge variant="primary">{item.sessions.length} сессий</Badge>
              )}
            </div>
            {item.activeSessionsCount > 0 && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  setActionError(null);
                  setTerminatingUser(item);
                  setRevokeReason("Завершено директором центра в целях безопасности");
                }}
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{isUz ? "Sessiyalarni yopish" : "Завершить сессии"}</span>
              </Button>
            )}
          </div>
        )}
      />

      <Dialog
        open={Boolean(terminatingUser)}
        onOpenChange={(open) => !open && setTerminatingUser(null)}
      >
        <DialogContent className="max-w-md">
          {terminatingUser && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-destructive" aria-hidden="true" />
                  <span>
                    {isUz ? "Sessiyalarni yakunlash" : "Завершение сессий пользователя"}
                  </span>
                </DialogTitle>
              </DialogHeader>

              <p className="text-xs text-muted-foreground">
                {isUz
                  ? `Haqiqatan ham ${terminatingUser.fullName} foydalanuvchisining barcha faol qurilmalaridagi sessiyalarini yakunlamoqchimisiz?`
                  : `Вы действительно хотите принудительно завершить все ${terminatingUser.activeSessionsCount} активных сессий пользователя ${terminatingUser.fullName}? Все открытые вкладки и приложения будут деавторизованы.`}
              </p>

              {actionError && (
                <Alert variant="destructive">
                  <AlertDescription>{actionError}</AlertDescription>
                </Alert>
              )}

              <FormField
                label={
                  isUz
                    ? "Majburiy sabab (kamida 5 belgi)"
                    : "Причина действия (мин. 5 символов)"
                }
                htmlFor="revoke-reason"
                required
              >
                <Textarea
                  id="revoke-reason"
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  rows={3}
                  placeholder={isUz ? "Sababni kiriting..." : "Укажите причину для журнала аудита..."}
                />
              </FormField>

              <FormActions>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTerminatingUser(null)}
                  disabled={submitting}
                >
                  {isUz ? "Bekor qilish" : "Отмена"}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={submitting}
                  onClick={handleRevokeSessions}
                >
                  {submitting
                    ? isUz
                      ? "Bajarilmoqda..."
                      : "Завершение..."
                    : isUz
                    ? "Sessiyalarni yopish"
                    : "Завершить сессии"}
                </Button>
              </FormActions>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
