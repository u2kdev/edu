export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  // In production, this would use a real driver like Resend, Sendgrid, etc.
  // We use setTimeout to simulate network delay for fire-and-forget.
  return new Promise((resolve) => {
    setTimeout(() => {
      if (process.env.NODE_ENV !== "production") {
        console.log(`\n=== DEV EMAIL DRIVER ===`);
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Body: ${body}`);
        console.log(`========================\n`);
      }
      resolve();
    }, 10); // Small delay to simulate async network
  });
}
