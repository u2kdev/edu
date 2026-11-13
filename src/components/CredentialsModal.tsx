"use client";

import { useState } from "react";
import { Copy, Check, Printer, AlertTriangle, ShieldCheck, X } from "lucide-react";
import { t } from "@/i18n";

export interface CredentialsData {
  login: string;
  password?: string;
  loginUrl: string;
  fullName: string;
  role?: string;
  mustChangePassword?: boolean;
}

interface CredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  credentials: CredentialsData;
  locale?: string;
  parentCredentials?: CredentialsData | null;
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

  if (!isOpen) return null;

  const handleCopy = (creds: CredentialsData, isParent = false) => {
    const text = `e-darschi LMS\n${t(locale, "common.fullName")}: ${creds.fullName}\nЛогин: ${creds.login}\nПароль: ${creds.password || "(уже установлен)"}\nВход: ${creds.loginUrl}`;
    navigator.clipboard.writeText(text);
    if (isParent) {
      setCopiedParent(true);
      setTimeout(() => setCopiedParent(false), 2000);
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=600,height=600");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Данные для входа — ${credentials.fullName}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #1e293b; }
            .card { border: 2px dashed #cbd5e1; border-radius: 12px; padding: 24px; max-width: 480px; margin: 0 auto; }
            .title { font-size: 20px; font-weight: bold; margin-bottom: 4px; color: #0f172a; }
            .subtitle { font-size: 13px; color: #64748b; margin-bottom: 20px; }
            .row { margin-bottom: 12px; }
            .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 600; }
            .val { font-size: 16px; font-weight: bold; font-family: monospace; color: #0f172a; margin-top: 2px; }
            .warning { font-size: 12px; color: #b45309; background: #fef3c7; padding: 10px; border-radius: 6px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="title">e-darschi LMS</div>
            <div class="subtitle">Карточка доступа пользователя</div>
            <div class="row">
              <div class="label">ФИО</div>
              <div class="val">${credentials.fullName}</div>
            </div>
            <div class="row">
              <div class="label">Логин (Email / Телефон)</div>
              <div class="val">${credentials.login}</div>
            </div>
            ${
              credentials.password
                ? `<div class="row">
                    <div class="label">Временный пароль</div>
                    <div class="val">${credentials.password}</div>
                  </div>`
                : ""
            }
            <div class="row">
              <div class="label">Адрес входа</div>
              <div class="val">${credentials.loginUrl}</div>
            </div>
            <div class="warning">
              Сохраните пароль. При первом входе потребуется изменить пароль на собственный.
            </div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Данные для входа</h2>
              <p className="text-xs text-amber-400/90 font-medium flex items-center gap-1 mt-0.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Показываются только один раз
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Credentials Display Card */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Пользователь
            </span>
            <div className="text-base font-bold text-white mt-0.5">
              {credentials.fullName}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/60">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Логин для входа
              </span>
              <div className="text-sm font-mono font-medium text-brand-300 mt-1 select-all break-all">
                {credentials.login}
              </div>
            </div>

            {credentials.password ? (
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Временный пароль
                </span>
                <div className="text-sm font-mono font-bold text-emerald-400 mt-1 select-all tracking-wider">
                  {credentials.password}
                </div>
              </div>
            ) : (
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Пароль
                </span>
                <div className="text-xs text-slate-400 mt-1">
                  Используется существующий пароль пользователя
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
            <span>Адрес входа:</span>
            <span className="font-mono text-slate-300">{credentials.loginUrl}</span>
          </div>

          {credentials.mustChangePassword && (
            <div className="text-[11px] text-amber-300/80 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5">
              Пользователю будет предложено изменить пароль при первом входе в систему.
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => handleCopy(credentials)}
              className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Скопировано!" : "Копировать"}</span>
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Печать карточки</span>
            </button>
          </div>
        </div>

        {/* Optional Parent Credentials if created together */}
        {parentCredentials && (
          <div className="bg-slate-950/80 border border-emerald-900/30 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                  Аккаунт родителя
                </span>
                <div className="text-sm font-bold text-white mt-0.5">
                  {parentCredentials.fullName}
                </div>
              </div>
              <button
                onClick={() => handleCopy(parentCredentials, true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700"
              >
                {copiedParent ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedParent ? "Скопировано!" : "Копировать"}</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Логин</span>
                <span className="text-slate-300">{parentCredentials.login}</span>
              </div>
              {parentCredentials.password && (
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Пароль</span>
                  <span className="text-emerald-400 font-bold">{parentCredentials.password}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl shadow-lg transition-colors"
          >
            Понятно, я сохранил данные
          </button>
        </div>
      </div>
    </div>
  );
}
