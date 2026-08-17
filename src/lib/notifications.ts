import { db } from "./db";

export interface SendNotificationOptions {
  userId: string;
  centerId?: string;
  type: string; // INVITE, NEW_HOMEWORK, SCHEDULE_CHANGE, PAYMENT_DUE, PAYMENT_OVERDUE, GRADE_POSTED, SUBSCRIPTION_EXPIRING, ABSENT_ALERT
  titleKey: string;
  bodyKey: string;
  bodyParams?: Record<string, string | number>;
  channel?: "IN_APP" | "EMAIL" | "SMS" | "PUSH";
  recipientEmail?: string;
  recipientPhone?: string;
}

/**
 * High-level notification dispatcher supporting DB persistence + Email/SMS transports.
 */
export async function sendNotification(options: SendNotificationOptions) {
  try {
    // 1. Create in-app DB notification
    const notification = await db.notification.create({
      data: {
        userId: options.userId,
        centerId: options.centerId || null,
        type: options.type,
        titleKey: options.titleKey,
        bodyKey: options.bodyKey,
        bodyParams: options.bodyParams ? JSON.stringify(options.bodyParams) : null,
        channel: options.channel || "IN_APP",
        sentAt: new Date(),
      },
    });

    // 2. Dispatch to external channel (Email / SMS) if specified
    if (options.channel === "EMAIL" && options.recipientEmail) {
      await sendEmailTransport(options.recipientEmail, options.titleKey, options.bodyKey, options.bodyParams);
    } else if (options.channel === "SMS" && options.recipientPhone) {
      await sendSmsTransport(options.recipientPhone, options.titleKey, options.bodyParams);
    }

    return notification;
  } catch (err) {
    console.error("[Notification Engine] Failed to dispatch notification:", err);
  }
}

/**
 * Mock/real Email Transporter driver (Nodemailer / Resend compatible)
 */
async function sendEmailTransport(
  email: string,
  subjectKey: string,
  bodyKey: string,
  params?: Record<string, string | number>
) {
  console.log(`📧 [Email Driver] Sending email to ${email}: Subject="${subjectKey}", Params=`, params);
  // Production integration: send via nodemailer / resend API
}

/**
 * Mock/real SMS Transporter driver (Eskiz.uz API compatible for Uzbekistan)
 */
async function sendSmsTransport(
  phone: string,
  titleKey: string,
  params?: Record<string, string | number>
) {
  console.log(`📱 [SMS Driver (Eskiz.uz)] Sending SMS to ${phone}: Title="${titleKey}", Params=`, params);
  // Production integration: POST to https://notify.eskiz.uz/api/message/sms/send
}
