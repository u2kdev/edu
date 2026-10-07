export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  if (process.env.DEV_EMAIL_LOG === "true" && process.env.NODE_ENV !== "production") {
    console.log(`\n=== DEV EMAIL DRIVER ===`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${body}`);
    console.log(`========================\n`);
  }
  return Promise.resolve();
}
