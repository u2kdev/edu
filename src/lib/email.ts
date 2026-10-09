export interface SentEmail {
  to: string;
  subject: string;
  body: string;
  sentAt: Date;
}

const sentEmailsBuffer: SentEmail[] = [];

export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  sentEmailsBuffer.push({
    to,
    subject,
    body,
    sentAt: new Date(),
  });

  if (process.env.DEV_EMAIL_LOG === "true" && process.env.NODE_ENV !== "production") {
    console.log(`\n=== DEV EMAIL DRIVER ===`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${body}`);
    console.log(`========================\n`);
  }
  return Promise.resolve();
}

export function getSentEmails(): readonly SentEmail[] {
  return [...sentEmailsBuffer];
}

export function clearSentEmails(): void {
  sentEmailsBuffer.length = 0;
}
