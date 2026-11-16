"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronDown, ChevronRight, Clock, Layers, LayoutGrid, List, Plus, Video } from "lucide-react";
import { t } from "@/i18n";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  DataTable,
  type DataTableColumn,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EmptyState,
  FilterBar,
  FormActions,
  FormField,
  Input,
  PageHeader,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Textarea,
} from "@/components/ui";

export interface LessonItem {
  id: string;
  title: string;
  durationMinutes: number;
  lessonType: string;
}

export interface ModuleItem {
  id: string;
  title: string;
  lessons: LessonItem[];
}

export interface CourseItem {
  id: string;
  title: string;
  description?: string | null;
  isPublished: boolean;
  modules: ModuleItem[];
  groups: Array<{ id: string }>;
}

interface CourseManagerProps {
  initialCourses: CourseItem[];
  role?: string;
  locale?: string;
}

const selectClassName =
  "h-9 rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background";

export default function CourseManager({ initialCourses, role, locale = "ru" }: CourseManagerProps) {
  const router = useRouter();
  const [courses] = useState(initialCourses);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "PUBLISHED" | "DRAFT">("");
  const [viewMode, setViewMode] = useState<"table" | "accordion">("table");
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(initialCourses[0]?.id || null);
  const [drawerCourse, setDrawerCourse] = useState<CourseItem | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canEdit = role === "DIRECTOR" || role === "CENTER_ADMIN";

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, isPublished: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowCreateModal(false);
        setTitle("");
        setDescription("");
        router.refresh();
      } else {
        setCreateError(data.error || t(locale, "courses.networkError"));
      }
    } catch {
      setCreateError(t(locale, "courses.networkError"));
    } finally {
      setLoading(false);
    }
  };

  const filteredCourses = courses.filter((c) => {
    const q = search.trim().toLowerCase();
    if (q) {
      const matchTitle = c.title.toLowerCase().includes(q);
      const matchDesc = (c.description || "").toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }
    if (statusFilter === "PUBLISHED" && !c.isPublished) return false;
    if (statusFilter === "DRAFT" && c.isPublished) return false;
    return true;
  });

  const hasFilters = Boolean(search || statusFilter);

  const columns: DataTableColumn<CourseItem>[] = [
    {
      id: "title",
      header: t(locale, "courses.courseName"),
      isMobilePrimary: true,
      sortable: true,
      sortValue: (c) => c.title,
      cell: (c) => (
        <div className="min-w-0">
          <Link
            href={`/center/courses/${c.id}`}
            onClick={(e) => e.stopPropagation()}
            className="block truncate font-medium text-foreground hover:text-primary"
          >
            {c.title}
          </Link>
          <p className="truncate max-w-md text-xs text-muted-foreground">
            {c.description || t(locale, "courses.noDescription")}
          </p>
        </div>
      ),
    },
    {
      id: "status",
      header: t(locale, "students.status"),
      cell: (c) => (
        <Badge variant={c.isPublished ? "success" : "warning"}>
          {c.isPublished ? t(locale, "courses.published") : t(locale, "courses.draft")}
        </Badge>
      ),
    },
    {
      id: "modules",
      header: t(locale, "courses.modules"),
      sortable: true,
      sortValue: (c) => c.modules.length,
      cell: (c) => (
        <span className="text-sm text-foreground tabular-nums">
          {t(locale, "courses.modulesCount", { count: c.modules.length })}
        </span>
      ),
    },
    {
      id: "groups",
      header: t(locale, "groups.title"),
      hideOnMobile: true,
      sortable: true,
      sortValue: (c) => c.groups.length,
      cell: (c) => (
        <span className="text-sm text-muted-foreground tabular-nums">
          {t(locale, "courses.groupsCount", { count: c.groups.length })}
        </span>
      ),
    },
    {
      id: "actions",
      header: locale === "uz-Latn" ? "Amallar" : "Действия",
      align: "right",
      cell: (c) => (
        <div className="inline-flex items-center gap-1.5" data-no-row-click="true">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setDrawerCourse(c)}
          >
            {t(locale, "courses.modules")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push(`/center/courses/${c.id}`)}
          >
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Конструктор</span>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(locale, "courses.title")}
        description={
          locale === "uz-Latn"
            ? `Jami kurslar: ${courses.length}`
            : `Всего курсов: ${courses.length}`
        }
        actions={
          canEdit ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                setCreateError(null);
                setShowCreateModal(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>{t(locale, "courses.addNewCourse")}</span>
            </Button>
          ) : undefined
        }
      />

      <FilterBar
        locale={locale}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={
          locale === "uz-Latn" ? "Kurs nomi boʻyicha qidirish..." : "Поиск по названию курса..."
        }
        hasActiveFilters={hasFilters}
        onReset={() => {
          setSearch("");
          setStatusFilter("");
        }}
        actions={
          <div className="inline-flex rounded-md border border-border bg-muted p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === "table"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Таблица</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("accordion")}
              className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === "accordion"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Программа</span>
            </button>
          </div>
        }
      >
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "" | "PUBLISHED" | "DRAFT")}
          aria-label={t(locale, "students.status")}
          className={selectClassName}
        >
          <option value="">{t(locale, "students.filterStatus")}</option>
          <option value="PUBLISHED">{t(locale, "courses.published")}</option>
          <option value="DRAFT">{t(locale, "courses.draft")}</option>
        </select>
      </FilterBar>

      {viewMode === "table" ? (
        <DataTable
          data={filteredCourses}
          columns={columns}
          getRowId={(c) => c.id}
          getRowHref={(c) => `/center/courses/${c.id}`}
          locale={locale}
          emptyTitle={t(locale, "courses.noCoursesYet")}
          emptyDescription={t(locale, "ui4.emptyCoursesDesc")}
          emptyAction={
            canEdit ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  setCreateError(null);
                  setShowCreateModal(true);
                }}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>{t(locale, "courses.addNewCourse")}</span>
              </Button>
            ) : undefined
          }
          mobileMode="cards"
        />
      ) : filteredCourses.length === 0 ? (
        <EmptyState
          title={t(locale, "courses.noCoursesYet")}
          description={t(locale, "ui4.emptyCoursesDesc")}
          action={
            canEdit ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  setCreateError(null);
                  setShowCreateModal(true);
                }}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>{t(locale, "courses.addNewCourse")}</span>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredCourses.map((course) => {
            const isExpanded = expandedCourseId === course.id;
            return (
              <Card key={course.id} className="overflow-hidden">
                <div
                  onClick={() => setExpandedCourseId(isExpanded ? null : course.id)}
                  className="flex cursor-pointer items-center justify-between gap-4 p-5 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-primary/10 text-primary">
                      <BookOpen className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-foreground">{course.title}</h3>
                        <Badge variant={course.isPublished ? "success" : "warning"}>
                          {course.isPublished ? t(locale, "courses.published") : t(locale, "courses.draft")}
                        </Badge>
                      </div>
                      <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                        {course.description || t(locale, "courses.noDescription")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/center/courses/${course.id}`);
                      }}
                    >
                      <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Конструктор</span>
                    </Button>
                    <div className="hidden text-right text-xs text-muted-foreground sm:block tabular-nums">
                      <div>{t(locale, "courses.modulesCount", { count: course.modules.length })}</div>
                      <div>{t(locale, "courses.groupsCount", { count: course.groups.length })}</div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="space-y-4 border-t border-border bg-muted/40 p-5">
                    <h4 className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Layers className="h-4 w-4 text-primary" aria-hidden="true" />
                      <span>{t(locale, "courses.curriculum")}</span>
                    </h4>

                    {course.modules.length === 0 ? (
                      <p className="text-xs text-muted-foreground">{t(locale, "courses.noModulesYet")}</p>
                    ) : (
                      <div className="space-y-3">
                        {course.modules.map((mod) => (
                          <div key={mod.id} className="rounded-lg border border-border bg-card p-4">
                            <h5 className="mb-2.5 text-sm font-semibold text-foreground">{mod.title}</h5>
                            <div className="space-y-2">
                              {mod.lessons.map((lesson) => (
                                <div
                                  key={lesson.id}
                                  className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2 text-xs"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <Video className="h-4 w-4 text-info" aria-hidden="true" />
                                    <span className="font-medium text-foreground">{lesson.title}</span>
                                  </div>
                                  <div className="flex items-center gap-3 text-muted-foreground tabular-nums">
                                    <span className="inline-flex items-center gap-1">
                                      <Clock className="h-3 w-3" aria-hidden="true" />
                                      <span>
                                        {lesson.durationMinutes} {t(locale, "courses.minutes")}
                                      </span>
                                    </span>
                                    <Badge variant="neutral">{lesson.lessonType}</Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={Boolean(drawerCourse)} onOpenChange={(next) => !next && setDrawerCourse(null)}>
        <SheetContent side="right" locale={locale} className="max-w-lg overflow-y-auto">
          {drawerCourse && (
            <>
              <SheetHeader>
                <SheetTitle>{drawerCourse.title}</SheetTitle>
                <SheetDescription>
                  {drawerCourse.description || t(locale, "courses.noDescription")}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4">
                <h4 className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Layers className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span>{t(locale, "courses.curriculum")}</span>
                </h4>

                {drawerCourse.modules.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t(locale, "courses.noModulesYet")}</p>
                ) : (
                  <div className="space-y-3">
                    {drawerCourse.modules.map((mod) => (
                      <div key={mod.id} className="rounded-lg border border-border bg-muted/50 p-3.5 space-y-2">
                        <div className="text-sm font-semibold text-foreground">{mod.title}</div>
                        {mod.lessons.map((lesson) => (
                          <div
                            key={lesson.id}
                            className="flex items-center justify-between rounded border border-border bg-card px-2.5 py-1.5 text-xs"
                          >
                            <span className="font-medium text-foreground">{lesson.title}</span>
                            <span className="text-muted-foreground tabular-nums">
                              {lesson.durationMinutes} {t(locale, "courses.minutes")}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => router.push(`/center/courses/${drawerCourse.id}`)}
                  >
                    Конструктор
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog
        open={showCreateModal}
        onOpenChange={(next) => {
          setShowCreateModal(next);
          if (!next) setCreateError(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t(locale, "courses.createCourseModal")}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateCourse} className="space-y-4">
            {createError && (
              <Alert variant="destructive">
                <AlertDescription>{createError}</AlertDescription>
              </Alert>
            )}

            <FormField label={t(locale, "courses.courseName")} htmlFor="course-title" required>
              <Input
                id="course-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t(locale, "courses.titlePlaceholder")}
              />
            </FormField>

            <FormField label={t(locale, "courses.courseDescription")} htmlFor="course-description">
              <Textarea
                id="course-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t(locale, "courses.descPlaceholder")}
              />
            </FormField>

            <FormActions>
              <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
                {t(locale, "courses.cancel")}
              </Button>
              <Button type="submit" variant="primary" disabled={loading} loading={loading}>
                {loading ? t(locale, "courses.creating") : t(locale, "courses.createCourse")}
              </Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
