"use client";

import { useState, useEffect, useRef } from "react";
import { GraduationCap, Download, Lock, Loader2 } from "lucide-react";
import { t } from "@/i18n";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface GroupOption {
  id: string;
  name: string;
}

interface GradeItem {
  id: string;
  gradeType: string;
  value: number;
  maxValue: number;
  lifecycle: string;
  comment: string | null;
  lessonId: string | null;
  createdAt: string;
}

interface StudentRow {
  studentMembershipId: string;
  studentName: string;
  studentEmail: string;
  grades: GradeItem[];
  weightedScore: number;
  letterGrade: string;
}

interface MatrixResponse {
  groupId: string;
  groupName: string;
  students: StudentRow[];
}

interface GradebookManagerProps {
  groups: GroupOption[];
  locale?: string;
  userRole: string;
}

const SELECT_CLS =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

function getGradeBadgeVariant(letter: string): BadgeVariant {
  switch (letter) {
    case "A":
      return "success";
    case "B":
      return "info";
    case "C":
      return "warning";
    case "D":
      return "neutral";
    default:
      return "destructive";
  }
}

export default function GradebookManager({
  groups,
  locale = "ru",
  userRole,
}: GradebookManagerProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    groups[0]?.id || ""
  );
  const [matrixData, setMatrixData] = useState<MatrixResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Finalize state
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeSuccess, setFinalizeSuccess] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  // Cleared on unmount so the success banner timer cannot fire on a dead component.
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const canFinalize = userRole === "DIRECTOR" || userRole === "CENTER_ADMIN";
  const canExport =
    userRole === "DIRECTOR" ||
    userRole === "CENTER_ADMIN" ||
    userRole === "TEACHER";

  useEffect(() => {
    if (!selectedGroupId) {
      setMatrixData(null);
      return;
    }

    let isSubscribed = true;
    // Drop the previous group's matrix immediately when the select changes.
    setMatrixData(null);
    async function loadMatrix() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/grades/matrix?groupId=${selectedGroupId}`);
        if (!res.ok) {
          const errData = (await res.json()) as { error?: string };
          if (isSubscribed) setError(errData.error || "Failed to load gradebook");
          return;
        }
        const data = (await res.json()) as MatrixResponse;
        if (isSubscribed) {
          setMatrixData(data);
        }
      } catch {
        if (isSubscribed) setError("Network error loading gradebook");
      } finally {
        if (isSubscribed) setLoading(false);
      }
    }

    loadMatrix();
    return () => {
      isSubscribed = false;
    };
  }, [selectedGroupId]);

  const handleFinalize = async () => {
    if (!selectedGroupId) return;
    setFinalizing(true);
    setFinalizeSuccess(false);
    setFinalizeError(null);

    try {
      const res = await fetch("/api/grades/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: selectedGroupId }),
      });

      if (res.ok) {
        setFinalizeSuccess(true);
        const refreshRes = await fetch(
          `/api/grades/matrix?groupId=${selectedGroupId}`
        );
        if (refreshRes.ok) {
          const data = (await refreshRes.json()) as MatrixResponse;
          setMatrixData(data);
        }
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setFinalizeSuccess(false), 4000);
      } else {
        const errData = (await res.json()) as { error?: string };
        setFinalizeError(errData.error || "Failed to finalize period");
      }
    } catch {
      setFinalizeError("Network error while finalizing");
    } finally {
      setFinalizing(false);
    }
  };

  const students = matrixData?.students || [];

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <Card>
        <CardContent className="flex flex-col items-stretch justify-between gap-4 p-4 sm:flex-row sm:items-end sm:p-5">
          <div className="w-full sm:w-64">
            <label
              htmlFor="gradebook-group-select"
              className="mb-1.5 block text-[13px] font-medium text-foreground"
            >
              {t(locale, "grades.selectGroup")}
            </label>
            <select
              id="gradebook-group-select"
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className={SELECT_CLS}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canExport && (
              <a
                href={`/api/grades/export?groupId=${selectedGroupId}`}
                download
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Download className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                <span>{t(locale, "grades.exportCsv")}</span>
              </a>
            )}

            {canFinalize && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleFinalize}
                disabled={finalizing || loading || !selectedGroupId}
              >
                {finalizing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    <span>...</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t(locale, "grades.finalizePeriod")}</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {finalizeSuccess && (
        <Alert variant="success">
          <AlertDescription>{t(locale, "grades.finalizedSuccess")}</AlertDescription>
        </Alert>
      )}

      {finalizeError && (
        <Alert variant="destructive">
          <AlertDescription>{finalizeError}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Gradebook Matrix Content */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-border py-3.5">
          <CardTitle className="flex items-center gap-2 text-sm">
            <GraduationCap className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>{matrixData?.groupName || t(locale, "grades.gradebookMatrix")}</span>
          </CardTitle>
          <span className="text-xs text-muted-foreground tabular-nums">
            {students.length} {t(locale, "nav.students")}
          </span>
        </CardHeader>

        {loading ? (
          <CardContent className="space-y-3 p-6">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
              <span>...</span>
            </div>
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </CardContent>
        ) : students.length === 0 ? (
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {t(locale, "grades.noGrades")}
          </CardContent>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table wrapperClassName="border-0 rounded-none">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t(locale, "nav.students")}</TableHead>
                    <TableHead>{t(locale, "grades.title")}</TableHead>
                    <TableHead className="text-center">
                      {t(locale, "grades.weightedScore")}
                    </TableHead>
                    <TableHead className="text-center">
                      {t(locale, "grades.letterGrade")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((s) => (
                    <TableRow key={s.studentMembershipId}>
                      <TableCell>
                        <div className="font-medium text-foreground">{s.studentName}</div>
                        <div className="text-xs text-muted-foreground">{s.studentEmail}</div>
                      </TableCell>
                      <TableCell>
                        {s.grades.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {s.grades.map((g) => (
                              <Badge
                                key={g.id}
                                variant={g.lifecycle === "FINAL" ? "neutral" : "primary"}
                                title={`${g.gradeType}: ${g.value}/${g.maxValue}${
                                  g.comment ? ` (${g.comment})` : ""
                                }${g.lifecycle === "FINAL" ? " [LOCKED]" : ""}`}
                                className="font-mono"
                              >
                                {g.lifecycle === "FINAL" && (
                                  <Lock className="h-3 w-3" aria-hidden="true" />
                                )}
                                <span>{g.value}</span>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-foreground tabular-nums">
                        {s.weightedScore}%
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={getGradeBadgeVariant(s.letterGrade)}>
                          {s.letterGrade}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="divide-y divide-border md:hidden">
              {students.map((s) => (
                <div key={s.studentMembershipId} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {s.studentName}
                      </div>
                      <div className="text-xs text-muted-foreground">{s.studentEmail}</div>
                    </div>
                    <div className="flex items-center gap-2 tabular-nums">
                      <span className="text-xs font-semibold text-foreground">
                        {s.weightedScore}%
                      </span>
                      <Badge variant={getGradeBadgeVariant(s.letterGrade)}>
                        {s.letterGrade}
                      </Badge>
                    </div>
                  </div>

                  {s.grades.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {s.grades.map((g) => (
                        <Badge
                          key={g.id}
                          variant={g.lifecycle === "FINAL" ? "neutral" : "primary"}
                          className="font-mono"
                        >
                          {g.lifecycle === "FINAL" && (
                            <Lock className="h-3 w-3" aria-hidden="true" />
                          )}
                          <span>
                            {g.gradeType.slice(0, 3)}: {g.value}
                          </span>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
