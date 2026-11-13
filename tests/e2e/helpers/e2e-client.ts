/**
 * Opaque-Box E2E Test Client Helper
 *
 * Invokes Next.js App Router route handlers through standard Web API Request/Response
 * without mocking internal Prisma, business logic, or middleware.
 */

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  token?: string;
  ip?: string;
  headers?: Record<string, string>;
  body?: unknown;
  cookies?: Record<string, string>;
}

export interface RouteResponse<T = unknown> {
  status: number;
  headers: Headers;
  data: T;
  cookies: Record<string, string>;
  raw: Response;
}

/**
 * Creates a standard Web Request object with headers, cookies, and JSON payload.
 */
export function createRequest(url: string, options: RequestOptions = {}): Request {
  const headers = new Headers(options.headers || {});

  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const cookieMap: Record<string, string> = { ...options.cookies };
  if (options.token) {
    if (!headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${options.token}`);
    }
    cookieMap["auth_token"] = options.token;
  }

  const cookiePairs = Object.entries(cookieMap).map(
    ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`
  );
  if (cookiePairs.length > 0) {
    headers.set("Cookie", cookiePairs.join("; "));
  }

  if (options.ip && !headers.has("x-forwarded-for")) {
    headers.set("x-forwarded-for", options.ip);
  }

  const method = options.method || (options.body !== undefined ? "POST" : "GET");
  const bodyString =
    options.body !== undefined
      ? typeof options.body === "string"
        ? options.body
        : JSON.stringify(options.body)
      : undefined;

  const fullUrl = url.startsWith("http") ? url : `http://localhost${url}`;

  return new Request(fullUrl, {
    method,
    headers,
    body: bodyString,
  });
}

/**
 * Helper to parse Set-Cookie headers into a key-value record.
 */
export function parseResponseCookies(headers: Headers): Record<string, string> {
  const cookies: Record<string, string> = {};
  const setCookie = headers.get("set-cookie");
  if (!setCookie) return cookies;

  // Split multiple Set-Cookie entries (handling common comma splitting vs attributes)
  const parts = setCookie.split(/,\s*(?=[a-zA-Z0-9_-]+=)/);
  for (const part of parts) {
    const mainPart = part.split(";")[0]?.trim();
    if (mainPart) {
      const eqIdx = mainPart.indexOf("=");
      if (eqIdx !== -1) {
        const key = decodeURIComponent(mainPart.substring(0, eqIdx).trim());
        const val = decodeURIComponent(mainPart.substring(eqIdx + 1).trim());
        cookies[key] = val;
      }
    }
  }

  return cookies;
}

/**
 * Invokes a route handler and unpacks the status, JSON data, and cookies.
 */
export async function invokeRoute<T = unknown>(
  handler: unknown,
  url: string,
  options: RequestOptions = {},
  routeContext?: unknown
): Promise<RouteResponse<T>> {
  const req = createRequest(url, options);
  const fn = handler as (req: Request, ctx?: unknown) => Promise<Response>;
  const raw = await fn(req, routeContext);
  const status = raw.status;
  const headers = raw.headers;
  const cookies = parseResponseCookies(headers);

  let data: T;
  const contentType = headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      data = (await raw.json()) as T;
    } catch {
      data = {} as T;
    }
  } else {
    try {
      data = (await raw.text()) as unknown as T;
    } catch {
      data = "" as unknown as T;
    }
  }

  return {
    status,
    headers,
    data,
    cookies,
    raw,
  };
}

/**
 * Stateful opaque client that retains session tokens and cookies.
 */
export class OpaqueE2EClient {
  private token?: string;
  private cookies: Record<string, string> = {};
  private ip?: string;

  constructor(defaults: { token?: string; ip?: string } = {}) {
    this.token = defaults.token;
    this.ip = defaults.ip;
  }

  setToken(token: string) {
    this.token = token;
  }

  clearToken() {
    this.token = undefined;
  }

  setCookie(name: string, value: string) {
    this.cookies[name] = value;
  }

  getCookie(name: string): string | undefined {
    return this.cookies[name];
  }

  async invoke<T = unknown>(
    handler: unknown,
    url: string,
    options: RequestOptions = {},
    routeContext?: unknown
  ): Promise<RouteResponse<T>> {
    const mergedOptions: RequestOptions = {
      ...options,
      token: options.token !== undefined ? options.token : this.token,
      ip: options.ip !== undefined ? options.ip : this.ip,
      cookies: { ...this.cookies, ...options.cookies },
    };

    const res = await invokeRoute<T>(handler, url, mergedOptions, routeContext);

    // Save received cookies from Set-Cookie
    for (const [key, value] of Object.entries(res.cookies)) {
      this.cookies[key] = value;
      if (key === "auth_token") {
        this.token = value;
      }
    }

    return res;
  }
}
