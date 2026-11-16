"use client";

import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { t } from "@/i18n";
import { Badge, Card } from "@/components/ui";
import { activeEnrollments, type StudentItem } from "./students-utils";

export interface StudentCardProps {
  student: StudentItem;
  locale: string;
}

export function StudentCard({ student, locale }: StudentCardProps) {
  const activeGroups = activeEnrollments(student);
  const isActive = student.status === "ACTIVE";

  return (
    <Card className="p-3.5 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {student.user.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <Link
              href={`/center/students/${student.id}`}
              className="block truncate font-medium text-foreground hover:text-primary transition-colors"
            >
              {student.user.fullName}
            </Link>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
              {student.user.email && !student.user.email.endsWith("@noemail.local") && (
                <span className="inline-flex items-center gap-1 truncate">
                  <Mail className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">{student.user.email}</span>
                </span>
              )}
              {student.user.phone && (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Phone className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {student.user.phone}
                </span>
              )}
            </div>
          </div>
        </div>
        <Badge variant={isActive ? "success" : "neutral"}>
          {isActive ? t(locale, "students.statusActive") : t(locale, "students.statusArchived")}
        </Badge>
      </div>

      {activeGroups.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border">
          {activeGroups.map((enr) => (
            <Badge key={enr.id} variant="primary">
              {enr.group.name}
            </Badge>
          ))}
        </div>
      )}

      {student.parentLinksAsStudent && student.parentLinksAsStudent.length > 0 && (
        <div className="text-xs text-muted-foreground pt-1 border-t border-border">
          <span className="font-medium text-foreground">{t(locale, "students.parents")}:</span>{" "}
          {student.parentLinksAsStudent.map((pl) => pl.parent.user.fullName).join(", ")}
        </div>
      )}
    </Card>
  );
}
