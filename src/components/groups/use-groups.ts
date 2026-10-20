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
  type TransferTarget,
} from "./groups-utils";

/** Locale-independent fallback copy, owned by the public entry module. */
export interface GroupsMessages {
  createError: string;
  networkError: string;
}

export interface UseGroupsArgs {
  initialGroups: GroupItem[];
  courses: CourseOption[];
  teachers: TeacherOption[];
  role?: string;
  locale: string;
  messages: GroupsMessages;
}

export function useGroups({
  initialGroups,
  courses,
  teachers,
  role,
  locale,
  messages,
}: UseGroupsArgs) {
  const router = useRouter();
  const [groups, setGroups] = useState(initialGroups);

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [courseId, setCourseId] = useState(courses[0]?.id || "");
  const [name, setName] = useState("");
  const [teacherMembershipId, setTeacherMembershipId] = useState("");
  const [maxStudents, setMaxStudents] = useState("30");
  const [loading, setLoading] = useState(false);

  // Edit Modal
  const [editingGroup, setEditingGroup] = useState<GroupItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editTeacherId, setEditTeacherId] = useState("");
  const [editMaxStudents, setEditMaxStudents] = useState("30");

  // Transfer Modal
  const [transferData, setTransferData] = useState<TransferTarget | null>(null);
  const [targetGroupId, setTargetGroupId] = useState("");
  const [transferReason, setTransferReason] = useState("");

  // Drop Modal
  const [dropData, setDropData] = useState<DropTarget | null>(null);
  const [dropReason, setDropReason] = useState("");

  const canEdit = canEditGroups(role);

  const openCreateModal = () => setShowCreateModal(true);
  const closeCreateModal = () => setShowCreateModal(false);

  const openEditModal = (group: GroupItem) => {
    setEditingGroup(group);
    setEditName(group.name);
    setEditTeacherId(group.teacher?.id || "");
    setEditMaxStudents(group.maxStudents.toString());
  };
  const closeEditModal = () => setEditingGroup(null);

  const openTransfer = (group: GroupItem, enrollment: GroupEnrollment) => {
    setTransferData({
      sourceGroupId: group.id,
      studentMembershipId: enrollment.student.id,
      studentName: enrollment.student.user.fullName,
    });
    setTargetGroupId(firstOtherGroupId(groups, group.id));
  };
  const closeTransfer = () => setTransferData(null);

  const openDrop = (group: GroupItem, enrollment: GroupEnrollment) => {
    setDropData({
      groupId: group.id,
      studentMembershipId: enrollment.student.id,
      studentName: enrollment.student.user.fullName,
    });
  };
  const closeDrop = () => setDropData(null);

  const handleCreateGroup = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, name, teacherMembershipId, maxStudents }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowCreateModal(false);
        setName("");
        router.refresh();
      } else {
        alert(data.error || messages.createError);
      }
    } catch {
      alert(messages.networkError);
    } finally {
      setLoading(false);
    }
  };

  const handleEditGroup = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingGroup) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${editingGroup.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          teacherMembershipId: editTeacherId || null,
          maxStudents: editMaxStudents,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGroups((prev) =>
          prev.map((g) =>
            g.id === editingGroup.id
              ? {
                  ...g,
                  name: editName,
                  maxStudents: parseInt(editMaxStudents) || 30,
                  teacher: teachers.find((teacher) => teacher.id === editTeacherId) || null,
                }
              : g
          )
        );
        setEditingGroup(null);
        router.refresh();
      } else {
        alert(data.error || t(locale, "groups.saveError"));
      }
    } catch {
      alert(t(locale, "groups.networkError"));
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async (e: FormEvent) => {
    e.preventDefault();
    if (!transferData || !targetGroupId) return;
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
        alert(t(locale, "groups.transferSuccess"));
        setTransferData(null);
        setTargetGroupId("");
        setTransferReason("");
        router.refresh();
      } else {
        alert(data.error || t(locale, "groups.transferError"));
      }
    } catch {
      alert(t(locale, "groups.networkError"));
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = async (e: FormEvent) => {
    e.preventDefault();
    if (!dropData) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${dropData.groupId}/enrollments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentMembershipId: dropData.studentMembershipId,
          reason: dropReason,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(t(locale, "groups.dropSuccess"));
        setDropData(null);
        setDropReason("");
        router.refresh();
      } else {
        alert(data.error || t(locale, "groups.dropError"));
      }
    } catch {
      alert(t(locale, "groups.networkError"));
    } finally {
      setLoading(false);
    }
  };

  return {
    groups,
    canEdit,
    // Create modal
    showCreateModal,
    openCreateModal,
    closeCreateModal,
    courseId,
    setCourseId,
    name,
    setName,
    teacherMembershipId,
    setTeacherMembershipId,
    maxStudents,
    setMaxStudents,
    handleCreateGroup,
    // Edit modal
    editingGroup,
    openEditModal,
    closeEditModal,
    editName,
    setEditName,
    editTeacherId,
    setEditTeacherId,
    editMaxStudents,
    setEditMaxStudents,
    handleEditGroup,
    // Transfer modal
    transferData,
    targetGroupId,
    setTargetGroupId,
    transferReason,
    setTransferReason,
    openTransfer,
    closeTransfer,
    handleTransfer,
    // Drop modal
    dropData,
    dropReason,
    setDropReason,
    openDrop,
    closeDrop,
    loading,
    handleDrop,
  };
}
