"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Globe,
  Phone,
  Bell,
  Save,
  CheckCircle2,
  AlertCircle,
  Lock,
  MessageSquare,
} from "lucide-react";
import type {
  NotificationPreferences,
  NotificationEventCategory,
  NotificationChannelType,
} from "@/lib/notifications";

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

  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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
        <div
          className={`p-4 rounded-2xl border flex items-center gap-3 text-sm ${
            notice.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}
        >
          {notice.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Editable Profile Settings */}
      <form
        onSubmit={handleProfileFormSubmit}
        className="glass-panel p-6 rounded-3xl border border-slate-800/80 space-y-5"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white">
              Редактирование личных данных
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Фотография профиля, язык интерфейса и контактный номер телефона
            </p>
          </div>
          <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer transition-colors">
            <Camera className="w-4 h-4 text-indigo-400" />
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
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                ФИО
              </label>
              {!initialProfile.canEditFullName && (
                <span className="inline-flex items-center gap-1 text-[11px] text-amber-400">
                  <Lock className="w-3 h-3" />
                  Только администрация
                </span>
              )}
            </div>
            <input
              type="text"
              value={fullName}
              disabled={!initialProfile.canEditFullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              <Globe className="w-3.5 h-3.5 inline mr-1 text-indigo-400" />
              Язык интерфейса
            </label>
            <select
              value={preferredLanguage}
              onChange={(e) => setPreferredLanguage(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="ru">Русский (RU)</option>
              <option value="uz-Latn">O&lsquo;zbekcha (UZ-Latn)</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              <Phone className="w-3.5 h-3.5 inline mr-1 text-emerald-400" />
              Номер телефона (для SMS и входа)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+998 90 123 45 67"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={savingProfile || uploadingAvatar}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{savingProfile ? "Сохранение..." : "Сохранить профиль"}</span>
          </button>
        </div>
      </form>

      {/* Notification Preferences Matrix */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800/80 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-400" />
              Настройки уведомлений по каналам
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Выберите, каким способом получать уведомления по каждому типу событий
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-800/70">
          {EVENT_LABELS.map((ev) => {
            const activeChannels = prefs[ev.key] || [];
            return (
              <div
                key={ev.key}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="text-sm font-semibold text-white">
                    {ev.title}
                  </div>
                  <div className="text-xs text-slate-400">{ev.subtitle}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {CHANNELS.map((ch) => {
                    const checked = activeChannels.includes(ch.key);
                    return (
                      <button
                        key={ch.key}
                        type="button"
                        onClick={() => toggleChannel(ev.key, ch.key)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                          checked
                            ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-300"
                            : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        {ch.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {initialCenterSettings.canManageCenter && (
          <div className="pt-4 border-t border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-400">
              <MessageSquare className="w-4 h-4" />
              Настройки SMS-шлюза Eskiz.uz для учебного центра
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 cursor-pointer">
                <div>
                  <div className="text-sm font-semibold text-white">
                    Отправка SMS-уведомлений
                  </div>
                  <div className="text-xs text-slate-400">
                    Автоматические SMS родителям при отметке ABSENT / LATE
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={smsEnabled}
                  onChange={(e) => setSmsEnabled(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600"
                />
              </label>

              <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800">
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Суточный лимит SMS центра
                </label>
                <input
                  type="number"
                  min={0}
                  max={100000}
                  value={smsDailyLimit}
                  onChange={(e) => setSmsDailyLimit(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="button"
            disabled={savingPrefs}
            onClick={handleSaveNotificationPrefs}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>
              {savingPrefs
                ? "Сохранение..."
                : "Сохранить настройки уведомлений"}
            </span>
          </button>
        </div>
      </div>

      {/* Phone Confirmation Modal */}
      {phoneConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="text-lg font-bold text-white">
              Подтверждение смены номера телефона
            </h3>
            <p className="text-xs text-slate-400">
              Вы меняете номер телефона на{" "}
              <span className="font-bold text-white">{phone}</span>. Подтвердите
              изменение номера для получения SMS-уведомлений.
            </p>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Код подтверждения (если отправлен по SMS)
              </label>
              <input
                type="text"
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
                placeholder="Подтвердить смену номера"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPhoneConfirmModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={savingProfile}
                onClick={submitProfileUpdate}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
              >
                {savingProfile ? "Сохранение..." : "Подтвердить и сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
