"use client";

import { useEffect, useState, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { useRouter, useSearchParams } from "next/navigation";

function ConfirmEmailContent() {
  const { t } = useTranslation();
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
        setResendMsg(t("auth.confirm.resend_success"));
      } else {
        setResendMsg(t("auth.confirm.resend_error"));
      }
    } catch {
      setResendMsg(t("auth.confirm.resend_error"));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white shadow-md rounded-md text-center">
      <h2 className="text-2xl font-semibold mb-6">{t("auth.confirm.title")}</h2>
      
      {status === "loading" && (
        <p className="text-gray-600">{t("auth.confirm.loading")}</p>
      )}
      
      {status === "success" && (
        <div>
          <p className="text-green-600 mb-4">{t("auth.confirm.success")}</p>
          <button
            onClick={() => router.push("/login")}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
          >
            {t("auth.confirm.login")}
          </button>
        </div>
      )}
      
      {status === "expired" && (
        <div>
          <p className="text-yellow-600 mb-4">{t("auth.confirm.expired")}</p>
          <button
            onClick={handleResend}
            disabled={resending}
            className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-200"
          >
            {resending ? t("auth.confirm.loading") : t("auth.confirm.resend")}
          </button>
          {resendMsg && <p className="mt-2 text-sm">{resendMsg}</p>}
        </div>
      )}
      
      {status === "error" && (
        <div>
          <p className="text-red-500 mb-4">{t("auth.confirm.error")}</p>
          <button
            onClick={handleResend}
            disabled={resending}
            className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-200"
          >
            {resending ? t("auth.confirm.loading") : t("auth.confirm.resend")}
          </button>
          {resendMsg && <p className="mt-2 text-sm">{resendMsg}</p>}
        </div>
      )}
    </div>
  );
}

export default function ConfirmEmailPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ConfirmEmailContent />
    </Suspense>
  );
}
