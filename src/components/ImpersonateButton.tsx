"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Loader2 } from "lucide-react";

interface ImpersonateButtonProps {
  targetUserId: string;
  targetCenterId?: string;
  label?: string;
}

export default function ImpersonateButton({
  targetUserId,
  targetCenterId,
  label = "Войти как",
}: ImpersonateButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleImpersonate() {
    setLoading(true);
    try {
      const res = await fetch("/api/platform/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, targetCenterId }),
      });

      const data = await res.json();
      if (res.ok) {
        window.location.href = "/center";
      } else {
        alert(data.error || "Ошибка входа от имени пользователя");
      }
    } catch (err) {
      alert("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleImpersonate}
      disabled={loading}
      className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold rounded-lg border border-red-500/20 transition-all flex items-center gap-1.5 ml-auto disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Eye className="w-3.5 h-3.5" />
      )}
      <span>{label}</span>
    </button>
  );
}
