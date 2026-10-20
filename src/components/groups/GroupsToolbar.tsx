"use client";

import { Plus } from "lucide-react";
import { t } from "@/i18n";

interface GroupsToolbarProps {
  locale: string;
  canEdit: boolean;
  onOpenCreate: () => void;
}

export function GroupsToolbar({ locale, canEdit, onOpenCreate }: GroupsToolbarProps) {
  return (
    <>
      {canEdit && (
        <div className="flex justify-end">
          <button
            onClick={onOpenCreate}
            className="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-brand-600/30 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>{t(locale, "groups.createGroup")}</span>
          </button>
        </div>
      )}
    </>
  );
}
