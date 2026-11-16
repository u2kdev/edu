"use client";

import * as React from "react";
import { t } from "@/i18n";
import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { Input } from "./input";
import { Label } from "./label";
import { Textarea } from "./textarea";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "primary";
  loading?: boolean;
  locale?: string;
  /** Optional required/optional reason prompt replacing window.prompt + confirm */
  reasonLabel?: string;
  reasonPlaceholder?: string;
  reasonRequired?: boolean;
  reasonMinLength?: number;
  reasonMultiline?: boolean;
  onConfirm: (reason?: string) => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = "destructive",
  loading = false,
  locale = "ru",
  reasonLabel,
  reasonPlaceholder,
  reasonRequired = false,
  reasonMinLength = 0,
  reasonMultiline = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
    }
  }, [open]);

  const handleConfirm = async () => {
    const trimmed = reason.trim();
    if (reasonLabel && reasonRequired && trimmed.length < Math.max(1, reasonMinLength)) {
      setError(
        reasonMinLength > 0
          ? t(locale, "ui4.minReasonError", { count: reasonMinLength })
          : t(locale, "common.required")
      );
      return;
    }
    setError(null);
    await onConfirm(reasonLabel ? trimmed : undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent locale={locale} className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {reasonLabel && (
          <div className="space-y-1.5">
            <Label htmlFor="confirm-dialog-reason">
              {reasonLabel}
              {reasonRequired && <span className="text-destructive ml-0.5">*</span>}
            </Label>
            {reasonMultiline ? (
              <Textarea
                id="confirm-dialog-reason"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={reasonPlaceholder}
                rows={3}
                aria-invalid={Boolean(error)}
              />
            ) : (
              <Input
                id="confirm-dialog-reason"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={reasonPlaceholder}
                aria-invalid={Boolean(error)}
              />
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel ?? t(locale, "common.cancel")}
          </Button>
          <Button
            type="button"
            variant={variant}
            loading={loading}
            onClick={() => void handleConfirm()}
          >
            {confirmLabel ?? t(locale, "common.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
