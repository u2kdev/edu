import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/ip";
import { checkRateLimit, getClientRateLimitKey } from "@/lib/rate-limit";
import { CLICK_ERROR, isClickIpAllowed, processClickWebhook } from "@/lib/click";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

async function parseClickBody(req: Request): Promise<Record<string, unknown>> {
  const contentType = (req.headers.get("content-type") || "").toLowerCase();
  const rawText = await req.text();
  if (!rawText.trim()) return {};

  if (contentType.includes("application/json")) {
    const parsed = JSON.parse(rawText);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  }

  // Click default: application/x-www-form-urlencoded (or fallback JSON if valid JSON sent without header)
  if (rawText.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(rawText);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Fall through to URLSearchParams
    }
  }

  const formParams = new URLSearchParams(rawText);
  const out: Record<string, unknown> = {};
  for (const [k, v] of formParams.entries()) {
    out[k] = v;
  }
  return out;
}

export async function POST(req: Request) {
  try {
    if (!isClickIpAllowed(req)) {
      return NextResponse.json(
        { error: CLICK_ERROR.REQUEST_ERROR, error_note: "Forbidden source IP" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const rlKey = getClientRateLimitKey(req, "webhook_click");
    const allowed = await checkRateLimit(rlKey, 120, 60 * 1000, true);
    if (!allowed) {
      return NextResponse.json(
        { error: CLICK_ERROR.REQUEST_ERROR, error_note: "Rate limit exceeded" },
        { status: 429, headers: NO_STORE_HEADERS }
      );
    }

    let payload: Record<string, unknown>;
    try {
      payload = await parseClickBody(req);
    } catch {
      return NextResponse.json(
        { error: CLICK_ERROR.REQUEST_ERROR, error_note: "Malformed webhook body" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const ipAddress = getClientIp(req);
    const result = await processClickWebhook({
      payload,
      ipAddress: ipAddress === "unknown" ? null : ipAddress,
    });

    return NextResponse.json(result, { status: 200, headers: NO_STORE_HEADERS });
  } catch (err) {
    console.error("[POST /api/webhooks/click]", err);
    return NextResponse.json(
      { error: CLICK_ERROR.REQUEST_ERROR, error_note: "Webhook handler error" },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  }
}
