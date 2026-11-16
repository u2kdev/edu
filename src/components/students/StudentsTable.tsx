"use client";

import Link from "next/link";
import { ChevronRight, Mail, Phone, UserPlus } from "lucide-react";
import { t } from "@/i18n";
import { Badge, Button, DataTable, type DataTableColumn } from "@/components/ui";
import { activeEnrollments, type StudentItem } from "./students-utils";
import { StudentCard } from "./StudentCard";

export interface StudentsTableProps {
  students: StudentItem[];
  locale: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  page?: number;
  totalPages?: number;
  totalCount?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  canManage?: boolean;
  onOpenAdd?: () => void;
}

export function StudentsTable({
  students,
  locale,
  loading = false,
  error = null,
  onRetry,
  page = 1,
  totalPages = 1,
  totalCount,
  pageSize = 15,
  onPageChange,
  emptyTitle,
  emptyDescription,
  canManage = false,
  onOpenAdd,
}: StudentsTableProps) {
  const columns: DataTableColumn<StudentItem>[] = [
    {
      id: "fullName",
      header: t(locale, "students.fullName"),
      isMobilePrimary: true,
      cell: (student) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {student.user.fullName.charAt(0).toUpperCase()}
          </div>
          <Link
            href={`/center/students/${student.id}`}
            className="truncate font-medium text-foreground hover:text-primary transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {student.user.fullName}
          </Link>
        </div>
      ),
    },
    {
      id: "contacts",
      header: `${t(locale, "students.email")} / ${t(locale, "students.phone")}`,
      cell: (student) => (
        <div className="space-y-0.5 text-xs">
          {student.user.email && !student.user.email.endsWith("@noemail.local") && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Mail className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{student.user.email}</span>
            </div>
          )}
          {student.user.phone && (
            <div className="flex items-center gap-1.5 text-muted-foreground tabular-nums">
              <Phone className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>{student.user.phone}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      id: "groups",
      header: t(locale, "students.groups"),
      cell: (student) => {
        const activeGroups = activeEnrollments(student);
        if (activeGroups.length === 0) {
          return <span className="text-xs text-muted-foreground">{t(locale, "students.noGroups")}</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {activeGroups.map((enr) => (
              <Badge key={enr.id} variant="primary">
                {enr.group.name}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      id: "parents",
      header: t(locale, "students.parents"),
      hideOnMobile: true,
      cell: (student) => {
        if (!student.parentLinksAsStudent || student.parentLinksAsStudent.length === 0) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        return (
          <div className="space-y-0.5 text-xs">
            {student.parentLinksAsStudent.map((pl, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span className="font-medium text-foreground">{pl.parent.user.fullName}</span>
                {pl.parent.user.phone && (
                  <span className="text-muted-foreground tabular-nums">({pl.parent.user.phone})</span>
                )}
              </div>
            ))}
          </div>
        );
      },
    },
    {
      id: "status",
      header: t(locale, "students.status"),
      cell: (student) => {
        const isActive = student.status === "ACTIVE";
        return (
          <Badge variant={isActive ? "success" : "neutral"}>
            {isActive ? t(locale, "students.statusActive") : t(locale, "students.statusArchived")}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: t(locale, "students.actions"),
      align: "right",
      cell: (student) => (
        <Link
          href={`/center/students/${student.id}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors"
        >
          <span>{t(locale, "students.viewProfile")}</span>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      ),
    },
  ];

  return (
    <DataTable
      data={students}
      columns={columns}
      getRowId={(s) => s.id}
      getRowHref={(s) => `/center/students/${s.id}`}
      locale={locale}
      loading={loading}
      loadingLabel={t(locale, "students.loading")}
      error={error}
      onRetry={onRetry}
      page={page}
      totalPages={totalPages}
      totalItems={totalCount}
      pageSize={pageSize}
      onPageChange={onPageChange}
      emptyTitle={emptyTitle ?? t(locale, "students.emptyList")}
      emptyDescription={emptyDescription ?? t(locale, "ui4.emptyStudentsDesc")}
      emptyAction={
        canManage && onOpenAdd ? (
          <Button type="button" variant="primary" size="sm" onClick={onOpenAdd}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            <span>{t(locale, "students.addStudent")}</span>
          </Button>
        ) : undefined
      }
      mobileMode="cards"
      mobileCardRender={(student) => <StudentCard student={student} locale={locale} />}
    />
  );
}
