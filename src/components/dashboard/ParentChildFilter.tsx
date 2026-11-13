"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";

interface ChildNavItem {
  studentMembershipId: string;
  fullName: string;
}

function SwitcherInner({ childrenList }: { childrenList: ChildNavItem[] }) {
  const searchParams = useSearchParams();
  const selectedChildFilter = searchParams.get("childId");

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-2">
        Переключение между детьми:
      </span>
      <Link
        href="/center"
        className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
          !selectedChildFilter
            ? "bg-brand-600 text-white shadow-lg shadow-brand-600/20"
            : "bg-slate-800 text-slate-300 hover:bg-slate-700"
        }`}
      >
        Все дети ({childrenList.length})
      </Link>
      {childrenList.map((c) => (
        <Link
          key={c.studentMembershipId}
          href={`/center?childId=${c.studentMembershipId}`}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            selectedChildFilter === c.studentMembershipId
              ? "bg-brand-600 text-white shadow-lg shadow-brand-600/20"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          {c.fullName}
        </Link>
      ))}
    </div>
  );
}

export function ParentChildSwitcherBar({ childrenList }: { childrenList: ChildNavItem[] }) {
  if (childrenList.length <= 1) return null;
  return (
    <Suspense fallback={null}>
      <SwitcherInner childrenList={childrenList} />
    </Suspense>
  );
}

function SlotInner({
  studentMembershipId,
  children,
}: {
  studentMembershipId: string;
  children: ReactNode;
}) {
  const searchParams = useSearchParams();
  const selectedChildFilter = searchParams.get("childId");
  if (selectedChildFilter && selectedChildFilter !== studentMembershipId) {
    return null;
  }
  return <>{children}</>;
}

export function ParentChildFilterSlot({
  studentMembershipId,
  children,
}: {
  studentMembershipId: string;
  children: ReactNode;
}) {
  return (
    <Suspense fallback={<>{children}</>}>
      <SlotInner studentMembershipId={studentMembershipId}>{children}</SlotInner>
    </Suspense>
  );
}
