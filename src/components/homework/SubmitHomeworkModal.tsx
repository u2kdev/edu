"use client";

import type { FormEvent } from "react";
import { Loader2, Paperclip, Send, Trash2, Upload } from "lucide-react";
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
import type { HomeworkAttachmentItem } from "./homework-utils";

interface SubmitHomeworkModalProps {
  locale: string;
  submissionText: string;
  onSubmissionTextChange: (value: string) => void;
  linkUrl: string;
  onLinkUrlChange: (value: string) => void;
  linkTitle: string;
  onLinkTitleChange: (value: string) => void;
  attachments?: HomeworkAttachmentItem[];
  isLockedAccepted?: boolean;
  uploadingFile?: boolean;
  uploadError?: string | null;
  onUploadFiles?: (files: FileList | null) => void;
  onRemoveAttachment?: (idx: number) => void;
  isSubmitting: boolean;
  submitSuccess: string | null;
  submitError: string | null;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}

export function SubmitHomeworkModal({
  locale,
  submissionText,
  onSubmissionTextChange,
  linkUrl,
  onLinkUrlChange,
  linkTitle,
  onLinkTitleChange,
  attachments = [],
  isLockedAccepted = false,
  uploadingFile = false,
  uploadError = null,
  onUploadFiles,
  onRemoveAttachment,
  isSubmitting,
  submitSuccess,
  submitError,
  onSubmit,
  onClose,
}: SubmitHomeworkModalProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>{t(locale, "homework.submitHomework")}</span>
          </DialogTitle>
        </DialogHeader>

        {isLockedAccepted && (
          <Alert variant="success">
            <AlertDescription>
              Задание уже проверено и принято. Изменение или удаление файлов недоступно.
            </AlertDescription>
          </Alert>
        )}

        {submitSuccess && (
          <Alert variant="success">
            <AlertDescription>{submitSuccess}</AlertDescription>
          </Alert>
        )}

        {submitError && (
          <Alert variant="destructive">
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        {uploadError && (
          <Alert variant="destructive">
            <AlertDescription>{uploadError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <FormField
            label={t(locale, "homework.submitHomework")}
            htmlFor="hw-submission-text"
            required
          >
            <Textarea
              id="hw-submission-text"
              value={submissionText}
              onChange={(e) => onSubmissionTextChange(e.target.value)}
              rows={4}
              required
              disabled={isLockedAccepted}
              placeholder="..."
            />
          </FormField>

          <div className="space-y-1.5">
            <span className="block text-[13px] font-medium text-foreground">
              {t(locale, "homework.links")} (GitHub, Google Drive, Figma)
            </span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input
                type="text"
                value={linkTitle}
                onChange={(e) => onLinkTitleChange(e.target.value)}
                disabled={isLockedAccepted}
                placeholder={t(locale, "homework.linkNamePlaceholder")}
              />
              <Input
                type="url"
                value={linkUrl}
                onChange={(e) => onLinkUrlChange(e.target.value)}
                disabled={isLockedAccepted}
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Файлы и фото (PDF, DOCX, изображения, архивы)
              </span>
              {!isLockedAccepted && onUploadFiles && (
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/80">
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{uploadingFile ? "Загрузка..." : "Прикрепить файл"}</span>
                  <input
                    type="file"
                    multiple
                    disabled={uploadingFile}
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
                    onChange={(e) => {
                      onUploadFiles(e.target.files);
                      e.target.value = "";
                    }}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {attachments.length > 0 && (
              <div className="space-y-1.5">
                {attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2 text-xs"
                  >
                    <a
                      href={att.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 truncate text-primary hover:underline"
                    >
                      <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{att.fileName}</span>
                    </a>
                    {!isLockedAccepted && onRemoveAttachment && (
                      <button
                        type="button"
                        onClick={() => onRemoveAttachment(idx)}
                        className="p-1 text-muted-foreground hover:text-destructive"
                        title="Удалить файл"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <FormActions>
            <Button type="button" variant="outline" onClick={onClose}>
              {t(locale, "common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting || uploadingFile || isLockedAccepted}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  <span>...</span>
                </>
              ) : (
                <span>{t(locale, "homework.submitHomework")}</span>
              )}
            </Button>
          </FormActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
