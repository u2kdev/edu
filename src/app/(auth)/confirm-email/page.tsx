"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter, useSearchParams } from "next/navigation";

export default function ConfirmEmailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") || "";

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

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
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, [token]);

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
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
          >
            {t("auth.confirm.login")}
          </button>
        </div>
      )}
      
      {status === "error" && (
        <p className="text-red-500">{t("auth.confirm.error")}</p>
      )}
    </div>
  );
}
