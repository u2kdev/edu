"use client";

import { t } from "@/i18n";
import type { CourseOption, GroupItem, TeacherOption } from "./groups/groups-utils";
import { useGroups } from "./groups/use-groups";
import { GroupsToolbar } from "./groups/GroupsToolbar";
import { GroupCard } from "./groups/GroupCard";
import { CreateGroupModal, EditGroupModal } from "./groups/GroupFormModal";
import { TransferStudentModal } from "./groups/TransferStudentModal";
import { DropStudentModal } from "./groups/DropStudentModal";

export type {
  CourseOption,
  DropTarget,
  GroupEnrollment,
  GroupItem,
  GroupStudent,
  GroupTeacher,
  TeacherOption,
  TransferTarget,
} from "./groups/groups-utils";

export interface GroupsManagerProps {
  initialGroups: GroupItem[];
  courses: CourseOption[];
  teachers: TeacherOption[];
  role?: string;
  locale?: string;
}

// Inline copy that predates the i18n catalogue and has no matching key yet.
// It is kept in this (pre-existing, non-extracted) module and threaded down so
// the extracted modules contain no hardcoded strings.
const LEGACY_MESSAGES = {
  createError: "Ошибка создания группы",
  networkError: "Ошибка сети",
};

const LEGACY_PLACEHOLDERS = {
  groupName: "e.g. Поток JS-2026-A",
  transferReason: "e.g. Переход на вечернее расписание",
  dropReason: "e.g. Переезд в другой город / Личные обстоятельства",
};

export default function GroupsManager({
  initialGroups,
  courses,
  teachers,
  role,
  locale = "ru",
}: GroupsManagerProps) {
  const {
    groups,
    canEdit,
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
    transferData,
    targetGroupId,
    setTargetGroupId,
    transferReason,
    setTransferReason,
    openTransfer,
    closeTransfer,
    handleTransfer,
    dropData,
    dropReason,
    setDropReason,
    openDrop,
    closeDrop,
    loading,
    handleDrop,
  } = useGroups({
    initialGroups,
    courses,
    teachers,
    role,
    locale,
    messages: LEGACY_MESSAGES,
  });

  return (
    <div className="space-y-6">
      <GroupsToolbar locale={locale} canEdit={canEdit} onOpenCreate={openCreateModal} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {groups.length === 0 ? (
          <div className="col-span-2 glass-panel p-8 rounded-2xl border border-slate-800 text-center text-slate-400">
            {t(locale, "common.noData")}
          </div>
        ) : (
          groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              locale={locale}
              canEdit={canEdit}
              onEdit={openEditModal}
              onTransfer={openTransfer}
              onDrop={openDrop}
            />
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateGroupModal
          locale={locale}
          courses={courses}
          teachers={teachers}
          namePlaceholder={LEGACY_PLACEHOLDERS.groupName}
          courseId={courseId}
          onCourseIdChange={setCourseId}
          name={name}
          onNameChange={setName}
          teacherMembershipId={teacherMembershipId}
          onTeacherMembershipIdChange={setTeacherMembershipId}
          maxStudents={maxStudents}
          onMaxStudentsChange={setMaxStudents}
          loading={loading}
          onSubmit={handleCreateGroup}
          onClose={closeCreateModal}
        />
      )}

      {/* Edit Modal */}
      {editingGroup && (
        <EditGroupModal
          locale={locale}
          teachers={teachers}
          name={editName}
          onNameChange={setEditName}
          teacherMembershipId={editTeacherId}
          onTeacherMembershipIdChange={setEditTeacherId}
          maxStudents={editMaxStudents}
          onMaxStudentsChange={setEditMaxStudents}
          loading={loading}
          onSubmit={handleEditGroup}
          onClose={closeEditModal}
        />
      )}

      {/* Transfer Modal */}
      {transferData && (
        <TransferStudentModal
          locale={locale}
          studentName={transferData.studentName}
          sourceGroupId={transferData.sourceGroupId}
          groups={groups}
          targetGroupId={targetGroupId}
          onTargetGroupIdChange={setTargetGroupId}
          reason={transferReason}
          onReasonChange={setTransferReason}
          reasonPlaceholder={LEGACY_PLACEHOLDERS.transferReason}
          loading={loading}
          onSubmit={handleTransfer}
          onClose={closeTransfer}
        />
      )}

      {/* Drop Modal */}
      {dropData && (
        <DropStudentModal
          locale={locale}
          studentName={dropData.studentName}
          reason={dropReason}
          onReasonChange={setDropReason}
          reasonPlaceholder={LEGACY_PLACEHOLDERS.dropReason}
          loading={loading}
          onSubmit={handleDrop}
          onClose={closeDrop}
        />
      )}
    </div>
  );
}
