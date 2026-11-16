"use client";

import { useState } from "react";
import { Copy, Check, Printer, ShieldAlert, ShieldCheck } from "lucide-react";
import { t } from "@/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export interface CredentialsData {
  login: string;
  password?: string;
  loginUrl: string;
  fullName: string;
  role?: string;
  mustChangePassword?: boolean;
}

export interface CredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  credentials: CredentialsData;
  locale?: string;
  parentCredentials?: CredentialsData | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function CredentialsModal({
  isOpen,
  onClose,
  credentials,
  locale = "ru",
  parentCredentials,
}: CredentialsModalProps) {
  const [copied, setCopied] = useState(false);
  const [copiedParent, setCopiedParent] = useState(false);

  const handleCopy = (creds: CredentialsData, isParent = false) => {
    const text = [
      t(locale, "common.brandName"),
      `${t(locale, "ui4.credentialsUser")}: ${creds.fullName}`,
      `${t(locale, "ui4.credentialsLogin")}: ${creds.login}`,
      `${t(locale, "ui4.credentialsPassword")}: ${creds.password || t(locale, "ui4.credentialsExistingPassword")}`,
      `${t(locale, "ui4.credentialsLoginUrl")}: ${creds.loginUrl}`,
    ].join("\n");

    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text);
    }

    if (isParent) {
      setCopiedParent(true);
      setTimeout(() => setCopiedParent(false), 2000);
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=600,height=640");
    if (!printWindow) return;

    const title = escapeHtml(`${t(locale, "ui4.oneTimeSecretTitle")} — ${credentials.fullName}`);
    const fullName = escapeHtml(credentials.fullName);
    const login = escapeHtml(credentials.login);
    const password = credentials.password ? escapeHtml(credentials.password) : "";
    const loginUrl = escapeHtml(credentials.loginUrl);

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 32px; color: hsl(222 47% 11%); background: hsl(0 0% 100%); }
            .card { border: 1px dashed hsl(213 27% 84%); border-radius: 8px; padding: 24px; max-width: 480px; margin: 0 auto; }
            .title { font-size: 18px; font-weight: 700; margin-bottom: 4px; color: hsl(222 47% 11%); }
            .subtitle { font-size: 13px; color: hsl(215 19% 35%); margin-bottom: 20px; }
            .row { margin-bottom: 12px; }
            .label { font-size: 12px; color: hsl(215 19% 35%); font-weight: 600; }
            .val { font-size: 15px; font-weight: 600; font-family: monospace; color: hsl(222 47% 11%); margin-top: 2px; word-break: break-all; }
            .warning { font-size: 12px; color: hsl(23 83% 31%); background: hsl(48 100% 96%); border: 1px solid hsl(26 90% 37%); padding: 10px 12px; border-radius: 6px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="title">${escapeHtml(t(locale, "common.brandName"))}</div>
            <div class="subtitle">${escapeHtml(t(locale, "ui4.oneTimeSecretTitle"))}</div>
            <div class="row">
              <div class="label">${escapeHtml(t(locale, "ui4.credentialsUser"))}</div>
              <div class="val">${fullName}</div>
            </div>
            <div class="row">
              <div class="label">${escapeHtml(t(locale, "ui4.credentialsLogin"))}</div>
              <div class="val">${login}</div>
            </div>
            ${
              password
                ? `<div class="row">
                    <div class="label">${escapeHtml(t(locale, "ui4.credentialsTempPassword"))}</div>
                    <div class="val">${password}</div>
                  </div>`
                : ""
            }
            <div class="row">
              <div class="label">${escapeHtml(t(locale, "ui4.credentialsLoginUrl"))}</div>
              <div class="val">${loginUrl}</div>
            </div>
            <div class="warning">
              ${escapeHtml(t(locale, "ui4.oneTimeSecretWarn"))}
            </div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-warning/30 bg-warning-subtle text-warning-subtle-foreground">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <DialogTitle>{t(locale, "ui4.oneTimeSecretTitle")}</DialogTitle>
              <DialogDescription className="text-warning-subtle-foreground">
                {t(locale, "ui4.oneTimeSecretWarn")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                {t(locale, "ui4.credentialsUser")}
              </div>
              <div className="mt-0.5 text-sm font-semibold text-foreground">
                {credentials.fullName}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 border-t border-border pt-3 sm:grid-cols-2">
              <div>
                <div className="text-xs font-medium text-muted-foreground">
                  {t(locale, "ui4.credentialsLogin")}
                </div>
                <div className="mt-1 select-all break-all font-mono text-sm font-medium text-primary">
                  {credentials.login}
                </div>
              </div>

              {credentials.password ? (
                <div>
                  <div className="text-xs font-medium text-muted-foreground">
                    {t(locale, "ui4.credentialsTempPassword")}
                  </div>
                  <div className="mt-1 select-all break-all font-mono text-sm font-semibold text-success">
                    {credentials.password}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-xs font-medium text-muted-foreground">
                    {t(locale, "ui4.credentialsPassword")}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {t(locale, "ui4.credentialsExistingPassword")}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs">
              <span className="text-muted-foreground">{t(locale, "ui4.credentialsLoginUrl")}</span>
              <span className="font-mono text-foreground">{credentials.loginUrl}</span>
            </div>

            {credentials.mustChangePassword && (
              <Alert variant="warning" className="text-xs">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {t(locale, "ui4.credentialsMustChange")}
                </span>
              </Alert>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleCopy(credentials)}
              >
                {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                <span>
                  {copied ? t(locale, "ui4.copied") : t(locale, "ui4.copyCredentials")}
                </span>
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-3.5 w-3.5" />
                <span>{t(locale, "ui4.printCard")}</span>
              </Button>
            </div>
          </div>

          {parentCredentials && (
            <div className="space-y-3 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-medium text-success">
                    {t(locale, "ui4.parentAccount")}
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-foreground">
                    {parentCredentials.fullName}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(parentCredentials, true)}
                >
                  {copiedParent ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {copiedParent ? t(locale, "ui4.copied") : t(locale, "ui4.copyCredentials")}
                  </span>
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3 border-t border-border pt-3 text-xs sm:grid-cols-2">
                <div>
                  <span className="block text-muted-foreground">
                    {t(locale, "ui4.credentialsLogin")}
                  </span>
                  <span className="mt-0.5 block select-all font-mono text-foreground">
                    {parentCredentials.login}
                  </span>
                </div>
                {parentCredentials.password && (
                  <div>
                    <span className="block text-muted-foreground">
                      {t(locale, "ui4.credentialsTempPassword")}
                    </span>
                    <span className="mt-0.5 block select-all font-mono font-semibold text-success">
                      {parentCredentials.password}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="primary" onClick={onClose}>
            {t(locale, "ui4.savedConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
