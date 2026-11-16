"use client";

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
  Textarea,
} from "@/components/ui";
import type { CsvImportResult, CsvPreviewData } from "./students-utils";

export interface CsvImportModalProps {
  open: boolean;
  locale: string;
  placeholder: string;
  content: string;
  onContentChange: (value: string) => void;
  previewData: CsvPreviewData | null;
  result: CsvImportResult | null;
  loading: boolean;
  error?: string | null;
  onPreview: () => void;
  onExecute: () => void;
  onClose: () => void;
}

export function CsvImportModal({
  open,
  locale,
  placeholder,
  content,
  onContentChange,
  previewData,
  result,
  loading,
  error,
  onPreview,
  onExecute,
  onClose,
}: CsvImportModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t(locale, "students.importCsv")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <FormField
            label={t(locale, "students.csvUpload")}
            htmlFor="csv-content"
            hint={t(locale, "students.csvHelp")}
          >
            <Textarea
              id="csv-content"
              rows={6}
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              placeholder={placeholder}
              className="font-mono text-xs"
            />
          </FormField>

          {previewData && !result && (
            <div className="space-y-3 rounded-lg border border-border bg-muted p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium text-success">
                  {t(locale, "students.csvRowsValid", { count: String(previewData.validCount) })}
                </span>
                <span className="font-medium text-destructive">
                  {t(locale, "students.csvRowsError", { count: String(previewData.errorCount) })}
                </span>
              </div>

              {previewData.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertDescription>
                    <p className="font-medium mb-1">{t(locale, "students.csvImportErrorsTitle")}:</p>
                    <div className="max-h-28 overflow-y-auto space-y-1 text-xs">
                      {previewData.errors.map((err, i) => (
                        <div key={i}>
                          {t(locale, "students.csvErrorRow", { row: String(err.row), error: err.error })}
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {result && (
            <Alert variant="success">
              <AlertDescription className="space-y-1">
                <p className="font-semibold">
                  {t(locale, "students.csvImportSuccess", { count: String(result.createdCount) })}
                </p>
                {result.errors.length > 0 && (
                  <div className="text-xs text-destructive space-y-0.5 pt-1">
                    {result.errors.map((err, i) => (
                      <div key={i}>
                        {t(locale, "students.csvErrorRow", { row: String(err.row), error: err.error })}
                      </div>
                    ))}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          <FormActions className="justify-between">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t(locale, "common.close")}
            </Button>

            {!result && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={loading || !content.trim()}
                  onClick={onPreview}
                >
                  {t(locale, "students.csvPreview")}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={loading || !previewData || previewData.validCount === 0}
                  loading={loading}
                  onClick={onExecute}
                >
                  {t(locale, "common.submit")}
                </Button>
              </div>
            )}
          </FormActions>
        </div>
      </DialogContent>
    </Dialog>
  );
}
