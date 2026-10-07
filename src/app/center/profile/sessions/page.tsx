"use client";

import { useState, useEffect } from "react";
import { t } from "@/lib/i18n";

interface Session {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  isCurrent: boolean;
}

export default function MySessionsPage() {
  const locale = "ru";
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch("/api/auth/sessions");
      const data = await res.json();
      if (res.ok) {
        setSessions(data.success ? data.sessions : data.sessions);
      } else {
        setError(t(data.error?.message || "common.error", locale));
      }
    } catch (err) {
      setError(t("common.error", locale));
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    try {
      const res = await fetch(`/api/auth/sessions?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== id));
      } else {
        const data = await res.json();
        alert(t(data.error?.message || "common.error", locale));
      }
    } catch (err) {
      alert(t("common.error", locale));
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAll = async () => {
    if (!confirm(t("profile.confirmRevokeAll", locale))) return;
    
    setRevokingAll(true);
    try {
      const res = await fetch("/api/auth/sessions?allButCurrent=true", { method: "DELETE" });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.isCurrent));
      } else {
        const data = await res.json();
        alert(t(data.error?.message || "common.error", locale));
      }
    } catch (err) {
      alert(t("common.error", locale));
    } finally {
      setRevokingAll(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-900">
          {t("profile.myDevices", locale)}
        </h1>
        {sessions.length > 1 && (
          <button
            onClick={handleRevokeAll}
            disabled={revokingAll}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {revokingAll ? t("common.loading", locale) : t("profile.revokeAll", locale)}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded mb-6 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-gray-500 text-center py-10">
          {t("common.loading", locale)}
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-gray-500 text-center py-10 bg-gray-50 rounded-lg border border-gray-100">
          {t("profile.noDevices", locale)}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`relative flex flex-col justify-between rounded-lg border p-5 shadow-sm ${
                session.isCurrent ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900 truncate" title={session.userAgent || "Unknown Device"}>
                    {session.userAgent ? (session.userAgent.length > 30 ? session.userAgent.substring(0, 30) + "..." : session.userAgent) : "Unknown Device"}
                  </h3>
                  {session.isCurrent && (
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                      {t("profile.currentDevice", locale)}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-sm text-gray-500 flex flex-col gap-1">
                  <span>IP: {session.ipAddress || "N/A"}</span>
                  <span>{t("profile.lastSeen", locale)}: {new Date(session.lastSeenAt).toLocaleString()}</span>
                  <span>{t("profile.loginDate", locale)}: {new Date(session.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              
              {!session.isCurrent && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => handleRevoke(session.id)}
                    disabled={revokingId === session.id}
                    className="text-sm font-medium text-red-600 hover:text-red-500 disabled:opacity-50"
                  >
                    {revokingId === session.id ? t("common.loading", locale) : t("profile.revokeSession", locale)}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
