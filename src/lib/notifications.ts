import { db } from "./db";
import type { NotificationType } from "@prisma/client";
import { normalizePhone } from "./phone";

export type NotificationChannelType = "IN_APP" | "EMAIL" | "PUSH" | "SMS";
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
  attendance: ["IN_APP", "PUSH", "SMS"],
  grades: ["IN_APP", "PUSH"],
  homework: ["IN_APP", "PUSH"],
  payments: ["IN_APP", "EMAIL", "SMS"],
  announcements: ["IN_APP", "PUSH"],
};

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
            ["IN_APP", "EMAIL", "PUSH", "SMS"].includes(String(ch))
          );
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

export interface SendNotificationOptions {
  userId: string;
  centerId?: string;
  type: NotificationType;
  titleKey: string;
  bodyKey: string;
  bodyParams?: Record<string, string | number>;
  channel?: "IN_APP" | "EMAIL" | "SMS" | "PUSH";
  recipientEmail?: string;
  recipientPhone?: string;
  lang?: "ru" | "uz";
  dedupeKey?: string;
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
  // strip leading '+' if present: "+998901234567" -> "998901234567"
  const digits = normalized.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("998")) {
    return digits;
  }
  return null;
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

  // Return cached token if valid for at least 5 more minutes
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
    });

    if (!response.ok) {
      console.error(`[Eskiz Auth] Login failed with status ${response.status}`);
      return null;
    }

    const data = (await response.json()) as { data?: { token?: string } };
    const token = data?.data?.token;
    if (token) {
      eskizCache.token = token;
      // Eskiz tokens are valid for 30 days; cache for 29 days
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
  error?: string;
}

/**
 * Sends SMS via Eskiz.uz (or falls back to simulated screen output when credentials are missing)
 */
export async function sendEskizSms(
  rawPhone: string,
  message: string
): Promise<SendSmsResult> {
  const phone = normalizeEskizPhone(rawPhone);
  if (!phone) {
    return {
      success: false,
      status: "FAILED",
      error: `Invalid Uzbekistan phone number: ${rawPhone}`,
    };
  }

  const token = await getEskizToken();

  // If Eskiz credentials are not configured, simulate delivery safely
  if (!token) {
    if (process.env.NODE_ENV !== "test") {
      console.log(`📱 [SMS Simulated (No Eskiz credentials)] To: +${phone} | Text: "${message}"`);
    }
    return {
      success: true,
      status: "SIMULATED",
      messageId: `sim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
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
    });

    if (!response.ok) {
      // Invalidate token cache on 401
      if (response.status === 401) {
        eskizCache.token = null;
        eskizCache.expiresAt = 0;
      }
      const errText = await response.text();
      return {
        success: false,
        status: "FAILED",
        error: `Eskiz API error ${response.status}: ${errText}`,
      };
    }

    const resJson = (await response.json()) as { id?: string | number; message?: string };
    return {
      success: true,
      status: "SENT",
      messageId: String(resJson.id || `eskiz_${Date.now()}`),
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      status: "FAILED",
      error: errMsg,
    };
  }
}

/**
 * Render SMS text for various center alerts in Russian or Uzbek
 */
export function formatSmsAlert(
  key: string,
  params: Record<string, string | number> = {},
  lang: "ru" | "uz" = "ru"
): string {
  const centerName = String(params.centerName || (lang === "uz" ? "O'quv markazi" : "Учебный центр"));

  switch (key) {
    case "SMS_DEBT_REMINDER": {
      const amount = params.amount ?? "0";
      return lang === "uz"
        ? `${centerName}: Hurmatli o'quvchi, sizning oylik to'lov bo'yicha qarzingiz ${amount} UZS. Iltimos, to'lovni amalga oshiring.`
        : `${centerName}: Уважаемый учащийся, ваша задолженность по оплате обучения: ${amount} UZS. Пожалуйста, оплатите курс.`;
    }
    case "SMS_ATTENDANCE_ALERT": {
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
    default:
      return `${centerName}: ${params.text || key}`;
  }
}

/**
 * High-level notification dispatcher supporting DB persistence + Email/SMS transports.
 */
export async function sendNotification(options: SendNotificationOptions) {
  try {
    const bodyParamsStr = options.bodyParams ? JSON.stringify(options.bodyParams) : null;

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
            channel: options.channel || existing.channel || "IN_APP",
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
            channel: options.channel || "IN_APP",
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
          channel: options.channel || "IN_APP",
          sentAt: new Date(),
        },
      });
    }

    // 2. Dispatch to external channel (Email / SMS) if specified
    if (options.channel === "EMAIL" && options.recipientEmail) {
      const { sendEmailWithOutbox, renderEmailTemplate } = await import("./email");
      const rendered = renderEmailTemplate("LOGIN_CREDENTIALS", {
        lang: options.lang || "ru",
        fullName: String(options.bodyParams?.fullName || ""),
        centerName: String(options.bodyParams?.centerName || ""),
        login: String(options.bodyParams?.login || ""),
        password: String(options.bodyParams?.password || ""),
        url: String(options.bodyParams?.url || ""),
      });
      await sendEmailWithOutbox(options.recipientEmail, rendered.subject, rendered.text, rendered.html);
    } else if (options.channel === "SMS" && options.recipientPhone) {
      const text = formatSmsAlert(options.titleKey, options.bodyParams, options.lang || "ru");
      await sendEskizSms(options.recipientPhone, text);
    }

    return notification;
  } catch (err) {
    console.error("[Notification Engine] Failed to dispatch notification:", err);
  }
}

export interface NotifyParentsAttendanceInput {
  centerId: string;
  lessonId: string;
  studentMembershipId: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  note?: string | null;
}

/**
 * Idempotently notifies confirmed parents when a student is marked ABSENT or LATE on a lesson.
 * - Strictly 1 Notification per (lessonId, studentMembershipId, parentUserId) using dedupeKey.
 * - Re-marking the same lesson updates the existing Notification instead of duplicating.
 * - Respects user notification preferences and center SMS daily limit.
 */
export async function notifyParentsOnAttendance(
  input: NotifyParentsAttendanceInput
): Promise<{
  notifiedParentsCount: number;
  smsSentCount: number;
}> {
  const { centerId, lessonId, studentMembershipId, status, note } = input;

  const [center, lesson, studentMembership, parentLinks] = await Promise.all([
    db.learningCenter.findUnique({
      where: { id: centerId },
      select: {
        id: true,
        name: true,
        smsEnabled: true,
        smsDailyLimit: true,
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
    : new Date().toISOString().slice(0, 10);

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
      // If previously marked ABSENT/LATE and now corrected to PRESENT/EXCUSED, update existing notification
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
            sentAt: new Date(),
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
          sentAt: new Date(),
        },
      });
      notifiedParentsCount++;
    } else if (
      attendanceChannels.includes("IN_APP") ||
      attendanceChannels.includes("PUSH") ||
      attendanceChannels.includes("SMS")
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
          sentAt: new Date(),
        },
      });
      notifiedParentsCount++;
    }

    // Check SMS dispatch (only when newly created or status changed, and center.smsEnabled is true)
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
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);

      const sentToday = await db.auditLog.count({
        where: {
          centerId: center.id,
          action: "SMS_ATTENDANCE_SENT",
          createdAt: { gte: startOfDay },
        },
      });

      if (sentToday < center.smsDailyLimit) {
        const lang =
          parentUser.preferredLanguage === "ru" ? "ru" : "uz";
        const smsText = formatSmsAlert(
          "SMS_ATTENDANCE_ALERT",
          {
            centerName: center.name,
            studentName,
            date: dateStr,
          },
          lang
        );
        const smsRes = await sendEskizSms(parentUser.phone, smsText);
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
