"use client";

import { useEffect, useState } from "react";
import { Activity, Database, Server, Clock, HardDrive } from "lucide-react";
import {
  Alert,
  AlertDescription,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  Skeleton,
} from "@/components/ui";

interface SystemHealthData {
  dbStatus: string;
  dbPingMs: number;
  redisStatus: string;
  redisPingMs: string | number;
  uptimeSeconds: number;
  memoryUsage: { rss: number; heapUsed: number; heapTotal: number };
  environment: string;
}

export default function DeveloperDashboard() {
  const [health, setHealth] = useState<SystemHealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/developer/health")
      .then((res) => res.json())
      .then((json) => setHealth(json.health))
      .catch(() => setHealth(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Running diagnostics...</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!health) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Failed to connect to health API.</AlertDescription>
      </Alert>
    );
  }

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const dbHealthy = health.dbStatus === "HEALTHY";

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Diagnostics"
        description="Real-time infrastructure health and telemetry"
        actions={
          <Badge variant={dbHealthy ? "success" : "warning"}>
            <Activity className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{health.environment}</span>
          </Badge>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex h-full flex-col p-5">
            <div className="mb-4 flex items-center gap-2.5 text-muted-foreground">
              <Database className="h-4 w-4" aria-hidden="true" />
              <span className="text-sm font-medium">PostgreSQL</span>
            </div>
            <div className="mt-auto flex items-end justify-between">
              <div className={`text-xl font-semibold tabular-nums ${dbHealthy ? "text-success" : "text-warning"}`}>
                {health.dbStatus}
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">{health.dbPingMs}ms ping</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex h-full flex-col p-5">
            <div className="mb-4 flex items-center gap-2.5 text-muted-foreground">
              <Server className="h-4 w-4" aria-hidden="true" />
              <span className="text-sm font-medium">Redis Cache</span>
            </div>
            <div className="mt-auto flex items-end justify-between">
              <div className="text-xl font-semibold text-foreground">{health.redisStatus}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex h-full flex-col p-5">
            <div className="mb-4 flex items-center gap-2.5 text-muted-foreground">
              <Clock className="h-4 w-4" aria-hidden="true" />
              <span className="text-sm font-medium">Node Process Uptime</span>
            </div>
            <div className="mt-auto flex items-end justify-between">
              <div className="text-xl font-semibold text-foreground tabular-nums">
                {formatUptime(health.uptimeSeconds)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex h-full flex-col p-5">
            <div className="mb-4 flex items-center gap-2.5 text-muted-foreground">
              <HardDrive className="h-4 w-4" aria-hidden="true" />
              <span className="text-sm font-medium">Heap Usage</span>
            </div>
            <div className="mt-auto flex items-end justify-between">
              <div className="text-xl font-semibold text-foreground tabular-nums">
                {formatBytes(health.memoryUsage.heapUsed)}
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                / {formatBytes(health.memoryUsage.heapTotal)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Environment Detail
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs text-foreground">
            {JSON.stringify(
              { env: health.environment, node: process.version, platform: process.platform },
              null,
              2
            )}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
