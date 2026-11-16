"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    } catch {
      alert("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleImpersonate}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Eye className="w-3.5 h-3.5" aria-hidden="true" />
      )}
      <span>{label}</span>
    </Button>
  );
}
