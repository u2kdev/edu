import { Platform } from "react-native";
import { apiClient } from "./api-client";
import { API_ENDPOINTS } from "../config/api";

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    const Notifications = await import("expo-notifications");
    const Constants = (await import("expo-constants")).default;

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
