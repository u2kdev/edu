import { API_BASE_URL, API_ENDPOINTS, isDevelopmentEnvironment } from "../config/api";
import { AuthStorage } from "./auth-storage";

export class ApiError extends Error {
  status: number;
  code?: string;
  data?: unknown;

  constructor(message: string, status: number, code?: string, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

let onUnauthorizedCallback: (() => void) | null = null;

export function setOnUnauthorizedCallback(cb: () => void) {
  onUnauthorizedCallback = cb;
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await AuthStorage.getItem("auth_token");
  const centerId = await AuthStorage.getItem("auth_active_center");

  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (centerId && !headers.has("x-center-id")) {
    headers.set("x-center-id", centerId);
  }

  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (networkErr) {
    // LAN fallback is strictly prohibited in release builds and only allowed during local dev
    if (isDevelopmentEnvironment() && !endpoint.startsWith("http") && API_BASE_URL.includes("localhost")) {
      const lanUrl = `http://192.168.100.12:3000${endpoint}`;
      response = await fetch(lanUrl, {
        ...options,
        headers,
      });
    } else {
      throw networkErr;
    }
  }

  if (response.status === 401) {
    // Attempt automatic refresh if not already requesting auth routes
    const isAuthRoute = endpoint.includes("/api/auth/mobile/login") || endpoint.includes("/api/auth/mobile/refresh");
    if (!isAuthRoute) {
      const storedRefreshToken = await AuthStorage.getItem("auth_refresh_token");
      if (storedRefreshToken) {
        try {
          const refreshRes = await fetch(`${API_BASE_URL}${API_ENDPOINTS.REFRESH}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken: storedRefreshToken }),
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            if (refreshData?.token) {
              await AuthStorage.setItem("auth_token", refreshData.token);
              if (refreshData.refreshToken) {
                await AuthStorage.setItem("auth_refresh_token", refreshData.refreshToken);
              }
              // Retry original request with newly issued token
              const retryHeaders = new Headers(options.headers || {});
              retryHeaders.set("Content-Type", "application/json");
              retryHeaders.set("Authorization", `Bearer ${refreshData.token}`);
              if (centerId && !retryHeaders.has("x-center-id")) {
                retryHeaders.set("x-center-id", centerId);
              }
              const retryResponse = await fetch(url, { ...options, headers: retryHeaders });
              if (retryResponse.ok) {
                return (await retryResponse.json()) as T;
              }
            }
          }
        } catch {}
      }
    }

    if (onUnauthorizedCallback) {
      onUnauthorizedCallback();
    }
    throw new ApiError("Сессия истекла. Пожалуйста, войдите снова.", 401, "UNAUTHORIZED");
  }

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = json?.error?.message || json?.error || "Произошла ошибка при обращении к серверу";
    const errorCode = json?.error?.code || "REQUEST_FAILED";
    throw new ApiError(errorMsg, response.status, errorCode, json);
  }

  return json as T;
}
