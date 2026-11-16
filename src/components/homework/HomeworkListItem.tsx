"use client";

import { Clock, Download, RotateCcw, Send, User } from "lucide-react";
import { t } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  STATUS_BADGES,
  findMySubmission,
  formatDueDate,
  parseSubmissionFiles,
  studentStatus,
  type HomeworkItem,
  type HomeworkSubmission,
} from "./homework-utils";

interface HomeworkListItemProps {
  hw: HomeworkItem;
  locale: string;
  userMembershipId?: string;
  isStudent: boolean;
  isTeacher: boolean;
  isParent?: boolean;
  onOpenSubmit: (hw: HomeworkItem) => void;
  onOpenGrade: (hwId: string, sub: HomeworkSubmission) => void;
}

export function HomeworkListItem({
  hw,
  locale,
  userMembershipId,
  isStudent,
  isTeacher,
  isParent = false,
  onOpenSubmit,
  onOpenGrade,
}: HomeworkListItemProps) {
  const mySubmission = findMySubmission(hw, userMembershipId);
  const myStatus = studentStatus(hw, userMembershipId);
  const badgeCfg = STATUS_BADGES[myStatus] || STATUS_BADGES.NOT_SUBMITTED;
  const myFiles = mySubmission ? parseSubmissionFiles(mySubmission.filesJson) : [];

  return (
    <Card data-hw-card="" className="transition-colors hover:border-border">
      <CardContent className="space-y-4 p-4 sm:p-5">
        {/* Header */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <span className="text-xs font-medium text-primary">{hw.lessonTitle}</span>
            <h3 className="mt-0.5 text-base font-semibold text-foreground">{hw.title}</h3>
            {hw.description && (
              <p className="mt-1 text-sm text-muted-foreground">{hw.description}</p>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {hw.dueDate && (
              <Badge variant="warning" className="tabular-nums">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{formatDueDate(hw.dueDate)}</span>
              </Badge>
            )}

            {isStudent && <Badge variant={badgeCfg.variant}>{t(locale, badgeCfg.labelKey)}</Badge>}
          </div>
        </div>

        {/* Student Action Bar */}
        {isStudent && (
          <div className="space-y-2 border-t border-border pt-3">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="text-xs text-muted-foreground tabular-nums">
                {mySubmission?.grade !== null && mySubmission?.grade !== undefined ? (
                  <span className="mr-2 font-semibold text-success">
                    {t(locale, "performance.title")}: {mySubmission.grade}/100
                  </span>
                ) : null}
                {mySubmission?.feedback && (
                  <span className="italic text-muted-foreground">
                    &quot;{mySubmission.feedback}&quot;
                  </span>
                )}
              </div>

              <Button type="button" size="sm" onClick={() => onOpenSubmit(hw)}>
                {mySubmission ? (
                  <>
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t(locale, "homework.submitHomework")}</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t(locale, "homework.submitHomework")}</span>
                  </>
                )}
              </Button>
            </div>

            {myFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {myFiles.map((f, i) => (
                  <a
                    key={i}
                    href={f.fileUrl}
                    download={f.fileName}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1 text-xs text-primary hover:underline"
                  >
                    <Download className="h-3 w-3" aria-hidden="true" />
                    <span>{f.fileName}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Teacher / Assistant / Admin Submissions View OR Parent Read-Only Child View */}
        {(isTeacher || isParent) && hw.submissions.length > 0 && (
          <div className="space-y-2 border-t border-border pt-3">
            <h4 className="text-xs font-medium text-muted-foreground">
              {t(locale, "homework.submitted")}: {hw.submissions.length}
            </h4>
            <div className="divide-y divide-border">
              {hw.submissions.map((sub) => {
                const subBadge = STATUS_BADGES[sub.status] || STATUS_BADGES.SUBMITTED;
                const subFiles = parseSubmissionFiles(sub.filesJson);
                return (
                  <div
                    key={sub.id}
                    className="flex flex-col justify-between gap-2 py-2.5 text-xs sm:flex-row sm:items-center"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                        <span className="font-medium text-foreground">{sub.studentName}</span>
                        <Badge variant={subBadge.variant}>{t(locale, subBadge.labelKey)}</Badge>
                        {sub.grade !== null && (
                          <span className="font-semibold text-primary tabular-nums">
                            {sub.grade}/100
                          </span>
                        )}
                      </div>
                      {isParent && sub.feedback && (
                        <p className="italic text-muted-foreground">&quot;{sub.feedback}&quot;</p>
                      )}
                      {subFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {subFiles.map((f, i) => (
                            <a
                              key={i}
                              href={f.fileUrl}
                              download={f.fileName}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              <Download className="h-3 w-3" aria-hidden="true" />
                              <span>{f.fileName}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                    {isTeacher && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenGrade(hw.id, sub)}
                        className="self-start sm:self-auto"
                      >
                        {t(locale, "homework.gradeHomework")}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
