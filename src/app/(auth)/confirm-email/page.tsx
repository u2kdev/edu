"use client";

import { useEffect, useState, Suspense } from "react";
import { t } from "@/i18n";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, AlertTriangle, Loader2, Clock } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";

function ConfirmEmailContent() {
  const locale = "ru";
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") || "";

  const [status, setStatus] = useState<"loading" | "success" | "error" | "expired">("loading");
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }

    fetch("/api/auth/confirm-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json().then(data => ({ status: res.status, data })))
      .then(({ status, data }) => {
        if (status === 200 && data.success) {
          setStatus("success");
        } else if (data.error?.code === "EXPIRED" || data.error === "auth.confirm.expired") {
          setStatus("expired");
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, [token]);

  const handleResend = async () => {
    setResending(true);
    setResendMsg("");
    try {
      const res = await fetch("/api/auth/resend-confirm", {
        method: "POST",
      });
      if (res.ok) {
        setResendMsg(t(locale, "auth.confirm.resend_success"));
      } else {
        setResendMsg(t(locale, "auth.confirm.resend_error"));
      }
    } catch {
      setResendMsg(t(locale, "auth.confirm.resend_error"));
    } finally {
      setResending(false);
    }
  };

  const resendButton = (
    <button
      onClick={handleResend}
      disabled={resending}
      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-ink-soft transition-colors hover:bg-[color:var(--paper-2)] disabled:opacity-60"
    >
      {resending ? t(locale, "auth.confirm.loading") : t(locale, "auth.confirm.resend")}
    </button>
  );

  return (
    <AuthShell title={t(locale, "auth.confirm.title")}>
      {status === "loading" && (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[color:var(--brand)]" />
          <p className="text-sm text-ink-muted">{t(locale, "auth.confirm.loading")}</p>
        </div>
      )}

      {status === "success" && (
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <p className="text-sm font-medium text-emerald-700">{t(locale, "auth.confirm.success")}</p>
          <button
            onClick={() => router.push("/login")}
            className="flex w-full cursor-pointer items-center justify-center rounded-xl bg-[color:var(--brand)] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_-16px_rgba(29,78,216,0.8)] transition-all hover:bg-[color:var(--brand-strong)] active:scale-[0.99]"
          >
            {t(locale, "auth.confirm.login")}
          </button>
        </div>
      )}

      {status === "expired" && (
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-100 bg-amber-50 text-amber-600">
            <Clock className="h-7 w-7" />
          </div>
          <p className="text-sm font-medium text-amber-700">{t(locale, "auth.confirm.expired")}</p>
          {resendButton}
          {resendMsg && <p className="text-sm text-ink-muted">{resendMsg}</p>}
        </div>
      )}

      {status === "error" && (
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-100 bg-rose-50 text-rose-600">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <p className="text-sm font-medium text-rose-600">{t(locale, "auth.confirm.error")}</p>
          {resendButton}
          {resendMsg && <p className="text-sm text-ink-muted">{resendMsg}</p>}
        </div>
      )}
    </AuthShell>
  );
}

export default function ConfirmEmailPage() {
  return (
    <Suspense
      fallback={
        <div data-theme="light" className="public-shell mesh-gradient-light flex min-h-screen items-center justify-center font-strict">
          <Loader2 className="h-8 w-8 animate-spin text-[color:var(--brand)]" />
        </div>
      }
    >
      <ConfirmEmailContent />
    </Suspense>
  );
}
