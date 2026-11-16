"use client";

import type { FormEvent } from "react";
import { CheckCircle2, Download, ExternalLink, Loader2 } from "lucide-react";
import { t } from "@/i18n";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormActions, FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  parseSubmissionFiles,
  parseSubmissionLinks,
  type GradeTarget,
} from "./homework-utils";

const SELECT_CLS =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

interface GradeHomeworkModalProps {
  locale: string;
  target: GradeTarget;
  gradeValue: string;
  onGradeValueChange: (value: string) => void;
  gradeStatus: string;
  onGradeStatusChange: (value: string) => void;
  feedbackText: string;
  onFeedbackTextChange: (value: string) => void;
  isGrading: boolean;
  gradeError: string | null;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}

export function GradeHomeworkModal({
  locale,
  target,
  gradeValue,
  onGradeValueChange,
  gradeStatus,
  onGradeStatusChange,
  feedbackText,
  onFeedbackTextChange,
  isGrading,
  gradeError,
  onSubmit,
  onClose,
}: GradeHomeworkModalProps) {
  const submissionLinks = target.filesJson ? parseSubmissionLinks(target.filesJson) : null;
  const submissionFiles = parseSubmissionFiles(target.filesJson);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>
              {t(locale, "homework.gradeHomework")} — {target.studentName}
            </span>
          </DialogTitle>
        </DialogHeader>

        {target.submissionText && (
          <div className="rounded-md border border-border bg-muted/50 p-3 text-xs text-foreground">
            <span className="mb-1 block font-medium text-muted-foreground">
              {t(locale, "homework.solutionLabel")}
            </span>
            {target.submissionText}
          </div>
        )}

        {target.filesJson && (
          <div className="space-y-1 rounded-md border border-border bg-muted/50 p-3 text-xs text-foreground">
            <span className="mb-1 block font-medium text-muted-foreground">
              {t(locale, "homework.linksLabel")}
            </span>
            {submissionLinks === null ? (
              <span>{target.filesJson}</span>
            ) : (
              <div className="flex flex-wrap gap-2">
                {submissionLinks.map((l, i) => (
                  <a
                    key={i}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    <span>{l.title || l.url}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {submissionFiles.length > 0 && (
          <div className="space-y-1.5 rounded-md border border-border bg-muted/50 p-3 text-xs text-foreground">
            <span className="block font-medium text-muted-foreground">Прикреплённые файлы:</span>
            <div className="flex flex-wrap gap-2">
              {submissionFiles.map((f, i) => (
                <a
                  key={i}
                  href={f.fileUrl}
                  download={f.fileName}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-primary hover:underline"
                >
                  <Download className="h-3 w-3" aria-hidden="true" />
                  <span>{f.fileName}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {gradeError && (
          <Alert variant="destructive">
            <AlertDescription>{gradeError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t(locale, "homework.scoreLabel")} htmlFor="hw-grade-value" required>
              <Input
                id="hw-grade-value"
                type="number"
                min="0"
                max="100"
                value={gradeValue}
                onChange={(e) => onGradeValueChange(e.target.value)}
                required
                className="font-semibold tabular-nums"
              />
            </FormField>

            <FormField label={t(locale, "common.status")} htmlFor="hw-grade-status">
              <select
                id="hw-grade-status"
                value={gradeStatus}
                onChange={(e) => onGradeStatusChange(e.target.value)}
                className={SELECT_CLS}
              >
                <option value="ACCEPTED">{t(locale, "homework.accepted")}</option>
                <option value="REVISION_REQUESTED">
                  {t(locale, "homework.revisionRequested")}
                </option>
              </select>
            </FormField>
          </div>

          <FormField label={t(locale, "homework.feedback")} htmlFor="hw-grade-feedback">
            <Textarea
              id="hw-grade-feedback"
              value={feedbackText}
              onChange={(e) => onFeedbackTextChange(e.target.value)}
              rows={3}
              placeholder="..."
            />
          </FormField>

          <FormActions>
            <Button type="button" variant="outline" onClick={onClose}>
              {t(locale, "common.cancel")}
            </Button>
            <Button type="submit" disabled={isGrading}>
              {isGrading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  <span>...</span>
                </>
              ) : (
                <span>{t(locale, "homework.gradeHomework")}</span>
              )}
            </Button>
          </FormActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
