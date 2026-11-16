"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/i18n";
import {
  canEditGroups,
  firstOtherGroupId,
  type CourseOption,
  type DropTarget,
  type GroupEnrollment,
  type GroupItem,
  type TeacherOption,
  type AssistantOption,
  type TransferTarget,
} from "./groups-utils";

export interface GroupsMessages {
  createError: string;
  networkError: string;
}

export interface UseGroupsArgs {
  initialGroups: GroupItem[];
  courses: CourseOption[];
  teachers: TeacherOption[];
  assistants?: AssistantOption[];
  role?: string;
  locale: string;
  messages: GroupsMessages;
}

export function useGroups({
  initialGroups,
  courses,
  teachers,
  assistants = [],
  role,
  locale,
  messages,
}: UseGroupsArgs) {
  const router = useRouter();
  const [groups, setGroups] = useState(initialGroups);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Filters & view state
  const [search, setSearch] = useState("");
  const [filterCourseId, setFilterCourseId] = useState("");
  const [filterTeacherId, setFilterTeacherId] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [detailGroupId, setDetailGroupId] = useState<string | null>(null);

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [courseId, setCourseId] = useState(courses[0]?.id || "");
  const [name, setName] = useState("");
  const [teacherMembershipId, setTeacherMembershipId] = useState("");
  const [assistantMembershipId, setAssistantMembershipId] = useState("");
  const [maxStudents, setMaxStudents] = useState("30");
  const [price1, setPrice1] = useState("");
  const [price2, setPrice2] = useState("");
  const [price3, setPrice3] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Edit Modal
  const [editingGroup, setEditingGroup] = useState<GroupItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editTeacherId, setEditTeacherId] = useState("");
  const [editAssistantId, setEditAssistantId] = useState("");
  const [editMaxStudents, setEditMaxStudents] = useState("30");
  const [editPrice1, setEditPrice1] = useState("");
  const [editPrice2, setEditPrice2] = useState("");
  const [editPrice3, setEditPrice3] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  // Transfer Modal
  const [transferData, setTransferData] = useState<TransferTarget | null>(null);
  const [targetGroupId, setTargetGroupId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferError, setTransferError] = useState<string | null>(null);

  // Drop Modal
  const [dropData, setDropData] = useState<DropTarget | null>(null);
  const [dropReason, setDropReason] = useState("");
  const [dropRefundAction, setDropRefundAction] = useState<"keep_balance" | "refund">("keep_balance");
  const [dropPreview, setDropPreview] = useState<{
    hasPaidRemaining: boolean;
    remainingDays: number;
    remainingAmount: number;
    paidUntil: string | null;
  } | null>(null);
  const [dropPreviewLoading, setDropPreviewLoading] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);

  const canEdit = canEditGroups(role);

  const openCreateModal = () => {
    setCreateError(null);
    setShowCreateModal(true);
  };
  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateError(null);
  };

  const handlePrice1Change = (val: string, mode: "create" | "edit") => {
    const clean = val.replace(/[^0-9]/g, "");
    const base = parseInt(clean || "0", 10);
    if (mode === "create") {
      const prev2Auto = price1 ? String(parseInt(price1, 10) * 2) : "";
      const prev3Auto = price1 ? String(parseInt(price1, 10) * 3) : "";
      setPrice1(clean);
      if (base > 0) {
        if (!price2 || price2 === prev2Auto) setPrice2(String(base * 2));
        if (!price3 || price3 === prev3Auto) setPrice3(String(base * 3));
      }
    } else {
      const prev2Auto = editPrice1 ? String(parseInt(editPrice1, 10) * 2) : "";
      const prev3Auto = editPrice1 ? String(parseInt(editPrice1, 10) * 3) : "";
      setEditPrice1(clean);
      if (base > 0) {
        if (!editPrice2 || editPrice2 === prev2Auto) setEditPrice2(String(base * 2));
        if (!editPrice3 || editPrice3 === prev3Auto) setEditPrice3(String(base * 3));
      }
    }
  };

  const openEditModal = (group: GroupItem) => {
    setEditError(null);
    setEditingGroup(group);
    setEditName(group.name);
    setEditTeacherId(group.teacher?.id || "");
    setEditAssistantId(group.assistant?.id || "");
    setEditMaxStudents(group.maxStudents.toString());
    const p1 = group.pricingPlans?.find((p) => p.periodMonths === 1)?.price;
    const p2 = group.pricingPlans?.find((p) => p.periodMonths === 2)?.price;
    const p3 = group.pricingPlans?.find((p) => p.periodMonths === 3)?.price;
    setEditPrice1(p1 !== undefined ? String(p1) : "");
    setEditPrice2(p2 !== undefined ? String(p2) : "");
    setEditPrice3(p3 !== undefined ? String(p3) : "");
  };
  const closeEditModal = () => {
    setEditingGroup(null);
    setEditError(null);
  };

  const openTransfer = (group: GroupItem, enrollment: GroupEnrollment) => {
    setTransferError(null);
    setTransferData({
      sourceGroupId: group.id,
      studentMembershipId: enrollment.student.id,
      studentName: enrollment.student.user.fullName,
    });
    setTargetGroupId(firstOtherGroupId(groups, group.id));
  };
  const closeTransfer = () => {
    setTransferData(null);
    setTransferError(null);
  };

  const openDrop = (group: GroupItem, enrollment: GroupEnrollment) => {
    setDropError(null);
    setDropData({
      enrollmentId: enrollment.id,
      groupId: group.id,
      studentMembershipId: enrollment.student.id,
      studentName: enrollment.student.user.fullName,
    });
    setDropRefundAction("keep_balance");
    setDropPreview(null);
    setDropPreviewLoading(false);
  };
  const loadDropPreview = async () => {
    if (!dropData?.enrollmentId) return;
    setDropPreviewLoading(true);
    try {
      const res = await fetch(`/api/enrollments/${dropData.enrollmentId}/dropped-preview`);
      const d = await res.json();
      if (d?.preview) setDropPreview(d.preview);
    } catch {
      // ignore network error in preview helper
    } finally {
      setDropPreviewLoading(false);
    }
  };
  const closeDrop = () => {
    setDropData(null);
    setDropPreview(null);
    setDropPreviewLoading(false);
    setDropError(null);
  };

  const savePricingPlans = async (groupId: string, p1: string, p2: string, p3: string) => {
    const plans: Array<{ periodMonths: 1 | 2 | 3; price: number; isActive: boolean }> = [];
    if (p1.trim()) plans.push({ periodMonths: 1, price: parseInt(p1, 10), isActive: true });
    if (p2.trim()) plans.push({ periodMonths: 2, price: parseInt(p2, 10), isActive: true });
    if (p3.trim()) plans.push({ periodMonths: 3, price: parseInt(p3, 10), isActive: true });
    if (plans.length === 0) return;
    await fetch(`/api/groups/${groupId}/pricing`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plans }),
    });
  };

  const handleCreateGroup = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          name,
          teacherMembershipId: teacherMembershipId || null,
          assistantMembershipId: assistantMembershipId || null,
          maxStudents,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.group?.id) {
          await savePricingPlans(data.group.id, price1, price2, price3);
        }
        setShowCreateModal(false);
        setName("");
        setAssistantMembershipId("");
        setPrice1("");
        setPrice2("");
        setPrice3("");
        router.refresh();
      } else {
        setCreateError(data.error || messages.createError);
      }
    } catch {
      setCreateError(messages.networkError);
    } finally {
      setLoading(false);
    }
  };

  const handleEditGroup = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingGroup) return;
    setEditError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${editingGroup.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          teacherMembershipId: editTeacherId || null,
          assistantMembershipId: editAssistantId || null,
          maxStudents: editMaxStudents,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await savePricingPlans(editingGroup.id, editPrice1, editPrice2, editPrice3);
        const updatedPlans = [
          editPrice1.trim() ? { periodMonths: 1, price: parseInt(editPrice1, 10), isActive: true } : null,
          editPrice2.trim() ? { periodMonths: 2, price: parseInt(editPrice2, 10), isActive: true } : null,
          editPrice3.trim() ? { periodMonths: 3, price: parseInt(editPrice3, 10), isActive: true } : null,
        ].filter((p): p is NonNullable<typeof p> => Boolean(p));

        setGroups((prev) =>
          prev.map((g) =>
            g.id === editingGroup.id
              ? {
                  ...g,
                  name: editName,
                  maxStudents: parseInt(editMaxStudents) || 30,
                  pricingPlans: updatedPlans.length > 0 ? updatedPlans : g.pricingPlans,
                  teacher: teachers.find((teacher) => teacher.id === editTeacherId) || null,
                  assistant: assistants.find((ast) => ast.id === editAssistantId) || null,
                }
              : g
          )
        );
        setEditingGroup(null);
        router.refresh();
      } else {
        setEditError(data.error || t(locale, "groups.saveError"));
      }
    } catch {
      setEditError(t(locale, "groups.networkError"));
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async (e: FormEvent) => {
    e.preventDefault();
    if (!transferData || !targetGroupId) return;
    setTransferError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${transferData.sourceGroupId}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentMembershipId: transferData.studentMembershipId,
          targetGroupId,
          reason: transferReason,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotice({ type: "success", text: t(locale, "groups.transferSuccess") });
        setTransferData(null);
        setTargetGroupId("");
        setTransferReason("");
        router.refresh();
      } else {
        setTransferError(data.error || t(locale, "groups.transferError"));
      }
    } catch {
      setTransferError(t(locale, "groups.networkError"));
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = async (e: FormEvent) => {
    e.preventDefault();
    if (!dropData) return;
    setDropError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${dropData.groupId}/enrollments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentMembershipId: dropData.studentMembershipId,
          reason: dropReason,
          ...(dropPreview?.hasPaidRemaining ? { refundAction: dropRefundAction } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotice({ type: "success", text: t(locale, "groups.dropSuccess") });
        setDropData(null);
        setDropReason("");
        router.refresh();
      } else {
        setDropError(data.error || t(locale, "groups.dropError"));
      }
    } catch {
      setDropError(t(locale, "groups.networkError"));
    } finally {
      setLoading(false);
    }
  };

  const filteredGroups = groups.filter((g) => {
    const q = search.trim().toLowerCase();
    if (q) {
      const matchesName = g.name.toLowerCase().includes(q);
      const matchesCourse = g.course.title.toLowerCase().includes(q);
      const matchesTeacher = g.teacher?.user.fullName.toLowerCase().includes(q);
      const matchesStudent = g.enrollments.some((en) =>
        en.student.user.fullName.toLowerCase().includes(q)
      );
      if (!matchesName && !matchesCourse && !matchesTeacher && !matchesStudent) return false;
    }
    if (filterCourseId && g.course.id !== filterCourseId) return false;
    if (filterTeacherId && g.teacher?.id !== filterTeacherId) return false;
    return true;
  });

  const detailGroup = groups.find((g) => g.id === detailGroupId) || null;

  return {
    groups,
    filteredGroups,
    canEdit,
    notice,
    setNotice,
    search,
    setSearch,
    filterCourseId,
    setFilterCourseId,
    filterTeacherId,
    setFilterTeacherId,
    viewMode,
    setViewMode,
    detailGroup,
    openDetailGroup: (group: GroupItem) => setDetailGroupId(group.id),
    closeDetailGroup: () => setDetailGroupId(null),
    showCreateModal,
    openCreateModal,
    closeCreateModal,
    courseId,
    setCourseId,
    name,
    setName,
    teacherMembershipId,
    setTeacherMembershipId,
    assistantMembershipId,
    setAssistantMembershipId,
    maxStudents,
    setMaxStudents,
    price1,
    price2,
    setPrice2,
    price3,
    setPrice3,
    createError,
    handlePrice1Change,
    handleCreateGroup,
    editingGroup,
    openEditModal,
    closeEditModal,
    editName,
    setEditName,
    editTeacherId,
    setEditTeacherId,
    editAssistantId,
    setEditAssistantId,
    editMaxStudents,
    setEditMaxStudents,
    editPrice1,
    editPrice2,
    setEditPrice2,
    editPrice3,
    setEditPrice3,
    editError,
    handleEditGroup,
    transferData,
    targetGroupId,
    setTargetGroupId,
    transferReason,
    setTransferReason,
    transferError,
    openTransfer,
    closeTransfer,
    handleTransfer,
    dropData,
    dropReason,
    setDropReason,
    dropPreview,
    dropPreviewLoading,
    loadDropPreview,
    dropRefundAction,
    setDropRefundAction,
    dropError,
    openDrop,
    closeDrop,
    loading,
    handleDrop,
  };
}
