import { t } from "@/i18n";

export interface GroupOption {
  id: string;
  name: string;
}

export interface StudentItem {
  id: string; // CenterMembership.id
  status: string;
  createdAt: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    phone?: string | null;
  };
  enrollments: {
    id: string;
    status: string;
    group: {
      id: string;
      name: string;
      course?: { title: string };
    };
  }[];
  parentLinksAsStudent?: {
    parent: {
      user: { fullName: string; phone?: string | null };
    };
  }[];
}

export interface CsvPreviewRow {
  fullName: string;
  email: string;
  phone?: string;
  groupId?: string;
}

export interface CsvPreviewData {
  totalParsed: number;
  validCount: number;
  errorCount: number;
  validPreview: CsvPreviewRow[];
  errors: { row: number; error: string; raw: string }[];
}

export interface CsvImportResult {
  createdCount: number;
  errors: { row: number; error: string }[];
}

export interface StudentsQueryParams {
  page: number;
  search: string;
  groupId: string;
  status: string;
  sortBy: string;
  sortOrder: string;
}

export const STUDENTS_PAGE_SIZE = 15;

const MANAGE_ROLES = ["DIRECTOR", "CENTER_ADMIN"];

export function canManageStudents(role: string): boolean {
  return MANAGE_ROLES.includes(role);
}

/** Build the request URL for the students list from the current filter state. */
export function buildStudentsQuery({
  page,
  search,
  groupId,
  status,
  sortBy,
  sortOrder,
}: StudentsQueryParams): string {
  return new URLSearchParams({
    page: page.toString(),
    pageSize: String(STUDENTS_PAGE_SIZE),
    search,
    groupId,
    status,
    sortBy,
    sortOrder,
  }).toString();
}

/** Only enrollments in the ACTIVE state are surfaced as group badges. */
export function activeEnrollments(student: StudentItem) {
  return student.enrollments.filter((e) => e.status === "ACTIVE");
}

export function studentStatusLabel(locale: string, status: string): string {
  return status === "ACTIVE"
    ? t(locale, "students.statusActive")
    : t(locale, "students.statusArchived");
}

export function studentStatusBadgeTone(status: string): string {
  return status === "ACTIVE"
    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
    : "bg-slate-700/50 text-slate-400 border border-slate-700";
}

export function hasActiveFilters(search: string, groupId: string, status: string): boolean {
  return Boolean(search || groupId || status);
}

export function sortSelectValue(sortBy: string, sortOrder: string): string {
  return `${sortBy}-${sortOrder}`;
}

export function parseSortValue(value: string): { sortBy: string; sortOrder: "asc" | "desc" } {
  const [sortBy, sortOrder] = value.split("-") as [string, "asc" | "desc"];
  return { sortBy, sortOrder };
}
