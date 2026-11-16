"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ClipboardList, Download, Eye, RefreshCw } from "lucide-react";
import { formatDateLocalized } from "@/i18n";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FilterBar } from "@/components/ui/filter-bar";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";

const SELECT_CLS =
  "flex h-9 rounded-md border border-input bg-card px-3 py-1.5 text-[13px] text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background";

interface AuditLogItem {
  id: string;
  action: string;
  resource: string;
  resourceId?: string | null;
  detailsJson?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  actor?: { id: string; fullName: string; email: string } | null;
}

interface FilterOptions {
  actions: string[];
  resources: string[];
  actors: Array<{ id: string; fullName: string; email: string }>;
}

function getActionVariant(action: string): BadgeVariant {
  if (action.includes("CREATE") || action.includes("SUCCESS") || action.includes("FINALIZED")) {
    return "success";
  }
  if (action.includes("UPDATE") || action.includes("EDIT") || action.includes("REORDER")) {
    return "info";
  }
  if (
    action.includes("DELETE") ||
    action.includes("REVOKE") ||
    action.includes("ARCHIVE") ||
    action.includes("FAILED")
  ) {
    return "destructive";
  }
  return "primary";
}

export function CenterAuditManager({ locale = "ru" }: { locale?: string }) {
  const isUz = locale === "uz" || locale === "uz-Latn";
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({ actions: [], resources: [], actors: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [search, setSearch] = useState("");
  const [selectedAction, setSelectedAction] = useState("ALL");
  const [selectedResource, setSelectedResource] = useState("ALL");
  const [selectedActor, setSelectedActor] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [activeLog, setActiveLog] = useState<AuditLogItem | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "25",
      });
      if (search) params.append("search", search);
      if (selectedAction !== "ALL") params.append("action", selectedAction);
      if (selectedResource !== "ALL") params.append("resource", selectedResource);
      if (selectedActor !== "ALL") params.append("actorUserId", selectedActor);
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);

      const res = await fetch(`/api/tenant/audit?${params.toString()}`);
      if (!res.ok) throw new Error(isUz ? "Jurnalni yuklab boʻlmadi" : "Не удалось загрузить журнал аудита");
      const data = await res.json();
      setLogs(data.logs || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalCount(data.pagination?.totalCount || 0);
      if (data.filters) {
        setFilters(data.filters);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedAction, selectedResource, selectedActor, dateFrom, dateTo, isUz]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const handleExportCsv = () => {
    const params = new URLSearchParams({ export: "csv" });
    if (search) params.append("search", search);
    if (selectedAction !== "ALL") params.append("action", selectedAction);
    if (selectedResource !== "ALL") params.append("resource", selectedResource);
    if (selectedActor !== "ALL") params.append("actorUserId", selectedActor);
    if (dateFrom) params.append("dateFrom", dateFrom);
    if (dateTo) params.append("dateTo", dateTo);

    window.open(`/api/tenant/audit?${params.toString()}`, "_blank");
  };

  const hasFilters = Boolean(
    search ||
      selectedAction !== "ALL" ||
      selectedResource !== "ALL" ||
      selectedActor !== "ALL" ||
      dateFrom ||
      dateTo
  );

  const columns = useMemo<DataTableColumn<AuditLogItem>[]>(
    () => [
      {
        id: "createdAt",
        header: isUz ? "Sana va vaqt" : "Время",
        sortable: true,
        sortValue: (item) => new Date(item.createdAt).getTime(),
        cell: (item) => (
          <div className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
            <div>{formatDateLocalized(item.createdAt, locale)}</div>
            <div>
              {new Date(item.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </div>
          </div>
        ),
      },
      {
        id: "actor",
        header: isUz ? "Foydalanuvchi" : "Пользователь",
        cell: (item) =>
          item.actor ? (
            <div>
              <div className="text-xs font-medium text-foreground">{item.actor.fullName}</div>
              <div className="text-xs text-muted-foreground">{item.actor.email}</div>
            </div>
          ) : (
            <span className="text-xs italic text-muted-foreground">System / Cron</span>
          ),
      },
      {
        id: "action",
        header: isUz ? "Amal" : "Действие",
        sortable: true,
        sortValue: (item) => item.action,
        cell: (item) => <Badge variant={getActionVariant(item.action)}>{item.action}</Badge>,
      },
      {
        id: "resource",
        header: isUz ? "Resurs" : "Ресурс",
        cell: (item) => (
          <div>
            <span className="font-mono text-xs text-foreground">{item.resource}</span>
            {item.resourceId && (
              <span className="block max-w-[140px] truncate font-mono text-xs text-muted-foreground">
                {item.resourceId}
              </span>
            )}
          </div>
        ),
      },
      {
        id: "ip",
        header: "IP",
        cell: (item) => (
          <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
            {item.ipAddress || "—"}
          </span>
        ),
      },
      {
        id: "details",
        header: isUz ? "Tafsilotlar" : "Детали",
        align: "right",
        cell: (item) =>
          item.detailsJson ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveLog(item)}
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isUz ? "Koʻrish" : "Инфо"}</span>
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
        title={isUz ? "Markaz harakatlar jurnali" : "Журнал действий центра"}
        description={
          isUz
            ? "Oʻquv markazi xodimlari va foydalanuvchilarining barcha amallari auditi"
            : "Полная история операций и событий пользователей вашего учебного центра"
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void fetchLogs()}
              title="Обновить"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin text-primary" : ""}`}
                aria-hidden="true"
              />
            </Button>
            <Button type="button" size="sm" onClick={handleExportCsv}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isUz ? "CSV yuklab olish" : "Экспорт в CSV"}</span>
            </Button>
          </div>
        }
      />

      {loadError && (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <FilterBar
        locale={locale}
        search={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        searchPlaceholder={
          isUz ? "Qidiruv (harakat, resurs, ism)..." : "Поиск по действию, ресурсу, имени..."
        }
        hasActiveFilters={hasFilters}
        onReset={() => {
          setSearch("");
          setSelectedAction("ALL");
          setSelectedResource("ALL");
          setSelectedActor("ALL");
          setDateFrom("");
          setDateTo("");
          setPage(1);
        }}
      >
        <select
          aria-label={isUz ? "Amal" : "Действие"}
          value={selectedAction}
          onChange={(e) => {
            setSelectedAction(e.target.value);
            setPage(1);
          }}
          className={SELECT_CLS}
        >
          <option value="ALL">{isUz ? "Barcha amallar" : "Все действия"}</option>
          {filters.actions.map((act) => (
            <option key={act} value={act}>
              {act}
            </option>
          ))}
        </select>

        <select
          aria-label={isUz ? "Resurs" : "Ресурс"}
          value={selectedResource}
          onChange={(e) => {
            setSelectedResource(e.target.value);
            setPage(1);
          }}
          className={SELECT_CLS}
        >
          <option value="ALL">{isUz ? "Barcha resurslar" : "Все ресурсы"}</option>
          {filters.resources.map((res) => (
            <option key={res} value={res}>
              {res}
            </option>
          ))}
        </select>

        <select
          aria-label={isUz ? "Foydalanuvchi" : "Пользователь"}
          value={selectedActor}
          onChange={(e) => {
            setSelectedActor(e.target.value);
            setPage(1);
          }}
          className={SELECT_CLS}
        >
          <option value="ALL">{isUz ? "Barcha xodimlar" : "Все пользователи"}</option>
          {filters.actors.map((actor) => (
            <option key={actor.id} value={actor.id}>
              {actor.fullName}
            </option>
          ))}
        </select>

        <Input
          type="date"
          aria-label="С даты"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
          className="w-auto text-xs"
        />

        <Input
          type="date"
          aria-label="По дату"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
          className="w-auto text-xs"
        />
      </FilterBar>

      <DataTable
        data={logs}
        columns={columns}
        getRowId={(item) => item.id}
        locale={locale}
        loading={loading && logs.length === 0}
        error={loadError}
        onRetry={() => void fetchLogs()}
        page={page}
        totalPages={totalPages}
        totalItems={totalCount}
        pageSize={25}
        onPageChange={setPage}
        emptyTitle={isUz ? "Harakatlar jurnali boʻsh" : "Записей аудита не найдено"}
        mobileCardRender={(item) => (
          <div className="space-y-1.5 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium text-foreground">
                  {item.actor?.fullName || "System / Cron"}
                </div>
                <div className="text-muted-foreground tabular-nums">
                  {formatDateLocalized(item.createdAt, locale)}
                </div>
              </div>
              <Badge variant={getActionVariant(item.action)}>{item.action}</Badge>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-muted-foreground">{item.resource}</span>
              {item.detailsJson && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveLog(item)}
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{isUz ? "Koʻrish" : "Инфо"}</span>
                </Button>
              )}
            </div>
          </div>
        )}
      />

      <Dialog open={Boolean(activeLog)} onOpenChange={(open) => !open && setActiveLog(null)}>
        <DialogContent className="max-w-xl">
          {activeLog && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span>{isUz ? "Harakat tafsilotlari" : "Детали записи аудита"}</span>
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  {activeLog.action} · {activeLog.resource}
                </p>
              </DialogHeader>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/40 p-3">
                  <div>
                    <span className="text-muted-foreground">
                      {isUz ? "Foydalanuvchi" : "Пользователь"}:
                    </span>
                    <p className="font-semibold text-foreground">
                      {activeLog.actor?.fullName || "System"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">IP:</span>
                    <p className="font-mono text-foreground">{activeLog.ipAddress || "—"}</p>
                  </div>
                </div>

                <div>
                  <span className="mb-1 block font-medium text-muted-foreground">
                    {isUz ? "JSON parametrlar" : "Параметры события (JSON)"}:
                  </span>
                  <pre className="max-h-60 overflow-x-auto rounded-lg border border-border bg-muted p-3 font-mono text-xs text-foreground">
                    {JSON.stringify(JSON.parse(activeLog.detailsJson || "{}"), null, 2)}
                  </pre>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setActiveLog(null)}>
                  {isUz ? "Yopish" : "Закрыть"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
