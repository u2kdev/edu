"use client";

import type { FormEvent } from "react";
import { ArrowRightLeft } from "lucide-react";
import { t } from "@/i18n";
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  FormActions,
  FormField,
  Input,
} from "@/components/ui";
import { transferTargets, type GroupItem } from "./groups-utils";

interface TransferStudentModalProps {
  open: boolean;
  locale: string;
  studentName: string;
  sourceGroupId: string;
  groups: GroupItem[];
  targetGroupId: string;
  onTargetGroupIdChange: (value: string) => void;
  reason: string;
  onReasonChange: (value: string) => void;
  reasonPlaceholder: string;
  loading: boolean;
  error?: string | null;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background";

export function TransferStudentModal({
  open,
  locale,
  studentName,
  sourceGroupId,
  groups,
  targetGroupId,
  onTargetGroupIdChange,
  reason,
  onReasonChange,
  reasonPlaceholder,
  loading,
  error,
  onSubmit,
  onClose,
}: TransferStudentModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>{t(locale, "groups.transferStudent")}</span>
          </DialogTitle>
          <DialogDescription>
            {t(locale, "groups.studentLabel", { name: studentName })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <FormField label={t(locale, "groups.transferTarget")} htmlFor="transfer-target-group" required>
            <select
              id="transfer-target-group"
              required
              value={targetGroupId}
              onChange={(e) => onTargetGroupIdChange(e.target.value)}
              className={selectClassName}
            >
              {transferTargets(groups, sourceGroupId).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.enrollments.length} / {g.maxStudents})
                </option>
              ))}
            </select>
          </FormField>

          <FormField label={t(locale, "groups.transferReasonLabel")} htmlFor="transfer-reason">
            <Input
              id="transfer-reason"
              type="text"
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder={reasonPlaceholder}
            />
          </FormField>

          <FormActions>
            <Button type="button" variant="secondary" onClick={onClose}>
              {t(locale, "common.cancel")}
            </Button>
            <Button type="submit" variant="primary" disabled={loading} loading={loading}>
              {loading ? t(locale, "common.loading") : t(locale, "groups.transferStudent")}
            </Button>
          </FormActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
