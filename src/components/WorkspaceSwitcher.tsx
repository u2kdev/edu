"use client";

import { useRouter } from "next/navigation";
import { t } from "@/i18n";

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
  locale?: string;
}

export default function WorkspaceSwitcher({
  memberships,
  activeCenterId,
  locale = "ru",
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

  if (memberships.length <= 1) {
    return null;
  }

  return (
    <div className="space-y-1.5">
      <label
        htmlFor="edarschi-workspace-switcher"
        className="block text-xs font-medium text-muted-foreground"
      >
        {t(locale, "shell.switchWorkspace")}
      </label>

      <select
        id="edarschi-workspace-switcher"
        aria-label={t(locale, "shell.switchWorkspace")}
        value={active?.centerId || ""}
        onChange={(e) => handleSwitch(e.target.value)}
        className="w-full min-h-[40px] py-2 px-3 bg-background border border-input rounded-lg text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
      >
        {memberships.map((m) => (
          <option key={m.id} value={m.centerId}>
            {m.centerName} ({t(locale, `roles.${m.role}`) || m.role})
          </option>
        ))}
      </select>
    </div>
  );
}
