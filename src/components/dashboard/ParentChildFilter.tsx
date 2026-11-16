"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

interface ChildNavItem {
  studentMembershipId: string;
  fullName: string;
}

function SwitcherInner({
  childrenList,
  locale = "ru",
}: {
  childrenList: ChildNavItem[];
  locale?: string;
}) {
  const searchParams = useSearchParams();
  const selectedChildFilter = searchParams?.get("childId") || null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
      <span className="mr-1 text-xs font-medium text-muted-foreground">
        {t(locale, "shell.parentChildLabel")}:
      </span>
      <Link
        href="/center"
        className={cn(
          "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
          !selectedChildFilter
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:text-foreground"
        )}
      >
        {t(locale, "shell.parentChildAll")} ({childrenList.length})
      </Link>
      {childrenList.map((c) => {
        const active = selectedChildFilter === c.studentMembershipId;
        return (
          <Link
            key={c.studentMembershipId}
            href={`/center?childId=${encodeURIComponent(c.studentMembershipId)}`}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {c.fullName}
          </Link>
        );
      })}
    </div>
  );
}

export function ParentChildSwitcherBar({
  childrenList,
  locale = "ru",
}: {
  childrenList: ChildNavItem[];
  locale?: string;
}) {
  if (childrenList.length <= 1) return null;
  return (
    <Suspense fallback={null}>
      <SwitcherInner childrenList={childrenList} locale={locale} />
    </Suspense>
  );
}

function SlotInner({
  studentMembershipId,
  initialSelectedChildId,
  children,
}: {
  studentMembershipId: string;
  initialSelectedChildId?: string | null;
  children: ReactNode;
}) {
  const searchParams = useSearchParams();
  const selectedChildFilter = searchParams?.get("childId") || initialSelectedChildId || null;
  if (selectedChildFilter && selectedChildFilter !== studentMembershipId) {
    return null;
  }
  return <>{children}</>;
}

export function ParentChildFilterSlot({
  studentMembershipId,
  initialSelectedChildId,
  children,
}: {
  studentMembershipId: string;
  initialSelectedChildId?: string | null;
  children: ReactNode;
}) {
  return (
    <Suspense fallback={<>{children}</>}>
      <SlotInner
        studentMembershipId={studentMembershipId}
        initialSelectedChildId={initialSelectedChildId}
      >
        {children}
      </SlotInner>
    </Suspense>
  );
}
