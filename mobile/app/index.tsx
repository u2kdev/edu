import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../src/store/auth-store";
import { resolveRoleRoute } from "../src/navigation/role-router";

export default function IndexScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading, activeRole } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace("/(auth)/login");
    } else {
      const targetRoute = resolveRoleRoute(activeRole);
      router.replace(targetRoute as any);
    }
  }, [isAuthenticated, isLoading, activeRole, router]);

  return (
    <View className="flex-1 items-center justify-center bg-slate-900">
      <ActivityIndicator size="large" color="#6366F1" />
    </View>
  );
}
