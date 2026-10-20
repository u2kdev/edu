import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Baseline CSRF protection for state-changing requests.
 *
 * We do not rely on tokens here; instead we validate the `Origin` header against
 * the request host. Browsers always attach `Origin` on cross-site state-changing
 * requests (and cannot forge it), so a mismatch indicates a cross-site request.
 *
 * Requests without an `Origin` header (server-to-server calls, cron jobs, native
 * mobile clients, curl) are allowed — those are not browser CSRF vectors.
 *
 * Note: security headers (CSP, HSTS, X-Frame-Options, ...) live in next.config.mjs.
 */
export function middleware(req: NextRequest) {
  const method = req.method.toUpperCase();

  if (!SAFE_METHODS.has(method)) {
    const origin = req.headers.get("origin");

    // Origin: null appears on sandboxed iframes / some cross-site redirects — treat as cross-site.
    if (origin === "null") {
      return NextResponse.json({ error: "Forbidden: cross-site request blocked" }, { status: 403 });
    }

    if (origin) {
      let originHost: string;
      try {
        originHost = new URL(origin).host;
      } catch {
        return NextResponse.json({ error: "Forbidden: invalid origin" }, { status: 403 });
      }

      const allowedHosts = [req.headers.get("host"), req.headers.get("x-forwarded-host")].filter(
        (host): host is string => Boolean(host)
      );

      if (allowedHosts.length > 0 && !allowedHosts.includes(originHost)) {
        return NextResponse.json({ error: "Forbidden: cross-site request blocked" }, { status: 403 });
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next.js static assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
