import { Platform } from "react-native";

/**
 * API configuration for e-darschi mobile client.
 * In development:
 * - Android Emulator uses 10.0.2.2 to access host machine.
 * - iOS Simulator uses localhost.
 * - Real devices can define EXPO_PUBLIC_API_URL in .env.
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000");

export const API_ENDPOINTS = {
  LOGIN: "/api/auth/mobile/login",
  LOGOUT: "/api/auth/logout",
  REGISTER_PUSH_TOKEN: "/api/mobile/push-token/register",
  UNREGISTER_PUSH_TOKEN: "/api/mobile/push-token/unregister",
  STUDENT_DASHBOARD: "/api/mobile/student/dashboard",
  PARENT_DASHBOARD: "/api/mobile/parent/dashboard",
  SCHEDULE: "/api/tenant/schedule",
  GRADES: "/api/grades",
  HOMEWORK: "/api/homework",
};
