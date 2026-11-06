import React, { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAuthStore } from "../src/store/auth-store";
import { configureNotificationHandler, resolveNotificationRoute } from "../src/services/notifications";
import "../src/i18n";
import "../global.css";

export default function RootLayout() {
  const router = useRouter();
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const activeRole = useAuthStore((state) => state.activeRole);

  useEffect(() => {
    restoreSession();
    configureNotificationHandler();

    // Listen to user tapping a push notification
    let subscription: { remove: () => void } | null = null;
    (async () => {
      try {
        const Notifications = await import("expo-notifications");
        subscription = Notifications.addNotificationResponseReceivedListener((response) => {
          const data = response?.notification?.request?.content?.data;
          const targetRoute = resolveNotificationRoute(data, activeRole || undefined);
          if (targetRoute && targetRoute !== "/") {
            router.push(targetRoute as any);
          }
        });
      } catch {
        // Ignored in non-native / test environments
      }
    })();

    return () => {
      if (subscription && typeof subscription.remove === "function") {
        subscription.remove();
      }
    };
  }, [restoreSession, activeRole, router]);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0F172A" },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)/login" options={{ animation: "fade" }} />
        <Stack.Screen name="(student)" />
        <Stack.Screen name="(parent)" />
        <Stack.Screen name="(teacher)" />
        <Stack.Screen name="(director)" />
        <Stack.Screen name="(platform)" />
      </Stack>
    </SafeAreaProvider>
  );
}
