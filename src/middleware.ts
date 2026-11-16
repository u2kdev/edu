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
  const pathname = req.nextUrl.pathname;

  // 1. Direct uploads access protection:
  // Rewrite /uploads/* to authorized /api/files/* route, and reject path traversal attempts
  if (pathname.startsWith("/uploads/")) {
    const relativePath = pathname.replace(/^\/uploads\//, "");
    if (relativePath.includes("..")) {
      return NextResponse.json(
        { error: "Forbidden: Invalid file path" },
        { status: 403 }
      );
    }
    const url = req.nextUrl.clone();
    url.pathname = `/api/files/${relativePath}`;
    return NextResponse.rewrite(url);
  }

  // 2. Request body limit (DoS defense against memory/buffer exhaustion)
  if (!SAFE_METHODS.has(method)) {
    const rawContentLength = req.headers.get("content-length");
    if (rawContentLength) {
      const contentLength = parseInt(rawContentLength, 10);
      if (!Number.isNaN(contentLength)) {
        // Large limit for file uploads and CSV imports (50MB)
        const isUploadRoute =
          pathname.startsWith("/api/upload") ||
          pathname.startsWith("/api/students/import-csv") ||
          pathname.startsWith("/api/invites/bulk-import");
        const maxLimit = isUploadRoute ? 50 * 1024 * 1024 : 1 * 1024 * 1024; // 1MB default for JSON/form APIs

        if (contentLength > maxLimit) {
          return NextResponse.json(
            { error: "Payload too large", code: "PAYLOAD_TOO_LARGE" },
            { status: 413 }
          );
        }
      }
    }
  }

  // 3. CSRF protection on state-changing requests
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

  const res = NextResponse.next();

  // 3. Global Cache-Control for sensitive API responses
  if (pathname.startsWith("/api/")) {
    res.headers.set(
      "Cache-Control",
      "private, no-cache, no-store, max-age=0, must-revalidate"
    );
    res.headers.set("Pragma", "no-cache");
  }

  return res;
}

export const config = {
  // Run on everything except Next.js static assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
