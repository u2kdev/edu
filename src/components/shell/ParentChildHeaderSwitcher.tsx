"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { UserCheck } from "lucide-react";
import { PARENT_CHILD_COOKIE } from "@/lib/sidebar-constants";
import { t } from "@/i18n";

export interface ParentChildOption {
  studentMembershipId: string;
  fullName: string;
}

interface ParentChildHeaderSwitcherProps {
  childrenList: ParentChildOption[];
  initialSelectedChildId?: string | null;
  locale: string;
}

export function ParentChildHeaderSwitcher({
  childrenList,
  initialSelectedChildId,
  locale,
}: ParentChildHeaderSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryChildId = searchParams?.get("childId") || "";

  const [selectedId, setSelectedId] = useState<string>(() => {
    if (queryChildId && childrenList.some((c) => c.studentMembershipId === queryChildId)) {
      return queryChildId;
    }
    if (
      initialSelectedChildId &&
      childrenList.some((c) => c.studentMembershipId === initialSelectedChildId)
    ) {
      return initialSelectedChildId;
    }
    return "";
  });

  useEffect(() => {
    if (queryChildId && childrenList.some((c) => c.studentMembershipId === queryChildId)) {
      setSelectedId(queryChildId);
    } else if (!queryChildId && initialSelectedChildId) {
      if (childrenList.some((c) => c.studentMembershipId === initialSelectedChildId)) {
        setSelectedId(initialSelectedChildId);
      }
    }
  }, [queryChildId, initialSelectedChildId, childrenList]);

  if (childrenList.length === 0) return null;

  const handleChange = (nextChildId: string) => {
    setSelectedId(nextChildId);
    if (typeof document !== "undefined") {
      if (nextChildId) {
        document.cookie = `${PARENT_CHILD_COOKIE}=${encodeURIComponent(nextChildId)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
      } else {
        document.cookie = `${PARENT_CHILD_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
      }
    }

    const params = new URLSearchParams(searchParams?.toString() || "");
    if (nextChildId) {
      params.set("childId", nextChildId);
    } else {
      params.delete("childId");
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
    router.refresh();
  };

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <UserCheck className="w-4 h-4 text-muted-foreground hidden sm:block shrink-0" aria-hidden="true" />
      <select
        aria-label={t(locale, "shell.parentChildLabel")}
        value={selectedId}
        onChange={(e) => handleChange(e.target.value)}
        className="min-h-[40px] max-w-[160px] sm:max-w-[200px] rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs sm:text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring truncate"
      >
        <option value="">
          {t(locale, "shell.parentChildAll")} ({childrenList.length})
        </option>
        {childrenList.map((child) => (
          <option key={child.studentMembershipId} value={child.studentMembershipId}>
            {child.fullName}
          </option>
        ))}
      </select>
    </div>
  );
}
