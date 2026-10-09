import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ApiErrorCode = 
  | "UNAUTHORIZED" 
  | "FORBIDDEN" 
  | "NOT_FOUND" 
  | "VALIDATION_ERROR" 
  | "INTERNAL_SERVER_ERROR"
  | "RATE_LIMITED"
  | "TENANT_BLOCKED"
  | "BAD_REQUEST"
  | "INVALID_TOKEN"
  | "INVALID_INVITE"
  | "ROLE_CONFLICT";

export interface ApiErrorResponse {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
}

export function apiError(
  message: string,
  code: ApiErrorCode = "INTERNAL_SERVER_ERROR",
  status: number = 500,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        details,
      },
    },
    { status }
  );
}

export function apiSuccess<T>(data: T, status: number = 200) {
  return NextResponse.json({ success: true, ...data }, { status });
}

export function handleApiError(error: unknown): NextResponse<ApiErrorResponse> {
  const err = error as { message?: string } | null | undefined;
  if (error instanceof ZodError) {
    return apiError("Ошибка валидации данных", "VALIDATION_ERROR", 400, error.issues);
  }

  if (err?.message && err.message.includes("Unauthorized")) {
    return apiError("Требуется авторизация", "UNAUTHORIZED", 401);
  }

  if (err?.message && err.message.includes("Forbidden")) {
    return apiError("Нет доступа", "FORBIDDEN", 403);
  }
  
  if (err?.message && err.message.includes("Tenant Blocked")) {
    return apiError(err.message, "TENANT_BLOCKED", 403);
  }

  console.error("Unhandled API Error:", error);
  return apiError(err?.message || "Внутренняя ошибка сервера", "INTERNAL_SERVER_ERROR", 500);
}
