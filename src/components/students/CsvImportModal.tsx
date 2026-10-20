"use client";

import { FileText } from "lucide-react";
import { t } from "@/i18n";
import type { CsvImportResult, CsvPreviewData } from "./students-utils";

interface CsvImportModalProps {
  locale: string;
  placeholder: string;
  content: string;
  onContentChange: (value: string) => void;
  previewData: CsvPreviewData | null;
  result: CsvImportResult | null;
  loading: boolean;
  onPreview: () => void;
  onExecute: () => void;
  onClose: () => void;
}

export function CsvImportModal({
  locale,
  placeholder,
  content,
  onContentChange,
  previewData,
  result,
  loading,
  onPreview,
  onExecute,
  onClose,
}: CsvImportModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-xl p-6 rounded-3xl border border-slate-800 space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-brand-400" />
          <span>{t(locale, "students.importCsv")}</span>
        </h3>

        <p className="text-xs text-slate-400">
          {t(locale, "students.csvHelp")}
        </p>

        <textarea
          rows={6}
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder={placeholder}
          className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
        />

        {/* Preview Results */}
        {previewData && !result && (
          <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2 text-xs">
            <div className="flex gap-4">
              <span className="text-emerald-400 font-semibold">
                {t(locale, "students.csvRowsValid", {
                  count: previewData.validCount,
                })}
              </span>
              {previewData.errorCount > 0 && (
                <span className="text-rose-400 font-semibold">
                  {t(locale, "students.csvRowsError", {
                    count: previewData.errorCount,
                  })}
                </span>
              )}
            </div>

            {previewData.errors.length > 0 && (
              <div className="max-h-24 overflow-y-auto space-y-1 p-2 bg-rose-500/10 rounded border border-rose-500/20 text-rose-300">
                <p className="font-bold">{t(locale, "students.csvImportErrorsTitle")}:</p>
                {previewData.errors.map((err, i) => (
                  <p key={i} className="font-mono text-[11px]">
                    {t(locale, "students.csvErrorRow", {
                      row: String(err.row),
                      error: err.error,
                    })}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Execution Report */}
        {result && (
          <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 space-y-2 text-xs">
            <p className="text-emerald-300 font-bold">
              {t(locale, "students.csvImportSuccess", {
                count: result.createdCount,
              })}
            </p>
            {result.errors.length > 0 && (
              <div className="max-h-24 overflow-y-auto space-y-1 p-2 bg-rose-500/10 rounded border border-rose-500/20 text-rose-300">
                <p className="font-bold">{t(locale, "students.csvImportErrorsTitle")}:</p>
                {result.errors.map((err, i) => (
                  <p key={i} className="font-mono text-[11px]">
                    {t(locale, "students.csvErrorRow", {
                      row: String(err.row),
                      error: err.error,
                    })}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between items-center pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs"
          >
            {t(locale, "common.close")}
          </button>

          <div className="flex gap-2">
            {!result && (
              <>
                <button
                  type="button"
                  disabled={loading || !content.trim()}
                  onClick={onPreview}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs border border-slate-700 disabled:opacity-50"
                >
                  {t(locale, "students.csvPreview")}
                </button>
                <button
                  type="button"
                  disabled={loading || !previewData || previewData.validCount === 0}
                  onClick={onExecute}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-brand-600/30 disabled:opacity-50"
                >
                  {loading ? t(locale, "common.loading") : t(locale, "common.submit")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
