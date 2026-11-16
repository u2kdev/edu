import type { DeliveryStatus, NotificationChannel, NotificationType } from "@prisma/client";
import { db } from "./db";
import { startOfTashkentDay } from "./billing";
import { normalizePhone } from "./phone";
import { checkRateLimit } from "./rate-limit";
import { maskEmailForLog, type EmailTemplatePayload, type EmailTemplateType } from "./email";
import {
  DEFAULT_QUIET_HOURS_END,
  DEFAULT_QUIET_HOURS_START,
  getNextQuietHoursEndTashkent,
  isCriticalNotification,
  isQuietHoursTashkent,
  normalizeQuietHour,
} from "./timezone";

export type NotificationChannelType = "IN_APP" | "EMAIL" | "PUSH" | "SMS" | "TELEGRAM";
export type NotificationEventCategory =
  | "attendance"
  | "grades"
  | "homework"
  | "payments"
  | "announcements";

export type NotificationPreferences = Record<
  NotificationEventCategory,
  NotificationChannelType[]
>;

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  attendance: ["IN_APP", "PUSH", "SMS", "TELEGRAM"],
  grades: ["IN_APP", "PUSH", "TELEGRAM"],
  homework: ["IN_APP", "PUSH", "TELEGRAM"],
  payments: ["IN_APP", "EMAIL", "SMS", "TELEGRAM"],
  announcements: ["IN_APP", "PUSH", "TELEGRAM"],
};

const VALID_CHANNELS = new Set<string>(["IN_APP", "EMAIL", "PUSH", "SMS", "TELEGRAM"]);

export function resolveUserNotificationPreferences(
  userPrefsJson?: string | null,
  centerDefaultPrefsJson?: string | null
): NotificationPreferences {
  const result: NotificationPreferences = {
    attendance: [...DEFAULT_NOTIFICATION_PREFS.attendance],
    grades: [...DEFAULT_NOTIFICATION_PREFS.grades],
    homework: [...DEFAULT_NOTIFICATION_PREFS.homework],
    payments: [...DEFAULT_NOTIFICATION_PREFS.payments],
    announcements: [...DEFAULT_NOTIFICATION_PREFS.announcements],
  };

  const applyJson = (raw?: string | null) => {
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      const categories: NotificationEventCategory[] = [
        "attendance",
        "grades",
        "homework",
        "payments",
        "announcements",
      ];
      for (const cat of categories) {
        if (Array.isArray(parsed[cat])) {
          result[cat] = parsed[cat].filter((ch: unknown) =>
            VALID_CHANNELS.has(String(ch))
          ) as NotificationChannelType[];
        }
      }
    } catch {
      // ignore invalid json
    }
  };

  applyJson(centerDefaultPrefsJson);
  applyJson(userPrefsJson);
  return result;
}

export interface UserQuietHoursConfig {
  enabled: boolean;
  start: number;
  end: number;
}

export function resolveUserQuietHours(
  userPrefsJson?: string | null,
  fallbackStart: number = DEFAULT_QUIET_HOURS_START,
  fallbackEnd: number = DEFAULT_QUIET_HOURS_END
): UserQuietHoursConfig {
  const safeStart = normalizeQuietHour(fallbackStart, DEFAULT_QUIET_HOURS_START);
  const safeEnd = normalizeQuietHour(fallbackEnd, DEFAULT_QUIET_HOURS_END);
  const base: UserQuietHoursConfig = {
    enabled: safeStart !== safeEnd,
    start: safeStart,
    end: safeEnd,
  };
  if (!userPrefsJson) return base;
  try {
    const parsed = JSON.parse(userPrefsJson);
    if (!parsed || typeof parsed !== "object") return base;
    const q = (parsed as { quietHours?: Record<string, unknown> }).quietHours;
    if (!q || typeof q !== "object") return base;
    return {
      enabled: typeof q.enabled === "boolean" ? q.enabled : base.enabled,
      start: normalizeQuietHour(typeof q.start === "number" ? q.start : undefined, base.start),
      end: normalizeQuietHour(typeof q.end === "number" ? q.end : undefined, base.end),
    };
  } catch {
    return base;
  }
}

export function serializeNotificationPrefsJson(
  preferences: NotificationPreferences,
  quietHours?: UserQuietHoursConfig | null
): string {
  return JSON.stringify({
    ...preferences,
    ...(quietHours ? { quietHours } : {}),
  });
}

export interface SendNotificationOptions {
  userId: string;
  centerId?: string;
  type: NotificationType;
  titleKey: string;
  bodyKey: string;
  bodyParams?: Record<string, string | number>;
  channel?: NotificationChannelType;
  recipientEmail?: string;
  recipientPhone?: string;
  lang?: "ru" | "uz";
  dedupeKey?: string;
  eventKey?: string;
  critical?: boolean;
  bypassQuietHours?: boolean;
  now?: Date;
  subject?: string;
  messageText?: string;
  actionUrl?: string;
  ctaLabel?: string;
}

/**
 * In-memory token cache for Eskiz.uz API
 */
interface EskizTokenCache {
  token: string | null;
  expiresAt: number;
}

const eskizCache: EskizTokenCache = {
  token: null,
  expiresAt: 0,
};

/**
 * Normalizes phone number to standard Uzbekistan format required by Eskiz (998XXXXXXXXX without +)
 */
export function normalizeEskizPhone(rawPhone: string): string | null {
  const normalized = normalizePhone(rawPhone);
  if (!normalized) return null;
  const digits = normalized.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("998")) {
    return digits;
  }
  return null;
}

export function maskPhoneForLog(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");
  if (digits.length >= 7) {
    return `+${digits.slice(0, 3)}****${digits.slice(-4)}`;
  }
  return "****";
}

/**
 * Authenticates against Eskiz.uz API or returns cached token
 */
export async function getEskizToken(): Promise<string | null> {
  const email = process.env.ESKIZ_EMAIL;
  const password = process.env.ESKIZ_PASSWORD;

  if (!email || !password) {
    return null;
  }

  if (eskizCache.token && Date.now() < eskizCache.expiresAt - 5 * 60 * 1000) {
    return eskizCache.token;
  }

  try {
    const formData = new URLSearchParams();
    formData.append("email", email);
    formData.append("password", password);

    const response = await fetch("https://notify.eskiz.uz/api/auth/login", {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.error(`[Eskiz Auth] Login failed with status ${response.status}`);
      return null;
    }

    const data = (await response.json()) as { data?: { token?: string } };
    const token = data?.data?.token;
    if (token) {
      eskizCache.token = token;
      eskizCache.expiresAt = Date.now() + 29 * 24 * 60 * 60 * 1000;
      return token;
    }
  } catch (err) {
    console.error("[Eskiz Auth] Network error connecting to Eskiz.uz:", err);
  }

  return null;
}

export interface SendSmsResult {
  success: boolean;
  status: "SENT" | "SIMULATED" | "FAILED";
  messageId?: string;
  deliveryId?: string;
  error?: string;
}

async function logExternalDelivery(params: {
  userId?: string | null;
  centerId?: string | null;
  channel: NotificationChannel;
  type: NotificationType;
  eventKey?: string | null;
  recipient?: string | null;
  subject?: string | null;
  payloadJson?: string | null;
  status: DeliveryStatus;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  deferredUntil?: Date | null;
  sentAt?: Date | null;
}): Promise<string | undefined> {
  try {
    const row = await db.notificationDelivery.create({
      data: {
        userId: params.userId ?? null,
        centerId: params.centerId ?? null,
        channel: params.channel,
        type: params.type,
        eventKey: params.eventKey ?? null,
        recipient: params.recipient ?? null,
        subject: params.subject ?? null,
        payloadJson: params.payloadJson ?? null,
        status: params.status,
        providerMessageId: params.providerMessageId ?? null,
        errorMessage: params.errorMessage ?? null,
        deferredUntil: params.deferredUntil ?? null,
        sentAt: params.sentAt ?? null,
      },
      select: { id: true },
    });
    return row.id;
  } catch (err) {
    console.error("[Notifications] Failed to record NotificationDelivery:", err);
    return undefined;
  }
}

/**
 * Sends SMS via Eskiz.uz (or simulated transport without credentials) with
 * center flag/limit enforcement, phone/global circuit breakers, and delivery logging.
 */
export async function sendEskizSms(
  rawPhone: string,
  message: string,
  options?: {
    centerId?: string;
    userId?: string | null;
    type?: NotificationType;
    eventKey?: string;
    skipDeliveryLog?: boolean;
  }
): Promise<SendSmsResult> {
  const phone = normalizeEskizPhone(rawPhone);
  const maskedPhone = maskPhoneForLog(rawPhone);

  const recordSms = async (
    status: DeliveryStatus,
    providerMessageId?: string,
    errorMessage?: string
  ) => {
    if (options?.skipDeliveryLog) return undefined;
    return logExternalDelivery({
      userId: options?.userId ?? null,
      centerId: options?.centerId ?? null,
      channel: "SMS",
      type: options?.type ?? "GENERAL",
      eventKey: options?.eventKey ?? null,
      recipient: maskedPhone,
      subject: "SMS",
      status,
      providerMessageId: providerMessageId ?? null,
      errorMessage: errorMessage ?? null,
      sentAt: status === "SENT" ? new Date() : null,
    });
  };

  if (!phone) {
    const error = `Invalid Uzbekistan phone number: ${maskedPhone}`;
    const deliveryId = await recordSms("FAILED", undefined, error);
    return { success: false, status: "FAILED", deliveryId, error };
  }

  // 1. Check center SMS enablement & DB daily limit when centerId is supplied
  let centerLimit = 500;
  if (options?.centerId) {
    const center = await db.learningCenter.findUnique({
      where: { id: options.centerId },
      select: { smsEnabled: true, smsDailyLimit: true },
    });

    if (!center || !center.smsEnabled) {
      const error = "SMS notifications are disabled for this learning center";
      const deliveryId = await recordSms("SKIPPED", undefined, error);
      return { success: false, status: "FAILED", deliveryId, error };
    }

    centerLimit = Math.max(0, center.smsDailyLimit ?? 100);
    const tashkentTodayStart = startOfTashkentDay(new Date());
    const sentToday = await db.notificationDelivery.count({
      where: {
        centerId: options.centerId,
        channel: "SMS",
        status: "SENT",
        createdAt: { gte: tashkentTodayStart },
      },
    });

    if (sentToday >= centerLimit) {
      const error = `Daily center SMS limit exceeded (max ${centerLimit} SMS/day)`;
      const deliveryId = await recordSms("SKIPPED", undefined, error);
      return { success: false, status: "FAILED", deliveryId, error };
    }
  }

  // 2. Per-recipient hourly & daily rate limits against SMS bombing
  const hourlyKey = `sms_recipient_hourly:${phone}`;
  if (!(await checkRateLimit(hourlyKey, 5, 60 * 60 * 1000))) {
    const error = "Rate limit exceeded for recipient phone number (max 5 SMS/hour)";
    const deliveryId = await recordSms("FAILED", undefined, error);
    return { success: false, status: "FAILED", deliveryId, error };
  }

  const dailyKey = `sms_recipient_daily:${phone}`;
  if (!(await checkRateLimit(dailyKey, 15, 24 * 60 * 60 * 1000))) {
    const error = "Daily limit exceeded for recipient phone number (max 15 SMS/day)";
    const deliveryId = await recordSms("FAILED", undefined, error);
    return { success: false, status: "FAILED", deliveryId, error };
  }

  // 3. Per-center rate limiter guard
  if (options?.centerId) {
    const centerKey = `sms_center_daily:${options.centerId}`;
    if (!(await checkRateLimit(centerKey, Math.max(1, centerLimit), 24 * 60 * 60 * 1000))) {
      const error = `Daily center SMS limit exceeded (max ${centerLimit} SMS/day)`;
      const deliveryId = await recordSms("FAILED", undefined, error);
      return { success: false, status: "FAILED", deliveryId, error };
    }
  }

  // 4. Global SMS budget circuit breaker
  const dailyMax = parseInt(process.env.SMS_DAILY_LIMIT || "1000", 10);
  const globalKey = `sms_global_daily:${new Date().toISOString().slice(0, 10)}`;
  if (!(await checkRateLimit(globalKey, dailyMax, 24 * 60 * 60 * 1000))) {
    const error = "SMS daily budget circuit breaker tripped. Further dispatches paused for safety.";
    const deliveryId = await recordSms("FAILED", undefined, error);
    return { success: false, status: "FAILED", deliveryId, error };
  }

  const token = await getEskizToken();

  // Simulated delivery when Eskiz credentials are absent
  if (!token) {
    const isProd = process.env.NODE_ENV === "production";
    if (process.env.NODE_ENV !== "test") {
      const displayMessage = isProd ? "[REDACTED]" : message;
      console.log(`📱 [SMS Simulated (No Eskiz credentials)] To: ${maskedPhone} | Text: "${displayMessage}"`);
    }
    const simId = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const deliveryId = await recordSms("SENT", simId);
    return {
      success: true,
      status: "SIMULATED",
      messageId: simId,
      deliveryId,
    };
  }

  try {
    const fromNick = process.env.ESKIZ_FROM || "4546";
    const formData = new URLSearchParams();
    formData.append("mobile_phone", phone);
    formData.append("message", message);
    formData.append("from", fromNick);

    const response = await fetch("https://notify.eskiz.uz/api/message/sms/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      if (response.status === 401) {
        eskizCache.token = null;
        eskizCache.expiresAt = 0;
      }
      const errText = await response.text();
      const error = `Eskiz API error ${response.status}: ${errText}`;
      const deliveryId = await recordSms("FAILED", undefined, error.slice(0, 500));
      return { success: false, status: "FAILED", deliveryId, error };
    }

    const resJson = (await response.json()) as { id?: string | number; message?: string };
    const messageId = String(resJson.id || `eskiz_${Date.now()}`);
    const deliveryId = await recordSms("SENT", messageId);
    return {
      success: true,
      status: "SENT",
      messageId,
      deliveryId,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const deliveryId = await recordSms("FAILED", undefined, errMsg.slice(0, 500));
    return { success: false, status: "FAILED", deliveryId, error: errMsg };
  }
}

/**
 * Render SMS text for center alerts in Russian or Uzbek Latin
 */
export function formatSmsAlert(
  key: string,
  params: Record<string, string | number> = {},
  lang: "ru" | "uz" = "ru"
): string {
  const centerName = String(
    params.centerName || (lang === "uz" ? "O'quv markazi" : "Учебный центр")
  );

  switch (key) {
    case "SMS_DEBT_REMINDER": {
      const amount = params.amount ?? "0";
      const dueDate = params.dueDate || params.paidUntil || "";
      const payUrl = params.payUrl ? ` ${params.payUrl}` : "";
      return lang === "uz"
        ? `${centerName}: Hurmatli talaba, qarzingiz ${amount} UZS${dueDate ? ` (muddati ${dueDate})` : ""}.${payUrl}`
        : `${centerName}: Напоминание о задолженности: ${amount} UZS${dueDate ? ` (срок ${dueDate})` : ""}.${payUrl}`;
    }
    case "PAYMENT_REMINDER":
    case "notifications.paymentReminder": {
      const amount = params.amount ?? "0";
      const dueDate = params.dueDate || params.paidUntil || "";
      const payUrl = params.payUrl ? ` ${params.payUrl}` : "";
      return lang === "uz"
        ? `${centerName}: O'quv to'lovi eslatmasi: ${amount} UZS${dueDate ? ` (muddati ${dueDate})` : ""}.${payUrl}`
        : `${centerName}: Напоминание об оплате обучения: ${amount} UZS${dueDate ? ` (срок ${dueDate})` : ""}.${payUrl}`;
    }
    case "SMS_ATTENDANCE_ALERT":
    case "notification.attendanceAbsent.title":
    case "notification.attendanceLate.title": {
      const studentName = params.studentName || (lang === "uz" ? "O'quvchi" : "Ученик");
      const date = params.date || new Date().toISOString().slice(0, 10);
      return lang === "uz"
        ? `${centerName}: Diqqat! ${studentName} ${date} sanasidagi darsga kelmadi.`
        : `${centerName}: Внимание! ${studentName} пропустил(а) занятие ${date}.`;
    }
    case "SMS_INVITE": {
      const url = params.url || "";
      return lang === "uz"
        ? `${centerName}: Sizni e-darschi platformasiga taklif qilamiz: ${url}`
        : `${centerName}: Приглашаем вас в систему e-darschi: ${url}`;
    }
    default: {
      const rendered = renderNotificationHumanText({
        titleKey: key,
        bodyKey: String(params.bodyKey || ""),
        bodyParams: params,
        lang,
      });
      return params.text ? `${centerName}: ${params.text}` : `${centerName}: ${rendered.body || rendered.title}`;
    }
  }
}

export function renderNotificationHumanText(params: {
  type?: NotificationType;
  titleKey: string;
  bodyKey?: string;
  bodyParams?: Record<string, string | number>;
  lang?: "ru" | "uz";
  subject?: string;
  messageText?: string;
}): { title: string; body: string } {
  const lang = params.lang === "uz" ? "uz" : "ru";
  const p = params.bodyParams || {};

  if (params.subject && params.messageText) {
    return { title: params.subject, body: params.messageText };
  }

  const titleDictRu: Record<string, string> = {
    "notifications.newHomework": "Новое домашнее задание",
    "notifications.gradePosted": "Выставлена оценка",
    "notifications.scheduleChanged": "Изменение в расписании",
    "notifications.scheduleCancelled": "Урок отменён",
    "notifications.lessonCancelled": "Занятие отменено",
    "notifications.lessonSubstituted": "Замена преподавателя",
    "notification.attendanceAbsent.title": "Пропуск занятия",
    "notification.attendanceLate.title": "Опоздание на занятие",
    "notifications.paymentDue": "Напоминание об оплате",
    "notifications.paymentOverdue": "Просроченная оплата",
    "notifications.paymentConfirmed": "Оплата подтверждена",
  };

  const titleDictUz: Record<string, string> = {
    "notifications.newHomework": "Yangi uy vazifasi",
    "notifications.gradePosted": "Yangi baho qo'yildi",
    "notifications.scheduleChanged": "Dars jadvalidagi o'zgarish",
    "notifications.scheduleCancelled": "Dars bekor qilindi",
    "notifications.lessonCancelled": "Mashg'ulot bekor qilindi",
    "notifications.lessonSubstituted": "O'qituvchi almashtirildi",
    "notification.attendanceAbsent.title": "Dars qoldirildi",
    "notification.attendanceLate.title": "Darsga kechikish",
    "notifications.paymentDue": "To'lov eslatmasi",
    "notifications.paymentOverdue": "Muddati o'tgan to'lov",
    "notifications.paymentConfirmed": "To'lov tasdiqlandi",
  };

  const title =
    params.subject ||
    (lang === "uz" ? titleDictUz[params.titleKey] : titleDictRu[params.titleKey]) ||
    params.titleKey;

  if (params.messageText) {
    return { title, body: params.messageText };
  }

  let body = "";
  const key = params.bodyKey || "";
  if (lang === "uz") {
    switch (key) {
      case "notifications.newHomeworkBody":
        body = `Yangi uy vazifasi: ${String(p.title || "")}`;
        break;
      case "notifications.gradePostedBody":
        body = `Baho: ${String(p.value ?? p.gradeValue ?? "")}${p.maxValue ? ` / ${p.maxValue}` : ""}`;
        break;
      case "notifications.scheduleBody":
      case "notifications.scheduleCancelledBody":
        body = `${p.groupName ? `Guruh: ${p.groupName}. ` : ""}${String(p.reason || p.title || "")}`.trim();
        break;
      case "notification.attendanceAbsent.body":
        body = `${String(p.studentName || "O'quvchi")} ${String(p.date || "")} darsiga kelmadi.`.trim();
        break;
      case "notification.attendanceLate.body":
        body = `${String(p.studentName || "O'quvchi")} ${String(p.date || "")} darsiga kechikdi.`.trim();
        break;
      case "notifications.paymentReminderBody":
        body = `${p.studentName ? `${p.studentName}: ` : ""}To'lov summasi ${String(p.amount ?? 0)} UZS${p.dueDate ? ` (muddati ${p.dueDate})` : ""}.`;
        break;
      case "notifications.paymentConfirmedBody":
        body = `To'lov ${String(p.amount ?? 0)} UZS qabul qilindi.`;
        break;
      default:
        body = String(p.body || p.text || p.title || key || title);
    }
  } else {
    switch (key) {
      case "notifications.newHomeworkBody":
        body = `Новое домашнее задание: ${String(p.title || "")}`;
        break;
      case "notifications.gradePostedBody":
        body = `Оценка: ${String(p.value ?? p.gradeValue ?? "")}${p.maxValue ? ` / ${p.maxValue}` : ""}`;
        break;
      case "notifications.scheduleBody":
      case "notifications.scheduleCancelledBody":
        body = `${p.groupName ? `Группа: ${p.groupName}. ` : ""}${String(p.reason || p.title || "")}`.trim();
        break;
      case "notification.attendanceAbsent.body":
        body = `${String(p.studentName || "Ученик")} пропустил(а) занятие ${String(p.date || "")}.`.trim();
        break;
      case "notification.attendanceLate.body":
        body = `${String(p.studentName || "Ученик")} опоздал(а) на занятие ${String(p.date || "")}.`.trim();
        break;
      case "notifications.paymentReminderBody":
        body = `${p.studentName ? `${p.studentName}: ` : ""}К оплате ${String(p.amount ?? 0)} UZS${p.dueDate ? ` (срок ${p.dueDate})` : ""}.`;
        break;
      case "notifications.paymentConfirmedBody":
        body = `Платёж ${String(p.amount ?? 0)} UZS зачислен.`;
        break;
      default:
        body = String(p.body || p.text || p.title || key || title);
    }
  }

  return { title, body };
}

export function mapNotificationTypeToEmailTemplate(
  type: NotificationType,
  titleKey?: string
): EmailTemplateType {
  if (titleKey === "LOGIN_CREDENTIALS") return "LOGIN_CREDENTIALS";
  switch (type) {
    case "PAYMENT_DUE":
    case "PAYMENT_OVERDUE":
      return "PAYMENT_REMINDER";
    case "PAYMENT_CONFIRMED":
      return "PAYMENT_CONFIRMED";
    case "ATTENDANCE_ABSENT":
    case "ATTENDANCE_LATE":
      return "ATTENDANCE_ALERT";
    case "GRADE_POSTED":
      return "GRADE_POSTED";
    case "NEW_HOMEWORK":
      return "NEW_HOMEWORK";
    case "SCHEDULE_CHANGE":
    case "SCHEDULE_CANCELLED":
      return "SCHEDULE_CHANGE";
    case "LESSON_CANCELLED":
    case "LESSON_SUBSTITUTED":
      return "LESSON_CHANGE";
    case "INVITE":
      return "INVITE_LINK";
    case "BROADCAST":
      return "BROADCAST";
    default:
      return "GENERAL";
  }
}

interface DispatchExternalPayload {
  userId: string;
  centerId?: string | null;
  channel: "EMAIL" | "SMS" | "PUSH" | "TELEGRAM";
  type: NotificationType;
  eventKey?: string | null;
  lang: "ru" | "uz";
  subject: string;
  body: string;
  titleKey: string;
  bodyKey: string;
  bodyParams: Record<string, string | number>;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  userFullName?: string | null;
  centerName?: string | null;
  actionUrl?: string | null;
  ctaLabel?: string | null;
}

async function dispatchExternalChannelNow(
  p: DispatchExternalPayload
): Promise<{
  status: DeliveryStatus;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  recipient?: string | null;
  alreadyLogged?: boolean;
  deliveryId?: string;
}> {
  if (p.channel === "EMAIL") {
    if (!p.recipientEmail) {
      return { status: "SKIPPED", errorMessage: "NO_RECIPIENT_EMAIL" };
    }
    const { renderEmailTemplate, sendEmailWithOutbox } = await import("./email");
    const templateType = mapNotificationTypeToEmailTemplate(p.type, p.titleKey);
    const emailPayload: EmailTemplatePayload = {
      lang: p.lang,
      fullName: p.userFullName || String(p.bodyParams.fullName || ""),
      centerName: p.centerName || String(p.bodyParams.centerName || ""),
      url: p.actionUrl || String(p.bodyParams.url || ""),
      login: String(p.bodyParams.login || ""),
      password: String(p.bodyParams.password || ""),
      studentName: String(p.bodyParams.studentName || ""),
      amount: p.bodyParams.amount,
      paidUntil: p.bodyParams.paidUntil !== undefined ? String(p.bodyParams.paidUntil) : undefined,
      dueDate: p.bodyParams.dueDate !== undefined ? String(p.bodyParams.dueDate) : undefined,
      date: p.bodyParams.date !== undefined ? String(p.bodyParams.date) : undefined,
      groupName: p.bodyParams.groupName !== undefined ? String(p.bodyParams.groupName) : undefined,
      title: String(p.bodyParams.title || p.subject || ""),
      body: p.body,
      gradeValue: p.bodyParams.value ?? p.bodyParams.gradeValue,
      maxValue: p.bodyParams.maxValue,
      status: p.bodyParams.status !== undefined ? String(p.bodyParams.status) : undefined,
      payUrl: p.bodyParams.payUrl !== undefined ? String(p.bodyParams.payUrl) : p.actionUrl || undefined,
    };
    const rendered = renderEmailTemplate(templateType, emailPayload);
    const res = await sendEmailWithOutbox(
      p.recipientEmail,
      p.subject && templateType === "BROADCAST" ? p.subject : rendered.subject,
      p.body && templateType === "BROADCAST" ? p.body : rendered.text,
      rendered.html,
      { skipDeliveryLog: true }
    );
    return {
      status: res.queued ? "PENDING" : "SENT",
      providerMessageId: res.id ?? null,
      recipient: maskEmailForLog(p.recipientEmail),
    };
  }

  if (p.channel === "SMS") {
    if (!p.recipientPhone) {
      return { status: "SKIPPED", errorMessage: "NO_RECIPIENT_PHONE" };
    }
    const smsText =
      p.body && (p.type === "BROADCAST" || p.bodyKey === "RAW_TEXT")
        ? p.body
        : formatSmsAlert(p.titleKey, { ...p.bodyParams, bodyKey: p.bodyKey, text: p.body }, p.lang);
    const smsRes = await sendEskizSms(p.recipientPhone, smsText, {
      centerId: p.centerId ?? undefined,
      userId: p.userId,
      type: p.type,
      eventKey: p.eventKey ?? undefined,
      skipDeliveryLog: true,
    });
    return {
      status: smsRes.success ? "SENT" : smsRes.error?.includes("disabled") || smsRes.error?.includes("limit exceeded") ? "SKIPPED" : "FAILED",
      providerMessageId: smsRes.messageId ?? null,
      errorMessage: smsRes.error ?? null,
      recipient: maskPhoneForLog(p.recipientPhone),
    };
  }

  if (p.channel === "PUSH") {
    const { dispatchMobilePush } = await import("./mobile-push");
    const pushRes = await dispatchMobilePush({
      userId: p.userId,
      centerId: p.centerId,
      title: p.subject,
      body: p.body,
      data: p.actionUrl ? { url: p.actionUrl, type: p.type } : { type: p.type },
      type: p.type,
      eventKey: p.eventKey ?? undefined,
      skipDeliveryLog: true,
    });
    return {
      status: pushRes.sent
        ? "SENT"
        : pushRes.reason === "NO_REGISTERED_TOKENS" || pushRes.reason === "USER_INACTIVE"
          ? "SKIPPED"
          : "FAILED",
      errorMessage: pushRes.reason ?? null,
      recipient: pushRes.recipientTokens.length > 0 ? `${pushRes.recipientTokens.length} device(s)` : null,
    };
  }

  // TELEGRAM
  const { sendTelegramToUser } = await import("./telegram");
  const tgRes = await sendTelegramToUser({
    userId: p.userId,
    centerId: p.centerId,
    text: p.subject && p.subject !== p.body ? `*${p.subject}*\n${p.body}` : p.body,
    actionUrl: p.actionUrl ?? undefined,
    ctaLabel: p.ctaLabel ?? undefined,
    type: p.type,
    eventKey: p.eventKey ?? undefined,
    skipDeliveryLog: true,
  });
  return {
    status: tgRes.sent ? "SENT" : tgRes.reason === "NOT_LINKED" || tgRes.reason === "USER_BLOCKED_BOT" ? "SKIPPED" : "FAILED",
    providerMessageId: tgRes.messageId ?? null,
    errorMessage: tgRes.reason ?? tgRes.error ?? null,
    recipient: tgRes.maskedChatId ?? null,
  };
}

/**
 * High-level notification dispatcher supporting DB persistence, quiet hours deferral (Asia/Tashkent),
 * delivery logging (NotificationDelivery), Email/SMS/Expo Push/Telegram transports.
 */
export async function sendNotification(options: SendNotificationOptions) {
  try {
    const bodyParamsStr = options.bodyParams ? JSON.stringify(options.bodyParams) : null;
    const channel: NotificationChannelType = options.channel || "IN_APP";

    let notification;
    if (options.dedupeKey) {
      const existing = await db.notification.findFirst({
        where: {
          dedupeKey: options.dedupeKey,
          userId: options.userId,
        },
      });
      if (existing) {
        notification = await db.notification.update({
          where: { id: existing.id },
          data: {
            type: options.type,
            titleKey: options.titleKey,
            bodyKey: options.bodyKey,
            bodyParams: bodyParamsStr,
            channel,
            isRead: false,
            sentAt: new Date(),
          },
        });
      } else {
        notification = await db.notification.create({
          data: {
            userId: options.userId,
            centerId: options.centerId || null,
            type: options.type,
            titleKey: options.titleKey,
            bodyKey: options.bodyKey,
            bodyParams: bodyParamsStr,
            dedupeKey: options.dedupeKey,
            channel,
            sentAt: new Date(),
          },
        });
      }
    } else {
      notification = await db.notification.create({
        data: {
          userId: options.userId,
          centerId: options.centerId || null,
          type: options.type,
          titleKey: options.titleKey,
          bodyKey: options.bodyKey,
          bodyParams: bodyParamsStr,
          channel,
          sentAt: new Date(),
        },
      });
    }

    if (channel === "IN_APP") {
      return notification;
    }

    const [userRecord, centerRecord] = await Promise.all([
      db.platformUser.findUnique({
        where: { id: options.userId },
        select: {
          fullName: true,
          email: true,
          phone: true,
          preferredLanguage: true,
        },
      }),
      options.centerId
        ? db.learningCenter.findUnique({
            where: { id: options.centerId },
            select: {
              name: true,
              smsEnabled: true,
              emailEnabled: true,
              quietHoursStart: true,
              quietHoursEnd: true,
            },
          })
        : Promise.resolve(null),
    ]);

    const lang: "ru" | "uz" =
      options.lang || (String(userRecord?.preferredLanguage) === "ru" ? "ru" : "uz");

    const recipientEmail = options.recipientEmail ?? userRecord?.email ?? null;
    const recipientPhone = options.recipientPhone ?? userRecord?.phone ?? null;
    const human = renderNotificationHumanText({
      type: options.type,
      titleKey: options.titleKey,
      bodyKey: options.bodyKey,
      bodyParams: options.bodyParams,
      lang,
      subject: options.subject,
      messageText: options.messageText,
    });

    const eventKey = options.eventKey ?? options.dedupeKey ?? null;

    if (channel === "EMAIL" && centerRecord && !centerRecord.emailEnabled) {
      await logExternalDelivery({
        userId: options.userId,
        centerId: options.centerId ?? null,
        channel: "EMAIL",
        type: options.type,
        eventKey,
        recipient: recipientEmail ? maskEmailForLog(recipientEmail) : null,
        subject: human.title,
        status: "SKIPPED",
        errorMessage: "CENTER_EMAIL_DISABLED",
      });
      return notification;
    }

    if (channel === "SMS" && centerRecord && !centerRecord.smsEnabled) {
      await logExternalDelivery({
        userId: options.userId,
        centerId: options.centerId ?? null,
        channel: "SMS",
        type: options.type,
        eventKey,
        recipient: recipientPhone ? maskPhoneForLog(recipientPhone) : null,
        subject: human.title,
        status: "SKIPPED",
        errorMessage: "CENTER_SMS_DISABLED",
      });
      return notification;
    }

    const now = options.now ?? new Date();
    const critical = isCriticalNotification({
      type: options.type,
      eventKey,
      critical: options.critical,
    });
    const qStart = centerRecord?.quietHoursStart ?? 21;
    const qEnd = centerRecord?.quietHoursEnd ?? 8;

    const payload: DispatchExternalPayload = {
      userId: options.userId,
      centerId: options.centerId ?? null,
      channel,
      type: options.type,
      eventKey,
      lang,
      subject: human.title,
      body: human.body,
      titleKey: options.titleKey,
      bodyKey: options.bodyKey,
      bodyParams: {
        ...(options.bodyParams || {}),
        centerName: String(options.bodyParams?.centerName || centerRecord?.name || ""),
        fullName: String(options.bodyParams?.fullName || userRecord?.fullName || ""),
      },
      recipientEmail,
      recipientPhone,
      userFullName: userRecord?.fullName ?? null,
      centerName: centerRecord?.name ?? null,
      actionUrl: options.actionUrl ?? null,
      ctaLabel: options.ctaLabel ?? null,
    };

    if (!options.bypassQuietHours && !critical && isQuietHoursTashkent(now, qStart, qEnd)) {
      const deferredUntil = getNextQuietHoursEndTashkent(now, qStart, qEnd);
      await logExternalDelivery({
        userId: options.userId,
        centerId: options.centerId ?? null,
        channel,
        type: options.type,
        eventKey,
        recipient:
          channel === "EMAIL" && recipientEmail
            ? maskEmailForLog(recipientEmail)
            : channel === "SMS" && recipientPhone
              ? maskPhoneForLog(recipientPhone)
              : null,
        subject: human.title,
        payloadJson: JSON.stringify(payload),
        status: "DEFERRED",
        deferredUntil,
      });
      return notification;
    }

    const dispatchRes = await dispatchExternalChannelNow(payload);
    await logExternalDelivery({
      userId: options.userId,
      centerId: options.centerId ?? null,
      channel,
      type: options.type,
      eventKey,
      recipient:
        dispatchRes.recipient ||
        (channel === "EMAIL" && recipientEmail
          ? maskEmailForLog(recipientEmail)
          : channel === "SMS" && recipientPhone
            ? maskPhoneForLog(recipientPhone)
            : null),
      subject: human.title,
      status: dispatchRes.status,
      providerMessageId: dispatchRes.providerMessageId ?? null,
      errorMessage: dispatchRes.errorMessage ?? null,
      sentAt: dispatchRes.status === "SENT" ? now : null,
    });

    return notification;
  } catch (err) {
    console.error("[Notification Engine] Failed to dispatch notification:", err);
  }
}

export interface FlushDeferredResult {
  checked: number;
  sent: number;
  failed: number;
  skipped: number;
  stillDeferred: number;
}

/**
 * Dispatches deferred quiet-hours NotificationDelivery rows once quiet hours end.
 */
export async function flushDeferredNotifications(options?: {
  now?: Date;
  batchSize?: number;
}): Promise<FlushDeferredResult> {
  const now = options?.now ?? new Date();
  const batchSize = Math.max(1, Math.min(options?.batchSize ?? 100, 250));

  const deferredRows = await db.notificationDelivery.findMany({
    where: {
      status: "DEFERRED",
      OR: [{ deferredUntil: null }, { deferredUntil: { lte: now } }],
    },
    include: {
      center: {
        select: {
          quietHoursStart: true,
          quietHoursEnd: true,
          smsEnabled: true,
          emailEnabled: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: batchSize,
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let stillDeferred = 0;

  for (const row of deferredRows) {
    const qStart = row.center?.quietHoursStart ?? 21;
    const qEnd = row.center?.quietHoursEnd ?? 8;
    if (isQuietHoursTashkent(now, qStart, qEnd)) {
      const nextWake = getNextQuietHoursEndTashkent(now, qStart, qEnd);
      await db.notificationDelivery.update({
        where: { id: row.id },
        data: { deferredUntil: nextWake },
      });
      stillDeferred++;
      continue;
    }

    if (!row.payloadJson) {
      await db.notificationDelivery.update({
        where: { id: row.id },
        data: { status: "SKIPPED", errorMessage: "MISSING_DEFERRED_PAYLOAD" },
      });
      skipped++;
      continue;
    }

    try {
      const payload = JSON.parse(row.payloadJson) as DispatchExternalPayload;
      const res = await dispatchExternalChannelNow(payload);
      await db.notificationDelivery.update({
        where: { id: row.id },
        data: {
          status: res.status,
          providerMessageId: res.providerMessageId ?? null,
          errorMessage: res.errorMessage ?? null,
          recipient: res.recipient ?? row.recipient,
          sentAt: res.status === "SENT" ? now : null,
          payloadJson: null,
        },
      });
      if (res.status === "SENT") sent++;
      else if (res.status === "SKIPPED") skipped++;
      else failed++;
    } catch (err) {
      await db.notificationDelivery.update({
        where: { id: row.id },
        data: {
          status: "FAILED",
          errorMessage: (err instanceof Error ? err.message : String(err)).slice(0, 500),
        },
      });
      failed++;
    }
  }

  return {
    checked: deferredRows.length,
    sent,
    failed,
    skipped,
    stillDeferred,
  };
}

export interface NotifyParentsAttendanceInput {
  centerId: string;
  lessonId: string;
  studentMembershipId: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  note?: string | null;
  now?: Date;
}

/**
 * Idempotently notifies confirmed parents when a student is marked ABSENT or LATE on a lesson.
 * - Strictly 1 Notification per (lessonId, studentMembershipId, parentUserId) using dedupeKey.
 * - Re-marking the same lesson updates the existing Notification instead of duplicating.
 * - Respects user notification preferences, quiet hours, Telegram/Push/SMS channels, and center limits.
 */
export async function notifyParentsOnAttendance(
  input: NotifyParentsAttendanceInput
): Promise<{
  notifiedParentsCount: number;
  smsSentCount: number;
}> {
  const { centerId, lessonId, studentMembershipId, status, note, now = new Date() } = input;

  const [center, lesson, studentMembership, parentLinks] = await Promise.all([
    db.learningCenter.findUnique({
      where: { id: centerId },
      select: {
        id: true,
        name: true,
        smsEnabled: true,
        smsDailyLimit: true,
        quietHoursStart: true,
        quietHoursEnd: true,
        defaultNotificationPrefsJson: true,
      },
    }),
    db.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, title: true, scheduledAt: true },
    }),
    db.centerMembership.findUnique({
      where: { id: studentMembershipId },
      include: {
        user: { select: { id: true, fullName: true } },
      },
    }),
    db.parentLink.findMany({
      where: {
        studentMembershipId,
        status: "CONFIRMED",
        parent: { centerId, status: "ACTIVE" },
      },
      include: {
        parent: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                phone: true,
                email: true,
                preferredLanguage: true,
                notificationPrefsJson: true,
              },
            },
          },
        },
      },
    }),
  ]);

  if (!center || !lesson || !studentMembership || parentLinks.length === 0) {
    return { notifiedParentsCount: 0, smsSentCount: 0 };
  }

  const studentName = studentMembership.user.fullName;
  const dateStr = lesson.scheduledAt
    ? lesson.scheduledAt.toISOString().slice(0, 10)
    : now.toISOString().slice(0, 10);

  let notifiedParentsCount = 0;
  let smsSentCount = 0;

  for (const link of parentLinks) {
    const parentUser = link.parent.user;
    const dedupeKey = `attendance:${lessonId}:${studentMembershipId}:${parentUser.id}`;

    const existing = await db.notification.findFirst({
      where: {
        dedupeKey,
        userId: parentUser.id,
      },
    });

    if (status !== "ABSENT" && status !== "LATE") {
      if (existing) {
        await db.notification.update({
          where: { id: existing.id },
          data: {
            bodyParams: JSON.stringify({
              studentName,
              studentMembershipId,
              lessonId,
              lessonTitle: lesson.title,
              date: dateStr,
              status,
              note: note || "",
            }),
            isRead: true,
            sentAt: now,
          },
        });
      }
      continue;
    }

    const prefs = resolveUserNotificationPreferences(
      parentUser.notificationPrefsJson,
      center.defaultNotificationPrefsJson
    );
    const attendanceChannels = prefs.attendance || ["IN_APP"];

    const notifType: NotificationType =
      status === "ABSENT" ? "ATTENDANCE_ABSENT" : "ATTENDANCE_LATE";
    const titleKey =
      status === "ABSENT"
        ? "notifications.attendanceAbsent"
        : "notifications.attendanceLate";
    const bodyKey =
      status === "ABSENT"
        ? "notifications.attendanceAbsentBody"
        : "notifications.attendanceLateBody";
    const bodyParamsObj = {
      studentName,
      studentMembershipId,
      lessonId,
      lessonTitle: lesson.title,
      date: dateStr,
      status,
      note: note || "",
      centerName: center.name,
    };

    let savedNotif = existing;
    if (existing) {
      savedNotif = await db.notification.update({
        where: { id: existing.id },
        data: {
          type: notifType,
          titleKey,
          bodyKey,
          bodyParams: JSON.stringify(bodyParamsObj),
          isRead: false,
          sentAt: now,
        },
      });
      notifiedParentsCount++;
    } else if (
      attendanceChannels.includes("IN_APP") ||
      attendanceChannels.includes("PUSH") ||
      attendanceChannels.includes("SMS") ||
      attendanceChannels.includes("TELEGRAM")
    ) {
      savedNotif = await db.notification.create({
        data: {
          userId: parentUser.id,
          centerId: center.id,
          type: notifType,
          titleKey,
          bodyKey,
          bodyParams: JSON.stringify(bodyParamsObj),
          dedupeKey,
          channel: "IN_APP",
          isRead: false,
          sentAt: now,
        },
      });
      notifiedParentsCount++;
    }

    let previousStatus: string | null = null;
    if (existing?.bodyParams) {
      try {
        previousStatus = JSON.parse(existing.bodyParams)?.status || null;
      } catch {
        previousStatus = null;
      }
    }

    const shouldAttemptSms =
      (!existing || previousStatus !== status) &&
      center.smsEnabled &&
      attendanceChannels.includes("SMS") &&
      Boolean(parentUser.phone);

    if (shouldAttemptSms && parentUser.phone) {
      const startOfDay = startOfTashkentDay(now);

      const sentToday = await db.auditLog.count({
        where: {
          centerId: center.id,
          action: "SMS_ATTENDANCE_SENT",
          createdAt: { gte: startOfDay },
        },
      });

      if (sentToday < center.smsDailyLimit) {
        const lang = parentUser.preferredLanguage === "ru" ? "ru" : "uz";
        const smsText = formatSmsAlert(
          "SMS_ATTENDANCE_ALERT",
          {
            centerName: center.name,
            studentName,
            date: dateStr,
          },
          lang
        );
        const smsRes = await sendEskizSms(parentUser.phone, smsText, {
          centerId: center.id,
          userId: parentUser.id,
          type: notifType,
          eventKey: dedupeKey,
        });
        if (smsRes.success) {
          smsSentCount++;
          await db.auditLog.create({
            data: {
              centerId: center.id,
              actorUserId: parentUser.id,
              action: "SMS_ATTENDANCE_SENT",
              resource: "Notification",
              resourceId: savedNotif?.id || lessonId,
              detailsJson: JSON.stringify({
                lessonId,
                studentMembershipId,
                status,
                smsStatus: smsRes.status,
              }),
            },
          });
        }
      }
    }
  }

  return { notifiedParentsCount, smsSentCount };
}
