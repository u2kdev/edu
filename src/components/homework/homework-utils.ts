/**
 * Types and pure helpers for the homework manager (a homework item plus its
 * per-student submissions).
 *
 * The public entry point (`src/components/HomeworkManager.tsx`) re-exports the
 * public type so existing consumers keep importing from the same module.
 */

/** One student submission attached to a homework item. */
export interface HomeworkSubmission {
  id: string;
  studentMembershipId: string;
  studentName: string;
  studentEmail: string;
  submissionText: string | null;
  filesJson: string | null;
  status: string;
  grade: number | null;
  feedback: string | null;
  submittedAt: string;
}

/** One homework as rendered by the manager, in either role's view. */
export interface HomeworkItem {
  id: string;
  lessonId: string;
  lessonTitle: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  materials: Array<{
    id: string;
    title: string;
    materialType: string;
  }>;
  submissions: HomeworkSubmission[];
}

/** Badge copy + colours for every homework submission status. */
export const STATUS_BADGES: Record<string, { labelKey: string; color: string }> = {
  NOT_SUBMITTED: {
    labelKey: "homework.notStarted",
    color: "bg-slate-800 text-slate-400 border-slate-700",
  },
  SUBMITTED: {
    labelKey: "homework.submitted",
    color: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  },
  ACCEPTED: {
    labelKey: "homework.accepted",
    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  },
  REVISION_REQUESTED: {
    labelKey: "homework.revisionRequested",
    color: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  },
  OVERDUE: {
    labelKey: "homework.overdue",
    color: "bg-red-500/10 text-red-400 border-red-500/30",
  },
};

/** Filter statuses, in button order. */
export const HOMEWORK_FILTER_STATUSES = [
  "ALL",
  "SUBMITTED",
  "ACCEPTED",
  "REVISION_REQUESTED",
  "OVERDUE",
];

/**
 * Whether a homework belongs to the active toolbar filter.
 *
 * Students are filtered by their own submission status; staff members see a
 * homework when at least one submission carries the requested status.
 */
export function matchesHomeworkFilter(
  hw: HomeworkItem,
  filterStatus: string,
  options: { isStudent: boolean; userMembershipId?: string },
): boolean {
  if (!filterStatus || filterStatus === "ALL") return true;
  if (options.isStudent) {
    return studentStatus(hw, options.userMembershipId) === filterStatus;
  }
  return hw.submissions.some((submission) => submission.status === filterStatus);
}

/** Students may submit their own work. */
export function isStudentRole(role: string): boolean {
  return role === "STUDENT";
}

/** Teachers, directors and center admins may grade submissions. */
export function isTeacherRole(role: string): boolean {
  return role === "TEACHER" || role === "DIRECTOR" || role === "CENTER_ADMIN";
}

/** The current user's submission for a homework, if they have one. */
export function findMySubmission(
  hw: HomeworkItem,
  userMembershipId?: string
): HomeworkSubmission | undefined {
  return hw.submissions.find((s) => s.studentMembershipId === userMembershipId);
}

/** Student-facing status: their submission status, or NOT_SUBMITTED. */
export function studentStatus(hw: HomeworkItem, userMembershipId?: string): string {
  const submission = findMySubmission(hw, userMembershipId);
  return submission ? submission.status : "NOT_SUBMITTED";
}

/** Format a due date the way the card always has (environment locale). */
export function formatDueDate(dueDate: string): string {
  return new Date(dueDate).toLocaleDateString();
}

/**
 * External links stored in a submission's filesJson. Returns null when the
 * payload is not valid JSON so callers can render it verbatim instead.
 */
export function parseSubmissionLinks(
  filesJson: string
): Array<{ url: string; title: string }> | null {
  try {
    const parsed = JSON.parse(filesJson) as {
      links?: Array<{ url: string; title: string }>;
    };
    return parsed.links || [];
  } catch {
    return null;
  }
}

/** SUBMIT payload: at most one external link, or null when none was given. */
export function buildSubmissionFiles(
  linkUrl: string,
  linkTitle: string
): { links: Array<{ title: string; url: string }> } | null {
  return linkUrl ? { links: [{ title: linkTitle || "Link", url: linkUrl }] } : null;
}

/** The submission a teacher is currently grading. */
export interface GradeTarget {
  hwId: string;
  studentMembershipId: string;
  studentName: string;
  submissionText: string | null;
  filesJson: string | null;
  currentGrade: number | null;
  currentStatus: string;
  feedback: string | null;
}
