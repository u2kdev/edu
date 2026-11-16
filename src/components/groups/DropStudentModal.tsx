"use client";

import type { FormEvent } from "react";
import { UserMinus } from "lucide-react";
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

interface DropStudentModalProps {
  open: boolean;
  locale: string;
  studentName: string;
  reason: string;
  onReasonChange: (value: string) => void;
  reasonPlaceholder: string;
  preview?: {
    hasPaidRemaining: boolean;
    remainingDays: number;
    remainingAmount: number;
    paidUntil: string | null;
  } | null;
  previewLoading?: boolean;
  onLoadPreview?: () => void;
  refundAction?: "keep_balance" | "refund";
  onRefundActionChange?: (action: "keep_balance" | "refund") => void;
  loading: boolean;
  error?: string | null;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}

export function DropStudentModal({
  open,
  locale,
  studentName,
  reason,
  onReasonChange,
  reasonPlaceholder,
  preview,
  previewLoading = false,
  onLoadPreview,
  refundAction = "keep_balance",
  onRefundActionChange,
  loading,
  error,
  onSubmit,
  onClose,
}: DropStudentModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserMinus className="h-4 w-4 text-destructive" aria-hidden="true" />
            <span>{t(locale, "groups.removeStudent")}</span>
          </DialogTitle>
          <DialogDescription>
            {t(locale, "groups.dropConfirm", { name: studentName })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <FormField label={t(locale, "groups.dropReasonPrompt")} htmlFor="drop-reason" required>
            <Input
              id="drop-reason"
              type="text"
              required
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder={reasonPlaceholder}
            />
          </FormField>

          {!preview && onLoadPreview && (
            <button
              type="button"
              disabled={previewLoading}
              onClick={onLoadPreview}
              className="text-xs font-medium text-warning hover:underline disabled:opacity-50"
            >
              {previewLoading
                ? t(locale, "common.loading")
                : locale === "uz-Latn"
                  ? "Qaytarish qoldigʻini hisoblash"
                  : "Рассчитать остаток к возврату"}
            </button>
          )}

          {preview && !preview.hasPaidRemaining && (
            <div className="text-xs text-muted-foreground">
              {locale === "uz-Latn"
                ? "Foydalanilmagan toʻlov qoldigʻi yoʻq."
                : "Неиспользованного остатка нет."}
            </div>
          )}

          {preview?.hasPaidRemaining && (
            <Alert variant="warning">
              <AlertDescription className="space-y-2.5 text-xs">
                <div className="font-semibold">
                  {locale === "uz-Latn"
                    ? `Foydalanilmagan qoldiq: ${preview.remainingAmount.toLocaleString("ru-RU")} UZS (${preview.remainingDays} kun)`
                    : `Неиспользованный остаток: ${preview.remainingAmount.toLocaleString("ru-RU")} UZS (${preview.remainingDays} дн.)`}
                </div>
                {onRefundActionChange && (
                  <div className="space-y-1.5 text-foreground">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="refundAction"
                        checked={refundAction === "keep_balance"}
                        onChange={() => onRefundActionChange("keep_balance")}
                        className="h-4 w-4 border-input text-primary focus:ring-ring"
                      />
                      <span>{t(locale, "billing.dropKeepBalance")}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="refundAction"
                        checked={refundAction === "refund"}
                        onChange={() => onRefundActionChange("refund")}
                        className="h-4 w-4 border-input text-primary focus:ring-ring"
                      />
                      <span>{t(locale, "billing.dropRefundOption")}</span>
                    </label>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          <FormActions>
            <Button type="button" variant="secondary" onClick={onClose}>
              {t(locale, "common.cancel")}
            </Button>
            <Button type="submit" variant="destructive" disabled={loading} loading={loading}>
              {loading ? t(locale, "common.loading") : t(locale, "groups.removeStudent")}
            </Button>
          </FormActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
