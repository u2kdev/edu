"use client";

import { useState, type FormEvent } from "react";
import { t } from "@/i18n";
import {
  buildSubmissionFiles,
  isStudentRole,
  isTeacherRole,
  matchesHomeworkFilter,
  type GradeTarget,
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

  // The toolbar filter now really filters. `homeworkList` stays intact, so
  // switching back to ALL never loses rows.
  const visibleHomeworks = homeworkList.filter((hw) =>
    matchesHomeworkFilter(hw, filterStatus, { isStudent, userMembershipId }),
  );

  const handleOpenSubmit = (hw: HomeworkItem) => {
    setSubmittingHwId(hw.id);
    const existing = hw.submissions.find((s) => s.studentMembershipId === userMembershipId);
    setSubmissionText(existing?.submissionText || "");
    setLinkUrl("");
    setLinkTitle("");
    setSubmitSuccess(null);
    setSubmitError(null);
  };

  const closeSubmit = () => setSubmittingHwId(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!submittingHwId) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    const filesPayload = buildSubmissionFiles(linkUrl, linkTitle);

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
        // Update local state
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
        // Update local state
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
