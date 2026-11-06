import { apiClient } from "./api-client";
import { API_ENDPOINTS } from "../config/api";

function getPlatform(): { OS: string; Version: string | number } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rn = require("react-native");
    if (rn?.Platform) return rn.Platform;
  } catch {}
  return { OS: "android", Version: "14" };
}

export interface NotificationPayloadData {
  type?: string;
  url?: string;
  homeworkId?: string;
  gradeId?: string;
  childId?: string;
  [key: string]: unknown;
}

/**
 * Maps incoming push notification payload data to appropriate mobile in-app route.
 */
export function resolveNotificationRoute(
  data?: NotificationPayloadData | null,
  activeRole?: string
): string {
  if (!data) return "/";

  // 1. Direct deep link URL specified in payload
  if (typeof data.url === "string" && data.url.startsWith("/")) {
    return data.url;
  }

  // 2. Type-based routing
  switch (data.type) {
    case "HOMEWORK_ASSIGNED":
    case "LESSON_REMINDER":
      return "/(student)";

    case "GRADE_POSTED":
    case "ATTENDANCE_MISSED":
      return activeRole === "PARENT" ? "/(parent)" : "/(student)";

    case "PAYMENT_CONFIRMED":
    case "PAYMENT_DUE":
      return activeRole === "PARENT" ? "/(parent)" : "/(director)";

    case "SUBMISSION_RECEIVED":
      return "/(teacher)";

    case "RISK_ALERT":
    case "NEW_ENROLLMENT":
      return "/(director)";

    default:
      if (activeRole === "STUDENT") return "/(student)";
      if (activeRole === "PARENT") return "/(parent)";
      if (activeRole === "TEACHER") return "/(teacher)";
      if (activeRole === "DIRECTOR") return "/(director)";
      return "/";
  }
}

/**
 * Configure foreground notification display behavior.
 */
export async function configureNotificationHandler(): Promise<void> {
  try {
    const Notifications = await import("expo-notifications");
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch {
    // In headless / non-Expo environments (e.g. unit tests) gracefully ignore
  }
}

/**
 * Request permissions and obtain device push token, registering with LMS backend.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    const Notifications = await import("expo-notifications");
    const Constants = (await import("expo-constants")).default;
    const Platform = getPlatform();

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#4F46E5",
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      return null;
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const pushToken = tokenResponse.data;

    // Send token to e-darschi backend
    await apiClient(API_ENDPOINTS.REGISTER_PUSH_TOKEN, {
      method: "POST",
      body: JSON.stringify({
        pushToken,
        platform: Platform.OS === "ios" ? "ios" : "android",
        deviceInfo: `${Platform.OS} ${Platform.Version}`,
      }),
    });

    return pushToken;
  } catch (error) {
    console.warn("Could not register for push notifications:", error);
    return null;
  }
}

/**
 * Unregisters device push token upon logout.
 */
export async function unregisterPushNotifications(pushToken: string): Promise<void> {
  try {
    await apiClient(API_ENDPOINTS.UNREGISTER_PUSH_TOKEN, {
      method: "POST",
      body: JSON.stringify({ pushToken }),
    });
  } catch (err) {
    console.warn("Failed to unregister push token:", err);
  }
}
