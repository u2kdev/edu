import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../src/store/auth-store";
import { resolveRoleRoute } from "../../src/navigation/role-router";
import { registerForPushNotifications } from "../../src/services/notifications";

export default function LoginScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { login, error } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return;

    setIsSubmitting(true);
    const success = await login(
      email.trim(),
      password,
      Platform.OS === "ios" ? "iPhone Mobile" : "Android Mobile"
    );
    setIsSubmitting(false);

    if (success) {
      // Register for push notifications in background
      registerForPushNotifications().catch(() => {});

      const activeRole = useAuthStore.getState().activeRole;
      const targetRoute = resolveRoleRoute(activeRole);
      router.replace(targetRoute as any);
    }
  };

  const toggleLanguage = () => {
    const nextLang = i18n.language === "ru" ? "uz" : "ru";
    i18n.changeLanguage(nextLang);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-slate-900"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        className="px-6 py-12 justify-center"
      >
        {/* Language Pill */}
        <View className="items-end mb-6">
          <TouchableOpacity
            onPress={toggleLanguage}
            className="px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700"
          >
            <Text className="text-xs font-semibold text-indigo-400">
              {i18n.language === "ru" ? "🇺🇿 O'zbekcha" : "🇷🇺 Русский"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Brand Header */}
        <View className="items-center mb-8">
          <View className="w-16 h-16 rounded-2xl bg-indigo-600 items-center justify-center shadow-lg shadow-indigo-500/30 mb-4">
            <Text className="text-white text-2xl font-black">eD</Text>
          </View>
          <Text className="text-2xl font-extrabold text-white text-center">
            {t("auth.title")}
          </Text>
          <Text className="text-sm text-slate-400 text-center mt-1">
            {t("auth.subtitle")}
          </Text>
        </View>

        {/* Error Alert */}
        {error && (
          <View className="mb-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30">
            <Text className="text-sm text-rose-400 text-center">{error}</Text>
          </View>
        )}

        {/* Input Fields */}
        <View className="space-y-4">
          <View>
            <Text className="text-xs font-semibold text-slate-300 mb-1.5 ml-1">
              {t("auth.emailLabel")}
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={t("auth.emailPlaceholder")}
              placeholderTextColor="#64748B"
              className="w-full h-12 px-4 rounded-xl bg-slate-800 border border-slate-700 text-white text-base focus:border-indigo-500"
            />
          </View>

          <View className="mt-3">
            <Text className="text-xs font-semibold text-slate-300 mb-1.5 ml-1">
              {t("auth.passwordLabel")}
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholder={t("auth.passwordPlaceholder")}
              placeholderTextColor="#64748B"
              className="w-full h-12 px-4 rounded-xl bg-slate-800 border border-slate-700 text-white text-base focus:border-indigo-500"
            />
          </View>

          {/* Login Button */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={isSubmitting || !email || !password}
            className={`w-full h-12 rounded-xl mt-6 items-center justify-center shadow-lg ${
              isSubmitting || !email || !password
                ? "bg-indigo-600/50"
                : "bg-indigo-600 active:bg-indigo-700 shadow-indigo-600/30"
            }`}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-white font-bold text-base">
                {t("auth.loginButton")}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
