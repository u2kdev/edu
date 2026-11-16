/**
 * Cloudflare Turnstile Captcha validation helper.
 * Protects public registration, leads, tickets, and forgot-password endpoints against automated bot attacks.
 */
export async function verifyTurnstileToken(token?: string, ip?: string): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  // Pass-through when Turnstile is not configured (e.g. standard local dev or test environments)
  if (!secretKey) {
    return true;
  }

  // If Turnstile is active but no token was provided, reject fail-closed
  if (!token || typeof token !== "string" || !token.trim()) {
    return false;
  }

  try {
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token.trim());
    if (ip && ip !== "unknown") {
      formData.append("remoteip", ip);
    }

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return false;
    }

    const data = (await res.json()) as { success?: boolean };
    return Boolean(data.success);
  } catch (err) {
    // Fail-closed on captcha service failure
    console.error("[Turnstile] Validation error:", err);
    return false;
  }
}
