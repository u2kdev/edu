"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Globe,
  Phone,
  Bell,
  Save,
  Lock,
  MessageSquare,
  Send,
  Link2Off,
  ExternalLink,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  NotificationPreferences,
  NotificationEventCategory,
  NotificationChannelType,
} from "@/lib/notifications";

const SELECT_CLS =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

interface CenterProfileEditorProps {
  initialProfile: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    username: string | null;
    avatarUrl: string | null;
    preferredLanguage: string;
    role: string;
    canEditFullName: boolean;
  };
  initialPreferences: NotificationPreferences;
  initialCenterSettings: {
    smsEnabled: boolean;
    smsDailyLimit: number;
    canManageCenter: boolean;
  };
}

const EVENT_LABELS: Array<{
  key: NotificationEventCategory;
  title: string;
  subtitle: string;
}> = [
  {
    key: "attendance",
    title: "Посещаемость (пропуски и опоздания)",
    subtitle: "Уведомления об отметках ABSENT и LATE на занятиях",
  },
  {
    key: "grades",
    title: "Оценки и результаты тестов",
    subtitle: "Новые оценки в журнале и завершённые тесты",
  },
  {
    key: "homework",
    title: "Домашние задания",
    subtitle: "Новые задания, проверка учителем и комментарии",
  },
  {
    key: "payments",
    title: "Оплаты и баланс",
    subtitle: "Напоминания об оплате, квитанции и задолженность",
  },
  {
    key: "announcements",
    title: "Объявления центра и группы",
    subtitle: "Важные новости, переносы занятий и события",
  },
];

const CHANNELS: Array<{ key: NotificationChannelType; label: string }> = [
  { key: "IN_APP", label: "В системе" },
  { key: "PUSH", label: "Push" },
  { key: "EMAIL", label: "Email" },
  { key: "SMS", label: "SMS" },
  { key: "TELEGRAM", label: "Telegram" },
];

export default function CenterProfileEditor({
  initialProfile,
  initialPreferences,
  initialCenterSettings,
}: CenterProfileEditorProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialProfile.fullName);
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatarUrl || "");
  const [preferredLanguage, setPreferredLanguage] = useState(
    initialProfile.preferredLanguage || "ru"
  );
  const [phone, setPhone] = useState(initialProfile.phone || "");
  const [phoneConfirmModal, setPhoneConfirmModal] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [prefs, setPrefs] = useState<NotificationPreferences>(initialPreferences);
  const [smsEnabled, setSmsEnabled] = useState(initialCenterSettings.smsEnabled);
  const [smsDailyLimit, setSmsDailyLimit] = useState(
    initialCenterSettings.smsDailyLimit
  );
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [tgLoading, setTgLoading] = useState(false);
  const [tgLinked, setTgLinked] = useState(false);
  const [tgAccount, setTgAccount] = useState<{
    username: string | null;
    firstName: string | null;
    isBlocked: boolean;
    linkedAt: string;
  } | null>(null);
  const [tgBotUsername, setTgBotUsername] = useState<string | null>(null);
  const [tgLinkPayload, setTgLinkPayload] = useState<{
    token: string;
    expiresAt: string;
    deepLink: string | null;
    qrDataUrl: string | null;
  } | null>(null);

  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const isUz = preferredLanguage === "uz-Latn" || preferredLanguage === "uz_Latn";

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/telegram")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setTgLinked(Boolean(data.linked));
        setTgAccount(data.account || null);
        setTgBotUsername(data.botUsername || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleGenerateTelegramLink = async () => {
    setTgLoading(true);
    setNotice(null);
    try {
      const res = await fetch("/api/account/telegram", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Ошибка генерации ссылки Telegram");
      }
      setTgLinkPayload({
        token: data.token,
        expiresAt: data.expiresAt,
        deepLink: data.deepLink || null,
        qrDataUrl: data.qrDataUrl || null,
      });
    } catch (err: unknown) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Ошибка привязки Telegram",
      });
    } finally {
      setTgLoading(false);
    }
  };

  const handleUnlinkTelegram = async () => {
    setTgLoading(true);
    setNotice(null);
    try {
      const res = await fetch("/api/account/telegram", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка отключения Telegram");
      setTgLinked(false);
      setTgAccount(null);
      setTgLinkPayload(null);
      setNotice({
        type: "success",
        text: isUz ? "Telegram hisobdan uzildi" : "Telegram-аккаунт отключён",
      });
    } catch (err: unknown) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Ошибка",
      });
    } finally {
      setTgLoading(false);
    }
  };

  const handleAvatarUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingAvatar(true);
    setNotice(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", "AVATAR");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Ошибка загрузки фото");
      }
      setAvatarUrl(data.fileUrl);
      setNotice({
        type: "success",
        text: "Фото загружено. Нажмите «Сохранить профиль», чтобы применить изменения.",
      });
    } catch (err: unknown) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Ошибка загрузки фото",
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const submitProfileUpdate = async () => {
    setSavingProfile(true);
    setNotice(null);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(initialProfile.canEditFullName ? { fullName } : {}),
          avatarUrl: avatarUrl || null,
          preferredLanguage,
          phone: phone.trim() || null,
          phoneConfirmationCode: confirmationCode || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Не удалось обновить профиль");
      }
      setPhoneConfirmModal(false);
      setConfirmationCode("");
      setNotice({ type: "success", text: "Профиль успешно сохранён" });
      router.refresh();
    } catch (err: unknown) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Ошибка сохранения профиля",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleProfileFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const phoneChanged =
      (phone.trim() || "") !== (initialProfile.phone || "");
    if (phoneChanged && phone.trim() !== "" && !phoneConfirmModal) {
      setPhoneConfirmModal(true);
      return;
    }
    await submitProfileUpdate();
  };

  const toggleChannel = (
    category: NotificationEventCategory,
    channel: NotificationChannelType
  ) => {
    setPrefs((prev) => {
      const current = prev[category] || [];
      const exists = current.includes(channel);
      const next = exists
        ? current.filter((c) => c !== channel)
        : [...current, channel];
      return {
        ...prev,
        [category]: next,
      };
    });
  };

  const handleSaveNotificationPrefs = async () => {
    setSavingPrefs(true);
    setNotice(null);
    try {
      const res = await fetch("/api/account/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferences: prefs,
          ...(initialCenterSettings.canManageCenter
            ? {
                smsEnabled,
                smsDailyLimit: Number(smsDailyLimit) || 0,
              }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Ошибка сохранения настроек уведомлений");
      }
      setNotice({
        type: "success",
        text: "Настройки уведомлений успешно сохранены",
      });
      router.refresh();
    } catch (err: unknown) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Ошибка сохранения",
      });
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <div className="space-y-6">
      {notice && (
        <Alert variant={notice.type === "success" ? "success" : "destructive"}>
          <AlertDescription>{notice.text}</AlertDescription>
        </Alert>
      )}

      {/* Editable Profile Settings */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle>Редактирование личных данных</CardTitle>
            <CardDescription>
              Фотография профиля, язык интерфейса и контактный номер телефона
            </CardDescription>
          </div>
          <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted text-foreground text-[13px] font-medium cursor-pointer transition-colors shrink-0">
            <Camera className="w-4 h-4 text-primary" aria-hidden="true" />
            <span>{uploadingAvatar ? "Загрузка..." : "Сменить фото"}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={uploadingAvatar}
              onChange={(e) => {
                handleAvatarUpload(e.target.files?.[0] || null);
                e.target.value = "";
              }}
              className="hidden"
            />
          </label>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleProfileFormSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="prof-fullname">ФИО</Label>
                  {!initialProfile.canEditFullName && (
                    <span className="inline-flex items-center gap-1 text-xs text-warning">
                      <Lock className="w-3 h-3" aria-hidden="true" />
                      <span>Только администрация</span>
                    </span>
                  )}
                </div>
                <Input
                  id="prof-fullname"
                  type="text"
                  value={fullName}
                  disabled={!initialProfile.canEditFullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prof-lang" className="inline-flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                  <span>Язык интерфейса</span>
                </Label>
                <select
                  id="prof-lang"
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                  className={SELECT_CLS}
                >
                  <option value="ru">Русский (RU)</option>
                  <option value="uz-Latn">O&lsquo;zbekcha (UZ-Latn)</option>
                </select>
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="prof-phone" className="inline-flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-success" aria-hidden="true" />
                  <span>Номер телефона (для SMS и входа)</span>
                </Label>
                <Input
                  id="prof-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+998 90 123 45 67"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={savingProfile || uploadingAvatar}
                loading={savingProfile}
                size="sm"
              >
                <Save className="w-4 h-4" aria-hidden="true" />
                <span>Сохранить профиль</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Notification Preferences Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-warning" aria-hidden="true" />
            <span>Настройки уведомлений по каналам</span>
          </CardTitle>
          <CardDescription>
            Выберите, каким способом получать уведомления по каждому типу событий
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="divide-y divide-border">
            {EVENT_LABELS.map((ev) => {
              const activeChannels = prefs[ev.key] || [];
              return (
                <div
                  key={ev.key}
                  className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {ev.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {ev.subtitle}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {CHANNELS.map((ch) => {
                      const checked = activeChannels.includes(ch.key);
                      return (
                        <Button
                          key={ch.key}
                          type="button"
                          size="sm"
                          variant={checked ? "primary" : "outline"}
                          onClick={() => toggleChannel(ev.key, ch.key)}
                        >
                          {ch.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {initialCenterSettings.canManageCenter && (
            <div className="pt-4 border-t border-border space-y-4">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-primary">
                <MessageSquare className="w-4 h-4" aria-hidden="true" />
                <span>Настройки SMS-шлюза Eskiz.uz для учебного центра</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex items-center justify-between gap-3 p-3.5 rounded-md bg-muted/40 border border-border cursor-pointer">
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      Отправка SMS-уведомлений
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Автоматические SMS родителям при отметке ABSENT / LATE
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={smsEnabled}
                    onChange={(e) => setSmsEnabled(e.target.checked)}
                    className="w-4 h-4 accent-primary shrink-0"
                  />
                </label>

                <div className="p-3.5 rounded-md bg-muted/40 border border-border space-y-1.5">
                  <Label htmlFor="prof-sms-limit">
                    Суточный лимит SMS центра
                  </Label>
                  <Input
                    id="prof-sms-limit"
                    type="number"
                    min={0}
                    max={100000}
                    value={smsDailyLimit}
                    onChange={(e) => setSmsDailyLimit(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              loading={savingPrefs}
              onClick={handleSaveNotificationPrefs}
              size="sm"
            >
              <Save className="w-4 h-4" aria-hidden="true" />
              <span>Сохранить настройки уведомлений</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Telegram Bot Connection */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-muted border border-border flex items-center justify-center text-primary shrink-0">
                <Send className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {isUz ? "Telegram-bot integratsiyasi" : "Telegram-бот уведомлений"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isUz
                    ? "Balans, dars jadvali, to'lov kvitansiyalari va Click orqali tez to'lovlar."
                    : "Получайте баланс, расписание и ссылки на оплату Click прямо в Telegram."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {tgLinked && tgAccount ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  loading={tgLoading}
                  onClick={handleUnlinkTelegram}
                >
                  <Link2Off className="w-4 h-4" aria-hidden="true" />
                  <span>{isUz ? "Uzish" : "Отключить"}</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  loading={tgLoading}
                  onClick={handleGenerateTelegramLink}
                >
                  <Send className="w-4 h-4" aria-hidden="true" />
                  <span>{isUz ? "Telegram ulash" : "Подключить Telegram"}</span>
                </Button>
              )}
            </div>
          </div>

          {tgLinked && tgAccount && (
            <div className="p-3.5 rounded-md bg-muted/50 border border-border text-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-foreground">
                  {isUz ? "Ulangan:" : "Привязан:"}{" "}
                  {tgAccount.username
                    ? `@${tgAccount.username}`
                    : tgAccount.firstName || "Telegram"}
                </span>
                {tgAccount.isBlocked && (
                  <Badge variant="destructive">
                    {isUz
                      ? "Bot bloklangan (/start bosing)"
                      : "Бот заблокирован в Telegram (/start)"}
                  </Badge>
                )}
              </div>
              <span className="text-muted-foreground">
                {isUz
                  ? "Buyruqlar: /balance, /schedule, /payments"
                  : "Команды: /balance, /schedule, /payments"}
              </span>
            </div>
          )}

          {tgLinkPayload && !tgLinked && (
            <div className="p-4 rounded-md bg-muted/50 border border-border flex flex-col sm:flex-row items-center gap-4">
              {tgLinkPayload.qrDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tgLinkPayload.qrDataUrl}
                  alt="Telegram QR"
                  className="w-36 h-36 rounded-md border border-border shrink-0"
                />
              )}
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>
                  {isUz
                    ? "Quyidagi tugma yoki QR-kod orqali botga o'ting va Start tugmasini bosing (havola 15 daqiqa amal qiladi):"
                    : "Перейдите в бота по кнопке или отсканируйте QR-код (ссылка действует 15 минут):"}
                </p>
                {tgLinkPayload.deepLink && (
                  <Button asChild size="sm">
                    <a
                      href={tgLinkPayload.deepLink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span>
                        {tgBotUsername ? `@${tgBotUsername}` : "Telegram Bot"}
                      </span>
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    </a>
                  </Button>
                )}
                <div className="text-foreground font-mono bg-card px-3 py-1.5 rounded-md border border-border">
                  /start {tgLinkPayload.token}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Phone Confirmation Modal */}
      <Dialog open={phoneConfirmModal} onOpenChange={setPhoneConfirmModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Подтверждение смены номера телефона</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Вы меняете номер телефона на{" "}
            <span className="font-semibold text-foreground">{phone}</span>.
            Подтвердите изменение номера для получения SMS-уведомлений.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="prof-confirm-code">
              Код подтверждения (если отправлен по SMS)
            </Label>
            <Input
              id="prof-confirm-code"
              type="text"
              value={confirmationCode}
              onChange={(e) => setConfirmationCode(e.target.value)}
              placeholder="Подтвердить смену номера"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPhoneConfirmModal(false)}
            >
              Отмена
            </Button>
            <Button
              type="button"
              loading={savingProfile}
              onClick={submitProfileUpdate}
            >
              Подтвердить и сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
