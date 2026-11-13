"use client";

import { useState, type FormEvent } from "react";
import { t } from "@/i18n";
import {
  buildSubmissionFilesWithAttachments,
  isParentRole,
  isStudentRole,
  isTeacherRole,
  matchesHomeworkFilter,
  parseSubmissionFiles,
  type GradeTarget,
  type HomeworkAttachmentItem,
  type HomeworkItem,
  type HomeworkSubmission,
} from "./homework-utils";

export interface UseHomeworkArgs {
  initialHomeworks: HomeworkItem[];
  userRole: string;
  userMembershipId?: string;
  locale: string;
}

export function useHomework({
  initialHomeworks,
  userRole,
  userMembershipId,
  locale,
}: UseHomeworkArgs) {
  const [homeworkList, setHomeworkList] = useState<HomeworkItem[]>(initialHomeworks);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  // Student submission form state
  const [submittingHwId, setSubmittingHwId] = useState<string | null>(null);
  const [submissionText, setSubmissionText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [attachments, setAttachments] = useState<HomeworkAttachmentItem[]>([]);
  const [isLockedAccepted, setIsLockedAccepted] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Teacher grading form state
  const [gradingSubmission, setGradingSubmission] = useState<GradeTarget | null>(null);
  const [gradeValue, setGradeValue] = useState<string>("");
  const [gradeStatus, setGradeStatus] = useState<string>("ACCEPTED");
  const [feedbackText, setFeedbackText] = useState<string>("");
  const [isGrading, setIsGrading] = useState(false);
  const [gradeError, setGradeError] = useState<string | null>(null);

  const isStudent = isStudentRole(userRole);
  const isTeacher = isTeacherRole(userRole);
  const isParent = isParentRole(userRole);

  const visibleHomeworks = homeworkList.filter((hw) =>
    matchesHomeworkFilter(hw, filterStatus, { isStudent, userMembershipId })
  );

  const handleOpenSubmit = (hw: HomeworkItem) => {
    setSubmittingHwId(hw.id);
    const existing = hw.submissions.find((s) => s.studentMembershipId === userMembershipId);
    setSubmissionText(existing?.submissionText || "");
    setLinkUrl("");
    setLinkTitle("");
    setAttachments(parseSubmissionFiles(existing?.filesJson || null));
    setIsLockedAccepted(existing?.status === "ACCEPTED");
    setUploadError(null);
    setSubmitSuccess(null);
    setSubmitError(null);
  };

  const closeSubmit = () => setSubmittingHwId(null);

  const handleUploadFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || isLockedAccepted) return;
    setUploadingFile(true);
    setUploadError(null);

    try {
      const uploaded: HomeworkAttachmentItem[] = [];
      for (const file of Array.from(fileList)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("category", "HOMEWORK");

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const data = (await res.json()) as {
          error?: string;
          fileUrl?: string;
          originalName?: string;
          sizeBytes?: number;
          mimeType?: string;
        };
        if (!res.ok || !data.fileUrl) {
          throw new Error(data.error || "Не удалось загрузить файл");
        }
        uploaded.push({
          fileUrl: data.fileUrl,
          fileName: data.originalName || file.name,
          sizeBytes: data.sizeBytes ?? file.size,
          mimeType: data.mimeType ?? file.type,
        });
      }
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Ошибка загрузки файла");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleRemoveAttachment = (idx: number) => {
    if (isLockedAccepted) return;
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!submittingHwId || isLockedAccepted) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    const filesPayload = buildSubmissionFilesWithAttachments(linkUrl, linkTitle, attachments);

    try {
      const res = await fetch("/api/homework", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SUBMIT",
          homeworkId: submittingHwId,
          submissionText,
          filesJson: filesPayload,
        }),
      });

      if (res.ok) {
        setSubmitSuccess(t(locale, "homework.submitSuccess"));
        setHomeworkList((prev) =>
          prev.map((hw) => {
            if (hw.id !== submittingHwId) return hw;
            const updatedSubs = hw.submissions.filter(
              (s) => s.studentMembershipId !== userMembershipId
            );
            updatedSubs.push({
              id: "temp-sub",
              studentMembershipId: userMembershipId || "",
              studentName: "Me",
              studentEmail: "",
              submissionText,
              filesJson: filesPayload ? JSON.stringify(filesPayload) : null,
              status: "SUBMITTED",
              grade: null,
              feedback: null,
              submittedAt: new Date().toISOString(),
            });
            return { ...hw, submissions: updatedSubs };
          })
        );
        setTimeout(() => setSubmittingHwId(null), 1500);
      } else {
        const errData = (await res.json()) as { error?: string };
        setSubmitError(errData.error || "Failed to submit");
      }
    } catch {
      setSubmitError("Network error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenGrade = (hwId: string, sub: HomeworkSubmission) => {
    setGradingSubmission({
      hwId,
      studentMembershipId: sub.studentMembershipId,
      studentName: sub.studentName,
      submissionText: sub.submissionText,
      filesJson: sub.filesJson,
      currentGrade: sub.grade,
      currentStatus: sub.status,
      feedback: sub.feedback,
    });
    setGradeValue(sub.grade !== null ? String(sub.grade) : "100");
    setGradeStatus(sub.status === "REVISION_REQUESTED" ? "REVISION_REQUESTED" : "ACCEPTED");
    setFeedbackText(sub.feedback || "");
    setGradeError(null);
  };

  const closeGrade = () => setGradingSubmission(null);

  const handleGrade = async (e: FormEvent) => {
    e.preventDefault();
    if (!gradingSubmission) return;

    setIsGrading(true);
    setGradeError(null);

    try {
      const res = await fetch("/api/homework", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "GRADE",
          homeworkId: gradingSubmission.hwId,
          studentMembershipId: gradingSubmission.studentMembershipId,
          grade: parseInt(gradeValue),
          status: gradeStatus,
          feedback: feedbackText,
        }),
      });

      if (res.ok) {
        setHomeworkList((prev) =>
          prev.map((hw) => {
            if (hw.id !== gradingSubmission.hwId) return hw;
            const updatedSubs = hw.submissions.map((s) => {
              if (s.studentMembershipId !== gradingSubmission.studentMembershipId) return s;
              return {
                ...s,
                grade: parseInt(gradeValue),
                status: gradeStatus,
                feedback: feedbackText,
              };
            });
            return { ...hw, submissions: updatedSubs };
          })
        );
        setGradingSubmission(null);
      } else {
        const errData = (await res.json()) as { error?: string };
        setGradeError(errData.error || "Failed to grade");
      }
    } catch {
      setGradeError("Network error");
    } finally {
      setIsGrading(false);
    }
  };

  return {
    homeworkList,
    visibleHomeworks,
    filterStatus,
    setFilterStatus,
    isStudent,
    isTeacher,
    isParent,
    // Student submit modal
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
    // Teacher grade modal
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
  };
}
