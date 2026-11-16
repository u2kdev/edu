"use client";

import { Download, Plus } from "lucide-react";
import { t } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import type { ScheduleGroupOption, ScheduleTeacherOption, ScheduleViewMode } from "./schedule-utils";

interface ScheduleToolbarProps {
  locale: string;
  canManage: boolean;
  viewMode: ScheduleViewMode;
  onViewModeChange: (mode: ScheduleViewMode) => void;
  selectedGroupId: string;
  onSelectedGroupIdChange: (value: string) => void;
  selectedTeacherId: string;
  onSelectedTeacherIdChange: (value: string) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  groups: ScheduleGroupOption[];
  teachers: ScheduleTeacherOption[];
  onCreateSlot: () => void;
}

const SELECT_CLS =
  "flex h-9 rounded-md border border-input bg-card px-3 py-1.5 text-[13px] text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background";

export function ScheduleToolbar({
  locale,
  canManage,
  viewMode,
  onViewModeChange,
  selectedGroupId,
  onSelectedGroupIdChange,
  selectedTeacherId,
  onSelectedTeacherIdChange,
  searchQuery,
  onSearchQueryChange,
  groups,
  teachers,
  onCreateSlot,
}: ScheduleToolbarProps) {
  return (
    <>
      <PageHeader
        title={t(locale, "schedule.title")}
        description={t(locale, "schedule.subtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/api/schedule/ical${selectedGroupId ? `?groupId=${selectedGroupId}` : ""}`}
              download="schedule.ics"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Download className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <span>{t(locale, "schedule.exportIcal")}</span>
            </a>

            {canManage && (
              <Button type="button" size="sm" onClick={onCreateSlot}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>{t(locale, "schedule.addSlot")}</span>
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <CardContent className="flex flex-col items-stretch justify-between gap-3 p-3 md:flex-row md:items-center">
          {/* View Mode Toggle */}
          <div className="inline-flex shrink-0 items-center rounded-md border border-border bg-muted p-0.5">
            {(["day", "week", "month"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onViewModeChange(mode)}
                className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === mode
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(locale, `schedule.${mode}View`)}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder={t(locale, "schedule.searchPlaceholder")}
              className="min-w-[180px] flex-1"
            />

            <select
              aria-label={t(locale, "schedule.group")}
              value={selectedGroupId}
              onChange={(e) => onSelectedGroupIdChange(e.target.value)}
              className={SELECT_CLS}
            >
              <option value="">{t(locale, "schedule.allGroups")}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>

            <select
              aria-label={t(locale, "schedule.teacher")}
              value={selectedTeacherId}
              onChange={(e) => onSelectedTeacherIdChange(e.target.value)}
              className={SELECT_CLS}
            >
              <option value="">{t(locale, "schedule.allTeachers")}</option>
              {teachers.map((teach) => (
                <option key={teach.id} value={teach.id}>
                  {teach.user.fullName}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
