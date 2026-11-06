import { API_BASE_URL } from "../config/api";
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

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
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
