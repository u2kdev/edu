let platformOS = "android";
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const rn = require("react-native");
  if (rn?.Platform?.OS) platformOS = rn.Platform.OS;
} catch {}

/**
 * API configuration for e-darschi mobile client.
 * In development:
 * - Physical Android over USB with `adb reverse tcp:3000 tcp:3000` uses http://localhost:3000 (via EXPO_PUBLIC_API_URL).
 * - Android Emulator uses http://10.0.2.2:3000.
 * - iOS Simulator uses http://localhost:3000.
 */
export function isDevelopmentEnvironment(): boolean {
  if (typeof __DEV__ !== "undefined") {
    return __DEV__;
  }
  return process.env.NODE_ENV !== "production";
}

export function resolveApiBaseUrl(
  isDev: boolean = isDevelopmentEnvironment(),
  envUrl?: string
): string {
  const configuredUrl = envUrl ?? process.env.EXPO_PUBLIC_API_URL;
  if (!isDev) {
    if (!configuredUrl) {
      throw new Error("EXPO_PUBLIC_API_URL must be configured for release builds");
    }
    if (!configuredUrl.startsWith("https://")) {
      throw new Error(`Insecure API URL rejected in release build: "${configuredUrl}". Only HTTPS is permitted.`);
    }
    return configuredUrl.replace(/\/+$/, "");
  }

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }

  return platformOS === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000";
}

export const API_BASE_URL = resolveApiBaseUrl();

export const API_ENDPOINTS = {
  LOGIN: "/api/auth/mobile/login",
  LOGOUT: "/api/auth/logout",
  DELETE_ACCOUNT: "/api/auth/account/delete",
  REFRESH: "/api/auth/mobile/refresh",
  REGISTER_PUSH_TOKEN: "/api/mobile/push-token/register",
  UNREGISTER_PUSH_TOKEN: "/api/mobile/push-token/unregister",
  STUDENT_DASHBOARD: "/api/mobile/student/dashboard",
  PARENT_DASHBOARD: "/api/mobile/parent/dashboard",
  TEACHER_DASHBOARD: "/api/mobile/teacher/dashboard",
  DIRECTOR_DASHBOARD: "/api/mobile/director/dashboard",
  PLATFORM_DASHBOARD: "/api/mobile/platform/dashboard",
  ATTENDANCE_BULK: "/api/attendance/bulk",
  SCHEDULE: "/api/tenant/schedule",
  GRADES: "/api/grades",
  HOMEWORK: "/api/homework",
};
