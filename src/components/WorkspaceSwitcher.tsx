"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";

interface WorkspaceSwitcherProps {
  memberships: {
    id: string;
    centerId: string;
    centerName: string;
    centerSlug: string;
    centerStatus: string;
    role: string;
  }[];
  activeCenterId?: string;
  platformRole: string;
}

export default function WorkspaceSwitcher({
  memberships,
  activeCenterId,
  platformRole,
}: WorkspaceSwitcherProps) {
  const router = useRouter();

  const active = memberships.find((m) => m.centerId === activeCenterId) || memberships[0];

  const handleSwitch = async (centerId: string) => {
    try {
      const res = await fetch("/api/auth/switch-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ centerId }),
      });
      if (res.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const isPlatformStaff = platformRole === "SUPERADMIN" || platformRole === "PLATFORM_ADMIN";

  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
        Текущий Воркспейс
      </label>

      {memberships.length > 0 ? (
        <select
          value={active?.centerId || ""}
          onChange={(e) => handleSwitch(e.target.value)}
          className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-sm font-medium text-white focus:outline-none focus:border-brand-500 transition-colors"
        >
          {memberships.map((m) => (
            <option key={m.id} value={m.centerId}>
              {m.centerName} ({m.role})
            </option>
          ))}
        </select>
      ) : (
        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400">
          Нет активных центров
        </div>
      )}

      {isPlatformStaff && (
        <Link
          href="/dashboard/platform"
          className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 font-medium transition-colors pt-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Создать центр (Платформа)</span>
        </Link>
      )}
    </div>
  );
}
