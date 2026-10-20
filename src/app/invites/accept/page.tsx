"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, LogIn, AlertTriangle, Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";

type Status = "loading" | "success" | "unauthorized" | "error";

function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const pendingInviteId = searchParams?.get("pendingInviteId") || "";

  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!pendingInviteId) {
      setStatus("error");
      setMessage("Ссылка приглашения недействительна.");
      return;
    }

    let cancelled = false;

    fetch("/api/auth/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pendingInviteId }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 200 && data.success) {
          setStatus("success");
        } else if (res.status === 401) {
          setStatus("unauthorized");
        } else {
          setStatus("error");
          setMessage(data?.error?.message || "Не удалось принять приглашение.");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("error");
          setMessage("Не удалось принять приглашение. Попробуйте позже.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pendingInviteId]);

  const loginHref = `/login?next=${encodeURIComponent(
    `/invites/accept?pendingInviteId=${pendingInviteId}`
  )}`;

  return (
    <AuthShell>
      <div className="space-y-5 text-center">
        {status === "loading" && (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-[color:var(--brand)]" />
            <p className="text-sm text-ink-muted">Принимаем приглашение…</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Приглашение принято</h1>
            <p className="text-sm text-ink-muted">Доступ к учебному центру открыт.</p>
            <Link
              href="/center"
              className="inline-flex w-full cursor-pointer items-center justify-center rounded-xl bg-[color:var(--brand)] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_-16px_rgba(29,78,216,0.8)] transition-all hover:bg-[color:var(--brand-strong)] active:scale-[0.99]"
            >
              Перейти в кабинет
            </Link>
          </>
        )}

        {status === "unauthorized" && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[color:var(--line)] bg-[color:var(--brand-soft)] text-[color:var(--brand)]">
              <LogIn className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Войдите, чтобы принять приглашение
            </h1>
            <p className="text-pretty text-sm text-ink-muted">
              Войдите под email, на который пришло приглашение, затем мы примем его автоматически.
            </p>
            <Link
              href={loginHref}
              className="inline-flex w-full cursor-pointer items-center justify-center rounded-xl bg-[color:var(--brand)] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_-16px_rgba(29,78,216,0.8)] transition-all hover:bg-[color:var(--brand-strong)] active:scale-[0.99]"
            >
              Войти
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-100 bg-amber-50 text-amber-600">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Не удалось принять приглашение
            </h1>
            <p className="text-pretty text-sm text-ink-muted">{message}</p>
            <Link
              href="/login"
              className="inline-flex w-full cursor-pointer items-center justify-center rounded-xl bg-[color:var(--brand)] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_-16px_rgba(29,78,216,0.8)] transition-all hover:bg-[color:var(--brand-strong)] active:scale-[0.99]"
            >
              Войти
            </Link>
          </>
        )}
      </div>
    </AuthShell>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div data-theme="light" className="public-shell mesh-gradient-light flex min-h-screen items-center justify-center font-strict">
          <Loader2 className="h-8 w-8 animate-spin text-[color:var(--brand)]" />
        </div>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  );
}
