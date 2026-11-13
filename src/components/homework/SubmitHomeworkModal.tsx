"use client";

import type { FormEvent } from "react";
import { AlertCircle, CheckCircle2, Loader2, Paperclip, Send, Trash2, Upload } from "lucide-react";
import { t } from "@/i18n";
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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 w-full max-w-lg space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Send className="w-5 h-5 text-brand-400" />
          <span>{t(locale, "homework.submitHomework")}</span>
        </h3>

        {isLockedAccepted && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
            Задание уже проверено и принято. Изменение или удаление файлов недоступно.
          </div>
        )}

        {submitSuccess && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{submitSuccess}</span>
          </div>
        )}

        {submitError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {uploadError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              {t(locale, "homework.submitHomework")}
            </label>
            <textarea
              value={submissionText}
              onChange={(e) => onSubmissionTextChange(e.target.value)}
              rows={4}
              required
              disabled={isLockedAccepted}
              placeholder="..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-brand-500 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              {t(locale, "homework.links")} (GitHub, Google Drive, Figma)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={linkTitle}
                onChange={(e) => onLinkTitleChange(e.target.value)}
                disabled={isLockedAccepted}
                placeholder={t(locale, "homework.linkNamePlaceholder")}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500 disabled:opacity-60"
              />
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => onLinkUrlChange(e.target.value)}
                disabled={isLockedAccepted}
                placeholder="https://..."
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500 disabled:opacity-60"
              />
            </div>
          </div>

          {/* File Attachments */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">
                Файлы и фото (PDF, DOCX, изображения, архивы)
              </span>
              {!isLockedAccepted && onUploadFiles && (
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5" />
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
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs"
                  >
                    <a
                      href={att.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-brand-400 hover:underline truncate"
                    >
                      <Paperclip className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{att.fileName}</span>
                    </a>
                    {!isLockedAccepted && onRemoveAttachment && (
                      <button
                        type="button"
                        onClick={() => onRemoveAttachment(idx)}
                        className="p-1 text-slate-400 hover:text-rose-400"
                        title="Удалить файл"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-800 hover:bg-slate-800 text-slate-400 transition-colors"
            >
              {t(locale, "common.cancel")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || uploadingFile || isLockedAccepted}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>...</span>
                </>
              ) : (
                <span>{t(locale, "homework.submitHomework")}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
