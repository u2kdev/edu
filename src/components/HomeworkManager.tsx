"use client";

import { BookOpen } from "lucide-react";
import { t } from "@/i18n";
import { EmptyState } from "@/components/ui/empty-state";
import type { HomeworkItem } from "./homework/homework-utils";
import { useHomework } from "./homework/use-homework";
import { HomeworkToolbar } from "./homework/HomeworkToolbar";
import { HomeworkListItem } from "./homework/HomeworkListItem";
import { SubmitHomeworkModal } from "./homework/SubmitHomeworkModal";
import { GradeHomeworkModal } from "./homework/GradeHomeworkModal";

export type { HomeworkItem } from "./homework/homework-utils";

interface HomeworkManagerProps {
  homeworks: HomeworkItem[];
  userRole: string;
  userMembershipId?: string;
  locale?: string;
}

export default function HomeworkManager({
  homeworks: initialHomeworks,
  userRole,
  userMembershipId,
  locale = "ru",
}: HomeworkManagerProps) {
  const {
    visibleHomeworks,
    filterStatus,
    setFilterStatus,
    isStudent,
    isTeacher,
    isParent,
    submittingHwId,
    handleOpenSubmit,
    closeSubmit,
    submissionText,
    setSubmissionText,
    linkUrl,
    setLinkUrl,
    linkTitle,
    setLinkTitle,
    attachments,
    isLockedAccepted,
    uploadingFile,
    uploadError,
    handleUploadFiles,
    handleRemoveAttachment,
    isSubmitting,
    submitSuccess,
    submitError,
    handleSubmit,
    gradingSubmission,
    handleOpenGrade,
    closeGrade,
    gradeValue,
    setGradeValue,
    gradeStatus,
    setGradeStatus,
    feedbackText,
    setFeedbackText,
    isGrading,
    gradeError,
    handleGrade,
  } = useHomework({ initialHomeworks, userRole, userMembershipId, locale });

  return (
    <div className="space-y-6">
      <HomeworkToolbar
        locale={locale}
        filterStatus={filterStatus}
        onFilterChange={setFilterStatus}
      />

      <div className="space-y-4">
        {visibleHomeworks.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-6 w-6 text-muted-foreground" aria-hidden="true" />}
            title={t(locale, "common.noData")}
          />
        ) : (
          visibleHomeworks.map((hw) => (
            <HomeworkListItem
              key={hw.id}
              hw={hw}
              locale={locale}
              userMembershipId={userMembershipId}
              isStudent={isStudent}
              isTeacher={isTeacher}
              isParent={isParent}
              onOpenSubmit={handleOpenSubmit}
              onOpenGrade={handleOpenGrade}
            />
          ))
        )}
      </div>

      {submittingHwId && (
        <SubmitHomeworkModal
          locale={locale}
          submissionText={submissionText}
          onSubmissionTextChange={setSubmissionText}
          linkUrl={linkUrl}
          onLinkUrlChange={setLinkUrl}
          linkTitle={linkTitle}
          onLinkTitleChange={setLinkTitle}
          attachments={attachments}
          isLockedAccepted={isLockedAccepted}
          uploadingFile={uploadingFile}
          uploadError={uploadError}
          onUploadFiles={handleUploadFiles}
          onRemoveAttachment={handleRemoveAttachment}
          isSubmitting={isSubmitting}
          submitSuccess={submitSuccess}
          submitError={submitError}
          onSubmit={handleSubmit}
          onClose={closeSubmit}
        />
      )}

      {gradingSubmission && (
        <GradeHomeworkModal
          locale={locale}
          target={gradingSubmission}
          gradeValue={gradeValue}
          onGradeValueChange={setGradeValue}
          gradeStatus={gradeStatus}
          onGradeStatusChange={setGradeStatus}
          feedbackText={feedbackText}
          onFeedbackTextChange={setFeedbackText}
          isGrading={isGrading}
          gradeError={gradeError}
          onSubmit={handleGrade}
          onClose={closeGrade}
        />
      )}
    </div>
  );
}
