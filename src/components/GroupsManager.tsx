"use client";

import { Edit2, Eye, Plus, Users, X } from "lucide-react";
import { t } from "@/i18n";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  DataTable,
  type DataTableColumn,
  EmptyState,
} from "@/components/ui";
import {
  isGroupFull,
  type AssistantOption,
  type CourseOption,
  type GroupItem,
  type TeacherOption,
} from "./groups/groups-utils";
import { useGroups } from "./groups/use-groups";
import { GroupsToolbar } from "./groups/GroupsToolbar";
import { GroupCard } from "./groups/GroupCard";
import { GroupDetailSheet } from "./groups/GroupDetailSheet";
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
  AssistantOption,
  TransferTarget,
} from "./groups/groups-utils";

export interface GroupsManagerProps {
  initialGroups: GroupItem[];
  courses: CourseOption[];
  teachers: TeacherOption[];
  assistants?: AssistantOption[];
  role?: string;
  locale?: string;
}

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
  assistants = [],
  role,
  locale = "ru",
}: GroupsManagerProps) {
  const {
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
    openDetailGroup,
    closeDetailGroup,
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
  } = useGroups({
    initialGroups,
    courses,
    teachers,
    assistants,
    role,
    locale,
    messages: LEGACY_MESSAGES,
  });

  const hasFilters = Boolean(search || filterCourseId || filterTeacherId);

  const columns: DataTableColumn<GroupItem>[] = [
    {
      id: "group",
      header: t(locale, "groups.title"),
      isMobilePrimary: true,
      sortable: true,
      sortValue: (g) => g.name,
      cell: (g) => (
        <div>
          <div className="font-medium text-foreground">{g.name}</div>
          <div className="text-xs text-primary">{g.course.title}</div>
        </div>
      ),
    },
    {
      id: "teacher",
      header: locale === "uz-Latn" ? "Oʻqituvchi" : "Преподаватель",
      sortable: true,
      sortValue: (g) => g.teacher?.user.fullName || "",
      cell: (g) => (
        <div className="space-y-0.5 text-sm">
          <div className={g.teacher ? "text-foreground" : "text-muted-foreground"}>
            {g.teacher ? g.teacher.user.fullName : t(locale, "groups.teacherNotAssigned")}
          </div>
          {g.assistant && (
            <div className="text-xs text-muted-foreground">
              {locale === "uz-Latn" ? "Yordamchi: " : "Ассистент: "}
              {g.assistant.user.fullName}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "pricing",
      header: t(locale, "billing.pricingPlans"),
      hideOnMobile: true,
      cell: (g) =>
        g.pricingPlans && g.pricingPlans.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {g.pricingPlans.map((p) => (
              <Badge key={p.periodMonths} variant="neutral" className="font-mono tabular-nums">
                {p.periodMonths} {locale === "uz-Latn" ? "oy" : "мес"}: {p.price.toLocaleString("ru-RU")}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      id: "capacity",
      header: t(locale, "groups.capacity"),
      sortable: true,
      sortValue: (g) => g.enrollments.length,
      cell: (g) => {
        const full = isGroupFull(g);
        return (
          <Badge variant={full ? "destructive" : "neutral"} className="tabular-nums">
            <Users className="h-3 w-3" aria-hidden="true" />
            <span>
              {g.enrollments.length} / {g.maxStudents}
            </span>
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: locale === "uz-Latn" ? "Amallar" : "Действия",
      align: "right",
      cell: (g) => (
        <div className="inline-flex items-center gap-1" data-no-row-click="true">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => openDetailGroup(g)}
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Карточка</span>
          </Button>
          {canEdit && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => openEditModal(g)}
              title={t(locale, "groups.editGroup")}
            >
              <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <GroupsToolbar
        locale={locale}
        canEdit={canEdit}
        totalCount={groups.length}
        search={search}
        onSearchChange={setSearch}
        courses={courses}
        selectedCourseId={filterCourseId}
        onCourseChange={setFilterCourseId}
        teachers={teachers}
        selectedTeacherId={filterTeacherId}
        onTeacherChange={setFilterTeacherId}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        hasActiveFilters={hasFilters}
        onResetFilters={() => {
          setSearch("");
          setFilterCourseId("");
          setFilterTeacherId("");
        }}
        onOpenCreate={openCreateModal}
      />

      {notice && (
        <Alert variant={notice.type === "success" ? "success" : "destructive"}>
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>{notice.text}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Close"
              className="rounded p-1 hover:opacity-75"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </AlertDescription>
        </Alert>
      )}

      {viewMode === "table" ? (
        <DataTable
          data={filteredGroups}
          columns={columns}
          getRowId={(g) => g.id}
          onRowClick={openDetailGroup}
          locale={locale}
          emptyTitle={t(locale, "common.noData")}
          emptyDescription={t(locale, "ui4.emptyGroupsDesc")}
          emptyAction={
            canEdit ? (
              <Button type="button" variant="primary" size="sm" onClick={openCreateModal}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>{t(locale, "groups.createGroup")}</span>
              </Button>
            ) : undefined
          }
          mobileMode="cards"
        />
      ) : filteredGroups.length === 0 ? (
        <EmptyState
          title={t(locale, "common.noData")}
          description={t(locale, "ui4.emptyGroupsDesc")}
          action={
            canEdit ? (
              <Button type="button" variant="primary" size="sm" onClick={openCreateModal}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>{t(locale, "groups.createGroup")}</span>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {filteredGroups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              locale={locale}
              canEdit={canEdit}
              onOpenDetail={openDetailGroup}
              onEdit={openEditModal}
              onTransfer={openTransfer}
              onDrop={openDrop}
            />
          ))}
        </div>
      )}

      <GroupDetailSheet
        group={detailGroup}
        open={Boolean(detailGroup)}
        onOpenChange={(next) => !next && closeDetailGroup()}
        locale={locale}
        canEdit={canEdit}
        onEdit={openEditModal}
        onTransfer={openTransfer}
        onDrop={openDrop}
      />

      <CreateGroupModal
        open={showCreateModal}
        locale={locale}
        courses={courses}
        teachers={teachers}
        assistants={assistants}
        namePlaceholder={LEGACY_PLACEHOLDERS.groupName}
        courseId={courseId}
        onCourseIdChange={setCourseId}
        name={name}
        onNameChange={setName}
        teacherMembershipId={teacherMembershipId}
        onTeacherMembershipIdChange={setTeacherMembershipId}
        assistantMembershipId={assistantMembershipId}
        onAssistantMembershipIdChange={setAssistantMembershipId}
        maxStudents={maxStudents}
        onMaxStudentsChange={setMaxStudents}
        price1={price1}
        onPrice1Change={(v) => handlePrice1Change(v, "create")}
        price2={price2}
        onPrice2Change={setPrice2}
        price3={price3}
        onPrice3Change={setPrice3}
        loading={loading}
        error={createError}
        onSubmit={handleCreateGroup}
        onClose={closeCreateModal}
      />

      <EditGroupModal
        open={Boolean(editingGroup)}
        locale={locale}
        teachers={teachers}
        assistants={assistants}
        name={editName}
        onNameChange={setEditName}
        teacherMembershipId={editTeacherId}
        onTeacherMembershipIdChange={setEditTeacherId}
        assistantMembershipId={editAssistantId}
        onAssistantMembershipIdChange={setEditAssistantId}
        maxStudents={editMaxStudents}
        onMaxStudentsChange={setEditMaxStudents}
        price1={editPrice1}
        onPrice1Change={(v) => handlePrice1Change(v, "edit")}
        price2={editPrice2}
        onPrice2Change={setEditPrice2}
        price3={editPrice3}
        onPrice3Change={setEditPrice3}
        loading={loading}
        error={editError}
        onSubmit={handleEditGroup}
        onClose={closeEditModal}
      />

      <TransferStudentModal
        open={Boolean(transferData)}
        locale={locale}
        studentName={transferData?.studentName || ""}
        sourceGroupId={transferData?.sourceGroupId || ""}
        groups={groups}
        targetGroupId={targetGroupId}
        onTargetGroupIdChange={setTargetGroupId}
        reason={transferReason}
        onReasonChange={setTransferReason}
        reasonPlaceholder={LEGACY_PLACEHOLDERS.transferReason}
        loading={loading}
        error={transferError}
        onSubmit={handleTransfer}
        onClose={closeTransfer}
      />

      <DropStudentModal
        open={Boolean(dropData)}
        locale={locale}
        studentName={dropData?.studentName || ""}
        reason={dropReason}
        onReasonChange={setDropReason}
        reasonPlaceholder={LEGACY_PLACEHOLDERS.dropReason}
        preview={dropPreview}
        previewLoading={dropPreviewLoading}
        onLoadPreview={loadDropPreview}
        refundAction={dropRefundAction}
        onRefundActionChange={setDropRefundAction}
        loading={loading}
        error={dropError}
        onSubmit={handleDrop}
        onClose={closeDrop}
      />
    </div>
  );
}
