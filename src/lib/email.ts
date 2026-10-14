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
  | "ACCOUNT_LOCKED";

export interface EmailTemplatePayload {
  lang?: "ru" | "uz";
  url?: string;
  fullName?: string;
  centerName?: string;
  expiresIn?: string;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export function renderEmailTemplate(
  template: EmailTemplateType,
  payload: EmailTemplatePayload
): RenderedEmail {
  const lang = payload.lang === "uz" ? "uz" : "ru";
  const name = payload.fullName || (lang === "uz" ? "Foydalanuvchi" : "Пользователь");
  const url = payload.url || "";
  const center = payload.centerName || (lang === "uz" ? "O'quv markazi" : "Учебный центр");

  switch (template) {
    case "EMAIL_CONFIRMATION": {
      if (lang === "uz") {
        return {
          subject: "e-darschi: Elektron pochtani tasdiqlash",
          text: `Salom, ${name}!\n\ne-darschi platformasida ro'yxatdan o'tganingiz uchun tashakkur. Pochtani tasdiqlash uchun havola: ${url}\n\nAgar siz ushbu amalni bajarmagan bo'lsangiz, xabarga e'tibor bermang.`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #2563eb; margin-top: 0;">e-darschi LMS</h2>
              <p>Salom, <strong>${name}</strong>!</p>
              <p>e-darschi platformasida hisobingizni faollashtirish uchun quyidagi tugmani bosing:</p>
              <p style="margin: 24px 0;">
                <a href="${url}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Pochtani tasdiqlash</a>
              </p>
              <p style="color: #64748b; font-size: 14px;">Yoki ushbu havolani brauzerga nusxalang: <br/><a href="${url}">${url}</a></p>
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
            <p>Здравствуйте, <strong>${name}</strong>!</p>
            <p>Для подтверждения вашего адреса электронной почты и завершения регистрации нажмите кнопку ниже:</p>
            <p style="margin: 24px 0;">
              <a href="${url}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Подтвердить email</a>
            </p>
            <p style="color: #64748b; font-size: 14px;">Или перейдите по ссылке: <br/><a href="${url}">${url}</a></p>
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
              <p>Salom, <strong>${name}</strong>!</p>
              <p>Siz e-darschi platformasida parolingizni tiklashni so'rashingiz haqida murojaat qildingiz. Yangi parol o'rnatish uchun quyidagi tugmani bosing:</p>
              <p style="margin: 24px 0;">
                <a href="${url}" style="background-color: #ef4444; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Parolni tiklash</a>
              </p>
              <p style="color: #64748b; font-size: 14px;">Havola: <a href="${url}">${url}</a></p>
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
            <p>Здравствуйте, <strong>${name}</strong>!</p>
            <p>Был запрошен сброс пароля для вашей учетной записи. Нажмите кнопку ниже для ввода нового пароля:</p>
            <p style="margin: 24px 0;">
              <a href="${url}" style="background-color: #ef4444; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Сбросить пароль</a>
            </p>
            <p style="color: #64748b; font-size: 14px;">Ссылка для перехода: <br/><a href="${url}">${url}</a></p>
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
              <h2 style="color: #2563eb; margin-top: 0;">${center}</h2>
              <p>Sizni <strong>${center}</strong> o'quv markaziga qo'shilishga taklif qilishdi.</p>
              <p style="margin: 24px 0;">
                <a href="${url}" style="background-color: #10b981; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Taklifni qabul qilish</a>
              </p>
              <p style="color: #64748b; font-size: 14px;">Havola: <a href="${url}">${url}</a></p>
            </div>
          `.trim(),
        };
      }
      return {
        subject: `${center}: Приглашение в учебный центр`,
        text: `Здравствуйте!\n\nВам отправлено приглашение в учебный центр ${center}. Ссылка для входа: ${url}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #2563eb; margin-top: 0;">${center}</h2>
            <p>Вы получили приглашение присоединиться к учебному центру <strong>${center}</strong>.</p>
            <p style="margin: 24px 0;">
              <a href="${url}" style="background-color: #10b981; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Принять приглашение</a>
            </p>
            <p style="color: #64748b; font-size: 14px;">Ссылка: <a href="${url}">${url}</a></p>
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
              <p>Salom, <strong>${name}</strong>!</p>
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
            <p>Здравствуйте, <strong>${name}</strong>!</p>
            <p>Из соображений безопасности ваша учетная запись заблокирована на 15 минут из-за многократного ввода неверного пароля.</p>
          </div>
        `.trim(),
      };
    }
  }
}

const sentEmailsBuffer: SentEmail[] = [];

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
  html?: string
): Promise<{ id?: string; queued: boolean; outboxId?: string }> {
  try {
    const res = await sendEmail(to, subject, body, html);
    return { id: res.id, queued: false };
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
    return { id: outbox.id, queued: true, outboxId: outbox.id };
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
