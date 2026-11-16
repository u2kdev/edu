"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Building2, Download, Plus } from "lucide-react";
import ImpersonateButton from "@/components/ImpersonateButton";
import {
  Badge,
  type BadgeVariant,
  Button,
  DataTable,
  type DataTableColumn,
  FilterBar,
  PageHeader,
} from "@/components/ui";
import { t } from "@/i18n";

interface CenterListItem {
  id: string;
  name: string;
  slug: string;
  email?: string | null;
  phone?: string | null;
  status: string;
  organizationKind?: "LEARNING_CENTER" | "SCHOOL" | "KINDERGARTEN" | "OTHER" | null;
  owner?: { id: string; fullName: string; email: string } | null;
}

const STATUS_VARIANTS: Record<string, { variant: BadgeVariant; label?: string }> = {
  ACTIVE: { variant: "success" },
  TRIAL: { variant: "info" },
  PAUSED: { variant: "warning" },
  BLOCKED: { variant: "destructive" },
  CANCELLED: { variant: "neutral", label: "CANCELLED" },
};

const KIND_LABELS: Record<string, { label: string; variant: BadgeVariant }> = {
  LEARNING_CENTER: { label: "Учебный центр", variant: "primary" },
  SCHOOL: { label: "Школа", variant: "info" },
  KINDERGARTEN: { label: "Детский сад", variant: "success" },
  OTHER: { label: "Другое", variant: "neutral" },
};

export default function PlatformCentersPage() {
  const [centers, setCenters] = useState<CenterListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [organizationKind, setOrganizationKind] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchCenters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        ...(debouncedSearch && { q: debouncedSearch }),
        ...(status && { status }),
        ...(organizationKind && { organizationKind }),
      });
      const res = await fetch(`/api/platform/centers?${query}`);
      if (!res.ok) throw new Error("Не удалось загрузить список центров");
      const json = await res.json();
      setCenters(json.items || json.data || []);
      setTotalPages(Math.ceil((json.total || 0) / (json.pageSize || 10)) || json.meta?.totalPages || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, status, organizationKind]);

  useEffect(() => {
    fetchCenters();
  }, [fetchCenters]);

  const columns: DataTableColumn<CenterListItem>[] = [
    {
      id: "organization",
      header: "Организация",
      isMobilePrimary: true,
      sortable: true,
      sortValue: (c) => c.name,
      cell: (center) => {
        const kind = center.organizationKind ? KIND_LABELS[center.organizationKind] : null;
        return (
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/platform-admin/centers/${center.id}`}
                className="font-medium text-foreground hover:text-primary transition-colors"
              >
                {center.name}
              </Link>
              {kind && <Badge variant={kind.variant}>{kind.label}</Badge>}
            </div>
            <div className="mt-0.5 font-mono text-xs text-muted-foreground">{center.slug}</div>
          </div>
        );
      },
    },
    {
      id: "contacts",
      header: "Контакты",
      cell: (center) => (
        <div className="space-y-0.5 text-sm">
          <div className="text-foreground">{center.email || "—"}</div>
          <div className="text-xs text-muted-foreground tabular-nums">{center.phone || "—"}</div>
        </div>
      ),
    },
    {
      id: "status",
      header: "Статус",
      sortable: true,
      sortValue: (c) => c.status,
      cell: (center) => {
        const badge = STATUS_VARIANTS[center.status] || { variant: "neutral" as const };
        return <Badge variant={badge.variant}>{center.status}</Badge>;
      },
    },
    {
      id: "actions",
      header: "Действия",
      align: "right",
      hideable: false,
      cell: (center) => (
        <div className="inline-flex items-center justify-end gap-2">
          {center.owner?.id && (
            <ImpersonateButton targetUserId={center.owner.id} targetCenterId={center.id} />
          )}
          <Button asChild variant="outline" size="sm">
            <Link href={`/platform-admin/centers/${center.id}`}>Карточка</Link>
          </Button>
        </div>
      ),
    },
  ];

  const hasFilters = Boolean(search || status || organizationKind);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Учебные центры"
        description="Управление организациями, статусами доступа и поддержка"
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <a href="/api/platform/centers/export" download>
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Экспорт CSV</span>
              </a>
            </Button>
            <Button asChild variant="primary" size="sm">
              <Link href="/platform-admin/centers/create">
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Добавить центр</span>
              </Link>
            </Button>
          </>
        }
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск по названию, slug или email..."
        hasActiveFilters={hasFilters}
        onReset={() => {
          setSearch("");
          setStatus("");
          setOrganizationKind("");
          setPage(1);
        }}
      >
        <select
          aria-label="Тип организации"
          value={organizationKind}
          onChange={(e) => {
            setOrganizationKind(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Все типы орг-ции</option>
          <option value="LEARNING_CENTER">Учебный центр</option>
          <option value="SCHOOL">Школа</option>
          <option value="KINDERGARTEN">Детский сад</option>
          <option value="OTHER">Другое</option>
        </select>

        <select
          aria-label="Статус центра"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Все статусы</option>
          <option value="ACTIVE">ACTIVE (Активные)</option>
          <option value="TRIAL">TRIAL (Пробный)</option>
          <option value="PAUSED">PAUSED (Замороженные)</option>
          <option value="BLOCKED">BLOCKED (Заблокированные)</option>
          <option value="CANCELLED">CANCELLED (Архив)</option>
        </select>
      </FilterBar>

      <DataTable
        data={centers}
        columns={columns}
        getRowId={(c) => c.id}
        loading={loading}
        loadingLabel="Загрузка списка учебных центров..."
        error={error}
        onRetry={fetchCenters}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        getRowHref={(c) => `/platform-admin/centers/${c.id}`}
        emptyTitle="Центры не найдены"
        emptyDescription={t("ru", "ui4.emptyCentersDesc")}
        emptyAction={
          <div className="flex flex-wrap items-center justify-center gap-2">
            {hasFilters && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setStatus("");
                  setOrganizationKind("");
                  setPage(1);
                }}
              >
                {t("ru", "ui4.resetFilters")}
              </Button>
            )}
            <Button asChild variant="primary" size="sm">
              <Link href="/platform-admin/centers/create">
                <Building2 className="h-4 w-4" aria-hidden="true" />
                <span>Добавить центр</span>
              </Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}
