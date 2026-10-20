"use client";

import { AlertCircle, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { t } from "@/i18n";
import { hasActiveFilters, type GroupOption } from "./students/students-utils";
import { useStudents } from "./students/use-students";
import { StudentsToolbar } from "./students/StudentsToolbar";
import { StudentsTable } from "./students/StudentsTable";
import { StudentCard } from "./students/StudentCard";
import { StudentFormModal } from "./students/StudentFormModal";
import { CsvImportModal } from "./students/CsvImportModal";

export type { GroupOption, StudentItem } from "./students/students-utils";

export interface StudentsManagerProps {
  initialGroups: GroupOption[];
  role: string;
  locale: string;
}

// Inline copy that predates the i18n catalogue and has no matching key yet.
// It is kept in this (pre-existing, non-extracted) module and threaded down so
// the extracted modules contain no hardcoded strings.
const LEGACY_MESSAGES = {
  networkError: "Ошибка сети",
  createError: "Ошибка создания студента",
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
    totalPages,
    totalCount,
    goPrevPage,
    goNextPage,
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
    addCreatedCode,
    handleAddSubmit,
    showCsvModal,
    openCsvModal,
    closeCsvModal,
    csvContent,
    setCsvContent,
    csvPreviewData,
    csvResult,
    csvLoading,
    handleCsvPreview,
    handleCsvExecute,
  } = useStudents({ role, locale, messages: LEGACY_MESSAGES });

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
        onOpenAdd={openAddModal}
        onOpenCsv={openCsvModal}
      />

      {/* Loading state */}
      {loading && (
        <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center text-slate-400 text-sm">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <span>{t(locale, "students.loading")}</span>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="glass-panel p-8 rounded-2xl border border-rose-500/30 text-center text-rose-400 space-y-3">
          <AlertCircle className="w-8 h-8 mx-auto text-rose-400" />
          <p className="text-sm font-semibold">{error}</p>
          <button
            onClick={fetchStudents}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl"
          >
            {t(locale, "students.retry")}
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && students.length === 0 && (
        <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center text-slate-400 space-y-2">
          <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-300">
            {hasActiveFilters(search, selectedGroup, selectedStatus)
              ? t(locale, "students.emptyListFilter")
              : t(locale, "students.emptyList")}
          </p>
        </div>
      )}

      {/* Content: Responsive Display (Cards on mobile/360px, Table on md+) */}
      {!loading && !error && students.length > 0 && (
        <div className="space-y-4">
          {/* Mobile view (< 640px / 360px) */}
          <div className="grid grid-cols-1 gap-3 sm:hidden">
            {students.map((student) => (
              <StudentCard key={student.id} student={student} locale={locale} />
            ))}
          </div>

          {/* Desktop Table view (>= 640px) */}
          <StudentsTable students={students} locale={locale} />

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-400">
                {t(locale, "students.pageOf", { page: String(page), totalPages: String(totalPages) })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={goPrevPage}
                  className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={goNextPage}
                  className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Student Modal */}
      {showAddModal && (
        <StudentFormModal
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
          createdCode={addCreatedCode}
          onSubmit={handleAddSubmit}
          onClose={closeAddModal}
          onCloseWithReset={closeAddModalAndReset}
        />
      )}

      {/* CSV Bulk Import Modal */}
      {showCsvModal && (
        <CsvImportModal
          locale={locale}
          placeholder={LEGACY_PLACEHOLDERS.csv}
          content={csvContent}
          onContentChange={setCsvContent}
          previewData={csvPreviewData}
          result={csvResult}
          loading={csvLoading}
          onPreview={handleCsvPreview}
          onExecute={handleCsvExecute}
          onClose={closeCsvModal}
        />
      )}
    </div>
  );
}
