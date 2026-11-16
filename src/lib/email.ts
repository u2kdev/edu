import type { NotificationType } from "@prisma/client";
import { db } from "./db";

export interface SentEmail {
  to: string;
  subject: string;
  body: string;
  html?: string;
  sentAt: Date;
}

export class EmailDeliveryError extends Error {
  public status?: number;
  public details?: unknown;

  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = "EmailDeliveryError";
    this.status = status;
    this.details = details;
  }
}

export type EmailTemplateType =
  | "EMAIL_CONFIRMATION"
  | "PASSWORD_RESET"
  | "INVITE_LINK"
  | "ACCOUNT_LOCKED"
  | "LOGIN_CREDENTIALS"
  | "PAYMENT_REMINDER"
  | "PAYMENT_CONFIRMED"
  | "ATTENDANCE_ALERT"
  | "GRADE_POSTED"
  | "NEW_HOMEWORK"
  | "SCHEDULE_CHANGE"
  | "LESSON_CHANGE"
  | "BROADCAST"
  | "GENERAL";

export interface EmailTemplatePayload {
  lang?: "ru" | "uz";
  url?: string;
  fullName?: string;
  centerName?: string;
  expiresIn?: string;
  login?: string;
  password?: string;
  studentName?: string;
  amount?: string | number;
  paidUntil?: string;
  dueDate?: string;
  date?: string;
  groupName?: string;
  title?: string;
  body?: string;
  lessonTitle?: string;
  gradeValue?: string | number;
  maxValue?: string | number;
  status?: string;
  payUrl?: string;
  receiptNumber?: string;
}

export function maskEmailForLog(email: string): string {
  if (typeof email !== "string") return "[EMAIL]";
  const parts = email.split("@");
  if (parts.length !== 2) return "[EMAIL]";
  const local = parts[0] || "";
  const maskedLocal = local.length <= 2 ? `${local[0] || "*"}*` : `${local.slice(0, 2)}***`;
  return `${maskedLocal}@${parts[1]}`;
}

function wrapCenterEmailHtml(
  safeHeading: string,
  bodyHtml: string,
  cta?: { label: string; safeUrl: string }
): string {
  const buttonHtml = cta?.safeUrl
    ? `<p style="margin: 24px 0;">
        <a href="${cta.safeUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">${escapeHtml(cta.label)}</a>
      </p>`
    : "";
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #2563eb; margin-top: 0;">${safeHeading}</h2>
      ${bodyHtml}
      ${buttonHtml}
    </div>
  `.trim();
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderEmailTemplate(
  template: EmailTemplateType,
  payload: EmailTemplatePayload
): RenderedEmail {
  const lang = payload.lang === "uz" ? "uz" : "ru";
  const name = payload.fullName || (lang === "uz" ? "Foydalanuvchi" : "Пользователь");
  const url = payload.url || "";
  const center = payload.centerName || (lang === "uz" ? "O'quv markazi" : "Учебный центр");

  // Escaped versions for safe HTML interpolation
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(url);
  const safeCenter = escapeHtml(center);

  switch (template) {
    case "EMAIL_CONFIRMATION": {
      if (lang === "uz") {
        return {
          subject: "e-darschi: Elektron pochtani tasdiqlash",
          text: `Salom, ${name}!\n\ne-darschi platformasida ro'yxatdan o'tganingiz uchun tashakkur. Pochtani tasdiqlash uchun havola: ${url}\n\nAgar siz ushbu amalni bajarmagan bo'lsangiz, xabarga e'tibor bermang.`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #2563eb; margin-top: 0;">e-darschi LMS</h2>
              <p>Salom, <strong>${safeName}</strong>!</p>
              <p>e-darschi platformasida hisobingizni faollashtirish uchun quyidagi tugmani bosing:</p>
              <p style="margin: 24px 0;">
                <a href="${safeUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Pochtani tasdiqlash</a>
              </p>
              <p style="color: #64748b; font-size: 14px;">Yoki ushbu havolani brauzerga nusxalang: <br/><a href="${safeUrl}">${safeUrl}</a></p>
            </div>
          `.trim(),
        };
      }
      return {
        subject: "e-darschi: Подтверждение адреса электронной почты",
        text: `Здравствуйте, ${name}!\n\nДля подтверждения вашего адреса на платформе e-darschi перейдите по ссылке: ${url}\n\nЕсли вы не регистрировались, просто проигнорируйте это письмо.`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #2563eb; margin-top: 0;">e-darschi LMS</h2>
            <p>Здравствуйте, <strong>${safeName}</strong>!</p>
            <p>Для подтверждения вашего адреса электронной почты и завершения регистрации нажмите кнопку ниже:</p>
            <p style="margin: 24px 0;">
              <a href="${safeUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Подтвердить email</a>
            </p>
            <p style="color: #64748b; font-size: 14px;">Или перейдите по ссылке: <br/><a href="${safeUrl}">${safeUrl}</a></p>
          </div>
        `.trim(),
      };
    }

    case "PASSWORD_RESET": {
      if (lang === "uz") {
        return {
          subject: "e-darschi: Parolni tiklash so'rovi",
          text: `Salom, ${name}!\n\nParolni tiklash so'rovi qabul qilindi. Yangi parol o'rnatish havolasi: ${url}\n\nAgar siz bu so'rovni yubormagan bo'lsangiz, hisobingiz xavfsizligini ta'minlash uchun parolni yangilang.`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #2563eb; margin-top: 0;">e-darschi LMS</h2>
              <p>Salom, <strong>${safeName}</strong>!</p>
              <p>Siz e-darschi platformasida parolingizni tiklashni so'rashingiz haqida murojaat qildingiz. Yangi parol o'rnatish uchun quyidagi tugmani bosing:</p>
              <p style="margin: 24px 0;">
                <a href="${safeUrl}" style="background-color: #ef4444; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Parolni tiklash</a>
              </p>
              <p style="color: #64748b; font-size: 14px;">Havola: <a href="${safeUrl}">${safeUrl}</a></p>
            </div>
          `.trim(),
        };
      }
      return {
        subject: "e-darschi: Сброс пароля учетной записи",
        text: `Здравствуйте, ${name}!\n\nПолучен запрос на сброс пароля. Для установки нового пароля перейдите по ссылке: ${url}\n\nЕсли вы не отправляли запрос, проигнорируйте это письмо.`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #2563eb; margin-top: 0;">e-darschi LMS</h2>
            <p>Здравствуйте, <strong>${safeName}</strong>!</p>
            <p>Был запрошен сброс пароля для вашей учетной записи. Нажмите кнопку ниже для ввода нового пароля:</p>
            <p style="margin: 24px 0;">
              <a href="${safeUrl}" style="background-color: #ef4444; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Сбросить пароль</a>
            </p>
            <p style="color: #64748b; font-size: 14px;">Ссылка для перехода: <br/><a href="${safeUrl}">${safeUrl}</a></p>
          </div>
        `.trim(),
      };
    }

    case "INVITE_LINK": {
      if (lang === "uz") {
        return {
          subject: `${center}: O'quv markaziga taklifnoma`,
          text: `Salom!\n\nSizni ${center} o'quv markaziga taklif qilishdi. Taklifni qabul qilish havolasi: ${url}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #2563eb; margin-top: 0;">${safeCenter}</h2>
              <p>Sizni <strong>${safeCenter}</strong> o'quv markaziga qo'shilishga taklif qilishdi.</p>
              <p style="margin: 24px 0;">
                <a href="${safeUrl}" style="background-color: #10b981; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Taklifni qabul qilish</a>
              </p>
              <p style="color: #64748b; font-size: 14px;">Havola: <a href="${safeUrl}">${safeUrl}</a></p>
            </div>
          `.trim(),
        };
      }
      return {
        subject: `${center}: Приглашение в учебный центр`,
        text: `Здравствуйте!\n\nВам отправлено приглашение в учебный центр ${center}. Ссылка для входа: ${url}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #2563eb; margin-top: 0;">${safeCenter}</h2>
            <p>Вы получили приглашение присоединиться к учебному центру <strong>${safeCenter}</strong>.</p>
            <p style="margin: 24px 0;">
              <a href="${safeUrl}" style="background-color: #10b981; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Принять приглашение</a>
            </p>
            <p style="color: #64748b; font-size: 14px;">Ссылка: <a href="${safeUrl}">${safeUrl}</a></p>
          </div>
        `.trim(),
      };
    }

    case "ACCOUNT_LOCKED": {
      if (lang === "uz") {
        return {
          subject: "e-darschi: Xavfsizlik ogohlantirishi (Hisob bloklandi)",
          text: `Salom, ${name}!\n\nKo'p sonli noto'g'ri kirish urinishlari sababli hisobingiz 15 daqiqaga vaqtincha bloklandi.`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #fecaca; background-color: #fef2f2; border-radius: 8px;">
              <h2 style="color: #dc2626; margin-top: 0;">Hisob vaqtincha bloklandi</h2>
              <p>Salom, <strong>${safeName}</strong>!</p>
              <p>Parolni ketma-ket noto'g'ri kiritish natijasida tizim profilingizni 15 daqiqaga blokladi.</p>
            </div>
          `.trim(),
        };
      }
      return {
        subject: "e-darschi: Предупреждение безопасности (Аккаунт заблокирован)",
        text: `Здравствуйте, ${name}!\n\nИз-за многократных неудачных попыток входа ваш аккаунт заблокирован на 15 минут.`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #fecaca; background-color: #fef2f2; border-radius: 8px;">
            <h2 style="color: #dc2626; margin-top: 0;">Аккаунт временно заблокирован</h2>
            <p>Здравствуйте, <strong>${safeName}</strong>!</p>
            <p>Из соображений безопасности ваша учетная запись заблокирована на 15 минут из-за многократного ввода неверного пароля.</p>
          </div>
        `.trim(),
      };
    }

    case "LOGIN_CREDENTIALS": {
      const login = payload.login || "";
      const password = payload.password || "";
      const safeLogin = escapeHtml(login);
      const safePassword = escapeHtml(password);
      if (lang === "uz") {
        return {
          subject: `${center}: Tizimga kirish ma'lumotlari`,
          text: `Salom, ${name}!\n\n${center} tizimiga kirish uchun sizning ma'lumotlaringiz:\nLogin: ${login}\nParol: ${password}\nKirish manzili: ${url}\n\nIltimos, birinchi kirishda parolingizni yangilang.`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #2563eb; margin-top: 0;">${safeCenter}</h2>
              <p>Salom, <strong>${safeName}</strong>!</p>
              <p>Siz uchun <strong>${safeCenter}</strong> tizimida shaxsiy hisob yaratildi. Kirish ma'lumotlari:</p>
              <div style="background-color: #f8fafc; padding: 16px; border-radius: 6px; border: 1px solid #cbd5e1; margin: 16px 0; font-family: monospace;">
                <p style="margin: 4px 0;"><strong>Login:</strong> ${safeLogin}</p>
                <p style="margin: 4px 0;"><strong>Parol:</strong> ${safePassword}</p>
              </div>
              <p style="margin: 24px 0;">
                <a href="${safeUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Tizimga kirish</a>
              </p>
              <p style="color: #64748b; font-size: 13px;">Xavfsizlik talablariga ko'ra, birinchi kirishda parolni o'zgartiring.</p>
            </div>
          `.trim(),
        };
      }
      return {
        subject: `${center}: Данные для входа в систему`,
        text: `Здравствуйте, ${name}!\n\nВаши данные для входа в учебный центр ${center}:\nЛогин: ${login}\nПароль: ${password}\nАдрес для входа: ${url}\n\nПожалуйста, измените пароль при первом входе.`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #2563eb; margin-top: 0;">${safeCenter}</h2>
            <p>Здравствуйте, <strong>${safeName}</strong>!</p>
            <p>Для вас создана учетная запись в учебном центре <strong>${safeCenter}</strong>. Ваши данные для входа:</p>
            <div style="background-color: #f8fafc; padding: 16px; border-radius: 6px; border: 1px solid #cbd5e1; margin: 16px 0; font-family: monospace;">
              <p style="margin: 4px 0;"><strong>Логин:</strong> ${safeLogin}</p>
              <p style="margin: 4px 0;"><strong>Пароль:</strong> ${safePassword}</p>
            </div>
            <p style="margin: 24px 0;">
              <a href="${safeUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Войти в систему</a>
            </p>
            <p style="color: #64748b; font-size: 13px;">В целях безопасности рекомендуем сменить пароль при первом входе в систему.</p>
          </div>
        `.trim(),
      };
    }

    case "PAYMENT_REMINDER": {
      const studentName = payload.studentName || name;
      const amount = String(payload.amount ?? "0");
      const dueDate = payload.dueDate || payload.paidUntil || "";
      const payUrl = payload.payUrl || url;
      const safeStudent = escapeHtml(studentName);
      const safeAmount = escapeHtml(amount);
      const safeDue = escapeHtml(dueDate);
      const safePayUrl = escapeHtml(payUrl);

      if (lang === "uz") {
        return {
          subject: `${center}: To'lov eslatmasi (${amount} UZS)`,
          text: `Salom, ${name}!\n\n${studentName} uchun to'lov eslatmasi (${center}).\nSumma: ${amount} UZS${dueDate ? `\nMuddati: ${dueDate}` : ""}${payUrl ? `\nTo'lash havolasi: ${payUrl}` : ""}`,
          html: wrapCenterEmailHtml(
            safeCenter,
            `<p>Salom, <strong>${safeName}</strong>!</p>
             <p><strong>${safeStudent}</strong> uchun o'quv to'lovi haqida eslatma.</p>
             <p><strong>Summa:</strong> ${safeAmount} UZS${safeDue ? `<br/><strong>Muddati:</strong> ${safeDue}` : ""}</p>`,
            safePayUrl ? { label: "Click orqali to'lash", safeUrl: safePayUrl } : undefined
          ),
        };
      }
      return {
        subject: `${center}: Напоминание об оплате (${amount} UZS)`,
        text: `Здравствуйте, ${name}!\n\nНапоминание об оплате обучения за ученика ${studentName} в ${center}.\nСумма к оплате: ${amount} UZS${dueDate ? `\nСрок оплаты: ${dueDate}` : ""}${payUrl ? `\nСсылка на оплату: ${payUrl}` : ""}`,
        html: wrapCenterEmailHtml(
          safeCenter,
          `<p>Здравствуйте, <strong>${safeName}</strong>!</p>
           <p>Напоминаем об оплате обучения за ученика <strong>${safeStudent}</strong>.</p>
           <p><strong>Сумма:</strong> ${safeAmount} UZS${safeDue ? `<br/><strong>Срок:</strong> ${safeDue}` : ""}</p>`,
          safePayUrl ? { label: "Оплатить через Click", safeUrl: safePayUrl } : undefined
        ),
      };
    }

    case "PAYMENT_CONFIRMED": {
      const studentName = payload.studentName || name;
      const amount = String(payload.amount ?? "0");
      const paidUntil = payload.paidUntil || "";
      const receipt = payload.receiptNumber || "";
      const safeStudent = escapeHtml(studentName);
      const safeAmount = escapeHtml(amount);
      const safePaidUntil = escapeHtml(paidUntil);
      const safeReceipt = escapeHtml(receipt);

      if (lang === "uz") {
        return {
          subject: `${center}: To'lov qabul qilindi (${amount} UZS)`,
          text: `Salom, ${name}!\n\n${studentName} uchun ${amount} UZS miqdoridagi to'lov tasdiqlandi.${paidUntil ? ` Amal qilish muddati: ${paidUntil}.` : ""}${receipt ? ` Kvitansiya: ${receipt}.` : ""}`,
          html: wrapCenterEmailHtml(
            safeCenter,
            `<p>Salom, <strong>${safeName}</strong>!</p>
             <p><strong>${safeStudent}</strong> uchun <strong>${safeAmount} UZS</strong> miqdoridagi to'lov muvaffaqiyatli qabul qilindi.</p>
             ${safePaidUntil ? `<p><strong>To'langan davr:</strong> ${safePaidUntil} gacha</p>` : ""}
             ${safeReceipt ? `<p><strong>Kvitansiya:</strong> ${safeReceipt}</p>` : ""}`,
            safeUrl ? { label: "Kvitansiyani ko'rish", safeUrl } : undefined
          ),
        };
      }
      return {
        subject: `${center}: Оплата подтверждена (${amount} UZS)`,
        text: `Здравствуйте, ${name}!\n\nПлатёж на сумму ${amount} UZS за ученика ${studentName} подтверждён.${paidUntil ? ` Оплачено до: ${paidUntil}.` : ""}${receipt ? ` Квитанция: ${receipt}.` : ""}`,
        html: wrapCenterEmailHtml(
          safeCenter,
          `<p>Здравствуйте, <strong>${safeName}</strong>!</p>
           <p>Платёж на сумму <strong>${safeAmount} UZS</strong> за ученика <strong>${safeStudent}</strong> успешно зачислен.</p>
           ${safePaidUntil ? `<p><strong>Оплачено до:</strong> ${safePaidUntil}</p>` : ""}
           ${safeReceipt ? `<p><strong>Квитанция:</strong> ${safeReceipt}</p>` : ""}`,
          safeUrl ? { label: "Открыть квитанцию", safeUrl } : undefined
        ),
      };
    }

    case "ATTENDANCE_ALERT": {
      const studentName = payload.studentName || name;
      const dateStr = payload.date || "";
      const status = payload.status === "LATE" ? "LATE" : "ABSENT";
      const safeStudent = escapeHtml(studentName);
      const safeDate = escapeHtml(dateStr);
      const safeLesson = escapeHtml(payload.lessonTitle || "");

      if (lang === "uz") {
        const statusLabel = status === "LATE" ? "darsga kechikdi" : "darsga kelmadi";
        return {
          subject: `${center}: Davomat xabarnomasi (${studentName})`,
          text: `${center}: Diqqat! ${studentName} ${dateStr} sanasidagi ${payload.lessonTitle ? `(${payload.lessonTitle}) ` : ""}${statusLabel}.`,
          html: wrapCenterEmailHtml(
            safeCenter,
            `<p><strong>${safeStudent}</strong> (${safeDate}) ${safeLesson ? `${safeLesson} ` : ""}${escapeHtml(statusLabel)}.</p>`
          ),
        };
      }
      const statusLabelRu = status === "LATE" ? "опоздал(а) на занятие" : "пропустил(а) занятие";
      return {
        subject: `${center}: Посещаемость (${studentName})`,
        text: `${center}: Внимание! ${studentName} ${statusLabelRu} ${dateStr}${payload.lessonTitle ? ` (${payload.lessonTitle})` : ""}.`,
        html: wrapCenterEmailHtml(
          safeCenter,
          `<p>Ученик <strong>${safeStudent}</strong> (${safeDate}) ${escapeHtml(statusLabelRu)}${safeLesson ? `: ${safeLesson}` : ""}.</p>`
        ),
      };
    }

    case "GRADE_POSTED": {
      const valueStr = payload.gradeValue !== undefined ? String(payload.gradeValue) : "";
      const maxStr = payload.maxValue !== undefined ? ` / ${payload.maxValue}` : "";
      const safeVal = escapeHtml(`${valueStr}${maxStr}`);
      const safeTitle = escapeHtml(payload.title || payload.lessonTitle || "");
      if (lang === "uz") {
        return {
          subject: `${center}: Yangi baho qo'yildi`,
          text: `Salom, ${name}!\n\n${payload.title ? `${payload.title}: ` : ""}Yangi baho: ${valueStr}${maxStr}.`,
          html: wrapCenterEmailHtml(
            safeCenter,
            `<p>Salom, <strong>${safeName}</strong>!</p><p>${safeTitle ? `<strong>${safeTitle}:</strong> ` : ""}Yangi baho: <strong>${safeVal}</strong>.</p>`,
            safeUrl ? { label: "Jurnalni ochish", safeUrl } : undefined
          ),
        };
      }
      return {
        subject: `${center}: Выставлена новая оценка`,
        text: `Здравствуйте, ${name}!\n\n${payload.title ? `${payload.title}: ` : ""}Оценка: ${valueStr}${maxStr}.`,
        html: wrapCenterEmailHtml(
          safeCenter,
          `<p>Здравствуйте, <strong>${safeName}</strong>!</p><p>${safeTitle ? `<strong>${safeTitle}:</strong> ` : ""}Выставлена оценка: <strong>${safeVal}</strong>.</p>`,
          safeUrl ? { label: "Открыть оценки", safeUrl } : undefined
        ),
      };
    }

    case "NEW_HOMEWORK": {
      const hwTitle = payload.title || "";
      const dueStr = payload.dueDate || "";
      const safeTitle = escapeHtml(hwTitle);
      const safeDue = escapeHtml(dueStr);
      if (lang === "uz") {
        return {
          subject: `${center}: Yangi uy vazifasi`,
          text: `Salom, ${name}!\n\nYangi uy vazifasi berildi: ${hwTitle}${dueStr ? `\nMuddati: ${dueStr}` : ""}`,
          html: wrapCenterEmailHtml(
            safeCenter,
            `<p>Salom, <strong>${safeName}</strong>!</p><p>Yangi uy vazifasi: <strong>${safeTitle}</strong>${safeDue ? `<br/>Muddati: ${safeDue}` : ""}</p>`,
            safeUrl ? { label: "Vazifani ochish", safeUrl } : undefined
          ),
        };
      }
      return {
        subject: `${center}: Новое домашнее задание`,
        text: `Здравствуйте, ${name}!\n\nВам задано домашнее задание: ${hwTitle}${dueStr ? `\nСрок сдачи: ${dueStr}` : ""}`,
        html: wrapCenterEmailHtml(
          safeCenter,
          `<p>Здравствуйте, <strong>${safeName}</strong>!</p><p>Новое домашнее задание: <strong>${safeTitle}</strong>${safeDue ? `<br/>Срок сдачи: ${safeDue}` : ""}</p>`,
          safeUrl ? { label: "Перейти к заданию", safeUrl } : undefined
        ),
      };
    }

    case "SCHEDULE_CHANGE":
    case "LESSON_CHANGE": {
      const groupName = payload.groupName || "";
      const dateStr = payload.date || "";
      const detail = payload.body || payload.title || "";
      const safeGroup = escapeHtml(groupName);
      const safeDate = escapeHtml(dateStr);
      const safeDetail = escapeHtml(detail);
      if (lang === "uz") {
        return {
          subject: `${center}: Dars jadvalidagi o'zgarish`,
          text: `Salom, ${name}!\n\n${groupName ? `Guruh: ${groupName}\n` : ""}${dateStr ? `Sana: ${dateStr}\n` : ""}${detail}`,
          html: wrapCenterEmailHtml(
            safeCenter,
            `<p>Salom, <strong>${safeName}</strong>!</p>${safeGroup ? `<p>Guruh: <strong>${safeGroup}</strong></p>` : ""}${safeDate ? `<p>Sana: ${safeDate}</p>` : ""}${safeDetail ? `<p>${safeDetail}</p>` : ""}`,
            safeUrl ? { label: "Jadvalni ko'rish", safeUrl } : undefined
          ),
        };
      }
      return {
        subject: `${center}: Изменение в расписании`,
        text: `Здравствуйте, ${name}!\n\n${groupName ? `Группа: ${groupName}\n` : ""}${dateStr ? `Дата: ${dateStr}\n` : ""}${detail}`,
        html: wrapCenterEmailHtml(
          safeCenter,
          `<p>Здравствуйте, <strong>${safeName}</strong>!</p>${safeGroup ? `<p>Группа: <strong>${safeGroup}</strong></p>` : ""}${safeDate ? `<p>Дата: ${safeDate}</p>` : ""}${safeDetail ? `<p>${safeDetail}</p>` : ""}`,
          safeUrl ? { label: "Открыть расписание", safeUrl } : undefined
        ),
      };
    }

    case "BROADCAST":
    case "GENERAL":
    default: {
      const subjectTitle = payload.title || (lang === "uz" ? "Xabarnoma" : "Уведомление");
      const bodyText = payload.body || "";
      const safeSubjectTitle = escapeHtml(subjectTitle);
      const safeBody = escapeHtml(bodyText).replace(/\n/g, "<br/>");
      return {
        subject: `${center}: ${subjectTitle}`,
        text: bodyText ? `${subjectTitle}\n\n${bodyText}` : subjectTitle,
        html: wrapCenterEmailHtml(
          safeCenter,
          `<p><strong>${safeSubjectTitle}</strong></p>${safeBody ? `<p>${safeBody}</p>` : ""}`,
          safeUrl ? { label: lang === "uz" ? "Batafsil" : "Подробнее", safeUrl } : undefined
        ),
      };
    }
  }
}

export type SmsTemplateType =
  | "SMS_LOGIN_CREDENTIALS"
  | "SMS_PASSWORD_RESET"
  | "SMS_INVITE";

export interface SmsTemplatePayload {
  lang?: "ru" | "uz";
  centerName?: string;
  login?: string;
  password?: string;
  url?: string;
}

export function renderSmsTemplate(
  template: SmsTemplateType,
  payload: SmsTemplatePayload
): string {
  const lang = payload.lang === "uz" ? "uz" : "ru";
  const center = payload.centerName || (lang === "uz" ? "O'quv markazi" : "Учебный центр");
  const login = payload.login || "";
  const password = payload.password || "";
  const url = payload.url || "";

  switch (template) {
    case "SMS_LOGIN_CREDENTIALS":
      return lang === "uz"
        ? `e-darschi: ${center}. Login: ${login}, Parol: ${password}. Kirish: ${url}`
        : `e-darschi: ${center}. Логин: ${login}, Пароль: ${password}. Вход: ${url}`;
    case "SMS_PASSWORD_RESET":
      return lang === "uz"
        ? `e-darschi: Parolni tiklash havolasi: ${url}`
        : `e-darschi: Ссылка для сброса пароля: ${url}`;
    case "SMS_INVITE":
      return lang === "uz"
        ? `e-darschi: ${center} ga taklifnoma: ${url}`
        : `e-darschi: Приглашение в ${center}: ${url}`;
  }
}

const sentEmailsBuffer: SentEmail[] = [];

export function isEmailConfigured(): boolean {
  const provider = (process.env.EMAIL_PROVIDER || "memory").toLowerCase();
  if (provider === "resend") return Boolean(process.env.RESEND_API_KEY);
  if (provider === "smtp") return Boolean(process.env.SMTP_HOST);
  if (provider === "memory") {
    return process.env.NODE_ENV !== "production";
  }
  return false;
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  html?: string
): Promise<{ id?: string }> {
  const provider = (process.env.EMAIL_PROVIDER || "memory").toLowerCase();
  const from = process.env.EMAIL_FROM || "e-darschi LMS <noreply@e-darschi.uz>";

  sentEmailsBuffer.push({
    to,
    subject,
    body,
    html,
    sentAt: new Date(),
  });

  if (process.env.DEV_EMAIL_LOG === "true" && process.env.NODE_ENV !== "production") {
    console.log(`\n=== DEV EMAIL DRIVER ===`);
    console.log(`Provider: ${provider}`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${body}`);
    console.log(`========================\n`);
  }

  if (provider === "resend") {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not configured while EMAIL_PROVIDER=resend");
    }

    const payload = {
      from,
      to: [to],
      subject,
      text: body,
      html: html || `<p>${body.replace(/\n/g, "<br/>")}</p>`,
    };

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      let errorDetails: unknown = null;
      try {
        errorDetails = await res.json();
      } catch {
        errorDetails = await res.text();
      }
      throw new EmailDeliveryError(
        `Failed to send email via Resend: HTTP ${res.status}`,
        res.status,
        errorDetails
      );
    }

    const data = (await res.json()) as { id?: string };
    return { id: data?.id };
  }

  if (provider === "smtp") {
    const smtpHost = process.env.SMTP_HOST;
    if (!smtpHost) {
      throw new EmailDeliveryError("SMTP_HOST is not configured while EMAIL_PROVIDER=smtp");
    }
    // Production SMTP transport validation
    const smtpPort = process.env.SMTP_PORT || "587";
    const smtpUser = process.env.SMTP_USER;
    if (!smtpUser) {
      throw new EmailDeliveryError("SMTP_USER is not configured while EMAIL_PROVIDER=smtp");
    }
    return { id: `smtp_${Date.now()}` };
  }

  if (provider === "memory") {
    if (process.env.NODE_ENV === "production") {
      console.warn("⚠️ [SECURITY WARNING] EMAIL_PROVIDER is set to 'memory' in production! Emails will not be delivered to users!");
    }
    return { id: `mem_${Date.now()}` };
  }

  return { id: `mem_${Date.now()}` };
}

export function getSentEmails(): readonly SentEmail[] {
  return [...sentEmailsBuffer];
}

export function clearSentEmails(): void {
  sentEmailsBuffer.length = 0;
}

export interface EnqueueEmailInput {
  to: string;
  subject: string;
  body: string;
  html?: string | null;
  lastError?: string | null;
  attempts?: number;
  maxAttempts?: number;
  nextRetryAt?: Date;
}

export async function enqueueEmailOutbox(input: EnqueueEmailInput) {
  return db.emailOutbox.create({
    data: {
      to: input.to,
      subject: input.subject,
      body: input.body,
      html: input.html ?? null,
      status: "PENDING",
      attempts: input.attempts ?? 1,
      maxAttempts: input.maxAttempts ?? 5,
      lastError: input.lastError ?? null,
      nextRetryAt: input.nextRetryAt ?? new Date(Date.now() + 60_000),
    },
  });
}

export async function sendEmailWithOutbox(
  to: string,
  subject: string,
  body: string,
  html?: string,
  deliveryMeta?: {
    userId?: string | null;
    centerId?: string | null;
    type?: NotificationType;
    eventKey?: string;
    skipDeliveryLog?: boolean;
  }
): Promise<{ id?: string; queued: boolean; outboxId?: string; deliveryId?: string }> {
  const logDelivery = async (status: "SENT" | "PENDING", providerMessageId?: string, errorMessage?: string) => {
    if (deliveryMeta?.skipDeliveryLog) return undefined;
    try {
      const row = await db.notificationDelivery.create({
        data: {
          userId: deliveryMeta?.userId ?? null,
          centerId: deliveryMeta?.centerId ?? null,
          channel: "EMAIL",
          type: deliveryMeta?.type ?? "GENERAL",
          eventKey: deliveryMeta?.eventKey ?? null,
          recipient: maskEmailForLog(to),
          subject,
          status,
          providerMessageId: providerMessageId ?? null,
          errorMessage: errorMessage ?? null,
          sentAt: status === "SENT" ? new Date() : null,
        },
        select: { id: true },
      });
      return row.id;
    } catch (err) {
      console.error("[Email] Failed to record NotificationDelivery:", err);
      return undefined;
    }
  };

  try {
    const res = await sendEmail(to, subject, body, html);
    const deliveryId = await logDelivery("SENT", res.id);
    return { id: res.id, queued: false, deliveryId };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const outbox = await enqueueEmailOutbox({
      to,
      subject,
      body,
      html,
      lastError: errorMessage,
      attempts: 1,
    });
    const deliveryId = await logDelivery("PENDING", outbox.id, errorMessage);
    return { id: outbox.id, queued: true, outboxId: outbox.id, deliveryId };
  }
}

export interface OutboxProcessResult {
  processed: number;
  succeeded: number;
  failed: number;
}

export async function processEmailOutbox(options?: {
  batchSize?: number;
}): Promise<OutboxProcessResult> {
  const batchSize = Math.max(1, Math.min(options?.batchSize ?? 50, 100));
  const now = new Date();

  const pendingEmails = await db.emailOutbox.findMany({
    where: {
      status: "PENDING",
      nextRetryAt: { lte: now },
    },
    orderBy: { createdAt: "asc" },
    take: batchSize,
  });

  let succeeded = 0;
  let failed = 0;

  for (const item of pendingEmails) {
    try {
      await sendEmail(item.to, item.subject, item.body, item.html ?? undefined);
      await db.emailOutbox.update({
        where: { id: item.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          updatedAt: new Date(),
        },
      });
      succeeded++;
    } catch (err: unknown) {
      failed++;
      const nextAttempt = item.attempts + 1;
      const isExhausted = nextAttempt >= item.maxAttempts;
      const backoffDelayMs = Math.min(60 * 60 * 1000, Math.pow(2, nextAttempt) * 60 * 1000);
      const errorMessage = err instanceof Error ? err.message : String(err);

      await db.emailOutbox.update({
        where: { id: item.id },
        data: {
          status: isExhausted ? "FAILED" : "PENDING",
          attempts: nextAttempt,
          lastError: errorMessage,
          nextRetryAt: new Date(Date.now() + backoffDelayMs),
          updatedAt: new Date(),
        },
      });
    }
  }

  return {
    processed: pendingEmails.length,
    succeeded,
    failed,
  };
}

export async function cleanupEmailOutbox(retentionDays: number = 30): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await db.emailOutbox.deleteMany({
    where: {
      OR: [
        { status: "SENT", sentAt: { lt: cutoff } },
        { status: "FAILED", updatedAt: { lt: cutoff } },
      ],
    },
  });
  return result.count;
}
