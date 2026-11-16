"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Send,
  Users,
  FileText,
  Clock,
  Lock,
  Sparkles,
  Plus,
  Trash2,
  Eye,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FilterBar } from "@/components/ui/filter-bar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const SELECT_CLS =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

export interface BroadcastRow {
  id: string;
  title: string;
  bodyRu: string;
  bodyUz: string | null;
  channel: string;
  audience: string;
  targetGroupId: string | null;
  targetRole: string | null;
  status: string;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  estimatedCost: number;
  createdAt: string;
  createdBy: { id: string; fullName: string } | null;
  group: { id: string; name: string } | null;
}

export interface TemplateRow {
  id: string;
  key: string;
  locale: "ru" | "uz_Latn" | "uz_Cyrl";
  title: string;
  body: string;
  isActive: boolean;
  updatedAt: string;
}

interface GroupOption {
  id: string;
  name: string;
}

interface PreviewSummary {
  totalAudience: number;
  totalRecipients: number;
  estimatedSmsSegments: number;
  estimatedCostUzs: number;
  sampleMessages: Array<{ userId: string; locale: string; text: string }>;
}

interface Props {
  initialBroadcasts: BroadcastRow[];
  initialTotal: number;
  initialTemplates: TemplateRow[];
  groups: GroupOption[];
  planFeatures: {
    broadcasts: boolean;
    smsReminders: boolean;
    telegramBot: boolean;
    mobileApp: boolean;
  };
  planName: string | null;
  canWrite: boolean;
  locale?: string;
}

const VARIABLES = [
  "{{studentName}}",
  "{{amount}}",
  "{{paidUntil}}",
  "{{payUrl}}",
  "{{centerName}}",
  "{{groupName}}",
] as const;

const ROLES_LIST = [
  { value: "STUDENT", ru: "Ученики", uz: "O'quvchilar" },
  { value: "PARENT", ru: "Родители", uz: "Ota-onalar" },
  { value: "TEACHER", ru: "Преподаватели", uz: "O'qituvchilar" },
  { value: "TEACHER_ASSISTANT", ru: "Ассистенты преподавателей", uz: "Assistentlar" },
  { value: "CENTER_ADMIN", ru: "Администраторы", uz: "Administratorlar" },
  { value: "ACCOUNTANT", ru: "Бухгалтеры", uz: "Buxgalterlar" },
] as const;

function broadcastStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case "COMPLETED":
      return "success";
    case "SCHEDULED":
    case "SENDING":
      return "info";
    case "FAILED":
      return "destructive";
    default:
      return "neutral";
  }
}

export default function CommunicationsManager({
  initialBroadcasts,
  initialTotal,
  initialTemplates,
  groups,
  planFeatures,
  planName,
  canWrite,
  locale = "ru",
}: Props) {
  const isUz = locale === "uz-Latn";
  const [activeTab, setActiveTab] = useState<"compose" | "templates">("compose");

  // Broadcast history state
  const [broadcasts, setBroadcasts] = useState<BroadcastRow[]>(initialBroadcasts);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(
    Math.max(1, Math.ceil(initialTotal / 15))
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [loadingList, setLoadingList] = useState(false);

  // Composer state
  const [title, setTitle] = useState("");
  const [bodyRu, setBodyRu] = useState("");
  const [bodyUz, setBodyUz] = useState("");
  const [channel, setChannel] = useState<
    "TELEGRAM" | "PUSH" | "SMS" | "EMAIL" | "IN_APP"
  >("TELEGRAM");
  const [audience, setAudience] = useState<
    "ALL" | "DEBTORS" | "OVERDUE" | "GROUP" | "ROLE"
  >("ALL");
  const [targetGroupId, setTargetGroupId] = useState(groups[0]?.id || "");
  const [targetRole, setTargetRole] = useState<string>("STUDENT");
  const [scheduledAt, setScheduledAt] = useState("");
  const [preview, setPreview] = useState<PreviewSummary | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Templates state
  const [templates, setTemplates] = useState<TemplateRow[]>(initialTemplates);
  const [tplKey, setTplKey] = useState("");
  const [tplLocale, setTplLocale] = useState<"ru" | "uz-Latn">("ru");
  const [tplTitle, setTplTitle] = useState("");
  const [tplBody, setTplBody] = useState("");
  const [tplActive, setTplActive] = useState(true);
  const [savingTpl, setSavingTpl] = useState(false);
  const [deleteTplTarget, setDeleteTplTarget] = useState<TemplateRow | null>(
    null
  );
  const [deletingTpl, setDeletingTpl] = useState(false);

  const lockedBroadcasts = !planFeatures.broadcasts;
  const lockedSmsChannel = channel === "SMS" && !planFeatures.smsReminders;

  const fetchHistory = useCallback(
    async (
      targetPage = page,
      overrides?: { search?: string; status?: string; channel?: string }
    ) => {
      setLoadingList(true);
      try {
        const s = overrides?.search ?? search;
        const st = overrides?.status ?? statusFilter;
        const ch = overrides?.channel ?? channelFilter;
        const sp = new URLSearchParams({
          page: String(targetPage),
          pageSize: "15",
        });
        if (s.trim()) sp.set("search", s.trim());
        if (st) sp.set("status", st);
        if (ch) sp.set("channel", ch);

        const res = await fetch(
          `/api/communications/broadcasts?${sp.toString()}`
        );
        const json = await res.json();
        if (res.ok) {
          setBroadcasts(json.broadcasts || []);
          setTotal(json.pagination?.total || 0);
          setPage(json.pagination?.page || targetPage);
          setTotalPages(json.pagination?.totalPages || 1);
        }
      } finally {
        setLoadingList(false);
      }
    },
    [page, search, statusFilter, channelFilter]
  );

  const fetchTemplates = useCallback(async () => {
    const res = await fetch("/api/communications/templates");
    if (res.ok) {
      const json = await res.json();
      setTemplates(json.templates || []);
    }
  }, []);

  const buildComposerPayload = (
    action: "preview" | "send" | "schedule",
    confirmed = false
  ) => ({
    action,
    title: title.trim() || (action === "preview" ? "Предпросмотр" : ""),
    bodyRu,
    bodyUz: bodyUz.trim() ? bodyUz.trim() : null,
    channel,
    audience,
    targetGroupId: audience === "GROUP" ? targetGroupId || null : null,
    targetRole: audience === "ROLE" ? targetRole || null : null,
    scheduledAt:
      action === "schedule" && scheduledAt
        ? new Date(scheduledAt).toISOString()
        : null,
    confirmed,
  });

  const handlePreview = async () => {
    setNotice(null);
    if (!bodyRu.trim()) {
      setNotice({
        type: "error",
        text: isUz
          ? "Rus tilidagi matnni kiriting"
          : "Введите текст рассылки на русском языке",
      });
      return;
    }
    setLoadingPreview(true);
    try {
      const res = await fetch("/api/communications/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildComposerPayload("preview")),
      });
      const json = await res.json();
      if (!res.ok) {
        setNotice({ type: "error", text: json.error || "Ошибка предпросмотра" });
        return;
      }
      setPreview(json.preview);
    } catch {
      setNotice({ type: "error", text: "Ошибка сети" });
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSendOrSchedule = async (mode: "send" | "schedule") => {
    setNotice(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/communications/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildComposerPayload(mode, mode === "send")),
      });
      const json = await res.json();
      if (!res.ok) {
        setNotice({ type: "error", text: json.error || "Ошибка рассылки" });
        return;
      }
      setConfirmOpen(false);
      setNotice({
        type: "success",
        text:
          mode === "schedule"
            ? isUz
              ? "Xabarnoma rejalashtirildi"
              : "Рассылка запланирована"
            : isUz
            ? `Yuborildi: ${json.summary?.sentCount ?? 0} ta`
            : `Рассылка выполнена: отправлено ${json.summary?.sentCount ?? 0}, ошибок ${json.summary?.failedCount ?? 0}`,
      });
      setTitle("");
      setBodyRu("");
      setBodyUz("");
      setScheduledAt("");
      setPreview(null);
      await fetchHistory(1);
    } catch {
      setNotice({ type: "error", text: "Ошибка сети" });
    } finally {
      setSubmitting(false);
    }
  };

  const applyTemplateKey = (key: string) => {
    if (!key) return;
    const ruMatch = templates.find(
      (item) => item.key === key && item.locale === "ru"
    );
    const uzMatch = templates.find(
      (item) => item.key === key && item.locale === "uz_Latn"
    );
    if (ruMatch) {
      setTitle(ruMatch.title);
      setBodyRu(ruMatch.body);
    }
    if (uzMatch) {
      setBodyUz(uzMatch.body);
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    setSavingTpl(true);
    try {
      const res = await fetch("/api/communications/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: tplKey.trim(),
          locale: tplLocale,
          title: tplTitle.trim(),
          body: tplBody.trim(),
          isActive: tplActive,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setNotice({
          type: "error",
          text: json.error || "Ошибка сохранения шаблона",
        });
        return;
      }
      setNotice({
        type: "success",
        text: isUz ? "Shablon saqlandi" : "Шаблон сохранён",
      });
      setTplKey("");
      setTplTitle("");
      setTplBody("");
      await fetchTemplates();
    } catch {
      setNotice({ type: "error", text: "Ошибка сети" });
    } finally {
      setSavingTpl(false);
    }
  };

  const handleConfirmDeleteTemplate = async () => {
    if (!deleteTplTarget) return;
    setDeletingTpl(true);
    try {
      const res = await fetch(
        `/api/communications/templates?id=${encodeURIComponent(deleteTplTarget.id)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        await fetchTemplates();
        setDeleteTplTarget(null);
      } else {
        const json = await res.json().catch(() => ({}));
        setNotice({
          type: "error",
          text: json.error || "Не удалось удалить шаблон",
        });
        setDeleteTplTarget(null);
      }
    } catch {
      setNotice({ type: "error", text: "Ошибка сети" });
      setDeleteTplTarget(null);
    } finally {
      setDeletingTpl(false);
    }
  };

  const uniqueTemplateKeys = Array.from(
    new Set(templates.map((item) => item.key))
  );

  const columns = useMemo<DataTableColumn<BroadcastRow>[]>(
    () => [
      {
        id: "title",
        header: isUz ? "Sarlavha" : "Заголовок",
        cell: (b) => (
          <div className="min-w-0">
            <div className="font-medium text-foreground">{b.title}</div>
            <div className="text-xs text-muted-foreground line-clamp-1">
              {b.bodyRu}
            </div>
          </div>
        ),
      },
      {
        id: "channel",
        header: isUz ? "Kanal / Auditoriya" : "Канал / Сегмент",
        cell: (b) => (
          <div className="text-xs text-foreground">
            <span className="font-semibold">{b.channel}</span> · {b.audience}
            {b.group?.name ? ` (${b.group.name})` : ""}
            {b.targetRole ? ` (${b.targetRole})` : ""}
          </div>
        ),
      },
      {
        id: "stats",
        header: isUz ? "Statistika" : "Отправлено / Ошибок",
        cell: (b) => (
          <div className="text-xs text-foreground tabular-nums">
            {b.sentCount} / {b.totalRecipients}
            {b.failedCount > 0 && (
              <span className="text-destructive ml-1">
                ({b.failedCount} err)
              </span>
            )}
          </div>
        ),
      },
      {
        id: "status",
        header: isUz ? "Holat" : "Статус",
        cell: (b) => (
          <Badge variant={broadcastStatusVariant(b.status)}>{b.status}</Badge>
        ),
      },
      {
        id: "createdAt",
        header: isUz ? "Sana" : "Дата",
        cell: (b) => (
          <span className="text-xs text-muted-foreground tabular-nums">
            {new Date(b.createdAt).toLocaleString("ru-RU")}
          </span>
        ),
      },
    ],
    [isUz]
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title={
          isUz
            ? "Ommaviy xabarnomalar va shablonlar"
            : "Рассылки и шаблоны сообщений"
        }
        description={
          isUz
            ? "Telegram, Push, SMS va Email orqali segmentlangan xabarnomalar (tinch soatlar 21:00-08:00 hisobga olinadi)"
            : "Массовые рассылки по группам и должникам (Telegram, Push, SMS, Email, IN_APP) с учётом тихих часов 21:00–08:00"
        }
      />

      {lockedBroadcasts && (
        <Alert variant="warning">
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Lock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <div className="font-semibold">
                  {isUz
                    ? "Tarif bo'yicha cheklov: Ommaviy xabarnomalar yopiq"
                    : `Функция рассылок недоступна на текущем тарифе${
                        planName ? ` «${planName}»` : ""
                      }`}
                </div>
                <p className="text-xs opacity-90 mt-0.5">
                  {isUz
                    ? "Xabarnomalar va shablonlardan foydalanish uchun tarifni yangilang."
                    : "Для отправки массовых рассылок и управления шаблонами перейдите на тариф «Рост» или «Про»."}
                </p>
              </div>
            </div>
            <Button asChild size="sm" variant="primary" className="shrink-0">
              <Link href="/center/upgrade">
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                <span>{isUz ? "Tarifni yaxshilash" : "Улучшить тариф"}</span>
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {notice && (
        <Alert variant={notice.type === "success" ? "success" : "destructive"}>
          <AlertDescription>{notice.text}</AlertDescription>
        </Alert>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "compose" | "templates")}
      >
        <TabsList>
          <TabsTrigger value="compose">
            <Send className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isUz ? "Xabarnomalar" : "Рассылки"}</span>
          </TabsTrigger>
          <TabsTrigger value="templates">
            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              {isUz ? "Shablonlar" : "Шаблоны"} ({templates.length})
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="space-y-6">
          {/* Composer Card */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" aria-hidden="true" />
                <span>
                  {isUz ? "Yangi xabarnoma yaratish" : "Создать рассылку"}
                </span>
              </CardTitle>

              {uniqueTemplateKeys.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground shrink-0">
                    {isUz ? "Shablondan:" : "Из шаблона:"}
                  </span>
                  <select
                    aria-label={isUz ? "Shablondan" : "Из шаблона"}
                    onChange={(e) => applyTemplateKey(e.target.value)}
                    defaultValue=""
                    className={SELECT_CLS}
                  >
                    <option value="">
                      {isUz ? "Tanlang..." : "Выбрать шаблон..."}
                    </option>
                    {uniqueTemplateKeys.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </CardHeader>

            <CardContent className="pt-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="comm-channel">
                    {isUz ? "Kanal" : "Канал доставки"}
                  </Label>
                  <select
                    id="comm-channel"
                    value={channel}
                    onChange={(e) => {
                      setChannel(e.target.value as typeof channel);
                      setPreview(null);
                    }}
                    className={SELECT_CLS}
                  >
                    <option value="TELEGRAM">Telegram Bot</option>
                    <option value="PUSH">Mobile Push</option>
                    <option value="SMS">SMS (Eskiz)</option>
                    <option value="EMAIL">Email</option>
                    <option value="IN_APP">In-App</option>
                  </select>
                  {lockedSmsChannel && (
                    <p className="text-xs text-destructive">
                      {isUz
                        ? "SMS eslatmalar tarifda yopiq"
                        : "SMS-канал заблокирован на текущем тарифе"}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="comm-audience">
                    {isUz ? "Auditoriya" : "Сегмент аудитории"}
                  </Label>
                  <select
                    id="comm-audience"
                    value={audience}
                    onChange={(e) => {
                      setAudience(e.target.value as typeof audience);
                      setPreview(null);
                    }}
                    className={SELECT_CLS}
                  >
                    <option value="ALL">
                      {isUz ? "Barcha a'zolar" : "Все участники центра"}
                    </option>
                    <option value="DEBTORS">
                      {isUz ? "Qarzdorlar" : "Должники (долг > 0)"}
                    </option>
                    <option value="OVERDUE">
                      {isUz ? "Muddati o'tganlar" : "Просрочившие оплату"}
                    </option>
                    <option value="GROUP">
                      {isUz ? "Guruh bo'yicha" : "По конкретной группе"}
                    </option>
                    <option value="ROLE">
                      {isUz ? "Rol bo'yicha" : "По роли"}
                    </option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  {audience === "GROUP" ? (
                    <>
                      <Label htmlFor="comm-group">
                        {isUz ? "Guruh" : "Группа"}
                      </Label>
                      <select
                        id="comm-group"
                        value={targetGroupId}
                        onChange={(e) => {
                          setTargetGroupId(e.target.value);
                          setPreview(null);
                        }}
                        className={SELECT_CLS}
                      >
                        <option value="">
                          {isUz ? "Guruhni tanlang" : "Выберите группу"}
                        </option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : audience === "ROLE" ? (
                    <>
                      <Label htmlFor="comm-role">
                        {isUz ? "Rol" : "Роль"}
                      </Label>
                      <select
                        id="comm-role"
                        value={targetRole}
                        onChange={(e) => {
                          setTargetRole(e.target.value);
                          setPreview(null);
                        }}
                        className={SELECT_CLS}
                      >
                        {ROLES_LIST.map((r) => (
                          <option key={r.value} value={r.value}>
                            {isUz ? r.uz : r.ru}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <>
                      <Label htmlFor="comm-scheduled">
                        {isUz
                          ? "Rejalashtirilgan vaqt (ixtiyoriy)"
                          : "Отложить отправку (опционально)"}
                      </Label>
                      <Input
                        id="comm-scheduled"
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                      />
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="comm-title">
                  {isUz ? "Sarlavha / Mavzu" : "Заголовок / тема сообщения"}
                </Label>
                <Input
                  id="comm-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    isUz
                      ? "Masalan: To'lov eslatmasi"
                      : "Например: Напоминание об оплате за месяц"
                  }
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium text-muted-foreground">
                  {isUz ? "O'zgaruvchilar:" : "Переменные подстановки:"}
                </span>
                {VARIABLES.map((v) => (
                  <Button
                    key={v}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setBodyRu((prev) => (prev ? `${prev} ${v}` : v))}
                    className="h-7 px-2 font-mono text-xs"
                  >
                    {v}
                  </Button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="comm-body-ru">
                    {isUz
                      ? "Matn (Ruscha — asosiy)"
                      : "Текст сообщения (RU — основной)"}
                  </Label>
                  <Textarea
                    id="comm-body-ru"
                    rows={4}
                    value={bodyRu}
                    onChange={(e) => {
                      setBodyRu(e.target.value);
                      setPreview(null);
                    }}
                    placeholder="Уважаемый(ая) {{studentName}}, напоминаем об оплате {{amount}} сум..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="comm-body-uz">
                    {isUz
                      ? "Matn (O'zbekcha — uz-Latn)"
                      : "Текст сообщения (UZ — uz-Latn)"}
                  </Label>
                  <Textarea
                    id="comm-body-uz"
                    rows={4}
                    value={bodyUz}
                    onChange={(e) => {
                      setBodyUz(e.target.value);
                      setPreview(null);
                    }}
                    placeholder="Hurmatli {{studentName}}, {{amount}} so'm to'lov haqida eslatma..."
                  />
                </div>
              </div>

              {preview && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-4 text-[13px] text-foreground">
                    <span>
                      {isUz ? "Auditoriya:" : "Всего в сегменте:"}{" "}
                      <strong className="tabular-nums">
                        {preview.totalAudience}
                      </strong>
                    </span>
                    <span>
                      {isUz ? "Qabul qiluvchilar:" : "Доступно по каналу:"}{" "}
                      <strong className="text-primary tabular-nums">
                        {preview.totalRecipients}
                      </strong>
                    </span>
                    {channel === "SMS" && (
                      <>
                        <span>
                          {isUz ? "SMS segmentlar:" : "SMS-сегментов:"}{" "}
                          <strong className="tabular-nums">
                            {preview.estimatedSmsSegments}
                          </strong>
                        </span>
                        <span>
                          {isUz ? "Taxminiy narx:" : "Оценка стоимости:"}{" "}
                          <strong className="tabular-nums">
                            {preview.estimatedCostUzs.toLocaleString("ru-RU")}{" "}
                            UZS
                          </strong>
                        </span>
                      </>
                    )}
                  </div>
                  {preview.sampleMessages.length > 0 && (
                    <div className="text-xs text-muted-foreground bg-card rounded-md p-3 border border-border">
                      <div className="font-semibold text-foreground mb-1">
                        {isUz ? "Namuna:" : "Пример рендера:"}
                      </div>
                      <div>{preview.sampleMessages[0].text}</div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canWrite || lockedBroadcasts || lockedSmsChannel}
                  loading={loadingPreview}
                  onClick={handlePreview}
                >
                  <Eye className="w-4 h-4" aria-hidden="true" />
                  <span>{isUz ? "Oldindan ko'rish" : "Предпросмотр"}</span>
                </Button>

                {scheduledAt && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={!canWrite || lockedBroadcasts || lockedSmsChannel}
                    loading={submitting}
                    onClick={() => handleSendOrSchedule("schedule")}
                  >
                    <Clock className="w-4 h-4" aria-hidden="true" />
                    <span>{isUz ? "Rejalashtirish" : "Запланировать"}</span>
                  </Button>
                )}

                <Button
                  type="button"
                  size="sm"
                  disabled={!canWrite || lockedBroadcasts || lockedSmsChannel}
                  loading={submitting}
                  onClick={async () => {
                    if (!preview) await handlePreview();
                    setConfirmOpen(true);
                  }}
                >
                  <Send className="w-4 h-4" aria-hidden="true" />
                  <span>{isUz ? "Yuborish" : "Отправить сейчас"}</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* History Table Card */}
          <Card>
            <CardHeader>
              <CardTitle>
                {isUz ? "Xabarnomalar tarixi" : "История рассылок"} ({total})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FilterBar
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder={
                  isUz ? "Qidiruv..." : "Поиск по заголовку/тексту..."
                }
                hasActiveFilters={Boolean(
                  search || channelFilter || statusFilter
                )}
                onReset={() => {
                  setSearch("");
                  setChannelFilter("");
                  setStatusFilter("");
                  void fetchHistory(1, { search: "", channel: "", status: "" });
                }}
              >
                <select
                  aria-label={isUz ? "Kanal" : "Канал"}
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                  className={SELECT_CLS}
                >
                  <option value="">
                    {isUz ? "Barcha kanallar" : "Все каналы"}
                  </option>
                  <option value="TELEGRAM">Telegram</option>
                  <option value="PUSH">Push</option>
                  <option value="SMS">SMS</option>
                  <option value="EMAIL">Email</option>
                  <option value="IN_APP">In-App</option>
                </select>
                <select
                  aria-label={isUz ? "Holat" : "Статус"}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={SELECT_CLS}
                >
                  <option value="">
                    {isUz ? "Barcha holatlar" : "Все статусы"}
                  </option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="SCHEDULED">SCHEDULED</option>
                  <option value="SENDING">SENDING</option>
                  <option value="FAILED">FAILED</option>
                </select>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void fetchHistory(1)}
                >
                  {isUz ? "Qo'llash" : "Найти"}
                </Button>
              </FilterBar>

              <DataTable
                data={broadcasts}
                columns={columns}
                getRowId={(b) => b.id}
                locale={locale}
                loading={loadingList}
                page={page}
                totalPages={totalPages}
                totalItems={total}
                pageSize={15}
                onPageChange={(nextPage) => void fetchHistory(nextPage)}
                mobileMode="cards"
                emptyTitle={
                  isUz ? "Hali xabarnomalar yo'q" : "Рассылок пока нет"
                }
                emptyDescription={
                  isUz
                    ? "Birinchi xabarnomani yuqoridagi shakl orqali yarating."
                    : "Создайте первую массовую рассылку с помощью формы выше."
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" aria-hidden="true" />
                <span>
                  {isUz
                    ? "Shablon qo'shish / tahrirlash"
                    : "Создать / обновить шаблон"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveTemplate} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-key">Ключ (slug)</Label>
                  <Input
                    id="tpl-key"
                    type="text"
                    required
                    value={tplKey}
                    onChange={(e) => setTplKey(e.target.value)}
                    placeholder="payment_reminder_custom"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-locale">
                    {isUz ? "Til" : "Язык"}
                  </Label>
                  <select
                    id="tpl-locale"
                    value={tplLocale}
                    onChange={(e) =>
                      setTplLocale(e.target.value as "ru" | "uz-Latn")
                    }
                    className={SELECT_CLS}
                  >
                    <option value="ru">Русский (ru)</option>
                    <option value="uz-Latn">O&apos;zbekcha (uz-Latn)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-title">
                    {isUz ? "Sarlavha" : "Заголовок"}
                  </Label>
                  <Input
                    id="tpl-title"
                    type="text"
                    required
                    value={tplTitle}
                    onChange={(e) => setTplTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-body">
                    {isUz ? "Matn" : "Текст шаблона"}
                  </Label>
                  <Textarea
                    id="tpl-body"
                    rows={5}
                    required
                    value={tplBody}
                    onChange={(e) => setTplBody(e.target.value)}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tplActive}
                    onChange={(e) => setTplActive(e.target.checked)}
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                  <span>{isUz ? "Faol" : "Активен"}</span>
                </label>
                <Button
                  type="submit"
                  disabled={!canWrite || lockedBroadcasts}
                  loading={savingTpl}
                  className="w-full"
                >
                  {isUz ? "Saqlash" : "Сохранить шаблон"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>
                {isUz
                  ? "Saqlangan shablonlar"
                  : "Сохранённые шаблоны центра"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  {isUz
                    ? "Shablonlar mavjud emas"
                    : "Шаблоны пока не добавлены"}
                </p>
              ) : (
                <div className="space-y-3">
                  {templates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="rounded-md border border-border p-4 flex items-start justify-between gap-4"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted text-foreground border border-border">
                            {tpl.key}
                          </span>
                          <Badge variant="info">
                            {tpl.locale === "uz_Latn" ? "uz-Latn" : tpl.locale}
                          </Badge>
                          {!tpl.isActive && (
                            <Badge variant="destructive">Неактивен</Badge>
                          )}
                        </div>
                        <div className="font-semibold text-sm text-foreground">
                          {tpl.title}
                        </div>
                        <p className="text-[13px] text-muted-foreground whitespace-pre-wrap">
                          {tpl.body}
                        </p>
                      </div>
                      {canWrite && !lockedBroadcasts && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setTplKey(tpl.key);
                              setTplLocale(
                                tpl.locale === "uz_Latn" ? "uz-Latn" : "ru"
                              );
                              setTplTitle(tpl.title);
                              setTplBody(tpl.body);
                              setTplActive(tpl.isActive);
                            }}
                          >
                            {isUz ? "Tahrir" : "Ред."}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Удалить шаблон"
                            onClick={() => setDeleteTplTarget(tpl)}
                            className="hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        </TabsContent>
      </Tabs>

      {/* Confirmation Modal */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent locale={locale} className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isUz
                ? "Yuborishni tasdiqlang"
                : "Подтвердите отправку рассылки"}
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground space-y-1.5">
            <div>
              <strong className="text-foreground">
                {isUz ? "Kanal:" : "Канал:"}
              </strong>{" "}
              {channel}
            </div>
            <div>
              <strong className="text-foreground">
                {isUz ? "Auditoriya:" : "Аудитория:"}
              </strong>{" "}
              {audience}
            </div>
            {preview && (
              <>
                <div>
                  <strong className="text-foreground">
                    {isUz ? "Qabul qiluvchilar:" : "Получателей:"}
                  </strong>{" "}
                  <span className="tabular-nums">{preview.totalRecipients}</span>
                </div>
                {channel === "SMS" && (
                  <div>
                    <strong className="text-foreground">
                      {isUz ? "Taxminiy SMS narxi:" : "Оценка SMS:"}
                    </strong>{" "}
                    <span className="tabular-nums">
                      {preview.estimatedCostUzs.toLocaleString("ru-RU")} UZS
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
            >
              {isUz ? "Bekor qilish" : "Отмена"}
            </Button>
            <Button
              type="button"
              loading={submitting}
              onClick={() => handleSendOrSchedule("send")}
            >
              {isUz ? "Ha, yuborish" : "Подтвердить и отправить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTplTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTplTarget(null);
        }}
        locale={locale}
        variant="destructive"
        loading={deletingTpl}
        title={isUz ? "Shablonni o'chirish" : "Удалить шаблон"}
        description={
          deleteTplTarget
            ? `Шаблон «${deleteTplTarget.key}» будет удалён.`
            : undefined
        }
        confirmLabel={isUz ? "O'chirish" : "Удалить"}
        onConfirm={handleConfirmDeleteTemplate}
      />
    </div>
  );
}
