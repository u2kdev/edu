"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Check, Code, Copy, Download } from "lucide-react";
import {
  Alert,
  AlertDescription,
  Button,
  DataTable,
  type DataTableColumn,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FilterBar,
  FormField,
  Input,
} from "@/components/ui";

interface AuditLogItem {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  detailsJson: string | null;
  ipAddress: string | null;
  createdAt: string;
  actor: {
    id: string;
    fullName: string;
    email: string;
    platformRole: string;
  } | null;
  center: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export default function PlatformAuditInteractive() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [distinctActions, setDistinctActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [resource, setResource] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedDetails, setSelectedDetails] = useState<{ action: string; json: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        page: page.toString(),
        limit: "25",
        ...(search && { search }),
        ...(action && { action }),
        ...(resource && { resource }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
      });
      const res = await fetch(`/api/platform/audit?${q}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
        setDistinctActions(data.distinctActions || []);
        setTotalPages(data.pagination?.totalPages || 1);
      } else {
        setError(data.error || "Не удалось загрузить журнал аудита");
      }
    } catch {
      setError("Ошибка соединения с сервером");
    } finally {
      setLoading(false);
    }
  }, [page, search, action, resource, dateFrom, dateTo]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExportCSV = () => {
    const q = new URLSearchParams({
      ...(search && { search }),
      ...(action && { action }),
      ...(resource && { resource }),
      ...(dateFrom && { dateFrom }),
      ...(dateTo && { dateTo }),
    });
    window.location.href = `/api/platform/audit/export?${q}`;
  };

  const handleCopyJSON = () => {
    if (!selectedDetails) return;
    navigator.clipboard.writeText(selectedDetails.json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasFilters = Boolean(search || action || resource || dateFrom || dateTo);

  const columns: DataTableColumn<AuditLogItem>[] = [
    {
      id: "createdAt",
      header: "Дата и время",
      cell: (log) => (
        <span className="whitespace-nowrap font-mono text-xs text-muted-foreground tabular-nums">
          {new Date(log.createdAt).toLocaleString("ru-RU")}
        </span>
      ),
    },
    {
      id: "action",
      header: "Действие",
      isMobilePrimary: true,
      cell: (log) => <span className="font-medium text-foreground">{log.action}</span>,
    },
    {
      id: "actor",
      header: "Актор",
      cell: (log) => (
        <div className="text-xs">
          <div className="font-medium text-foreground">{log.actor?.fullName || "Система"}</div>
          {log.actor?.email && <div className="text-muted-foreground">{log.actor.email}</div>}
        </div>
      ),
    },
    {
      id: "center",
      header: "Центр",
      cell: (log) => (
        <span className="text-xs text-muted-foreground">
          {log.center ? `${log.center.name} (${log.center.slug})` : "Платформа"}
        </span>
      ),
    },
    {
      id: "resource",
      header: "Ресурс",
      cell: (log) => <span className="font-mono text-xs text-muted-foreground">{log.resource}</span>,
    },
    {
      id: "ipAddress",
      header: "IP-адрес",
      hideOnMobile: true,
      cell: (log) => (
        <span className="font-mono text-xs text-muted-foreground">{log.ipAddress || "—"}</span>
      ),
    },
    {
      id: "details",
      header: "Детали",
      align: "right",
      cell: (log) =>
        log.detailsJson ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSelectedDetails({ action: log.action, json: log.detailsJson! })}
          >
            <Code className="h-3.5 w-3.5" aria-hidden="true" />
            <span>JSON</span>
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <FilterBar
        search={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        searchPlaceholder="Поиск по действию, ID, IP или деталям..."
        hasActiveFilters={hasFilters}
        onReset={() => {
          setSearch("");
          setAction("");
          setResource("");
          setDateFrom("");
          setDateTo("");
          setPage(1);
        }}
        actions={
          <Button type="button" variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Экспорт в CSV</span>
          </Button>
        }
      >
        <select
          aria-label="Действие"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground"
        >
          <option value="">Все действия</option>
          {distinctActions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <Input
          aria-label="Сущность или ресурс"
          type="text"
          placeholder="Ресурс (PlatformUser...)"
          value={resource}
          onChange={(e) => {
            setResource(e.target.value);
            setPage(1);
          }}
          className="h-9 w-44 text-xs"
        />

        <Input
          aria-label="С даты"
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
          className="h-9 w-36 text-xs"
        />

        <Input
          aria-label="По дату"
          type="date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
          className="h-9 w-36 text-xs"
        />
      </FilterBar>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {hasFilters && (
        <DataTable
          data={logs}
          columns={columns}
          getRowId={(l) => l.id}
          loading={loading}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          emptyTitle="Записи не найдены"
          emptyDescription="По выбранным фильтрам событий аудита не найдено."
        />
      )}

      <Dialog
        open={Boolean(selectedDetails)}
        onOpenChange={(next) => !next && setSelectedDetails(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code className="h-4 w-4 text-primary" aria-hidden="true" />
              <span>Детали события: {selectedDetails?.action}</span>
            </DialogTitle>
          </DialogHeader>

          <FormField label="Полезная нагрузка (JSON)">
            <div className="relative">
              <pre className="max-h-96 overflow-x-auto rounded-lg border border-border bg-muted/50 p-4 font-mono text-xs text-foreground">
                {selectedDetails?.json}
              </pre>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyJSON}
                className="absolute right-3 top-3"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? "Скопировано" : "Копировать"}</span>
              </Button>
            </div>
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSelectedDetails(null)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
