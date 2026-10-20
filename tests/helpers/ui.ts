/**
 * Shared helpers for DOM/component tests (Vitest + jsdom + Testing Library).
 *
 * These utilities are intentionally dependency-light: components under test only
 * consume `res.ok` / `res.status` / `res.json()`, so a plain object is enough and
 * avoids relying on the global `Response` implementation.
 */
import { vi } from "vitest";

/** Build a minimal fetch `Response`-like object for a JSON payload. */
export function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

/** A `Response`-like object whose `json()` rejects (simulates malformed payloads). */
export function brokenResponse(status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      throw new Error("invalid json");
    },
  } as unknown as Response;
}

export interface FetchRoute {
  /** Substring matched against the request URL. */
  match: string;
  method?: string;
  reply: Response | (() => Response);
}

export interface FetchRecord {
  url: string;
  init?: RequestInit;
}

/**
 * Install a `fetch` mock that answers by matching the request URL/method.
 * Throws on any request that has no matching route, so tests fail loudly
 * instead of silently hanging.
 */
export function installFetchMock(routes: FetchRoute[]): {
  fetchMock: ReturnType<typeof vi.fn>;
  calls: FetchRecord[];
} {
  const calls: FetchRecord[] = [];

  const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = typeof input === "string" ? input : String(input);
    calls.push({ url, init });

    const method = (init?.method ?? "GET").toUpperCase();
    // A route with an explicit method always wins over a method-agnostic one,
    // otherwise a plain `GET` route would swallow `DELETE`/`PATCH` requests.
    const candidates = routes.filter((r) => url.includes(r.match));
    const route =
      candidates.find((r) => r.method && method === r.method.toUpperCase()) ??
      candidates.find((r) => !r.method);

    if (!route) {
      throw new Error(`Unhandled fetch: ${method} ${url}`);
    }
    return typeof route.reply === "function" ? route.reply() : route.reply;
  });

  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return { fetchMock, calls };
}

/** Parse the JSON body that was sent to a mocked `fetch` call. */
export function sentBody(call: FetchRecord): unknown {
  return call.init?.body ? JSON.parse(String(call.init.body)) : undefined;
}
