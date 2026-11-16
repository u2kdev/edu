"use client";

import { AlertTriangle, ArrowRightLeft, Edit2, Eye, MessageCircle, Phone, UserCheck, UserMinus, Users } from "lucide-react";
import { t } from "@/i18n";
import { Badge, Button, Card } from "@/components/ui";
import { isGroupFull, type GroupEnrollment, type GroupItem } from "./groups-utils";

interface GroupCardProps {
  group: GroupItem;
  locale: string;
  canEdit: boolean;
  onOpenDetail?: (group: GroupItem) => void;
  onEdit: (group: GroupItem) => void;
  onTransfer: (group: GroupItem, enrollment: GroupEnrollment) => void;
  onDrop: (group: GroupItem, enrollment: GroupEnrollment) => void;
}

export function GroupCard({
  group,
  locale,
  canEdit,
  onOpenDetail,
  onEdit,
  onTransfer,
  onDrop,
}: GroupCardProps) {
  const isFull = isGroupFull(group);

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-medium text-primary">{group.course.title}</span>
          <h3 className="text-lg font-semibold text-foreground mt-0.5">{group.name}</h3>
          {group.pricingPlans && group.pricingPlans.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {group.pricingPlans.map((p) => (
                <Badge key={p.periodMonths} variant="neutral" className="font-mono tabular-nums">
                  {p.periodMonths} {locale === "uz-Latn" ? "oy" : "мес"}: {p.price.toLocaleString("ru-RU")} UZS
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant={isFull ? "destructive" : "neutral"} className="tabular-nums">
            <Users className="h-3 w-3" aria-hidden="true" />
            <span>
              {group.enrollments.length} / {group.maxStudents}
            </span>
          </Badge>
          {onOpenDetail && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onOpenDetail(group)}
              title="Карточка группы"
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          )}
          {canEdit && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onEdit(group)}
              title={t(locale, "groups.editGroup")}
            >
              <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-muted-foreground">
          <UserCheck className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
          <span className="truncate">
            {group.teacher ? (
              t(locale, "groups.teacherAssigned", {
                name: group.teacher.user.fullName,
              })
            ) : (
              <strong className="text-foreground">{t(locale, "groups.teacherNotAssigned")}</strong>
            )}
          </span>
        </div>

        {group.assistant && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-muted-foreground">
            <UserCheck className="h-4 w-4 shrink-0 text-info" aria-hidden="true" />
            <span className="truncate">
              {locale === "uz-Latn" ? "Yordamchi: " : "Ассистент: "}
              <strong className="text-foreground">{group.assistant.user.fullName}</strong>
            </span>
          </div>
        )}
      </div>

      <div>
        <h4 className="mb-2 text-xs font-medium text-muted-foreground">
          {t(locale, "groups.rosterTitle", {
            count: String(group.enrollments.length),
          })}
        </h4>
        {group.enrollments.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t(locale, "groups.emptyRoster")}</p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto pr-1 text-xs text-muted-foreground">
            {group.enrollments.map((en) => {
              const cleanPhone = en.student.user.phone?.replace(/[^0-9]/g, "");
              const cleanParentPhone = en.student.parentPhone?.replace(/[^0-9]/g, "");

              return (
                <li
                  key={en.id}
                  className={`flex flex-col gap-1.5 rounded-lg border p-2.5 transition-colors ${
                    en.student.isAtRisk
                      ? "border-destructive/30 bg-destructive-subtle/40"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{en.student.user.fullName}</span>
                      {en.student.attendanceRate !== undefined && en.student.attendanceRate !== null && (
                        <Badge variant={en.student.isAtRisk ? "destructive" : "success"} className="tabular-nums">
                          {en.student.isAtRisk && <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
                          <span>{en.student.attendanceRate}%</span>
                          {en.student.isAtRisk && (
                            <span>{locale === "uz-Latn" ? "· Xavf ostida" : "· В зоне риска"}</span>
                          )}
                        </Badge>
                      )}
                      {en.status === "FROZEN" && <Badge variant="info">{t(locale, "billing.frozen")}</Badge>}
                      {en.paidUntil && (
                        <Badge variant="neutral" className="tabular-nums">
                          {t(locale, "billing.paidUntil")}: {new Date(en.paidUntil).toLocaleDateString("ru-RU")}
                        </Badge>
                      )}
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title={t(locale, "groups.transferStudent")}
                          onClick={() => onTransfer(group, en)}
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title={t(locale, "groups.removeStudent")}
                          onClick={() => onDrop(group, en)}
                        >
                          <UserMinus className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-1 text-xs text-muted-foreground">
                    <span className="font-mono">{en.student.user.phone || en.student.user.email}</span>
                    {en.student.user.phone && (
                      <div className="flex items-center gap-2">
                        <a
                          href={`tel:${en.student.user.phone}`}
                          className="inline-flex items-center gap-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title={locale === "uz-Latn" ? "Qoʻngʻiroq qilish" : "Позвонить"}
                        >
                          <Phone className="h-3 w-3 text-success" aria-hidden="true" />
                          <span>{locale === "uz-Latn" ? "Tel" : "Звонок"}</span>
                        </a>
                        <a
                          href={`https://wa.me/${cleanPhone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-success"
                          title="WhatsApp"
                        >
                          <MessageCircle className="h-3 w-3 text-success" aria-hidden="true" />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                    )}
                  </div>

                  {en.student.parentPhone && (
                    <div className="flex items-center justify-between border-t border-border pt-1.5 text-xs text-muted-foreground">
                      <span className="truncate">
                        {locale === "uz-Latn" ? "Ota-onasi: " : "Родитель: "}
                        <strong className="text-foreground">{en.student.parentName || ""}</strong> ({en.student.parentPhone})
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={`tel:${en.student.parentPhone}`}
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                          aria-label={en.student.parentPhone}
                        >
                          <Phone className="h-3 w-3" aria-hidden="true" />
                        </a>
                        <a
                          href={`https://wa.me/${cleanParentPhone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-success hover:underline"
                          aria-label="WhatsApp"
                        >
                          <MessageCircle className="h-3 w-3" aria-hidden="true" />
                        </a>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
