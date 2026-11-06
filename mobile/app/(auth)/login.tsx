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

const DEMO_ACCOUNTS = [
  { roleKey: "roles.student", email: "c1-student13@example.com", icon: "🎓" },
  { roleKey: "roles.teacher", email: "c1-teacher1@example.com", icon: "👨‍🏫" },
  { roleKey: "roles.director", email: "director1@example.com", icon: "🏢" },
  { roleKey: "roles.parent", email: "c1-parent12@example.com", icon: "👪" },
  { roleKey: "roles.admin", email: "admin@platform.com", icon: "⚡" },
];

export default function LoginScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { login, error } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const performLogin = async (loginEmail: string, loginPassword: string) => {
    if (!loginEmail || !loginPassword) return;

    setIsSubmitting(true);
    const success = await login(
      loginEmail.trim(),
      loginPassword,
      Platform.OS === "ios" ? "iPhone Mobile" : "Android Mobile"
    );
    setIsSubmitting(false);

    if (success) {
      registerForPushNotifications().catch(() => {});

      const activeRole = useAuthStore.getState().activeRole;
      const targetRoute = resolveRoleRoute(activeRole);
      router.replace(targetRoute as any);
    }
  };

  const handleLogin = () => performLogin(email, password);

  const handleSelectDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("Password123!");
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
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        keyboardShouldPersistTaps="handled"
        className="px-6 py-10"
      >
        {/* Language Pill */}
        <View className="items-end mb-6">
          <TouchableOpacity
            onPress={toggleLanguage}
            className="px-3.5 py-1.5 rounded-full bg-slate-800 border border-slate-700"
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

        {/* Quick Demo Role Selector */}
        <View className="mt-8 pt-6 border-t border-slate-800">
          <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 text-center">
            {t("auth.quickDemoAccounts")}
          </Text>
          <View className="flex-row flex-wrap justify-center gap-2">
            {DEMO_ACCOUNTS.map((acc) => {
              const isSelected = email === acc.email;
              return (
                <TouchableOpacity
                  key={acc.email}
                  onPress={() => handleSelectDemo(acc.email)}
                  className={`px-3 py-2 rounded-xl border ${
                    isSelected
                      ? "bg-indigo-600/20 border-indigo-500"
                      : "bg-slate-800/80 border-slate-700/80"
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      isSelected ? "text-indigo-300" : "text-slate-300"
                    }`}
                  >
                    {acc.icon} {t(acc.roleKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
