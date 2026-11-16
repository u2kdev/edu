"use client";

import Link from "next/link";
import { ArrowRightLeft, BookOpen, MoreHorizontal, UserCheck, UserMinus, Users } from "lucide-react";
import { t } from "@/i18n";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
import { isGroupFull, type GroupEnrollment, type GroupItem } from "./groups-utils";

interface GroupDetailSheetProps {
  group: GroupItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: string;
  canEdit: boolean;
  onEdit: (group: GroupItem) => void;
  onTransfer: (group: GroupItem, enrollment: GroupEnrollment) => void;
  onDrop: (group: GroupItem, enrollment: GroupEnrollment) => void;
}

export function GroupDetailSheet({
  group,
  open,
  onOpenChange,
  locale,
  canEdit,
  onEdit,
  onTransfer,
  onDrop,
}: GroupDetailSheetProps) {
  if (!group) return null;
  const full = isGroupFull(group);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" locale={locale} className="max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex flex-wrap items-start justify-between gap-2 pr-6">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle>{group.name}</SheetTitle>
                <Badge variant={full ? "destructive" : "success"} className="tabular-nums">
                  {group.enrollments.length} / {group.maxStudents}
                </Badge>
              </div>
              <SheetDescription className="flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{group.course.title}</span>
              </SheetDescription>
            </div>

            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm">
                    <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                    <span>{t(locale, "ui4.moreActions")}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => {
                      onOpenChange(false);
                      onEdit(group);
                    }}
                  >
                    {t(locale, "groups.editGroup")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </SheetHeader>

        <Tabs defaultValue="roster" className="space-y-4">
          <TabsList>
            <TabsTrigger value="roster">
              <Users className="h-4 w-4" aria-hidden="true" />
              <span>
                {locale === "uz-Latn" ? "Tarkib" : "Состав"} ({group.enrollments.length})
              </span>
            </TabsTrigger>
            <TabsTrigger value="pricing">
              <span>{t(locale, "billing.pricingPlans")}</span>
            </TabsTrigger>
            <TabsTrigger value="team">
              <UserCheck className="h-4 w-4" aria-hidden="true" />
              <span>{locale === "uz-Latn" ? "Oʻqituvchilar" : "Преподаватели"}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="roster">
            {group.enrollments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t(locale, "groups.emptyRoster")}</p>
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border">
                {group.enrollments.map((en) => (
                  <div key={en.id} className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0 space-y-0.5">
                      <Link
                        href={`/center/students/${en.student.id}`}
                        className="block truncate text-sm font-medium text-foreground hover:text-primary"
                      >
                        {en.student.user.fullName}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground tabular-nums">
                        <span>{en.student.user.phone || en.student.user.email}</span>
                        {en.status === "FROZEN" && <Badge variant="info">{t(locale, "billing.frozen")}</Badge>}
                        {en.paidUntil && (
                          <span>
                            {t(locale, "billing.paidUntil")}:{" "}
                            {new Date(en.paidUntil).toLocaleDateString("ru-RU")}
                          </span>
                        )}
                      </div>
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
                          <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title={t(locale, "groups.removeStudent")}
                          onClick={() => onDrop(group, en)}
                        >
                          <UserMinus className="h-4 w-4 text-destructive" aria-hidden="true" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pricing" className="space-y-4">
            <div className="rounded-lg border border-border bg-muted p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t(locale, "groups.capacity")}</span>
                <span className="font-medium text-foreground tabular-nums">
                  {group.enrollments.length} / {group.maxStudents}
                </span>
              </div>
              <progress
                value={group.enrollments.length}
                max={Math.max(1, group.maxStudents)}
                className="h-2 w-full overflow-hidden rounded-full bg-background accent-primary"
              />
            </div>

            {group.pricingPlans && group.pricingPlans.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {group.pricingPlans.map((p) => (
                  <div key={p.periodMonths} className="rounded-lg border border-border bg-card p-3">
                    <div className="text-xs text-muted-foreground">
                      {p.periodMonths} {locale === "uz-Latn" ? "oy" : "мес."}
                    </div>
                    <div className="mt-1 font-mono text-sm font-semibold text-foreground tabular-nums">
                      {p.price.toLocaleString("ru-RU")} UZS
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Тарифы за 1/2/3 месяца не настроены для этой группы.
              </p>
            )}
          </TabsContent>

          <TabsContent value="team" className="space-y-3">
            <div className="rounded-lg border border-border bg-card p-4 space-y-1">
              <div className="text-xs text-muted-foreground">Преподаватель</div>
              <div className="text-sm font-medium text-foreground">
                {group.teacher ? group.teacher.user.fullName : t(locale, "groups.teacherNotAssigned")}
              </div>
            </div>
            {group.assistant && (
              <div className="rounded-lg border border-border bg-card p-4 space-y-1">
                <div className="text-xs text-muted-foreground">Ассистент преподавателя</div>
                <div className="text-sm font-medium text-foreground">{group.assistant.user.fullName}</div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
