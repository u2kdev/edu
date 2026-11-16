"use client";

import { useState } from "react";
import {
  CalendarDays,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  Download,
  Clock,
  Layers,
  X,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface AcademicTermItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface HolidayItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

interface AcademicCalendarManagerProps {
  initialTerms: AcademicTermItem[];
  initialHolidays: HolidayItem[];
  canManage: boolean;
}

type ConfirmAction =
  | { type: "import-uz" }
  | { type: "delete-term"; id: string; name: string }
  | { type: "delete-holiday"; id: string; name: string };

export default function AcademicCalendarManager({
  initialTerms,
  initialHolidays,
  canManage,
}: AcademicCalendarManagerProps) {
  const [activeTab, setActiveTab] = useState<"TERMS" | "HOLIDAYS">("TERMS");
  const [terms, setTerms] = useState<AcademicTermItem[]>(initialTerms);
  const [holidays, setHolidays] = useState<HolidayItem[]>(initialHolidays);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  // Term modal state
  const [termModalOpen, setTermModalOpen] = useState(false);
  const [editTermId, setEditTermId] = useState<string | null>(null);
  const [termName, setTermName] = useState("");
  const [termStart, setTermStart] = useState("");
  const [termEnd, setTermEnd] = useState("");

  // Holiday modal state
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [holidayName, setHolidayName] = useState("");
  const [holidayStart, setHolidayStart] = useState("");
  const [holidayEnd, setHolidayEnd] = useState("");

  const refreshTerms = async () => {
    try {
      const res = await fetch("/api/tenant/academic-terms");
      if (res.ok) {
        const data = await res.json();
        setTerms(data.terms);
      }
    } catch {}
  };

  const refreshHolidays = async () => {
    try {
      const res = await fetch("/api/tenant/holidays");
      if (res.ok) {
        const data = await res.json();
        setHolidays(data.holidays);
      }
    } catch {}
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    setLoading(true);
    setNotice(null);

    try {
      if (confirmAction.type === "import-uz") {
        const res = await fetch("/api/tenant/holidays", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "IMPORT_UZ_HOLIDAYS",
            year: new Date().getFullYear(),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Ошибка импорта");
        setHolidays(data.holidays);
        setNotice({
          type: "success",
          text: data.message || "Праздники успешно импортированы",
        });
      } else if (confirmAction.type === "delete-term") {
        const res = await fetch(`/api/tenant/academic-terms/${confirmAction.id}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Ошибка удаления");
        await refreshTerms();
        setNotice({ type: "success", text: "Учебный период удалён" });
      } else if (confirmAction.type === "delete-holiday") {
        const res = await fetch(`/api/tenant/holidays/${confirmAction.id}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Ошибка удаления");
        await refreshHolidays();
        setNotice({ type: "success", text: "Праздник удалён" });
      }
      setConfirmAction(null);
    } catch (err: unknown) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Ошибка выполнения операции",
      });
      setConfirmAction(null);
    } finally {
      setLoading(false);
    }
  };

  // Save Term (Create or Edit)
  const handleSaveTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termName.trim() || !termStart || !termEnd) return;
    setLoading(true);
    setNotice(null);

    try {
      if (editTermId) {
        const res = await fetch(`/api/tenant/academic-terms/${editTermId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: termName.trim(),
            startDate: termStart,
            endDate: termEnd,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Ошибка сохранения");
        setNotice({ type: "success", text: "Учебный период обновлён" });
      } else {
        const res = await fetch("/api/tenant/academic-terms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: termName.trim(),
            startDate: termStart,
            endDate: termEnd,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Ошибка создания");
        setNotice({ type: "success", text: "Учебный период добавлен" });
      }

      setTermModalOpen(false);
      setEditTermId(null);
      setTermName("");
      setTermStart("");
      setTermEnd("");
      await refreshTerms();
    } catch (err: unknown) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Ошибка сохранения",
      });
    } finally {
      setLoading(false);
    }
  };

  // Save Holiday
  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayName.trim() || !holidayStart) return;
    setLoading(true);
    setNotice(null);

    try {
      const res = await fetch("/api/tenant/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE",
          name: holidayName.trim(),
          startDate: holidayStart,
          endDate: holidayEnd || holidayStart,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка сохранения");

      setHolidayModalOpen(false);
      setHolidayName("");
      setHolidayStart("");
      setHolidayEnd("");
      await refreshHolidays();
      setNotice({ type: "success", text: "Праздник успешно добавлен" });
    } catch (err: unknown) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Ошибка сохранения",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  };

  const getDaysCount = (startIso: string, endIso: string) => {
    try {
      const s = new Date(startIso).getTime();
      const e = new Date(endIso).getTime();
      return Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1);
    } catch {
      return 1;
    }
  };

  const now = new Date().getTime();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Учебный календарь и праздники"
        description="Настройте четверти, семестры и праздничные дни. Расписание автоматически пропускает праздники, а отчёты фильтруются по учебным периодам."
        actions={
          canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmAction({ type: "import-uz" })}
                disabled={loading}
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                <span>Импорт праздников Узбекистана</span>
              </Button>
              {activeTab === "TERMS" ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setEditTermId(null);
                    setTermName("");
                    setTermStart("");
                    setTermEnd("");
                    setTermModalOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  <span>Добавить период</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setHolidayName("");
                    setHolidayStart("");
                    setHolidayEnd("");
                    setHolidayModalOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  <span>Добавить праздник</span>
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      {notice && (
        <Alert variant={notice.type === "success" ? "success" : "destructive"}>
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>{notice.text}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Закрыть уведомление"
              className="text-current opacity-70 hover:opacity-100 shrink-0"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "TERMS" | "HOLIDAYS")}
      >
        <TabsList>
          <TabsTrigger value="TERMS">
            <Layers className="w-4 h-4" aria-hidden="true" />
            <span>Учебные периоды ({terms.length})</span>
          </TabsTrigger>
          <TabsTrigger value="HOLIDAYS">
            <Calendar className="w-4 h-4" aria-hidden="true" />
            <span>Праздники и каникулы ({holidays.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="TERMS" className="space-y-4">
          {terms.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="w-5 h-5" aria-hidden="true" />}
              title="Учебные периоды не заданы"
              description="Создайте четверти или семестры для фильтрации оценок и посещаемости."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {terms.map((term) => {
                const s = new Date(term.startDate).getTime();
                const e = new Date(term.endDate).getTime();
                const isCurrent = now >= s && now <= e;
                const isPast = now > e;

                return (
                  <Card
                    key={term.id}
                    className={cn(isCurrent && "border-primary/40 bg-primary/5")}
                  >
                    <CardContent className="p-5 flex items-start justify-between gap-3">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-foreground">
                            {term.name}
                          </h3>
                          {isCurrent && <Badge variant="primary">Текущий</Badge>}
                          {isPast && <Badge variant="neutral">Завершён</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>
                            {formatDate(term.startDate)} — {formatDate(term.endDate)}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 tabular-nums">
                          <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>
                            Продолжительность: {getDaysCount(term.startDate, term.endDate)} дн.
                          </span>
                        </p>
                      </div>

                      {canManage && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditTermId(term.id);
                              setTermName(term.name);
                              setTermStart(term.startDate.split("T")[0]);
                              setTermEnd(term.endDate.split("T")[0]);
                              setTermModalOpen(true);
                            }}
                            title="Редактировать"
                            aria-label="Редактировать"
                          >
                            <Edit2 className="w-4 h-4" aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setConfirmAction({
                                type: "delete-term",
                                id: term.id,
                                name: term.name,
                              })
                            }
                            title="Удалить"
                            aria-label="Удалить"
                            className="hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="HOLIDAYS" className="space-y-4">
          {holidays.length === 0 ? (
            <EmptyState
              icon={<Calendar className="w-5 h-5" aria-hidden="true" />}
              title="Список праздников пуст"
              description="Добавьте праздники вручную или нажмите «Импорт праздников Узбекистана»."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {holidays.map((h) => (
                <Card key={h.id}>
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-foreground truncate">
                        {h.name}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(h.startDate)}
                        {h.endDate &&
                        h.endDate.split("T")[0] !== h.startDate.split("T")[0]
                          ? ` — ${formatDate(h.endDate)}`
                          : ""}
                      </p>
                    </div>
                    {canManage && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setConfirmAction({
                            type: "delete-holiday",
                            id: h.id,
                            name: h.name,
                          })
                        }
                        title="Удалить"
                        aria-label="Удалить"
                        className="shrink-0 hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Term Modal */}
      <Dialog open={termModalOpen} onOpenChange={setTermModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editTermId ? "Редактирование периода" : "Новый учебный период"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveTerm} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="term-name">Название периода *</Label>
              <Input
                id="term-name"
                type="text"
                required
                placeholder="Например: I четверть или 1 семестр"
                value={termName}
                onChange={(e) => setTermName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="term-start">Дата начала *</Label>
                <Input
                  id="term-start"
                  type="date"
                  required
                  value={termStart}
                  onChange={(e) => setTermStart(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="term-end">Дата окончания *</Label>
                <Input
                  id="term-end"
                  type="date"
                  required
                  value={termEnd}
                  onChange={(e) => setTermEnd(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setTermModalOpen(false)}
              >
                Отмена
              </Button>
              <Button type="submit" loading={loading}>
                Сохранить
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Holiday Modal */}
      <Dialog open={holidayModalOpen} onOpenChange={setHolidayModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Добавить праздничный день</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveHoliday} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="holiday-name">Название праздника / каникул *</Label>
              <Input
                id="holiday-name"
                type="text"
                required
                placeholder="Например: Осенние каникулы"
                value={holidayName}
                onChange={(e) => setHolidayName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="holiday-start">Дата начала *</Label>
                <Input
                  id="holiday-start"
                  type="date"
                  required
                  value={holidayStart}
                  onChange={(e) => setHolidayStart(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="holiday-end">Дата окончания</Label>
                <Input
                  id="holiday-end"
                  type="date"
                  value={holidayEnd}
                  onChange={(e) => setHolidayEnd(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setHolidayModalOpen(false)}
              >
                Отмена
              </Button>
              <Button type="submit" loading={loading}>
                Добавить праздник
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
        variant={confirmAction?.type === "import-uz" ? "primary" : "destructive"}
        loading={loading}
        title={
          confirmAction?.type === "import-uz"
            ? "Импорт праздников Узбекистана"
            : confirmAction?.type === "delete-term"
            ? "Удалить учебный период"
            : "Удалить праздник"
        }
        description={
          confirmAction?.type === "import-uz"
            ? "Импортировать официальные государственные праздники Узбекистана на текущий год?"
            : confirmAction?.type === "delete-term"
            ? `Удалить учебный период «${confirmAction.name}»?`
            : confirmAction?.type === "delete-holiday"
            ? `Удалить праздник «${confirmAction.name}»?`
            : undefined
        }
        confirmLabel={
          confirmAction?.type === "import-uz" ? "Импортировать" : "Удалить"
        }
        onConfirm={handleConfirmAction}
      />
    </div>
  );
}
