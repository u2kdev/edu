"use client";

import type { FormEvent } from "react";
import { t } from "@/i18n";
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  FormActions,
  FormField,
  Input,
} from "@/components/ui";
import type { GroupOption } from "./students-utils";

export interface StudentFormModalProps {
  open: boolean;
  locale: string;
  initialGroups: GroupOption[];
  namePlaceholder: string;
  fullName: string;
  onFullNameChange: (value: string) => void;
  email: string;
  onEmailChange: (value: string) => void;
  phone: string;
  onPhoneChange: (value: string) => void;
  groupId: string;
  onGroupIdChange: (value: string) => void;
  withInvite: boolean;
  onWithInviteChange: (value: boolean) => void;
  submitting: boolean;
  error?: string | null;
  createdCode: string | null;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
  onCloseWithReset: () => void;
}

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background";

export function StudentFormModal({
  open,
  locale,
  initialGroups,
  namePlaceholder,
  fullName,
  onFullNameChange,
  email,
  onEmailChange,
  phone,
  onPhoneChange,
  groupId,
  onGroupIdChange,
  withInvite,
  onWithInviteChange,
  submitting,
  error,
  createdCode,
  onSubmit,
  onClose,
  onCloseWithReset,
}: StudentFormModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && (createdCode ? onCloseWithReset() : onClose())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t(locale, "students.addStudent")}</DialogTitle>
        </DialogHeader>

        {createdCode ? (
          <div className="space-y-4">
            <Alert variant="success">
              <AlertDescription>{t(locale, "students.studentCreatedInvite")}</AlertDescription>
            </Alert>
            <div className="rounded-lg border border-border bg-muted px-4 py-3 text-center font-mono text-xl font-semibold tracking-wider text-primary select-all">
              {createdCode}
            </div>
            <FormActions>
              <Button type="button" variant="primary" onClick={onCloseWithReset}>
                {t(locale, "common.close")}
              </Button>
            </FormActions>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <FormField label={t(locale, "students.fullName")} htmlFor="student-fullname" required>
              <Input
                id="student-fullname"
                required
                type="text"
                value={fullName}
                onChange={(e) => onFullNameChange(e.target.value)}
                placeholder={namePlaceholder}
              />
            </FormField>

            <FormField label={t(locale, "students.email")} htmlFor="student-email">
              <Input
                id="student-email"
                type="email"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                placeholder="alisher@example.uz"
              />
            </FormField>

            <FormField label={t(locale, "students.phone")} htmlFor="student-phone">
              <Input
                id="student-phone"
                type="text"
                value={phone}
                onChange={(e) => onPhoneChange(e.target.value)}
                placeholder="+998901234567"
              />
            </FormField>

            <FormField label={t(locale, "students.group")} htmlFor="student-group">
              <select
                id="student-group"
                value={groupId}
                onChange={(e) => onGroupIdChange(e.target.value)}
                className={selectClassName}
              >
                <option value="">{t(locale, "students.noGroupSelected")}</option>
                {initialGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </FormField>

            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={withInvite}
                onChange={(e) => onWithInviteChange(e.target.checked)}
                className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
              />
              <span>{t(locale, "students.inviteCodeNotice")}</span>
            </label>

            <FormActions>
              <Button type="button" variant="secondary" onClick={onClose}>
                {t(locale, "common.cancel")}
              </Button>
              <Button type="submit" variant="primary" disabled={submitting} loading={submitting}>
                {submitting ? t(locale, "common.loading") : t(locale, "common.save")}
              </Button>
            </FormActions>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
