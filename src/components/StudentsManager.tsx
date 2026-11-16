"use client";

import { t } from "@/i18n";
import { hasActiveFilters, type GroupOption } from "./students/students-utils";
import { useStudents } from "./students/use-students";
import { StudentsToolbar } from "./students/StudentsToolbar";
import { StudentsTable } from "./students/StudentsTable";
import { StudentFormModal } from "./students/StudentFormModal";
import { CsvImportModal } from "./students/CsvImportModal";
import { CredentialsModal } from "@/components/CredentialsModal";

export type { GroupOption, StudentItem } from "./students/students-utils";

export interface StudentsManagerProps {
  initialGroups: GroupOption[];
  role: string;
  locale: string;
}

const LEGACY_MESSAGES = {
  networkError: "Ошибка сети",
  createError: "Ошибка создания ученика",
  csvPreviewError: "Ошибка обработки CSV",
  csvExecuteError: "Ошибка импорта CSV",
};

const LEGACY_PLACEHOLDERS = {
  studentName: "Алишер Навоий",
  csv: "ФИО, Email, Телефон, ID группы\nJasur Rashidov, jasur@example.uz, +998901234567, \nMadina Karimova, madina@example.uz, +998907654321, ",
};

export default function StudentsManager({
  initialGroups,
  role,
  locale,
}: StudentsManagerProps) {
  const {
    students,
    loading,
    error,
    search,
    updateSearch,
    selectedGroup,
    updateGroup,
    selectedStatus,
    updateStatus,
    sortBy,
    sortOrder,
    updateSort,
    page,
    setPage,
    totalPages,
    totalCount,
    resetFilters,
    canManage,
    fetchStudents,
    showAddModal,
    openAddModal,
    closeAddModal,
    closeAddModalAndReset,
    addFullName,
    setAddFullName,
    addEmail,
    setAddEmail,
    addPhone,
    setAddPhone,
    addGroupId,
    setAddGroupId,
    addWithInvite,
    setAddWithInvite,
    addLoading,
    addError,
    addCreatedCode,
    createdCredentials,
    setCreatedCredentials,
    handleAddSubmit,
    showCsvModal,
    openCsvModal,
    closeCsvModal,
    csvContent,
    setCsvContent,
    csvPreviewData,
    csvResult,
    csvLoading,
    csvError,
    handleCsvPreview,
    handleCsvExecute,
  } = useStudents({ role, locale, messages: LEGACY_MESSAGES });

  const filtered = hasActiveFilters(search, selectedGroup, selectedStatus);

  return (
    <div className="space-y-6">
      <StudentsToolbar
        locale={locale}
        canManage={canManage}
        totalCount={totalCount}
        search={search}
        onSearchChange={updateSearch}
        selectedGroup={selectedGroup}
        onGroupChange={updateGroup}
        selectedStatus={selectedStatus}
        onStatusChange={updateStatus}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={updateSort}
        initialGroups={initialGroups}
        hasActiveFilters={filtered}
        onResetFilters={resetFilters}
        onOpenAdd={openAddModal}
        onOpenCsv={openCsvModal}
      />

      <StudentsTable
        students={students}
        locale={locale}
        loading={loading}
        error={error}
        onRetry={fetchStudents}
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={setPage}
        emptyTitle={filtered ? t(locale, "students.emptyListFilter") : t(locale, "students.emptyList")}
        canManage={canManage}
        onOpenAdd={openAddModal}
      />

      <StudentFormModal
        open={showAddModal}
        locale={locale}
        initialGroups={initialGroups}
        namePlaceholder={LEGACY_PLACEHOLDERS.studentName}
        fullName={addFullName}
        onFullNameChange={setAddFullName}
        email={addEmail}
        onEmailChange={setAddEmail}
        phone={addPhone}
        onPhoneChange={setAddPhone}
        groupId={addGroupId}
        onGroupIdChange={setAddGroupId}
        withInvite={addWithInvite}
        onWithInviteChange={setAddWithInvite}
        submitting={addLoading}
        error={addError}
        createdCode={addCreatedCode}
        onSubmit={handleAddSubmit}
        onClose={closeAddModal}
        onCloseWithReset={closeAddModalAndReset}
      />

      <CsvImportModal
        open={showCsvModal}
        locale={locale}
        placeholder={LEGACY_PLACEHOLDERS.csv}
        content={csvContent}
        onContentChange={setCsvContent}
        previewData={csvPreviewData}
        result={csvResult}
        loading={csvLoading}
        error={csvError}
        onPreview={handleCsvPreview}
        onExecute={handleCsvExecute}
        onClose={closeCsvModal}
      />

      {createdCredentials && (
        <CredentialsModal
          isOpen={Boolean(createdCredentials)}
          onClose={() => setCreatedCredentials(null)}
          credentials={createdCredentials}
          locale={locale}
        />
      )}
    </div>
  );
}
