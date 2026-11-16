"use client";

import { useState, useEffect, useRef } from "react";
import { UserCheck, Download, AlertTriangle, Loader2, Users } from "lucide-react";
import { t } from "@/i18n";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

interface LessonOption {
  id: string;
  title: string;
  scheduledAt: string | null;
}

interface StudentItem {
  id: string;
  fullName: string;
  email: string;
}

interface RiskStudent {
  studentMembershipId: string;
  studentName: string;
  totalLessons: number;
  presentLessons: number;
  attendanceRate: number;
  isAtRisk: boolean;
}

interface AttendanceManagerProps {
  groups: GroupOption[];
  lessonsByGroup: Record<string, LessonOption[]>;
  studentsByGroup: Record<string, StudentItem[]>;
  locale?: string;
  userRole: string;
}

const SELECT_CLS =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

const STATUS_CONFIG: Record<
  string,
  { labelKey: string; color: string; activeColor: string }
> = {
  PRESENT: {
    labelKey: "attendance.present",
    color: "border-success/30 bg-success-subtle text-success-subtle-foreground",
    activeColor: "border-success bg-success text-success-foreground",
  },
  ABSENT: {
    labelKey: "attendance.absent",
    color: "border-destructive/30 bg-destructive-subtle text-destructive-subtle-foreground",
    activeColor: "border-destructive bg-destructive text-destructive-foreground",
  },
  EXCUSED: {
    labelKey: "attendance.excused",
    color: "border-info/30 bg-info-subtle text-info-subtle-foreground",
    activeColor: "border-info bg-info text-info-foreground",
  },
  LATE: {
    labelKey: "attendance.late",
    color: "border-warning/30 bg-warning-subtle text-warning-subtle-foreground",
    activeColor: "border-warning bg-warning text-warning-foreground",
  },
};

export default function AttendanceManager({
  groups,
  lessonsByGroup,
  studentsByGroup,
  locale = "ru",
  userRole,
}: AttendanceManagerProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groups[0]?.id || "");
  const currentLessons = lessonsByGroup[selectedGroupId] || [];
  const [selectedLessonId, setSelectedLessonId] = useState<string>(
    currentLessons[0]?.id || ""
  );

  const [studentStatusMap, setStudentStatusMap] = useState<Record<string, string>>({});
  const [studentNoteMap, setStudentNoteMap] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [showRiskList, setShowRiskList] = useState(false);
  const [riskList, setRiskList] = useState<RiskStudent[]>([]);
  const [loadingRisk, setLoadingRisk] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const lessons = lessonsByGroup[selectedGroupId] || [];
    setSelectedLessonId(lessons[0]?.id || "");
  }, [selectedGroupId, lessonsByGroup]);

  useEffect(() => {
    if (!selectedLessonId) {
      setStudentStatusMap({});
      setStudentNoteMap({});
      return;
    }

    setStudentStatusMap({});
    setStudentNoteMap({});

    let isSubscribed = true;
    async function loadLessonAttendance() {
      try {
        const res = await fetch(`/api/attendance?lessonId=${selectedLessonId}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          attendance?: Array<{
            studentMembershipId: string;
            status: string;
            note: string | null;
          }>;
        };
        if (isSubscribed && data.attendance) {
          const statuses: Record<string, string> = {};
          const notes: Record<string, string> = {};
          for (const item of data.attendance) {
            statuses[item.studentMembershipId] = item.status;
            if (item.note) {
              notes[item.studentMembershipId] = item.note;
            }
          }
          setStudentStatusMap(statuses);
          setStudentNoteMap(notes);
        }
      } catch {
        // Ignore transient load error
      }
    }

    loadLessonAttendance();
    return () => {
      isSubscribed = false;
    };
  }, [selectedLessonId]);

  useEffect(() => {
    async function fetchRiskList() {
      setLoadingRisk(true);
      try {
        const res = await fetch("/api/attendance/analytics");
        if (res.ok) {
          const data = (await res.json()) as { riskList?: RiskStudent[] };
          setRiskList(data.riskList || []);
        }
      } catch {
        // Ignore transient analytics error
      } finally {
        setLoadingRisk(false);
      }
    }
    fetchRiskList();
  }, []);

  const currentStudents = studentsByGroup[selectedGroupId] || [];

  const handleStatusChange = (studentId: string, status: string) => {
    setStudentStatusMap((prev) => ({ ...prev, [studentId]: status }));
  };

  const handleNoteChange = (studentId: string, note: string) => {
    setStudentNoteMap((prev) => ({ ...prev, [studentId]: note }));
  };

  const handleMarkAllPresent = () => {
    const updated: Record<string, string> = {};
    for (const s of currentStudents) {
      updated[s.id] = "PRESENT";
    }
    setStudentStatusMap(updated);
  };

  const handleSave = async () => {
    if (!selectedLessonId) return;
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const records = currentStudents.map((s) => ({
        studentMembershipId: s.id,
        groupId: selectedGroupId,
        status: studentStatusMap[s.id] || "PRESENT",
        note: studentNoteMap[s.id] || null,
      }));

      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: selectedLessonId,
          records,
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        const errData = (await res.json()) as { error?: string };
        setSaveError(errData.error || "Failed to save attendance");
      }
    } catch {
      setSaveError("Network error while saving");
    } finally {
      setSaving(false);
    }
  };

  const canExport =
    userRole === "DIRECTOR" || userRole === "CENTER_ADMIN" || userRole === "TEACHER";

  return (
    <div className="space-y-6">
      {/* Controls Header */}
      <Card>
        <CardContent className="flex flex-col items-stretch justify-between gap-4 p-4 md:flex-row md:items-end md:p-5">
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 md:w-auto">
            <div>
              <label
                htmlFor="att-group-select"
                className="mb-1.5 block text-[13px] font-medium text-foreground"
              >
                {t(locale, "attendance.selectGroup")}
              </label>
              <select
                id="att-group-select"
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

            <div>
              <label
                htmlFor="att-lesson-select"
                className="mb-1.5 block text-[13px] font-medium text-foreground"
              >
                {t(locale, "attendance.selectLesson")}
              </label>
              <select
                id="att-lesson-select"
                value={selectedLessonId}
                onChange={(e) => setSelectedLessonId(e.target.value)}
                className={SELECT_CLS}
                disabled={currentLessons.length === 0}
              >
                {currentLessons.length === 0 ? (
                  <option value="">{t(locale, "common.noData")}</option>
                ) : (
                  currentLessons.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowRiskList(!showRiskList)}
            >
              <AlertTriangle
                className={`h-4 w-4 ${riskList.length > 0 ? "text-warning" : "text-muted-foreground"}`}
                aria-hidden="true"
              />
              <span>{t(locale, "attendance.riskList")}</span>
              <Badge variant={riskList.length > 0 ? "warning" : "neutral"} className="ml-1">
                {riskList.length}
              </Badge>
            </Button>

            {canExport && (
              <a
                href={`/api/attendance/export?groupId=${selectedGroupId}`}
                download
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Download className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                <span>{t(locale, "attendance.exportCsv")}</span>
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Risk List Panel */}
      {showRiskList && (
        <Alert variant="warning">
          <AlertTitle className="flex items-center justify-between gap-2">
            <span>{t(locale, "attendance.riskList")}</span>
            <span className="text-xs font-normal text-muted-foreground tabular-nums">
              {loadingRisk ? "..." : `${riskList.length} ${t(locale, "nav.students")}`}
            </span>
          </AlertTitle>
          <AlertDescription>
            {riskList.length === 0 ? (
              <p className="text-xs">{t(locale, "attendance.riskListEmpty")}</p>
            ) : (
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {riskList.map((r) => (
                  <div
                    key={r.studentMembershipId}
                    className="flex items-center justify-between rounded-md border border-border bg-card p-2.5 text-xs"
                  >
                    <span className="mr-2 truncate font-medium text-foreground">
                      {r.studentName}
                    </span>
                    <Badge variant="destructive" className="shrink-0 tabular-nums">
                      {r.attendanceRate}% ({r.presentLessons}/{r.totalLessons})
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Bulk Attendance Form */}
      <Card>
        <CardHeader className="flex flex-col justify-between gap-3 border-b border-border py-3.5 sm:flex-row sm:items-center">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>
              {t(locale, "nav.students")}: {currentStudents.length}
            </span>
          </CardTitle>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleMarkAllPresent}>
              {t(locale, "attendance.markAllPresent")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving || currentStudents.length === 0}
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  <span>...</span>
                </>
              ) : (
                <>
                  <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t(locale, "attendance.saveAttendance")}</span>
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        {saveSuccess && (
          <div className="p-4 pb-0">
            <Alert variant="success">
              <AlertDescription>{t(locale, "attendance.savedSuccess")}</AlertDescription>
            </Alert>
          </div>
        )}

        {saveError && (
          <div className="p-4 pb-0">
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          </div>
        )}

        {currentStudents.length === 0 ? (
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {t(locale, "common.noData")}
          </CardContent>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table wrapperClassName="border-0 rounded-none">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t(locale, "nav.students")}</TableHead>
                    <TableHead>{t(locale, "common.status")}</TableHead>
                    <TableHead>{t(locale, "attendance.note")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentStudents.map((s) => {
                    const currentStatus = studentStatusMap[s.id] || "PRESENT";
                    return (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div className="font-medium text-foreground">{s.fullName}</div>
                          <div className="text-xs text-muted-foreground">{s.email}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {Object.entries(STATUS_CONFIG).map(([stKey, cfg]) => {
                              const active = currentStatus === stKey;
                              return (
                                <button
                                  key={stKey}
                                  type="button"
                                  aria-pressed={active}
                                  onClick={() => handleStatusChange(s.id, stKey)}
                                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                                    active ? cfg.activeColor : cfg.color
                                  }`}
                                >
                                  {t(locale, cfg.labelKey)}
                                </button>
                              );
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            value={studentNoteMap[s.id] || ""}
                            onChange={(e) => handleNoteChange(s.id, e.target.value)}
                            placeholder="..."
                            className="h-8 text-xs"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="divide-y divide-border md:hidden">
              {currentStudents.map((s) => {
                const currentStatus = studentStatusMap[s.id] || "PRESENT";
                return (
                  <div key={s.id} className="space-y-3 p-4">
                    <div>
                      <div className="text-sm font-medium text-foreground">{s.fullName}</div>
                      <div className="text-xs text-muted-foreground">{s.email}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries(STATUS_CONFIG).map(([stKey, cfg]) => {
                        const active = currentStatus === stKey;
                        return (
                          <button
                            key={stKey}
                            type="button"
                            aria-pressed={active}
                            onClick={() => handleStatusChange(s.id, stKey)}
                            className={`rounded-md border px-2 py-1.5 text-center text-xs font-medium transition-colors ${
                              active ? cfg.activeColor : cfg.color
                            }`}
                          >
                            {t(locale, cfg.labelKey)}
                          </button>
                        );
                      })}
                    </div>

                    <div>
                      <Input
                        type="text"
                        value={studentNoteMap[s.id] || ""}
                        onChange={(e) => handleNoteChange(s.id, e.target.value)}
                        placeholder={t(locale, "attendance.note")}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
