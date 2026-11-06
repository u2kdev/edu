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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Globe,
  ArrowRight,
  Sparkles,
  ChevronRight,
} from "lucide-react-native";
import { useAuthStore } from "../../src/store/auth-store";
import { resolveRoleRoute } from "../../src/navigation/role-router";
import { registerForPushNotifications } from "../../src/services/notifications";
import { DEMO_ROLE_PRESETS } from "../../src/components/ui";

export default function LoginScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login, error } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeDemoEmail, setActiveDemoEmail] = useState<string | null>(null);

  const performLogin = async (loginEmail: string, loginPassword: string) => {
    if (!loginEmail || !loginPassword) return;

    setIsSubmitting(true);
    const success = await login(
      loginEmail.trim(),
      loginPassword,
      Platform.OS === "ios" ? "iPhone Mobile" : "Android Mobile"
    );
    setIsSubmitting(false);
    setActiveDemoEmail(null);

    if (success) {
      registerForPushNotifications().catch(() => {});

      const activeRole = useAuthStore.getState().activeRole;
      const targetRoute = resolveRoleRoute(activeRole);
      router.replace(targetRoute as any);
    }
  };

  const handleLogin = () => performLogin(email, password);

  const handleInstantDemoLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("Password123!");
    setActiveDemoEmail(demoEmail);
    performLogin(demoEmail, "Password123!");
  };

  const toggleLanguage = () => {
    const nextLang = i18n.language === "ru" ? "uz" : "ru";
    i18n.changeLanguage(nextLang);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-slate-950"
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: Math.max(insets.top, 20) + 8,
          paddingBottom: Math.max(insets.bottom, 24) + 12,
        }}
        keyboardShouldPersistTaps="handled"
        className="px-6"
      >
        {/* Top Bar with Language Pill */}
        <View className="flex-row items-center justify-between mb-6">
          <View className="flex-row items-center">
            <View className="w-9 h-9 rounded-xl bg-indigo-600 items-center justify-center mr-2.5">
              <Text className="text-white text-sm font-black">eD</Text>
            </View>
            <Text className="text-base font-extrabold text-white tracking-tight">
              e-darschi
            </Text>
          </View>

          <TouchableOpacity
            onPress={toggleLanguage}
            activeOpacity={0.75}
            className="flex-row items-center px-3.5 py-2 rounded-full bg-slate-900 border border-slate-800"
          >
            <Globe size={14} color="#818CF8" />
            <Text className="text-xs font-bold text-indigo-300 ml-1.5">
              {i18n.language === "ru" ? "O'zbekcha" : "Русский"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Hero Welcome */}
        <View className="mb-6">
          <Text className="text-2xl font-black text-white">
            {t("auth.title")}
          </Text>
          <Text className="text-sm text-slate-400 mt-1">
            {t("auth.subtitle")}
          </Text>
        </View>

        {/* Error Alert */}
        {error && (
          <View className="mb-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30">
            <Text className="text-xs font-semibold text-rose-400 text-center">
              {error}
            </Text>
          </View>
        )}

        {/* Login Form Card */}
        <View className="p-5 rounded-3xl bg-slate-900 border border-slate-800/90 mb-6">
          {/* Email Input */}
          <View className="mb-4">
            <Text className="text-xs font-bold text-slate-300 mb-2 ml-1">
              {t("auth.emailLabel")}
            </Text>
            <View className="w-full h-13 px-4 rounded-2xl bg-slate-950 border border-slate-800 flex-row items-center">
              <Mail size={18} color="#64748B" />
              <TextInput
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={t("auth.emailPlaceholder")}
                placeholderTextColor="#475569"
                className="flex-1 h-12 ml-3 text-white text-sm"
              />
            </View>
          </View>

          {/* Password Input */}
          <View className="mb-5">
            <Text className="text-xs font-bold text-slate-300 mb-2 ml-1">
              {t("auth.passwordLabel")}
            </Text>
            <View className="w-full h-13 px-4 rounded-2xl bg-slate-950 border border-slate-800 flex-row items-center">
              <Lock size={18} color="#64748B" />
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                placeholder={t("auth.passwordPlaceholder")}
                placeholderTextColor="#475569"
                className="flex-1 h-12 ml-3 text-white text-sm"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                className="p-1.5"
              >
                {showPassword ? (
                  <EyeOff size={18} color="#94A3B8" />
                ) : (
                  <Eye size={18} color="#64748B" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={isSubmitting || !email || !password}
            activeOpacity={0.85}
            className={`w-full h-13 py-3.5 rounded-2xl flex-row items-center justify-center ${
              isSubmitting || !email || !password
                ? "bg-indigo-600/40"
                : "bg-indigo-600"
            }`}
          >
            {isSubmitting && !activeDemoEmail ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text className="text-white font-extrabold text-sm mr-2">
                  {t("auth.loginButton")}
                </Text>
                <ArrowRight size={17} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* 1-Tap Instant Demo Roles */}
        <View>
          <View className="flex-row items-center mb-1.5">
            <Sparkles size={14} color="#818CF8" />
            <Text className="text-xs font-extrabold text-indigo-300 uppercase tracking-wider ml-1.5">
              {t("auth.quickDemoAccounts")}
            </Text>
          </View>
          <Text className="text-xs text-slate-500 mb-3">
            {t("auth.quickDemoHint")}
          </Text>

          {DEMO_ROLE_PRESETS.map((acc) => {
            const IconComponent = acc.Icon;
            const isLoggingInThis = activeDemoEmail === acc.email && isSubmitting;
            return (
              <TouchableOpacity
                key={acc.email}
                disabled={isSubmitting}
                activeOpacity={0.8}
                onPress={() => handleInstantDemoLogin(acc.email)}
                className="p-3.5 mb-2.5 rounded-2xl bg-slate-900 border border-slate-800/90 flex-row items-center justify-between"
              >
                <View className="flex-row items-center flex-1 mr-3">
                  <View
                    style={{ backgroundColor: `${acc.color}20` }}
                    className="w-11 h-11 rounded-2xl items-center justify-center mr-3.5"
                  >
                    <IconComponent size={20} color={acc.color} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-extrabold text-white">
                      {t(acc.roleKey)}
                    </Text>
                    <Text className="text-xs text-slate-400 mt-0.5" numberOfLines={1}>
                      {acc.subtitle}
                    </Text>
                  </View>
                </View>

                {isLoggingInThis ? (
                  <ActivityIndicator size="small" color={acc.color} />
                ) : (
                  <View className="w-8 h-8 rounded-xl bg-slate-800 items-center justify-center">
                    <ChevronRight size={16} color="#94A3B8" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
