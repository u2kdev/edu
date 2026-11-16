"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Building2, CheckCircle2, Download, User, XCircle } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  type DataTableColumn,
  FilterBar,
  PageHeader,
} from "@/components/ui";
import { t } from "@/i18n";

interface RegistrationItem {
  id: string;
  kind: "USER" | "CENTER";
  name: string;
  email: string | null;
  phone: string | null;
  role?: string;
  centerName?: string;
  centerSlug?: string;
  emailVerified: boolean;
  createdAt: string;
}

export default function PlatformRegistrationsPage() {
  const [items, setItems] = useState<RegistrationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [type, setType] = useState("ALL");
  const [emailVerified, setEmailVerified] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchRegistrations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        page: page.toString(),
        limit: "25",
        ...(search && { search }),
        ...(type !== "ALL" && { type }),
        ...(emailVerified !== "ALL" && { emailVerified }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
      });
      const res = await fetch(`/api/platform/registrations?${q}`);
      const data = await res.json();
      if (data.success) {
        setItems(data.registrations || []);
        setTotalPages(data.pagination?.totalPages || 1);
      } else {
        setError(data.error || "Не удалось загрузить данные регистраций");
      }
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }, [page, search, type, emailVerified, dateFrom, dateTo]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  const exportUrl = `/api/platform/registrations/export?${new URLSearchParams({
    ...(search && { search }),
    ...(type !== "ALL" && { type }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
  }).toString()}`;

  const columns: DataTableColumn<RegistrationItem>[] = [
    {
      id: "kind",
      header: "Тип",
      cell: (it) =>
        it.kind === "CENTER" ? (
          <Badge variant="primary">
            <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Центр</span>
          </Badge>
        ) : (
          <Badge variant="neutral">
            <User className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Пользователь</span>
          </Badge>
        ),
    },
    {
      id: "name",
      header: "Имя / Название",
      isMobilePrimary: true,
      sortable: true,
      sortValue: (it) => it.name,
      cell: (it) => (
        <div>
          <Link
            href={
              it.kind === "CENTER"
                ? `/platform-admin/centers/${it.id}`
                : `/platform-admin/users/${it.id}`
            }
            className="font-medium text-foreground hover:text-primary block"
          >
            {it.name}
          </Link>
          {it.centerSlug && (
            <div className="mt-0.5 font-mono text-xs text-muted-foreground">{it.centerSlug}</div>
          )}
        </div>
      ),
    },
    {
      id: "contacts",
      header: "Контакты",
      cell: (it) => (
        <div className="text-xs">
          <div className="text-foreground">{it.email || "—"}</div>
          {it.phone && <div className="mt-0.5 text-muted-foreground tabular-nums">{it.phone}</div>}
        </div>
      ),
    },
    {
      id: "role",
      header: "Роль / Привязка",
      cell: (it) => (
        <div className="text-xs">
          <div className="font-medium text-foreground">{it.role || "—"}</div>
          {it.centerName && <div className="mt-0.5 text-muted-foreground">{it.centerName}</div>}
        </div>
      ),
    },
    {
      id: "verified",
      header: "Email подтверждён",
      align: "center",
      cell: (it) =>
        it.emailVerified ? (
          <Badge variant="success">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Да</span>
          </Badge>
        ) : (
          <Badge variant="neutral">
            <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Нет</span>
          </Badge>
        ),
    },
    {
      id: "createdAt",
      header: "Дата регистрации",
      align: "right",
      sortable: true,
      sortValue: (it) => it.createdAt,
      cell: (it) => (
        <div className="text-xs tabular-nums">
          <div className="font-medium text-foreground">
            {new Date(it.createdAt).toLocaleDateString()}
          </div>
          <div className="mt-0.5 text-muted-foreground">
            {new Date(it.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      ),
    },
  ];

  const hasFilters = Boolean(search || type !== "ALL" || emailVerified !== "ALL" || dateFrom || dateTo);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Регистрации на платформе"
        description="Хронология создания новых аккаунтов пользователей и регистрации учебных центров"
        actions={
          <Button asChild variant="outline" size="sm">
            <a href={exportUrl} download>
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Экспорт CSV</span>
            </a>
          </Button>
        }
      />

      <FilterBar
        search={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        searchPlaceholder="ФИО, название центра, email, телефон..."
        hasActiveFilters={hasFilters}
        onReset={() => {
          setSearch("");
          setType("ALL");
          setEmailVerified("ALL");
          setDateFrom("");
          setDateTo("");
          setPage(1);
        }}
      >
        <select
          aria-label="Тип объекта"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="ALL">Все объекты (пользователи и центры)</option>
          <option value="USERS">Только пользователи</option>
          <option value="CENTERS">Только учебные центры</option>
        </select>

        <select
          aria-label="Статус email"
          value={emailVerified}
          onChange={(e) => {
            setEmailVerified(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="ALL">Email: все</option>
          <option value="VERIFIED">Email подтверждён</option>
          <option value="UNVERIFIED">Email не подтверждён</option>
        </select>

        <div className="flex items-center gap-1.5">
          <input
            aria-label="С даты"
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-md border border-input bg-background px-2.5 text-xs text-foreground"
          />
          <span className="text-xs text-muted-foreground">—</span>
          <input
            aria-label="По дату"
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-md border border-input bg-background px-2.5 text-xs text-foreground"
          />
        </div>
      </FilterBar>

      <DataTable
        data={items}
        columns={columns}
        getRowId={(it) => `${it.kind}-${it.id}`}
        loading={loading}
        error={error}
        onRetry={fetchRegistrations}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        getRowHref={(it) =>
          it.kind === "CENTER"
            ? `/platform-admin/centers/${it.id}`
            : `/platform-admin/users/${it.id}`
        }
        emptyTitle="Регистраций не найдено"
        emptyDescription={t("ru", "ui4.emptyRegistrationsDesc")}
        emptyAction={
          hasFilters ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setType("ALL");
                setEmailVerified("ALL");
                setDateFrom("");
                setDateTo("");
                setPage(1);
              }}
            >
              {t("ru", "ui4.resetFilters")}
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
