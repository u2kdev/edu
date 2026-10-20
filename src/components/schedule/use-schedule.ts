"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/i18n";
import {
  filterScheduleSlots,
  groupSlotsByDay,
  type ScheduleFormData,
  type ScheduleGroupOption,
  type ScheduleSlotItem,
  type ScheduleTeacherOption,
  type ScheduleViewMode,
} from "./schedule-utils";

export interface UseScheduleArgs {
  initialSlots: ScheduleSlotItem[];
  groups: ScheduleGroupOption[];
  teachers: ScheduleTeacherOption[];
  locale: string;
}

export function useSchedule({ initialSlots, groups, teachers, locale }: UseScheduleArgs) {
  const router = useRouter();

  const [slots, setSlots] = useState<ScheduleSlotItem[]>(initialSlots);

  // `router.refresh()` re-renders the server page with a fresh slot list. Without
  // this sync the client kept its old array, so a newly created slot only showed
  // up after a full page reload.
  useEffect(() => {
    setSlots(initialSlots);
  }, [initialSlots]);

  const [viewMode, setViewMode] = useState<ScheduleViewMode>("week");
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingSlot, setEditingSlot] = useState<ScheduleSlotItem | null>(null);
  const [formData, setFormData] = useState<ScheduleFormData>({
    groupId: "",
    teacherMembershipId: "",
    dayOfWeek: 1,
    startTime: "09:00",
    endTime: "10:30",
    roomName: "",
    status: "ACTIVE",
    cancelledReason: "",
  });
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [conflictList, setConflictList] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Filter slots
  const filteredSlots = filterScheduleSlots(
    slots,
    selectedGroupId,
    selectedTeacherId,
    searchQuery
  );

  // Group by day of week
  const slotsByDay = groupSlotsByDay(filteredSlots);

  const openCreateModal = () => {
    setEditingSlot(null);
    setFormData({
      groupId: groups[0]?.id || "",
      teacherMembershipId: teachers[0]?.id || "",
      dayOfWeek: selectedDay,
      startTime: "09:00",
      endTime: "10:30",
      roomName: "",
      status: "ACTIVE",
      cancelledReason: "",
    });
    setErrorMsg("");
    setConflictList([]);
    setIsModalOpen(true);
  };

  const openEditModal = (slot: ScheduleSlotItem) => {
    setEditingSlot(slot);
    setFormData({
      groupId: slot.groupId,
      teacherMembershipId: slot.teacherMembershipId,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      roomName: slot.roomName || "",
      status: slot.status,
      cancelledReason: slot.cancelledReason || "",
    });
    setErrorMsg("");
    setConflictList([]);
    setIsModalOpen(true);
  };

  const handleSaveSlot = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setConflictList([]);
    setSubmitting(true);

    try {
      if (editingSlot) {
        // Update slot
        const res = await fetch("/api/tenant/schedule", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingSlot.id,
            groupId: formData.groupId,
            teacherMembershipId: formData.teacherMembershipId,
            dayOfWeek: formData.dayOfWeek,
            startTime: formData.startTime,
            endTime: formData.endTime,
            roomName: formData.roomName || null,
            status: formData.status,
            cancelledReason: formData.cancelledReason || null,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || "Failed to update slot");
          if (data.conflicts) setConflictList(data.conflicts);
          setSubmitting(false);
          return;
        }

        // Update local state
        setSlots((prev) =>
          prev.map((s) => (s.id === editingSlot.id ? { ...s, ...data.slot } : s))
        );
      } else {
        // Create slot
        const res = await fetch("/api/tenant/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupId: formData.groupId,
            teacherMembershipId: formData.teacherMembershipId,
            dayOfWeek: formData.dayOfWeek,
            startTime: formData.startTime,
            endTime: formData.endTime,
            roomName: formData.roomName || null,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || "Failed to create slot");
          if (data.conflicts) setConflictList(data.conflicts);
          setSubmitting(false);
          return;
        }

        // Reload data from server
        router.refresh();
      }

      setIsModalOpen(false);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSlot = async (id: string) => {
    if (!window.confirm(t(locale, "schedule.confirmDelete"))) return;

    try {
      const res = await fetch("/api/tenant/schedule", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setSlots((prev) => prev.filter((s) => s.id !== id));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete slot");
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      alert(error.message || "Failed to delete slot");
    }
  };

  return {
    viewMode,
    setViewMode,
    selectedDay,
    setSelectedDay,
    selectedGroupId,
    setSelectedGroupId,
    selectedTeacherId,
    setSelectedTeacherId,
    searchQuery,
    setSearchQuery,
    filteredSlots,
    slotsByDay,
    isModalOpen,
    setIsModalOpen,
    editingSlot,
    formData,
    setFormData,
    errorMsg,
    conflictList,
    submitting,
    openCreateModal,
    openEditModal,
    handleSaveSlot,
    handleDeleteSlot,
  };
}
