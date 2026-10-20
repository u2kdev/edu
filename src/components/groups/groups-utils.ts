/**
 * Types and pure helpers for the groups manager (group = a course stream).
 *
 * The public entry point (`src/components/GroupsManager.tsx`) re-exports every
 * type below so existing consumers keep importing from the same module.
 */

export interface GroupStudent {
  id: string; // CenterMembership.id
  user: {
    fullName: string;
    phone?: string | null;
    email: string;
  };
}

export interface GroupEnrollment {
  id: string;
  student: GroupStudent;
}

export interface GroupTeacher {
  id: string;
  user: {
    fullName: string;
    email?: string;
  };
}

export interface GroupItem {
  id: string;
  name: string;
  maxStudents: number;
  course: {
    id?: string;
    title: string;
  };
  teacher?: GroupTeacher | null;
  enrollments: GroupEnrollment[];
}

export interface CourseOption {
  id: string;
  title: string;
}

export interface TeacherOption {
  id: string;
  user: {
    fullName: string;
  };
}

/** The student a transfer modal is currently open for. */
export interface TransferTarget {
  sourceGroupId: string;
  studentMembershipId: string;
  studentName: string;
}

/** The student a drop (unenroll) modal is currently open for. */
export interface DropTarget {
  groupId: string;
  studentMembershipId: string;
  studentName: string;
}

const EDIT_ROLES = ["DIRECTOR", "CENTER_ADMIN"];

/** Only directors and center admins may manage groups. */
export function canEditGroups(role?: string): boolean {
  return typeof role === "string" && EDIT_ROLES.includes(role);
}

/** A group is full as soon as its roster reaches `maxStudents`. */
export function isGroupFull(group: GroupItem): boolean {
  return group.enrollments.length >= group.maxStudents;
}

/** Badge colours: rose once the group is at/over capacity, slate otherwise. */
export function capacityBadgeClass(isFull: boolean): string {
  return isFull
    ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
    : "bg-slate-900 border border-slate-800 text-slate-300";
}

/** Groups a student may be transferred into: every group but the source. */
export function transferTargets(groups: GroupItem[], sourceGroupId: string): GroupItem[] {
  return groups.filter((g) => g.id !== sourceGroupId);
}

/** Default transfer target when the modal opens: the first group that isn't the source. */
export function firstOtherGroupId(groups: GroupItem[], sourceGroupId: string): string {
  const other = groups.find((g) => g.id !== sourceGroupId);
  return other?.id || "";
}
