"use client";

import { useEffect, useState } from "react";
import {
  Badge,
  DataTable,
  type DataTableColumn,
  FilterBar,
  PageHeader,
} from "@/components/ui";

interface AuditLogItem {
  id: string;
  createdAt: string;
  center?: { slug: string } | null;
  actor: { email: string };
  action: string;
  resource: string;
  resourceId?: string | null;
}

export default function GlobalAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/developer/audit-logs?limit=200")
      .then((res) => res.json())
      .then((json) => setLogs(json.logs || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredLogs = logs.filter(
    (log) =>
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.actor.email.toLowerCase().includes(search.toLowerCase()) ||
      log.resource.toLowerCase().includes(search.toLowerCase())
  );

  const columns: DataTableColumn<AuditLogItem>[] = [
    {
      id: "timestamp",
      header: "Timestamp",
      sortable: true,
      sortValue: (log) => log.createdAt,
      cell: (log) => (
        <span className="whitespace-nowrap font-mono text-xs text-muted-foreground tabular-nums">
          {new Date(log.createdAt).toISOString().replace("T", " ").substring(0, 19)}
        </span>
      ),
    },
    {
      id: "tenant",
      header: "Tenant",
      sortable: true,
      sortValue: (log) => log.center?.slug ?? "PLATFORM",
      cell: (log) => (
        <Badge variant={log.center ? "info" : "neutral"}>
          {log.center ? log.center.slug : "PLATFORM"}
        </Badge>
      ),
    },
    {
      id: "actor",
      header: "Actor",
      isMobilePrimary: true,
      sortable: true,
      sortValue: (log) => log.actor.email,
      cell: (log) => <span className="font-mono text-xs text-foreground">{log.actor.email}</span>,
    },
    {
      id: "action",
      header: "Action",
      sortable: true,
      sortValue: (log) => log.action,
      cell: (log) => (
        <span className="font-mono text-xs font-semibold text-warning">{log.action}</span>
      ),
    },
    {
      id: "resource",
      header: "Resource",
      sortable: true,
      sortValue: (log) => log.resource,
      cell: (log) => (
        <span className="font-mono text-xs text-primary">{log.resource}</span>
      ),
    },
    {
      id: "resourceId",
      header: "ID",
      hideOnMobile: true,
      cell: (log) => (
        <span className="block max-w-[140px] truncate font-mono text-xs text-muted-foreground">
          {log.resourceId || "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Global Audit Logs"
        description="Unrestricted view of all platform and tenant activities"
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Grep logs by action, actor email, or resource..."
        hasActiveFilters={Boolean(search)}
        onReset={() => setSearch("")}
      />

      <DataTable
        data={filteredLogs}
        columns={columns}
        getRowId={(row) => row.id}
        loading={loading}
        loadingLabel="Querying logs..."
        emptyTitle="0 matches"
        defaultDensity="compact"
      />
    </div>
  );
}
