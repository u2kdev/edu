import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Globe,
  LogOut,
  Building2,
  GraduationCap,
  BookOpen,
  Briefcase,
  Users,
  ShieldCheck,
  ChevronRight,
  Check,
  Trash2,
  Shield,
  FileText,
  Info,
} from "lucide-react-native";
import { apiClient } from "../services/api-client";
import { API_ENDPOINTS } from "../config/api";
import { useAuthStore } from "../store/auth-store";
import { resolveRoleRoute } from "../navigation/role-router";
import { DevRoleSwitcher } from "./dev-quick-login";

export interface TabItem {
  key: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
  badge?: number;
}

export function getInitials(name?: string | null): string {
  if (!name) return "ED";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

interface AppHeaderProps {
  title: string;
  subtitle: string;
  accentColor?: string;
  onAvatarPress?: () => void;
}

export function AppHeader({
  title,
  subtitle,
  accentColor = "#6366F1",
  onAvatarPress,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === "ru" ? "uz" : "ru");
  };

  return (
    <View
      style={{ paddingTop: Math.max(insets.top, 16) + 8 }}
      className="px-5 pb-4 bg-slate-900/95 border-b border-slate-800/80 flex-row items-center justify-between"
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onAvatarPress}
        className="flex-row items-center flex-1 mr-3"
      >
        <View
          style={{ backgroundColor: `${accentColor}22`, borderColor: `${accentColor}66` }}
          className="w-11 h-11 rounded-2xl border items-center justify-center mr-3"
        >
          <Text style={{ color: accentColor }} className="text-sm font-black">
            {getInitials(title)}
          </Text>
        </View>
        <View className="flex-1">
          <View className="flex-row items-center">
            <Building2 size={12} color={accentColor} />
            <Text
              style={{ color: accentColor }}
              className="text-[11px] font-bold uppercase tracking-wider ml-1"
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          </View>
          <Text className="text-lg font-extrabold text-white mt-0.5" numberOfLines={1}>
            {title}
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={toggleLanguage}
        activeOpacity={0.75}
        className="flex-row items-center px-3 py-2 rounded-xl bg-slate-800 border border-slate-700/80"
      >
        <Globe size={14} color="#818CF8" />
        <Text className="text-xs font-extrabold text-indigo-300 ml-1.5">
          {i18n.language === "ru" ? "RU" : "UZ"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

interface BottomTabBarProps {
  tabs: TabItem[];
  activeTab: string;
  onSelect: (key: string) => void;
  accentColor?: string;
}

export function BottomTabBar({
  tabs,
  activeTab,
  onSelect,
  accentColor = "#6366F1",
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{ paddingBottom: Math.max(insets.bottom, 10) }}
      className="bg-slate-900 border-t border-slate-800 px-3 pt-2 flex-row items-center justify-around"
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        const IconComponent = tab.icon;
        return (
          <TouchableOpacity
            key={tab.key}
            activeOpacity={0.75}
            onPress={() => onSelect(tab.key)}
            className="flex-1 items-center justify-center py-1.5 relative"
          >
            <View
              style={
                isActive
                  ? { backgroundColor: `${accentColor}20` }
                  : undefined
              }
              className="px-4 py-1.5 rounded-2xl items-center justify-center relative"
            >
              <IconComponent
                size={20}
                color={isActive ? accentColor : "#64748B"}
                strokeWidth={isActive ? 2.4 : 1.9}
              />
              {tab.badge !== undefined && tab.badge > 0 && (
                <View className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 items-center justify-center border border-slate-900">
                  <Text className="text-[10px] font-black text-white">
                    {tab.badge > 99 ? "99+" : tab.badge}
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={{ color: isActive ? "#FFFFFF" : "#64748B" }}
              className={`text-[11px] mt-1 ${isActive ? "font-extrabold" : "font-medium"}`}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

interface ProgressBarProps {
  value: number;
  color?: string;
}

export function ProgressBar({ value, color = "#10B981" }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value || 0));
  return (
    <View className="w-full h-2 rounded-full bg-slate-700/60 overflow-hidden mt-2">
      <View
        style={{ width: `${clamped}%`, backgroundColor: color }}
        className="h-full rounded-full"
      />
    </View>
  );
}

interface ProfileViewProps {
  centerName?: string;
  roleLabel: string;
  accentColor?: string;
}

export function ProfileAndSettingsView({
  centerName,
  roleLabel,
  accentColor = "#6366F1",
}: ProfileViewProps) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user, activeRole, login, logout } = useAuthStore();
  const [switchingEmail, setSwitchingEmail] = useState<string | null>(null);

  const handleQuickRoleSwitch = async (demoEmail: string) => {
    setSwitchingEmail(demoEmail);
    try {
      const ok = await login(
        demoEmail,
        "Password123!",
        Platform.OS === "ios" ? "iPhone Mobile" : "Android Mobile"
      );
      if (ok) {
        const nextRole = useAuthStore.getState().activeRole;
        router.replace(resolveRoleRoute(nextRole) as any);
      }
    } finally {
      setSwitchingEmail(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  return (
    <View className="pb-10">
      {/* User Identity Card */}
      <View className="p-5 rounded-3xl bg-slate-800/90 border border-slate-700/70 mb-5">
        <View className="flex-row items-center">
          <View
            style={{ backgroundColor: `${accentColor}25`, borderColor: `${accentColor}66` }}
            className="w-16 h-16 rounded-2xl border items-center justify-center mr-4"
          >
            <Text style={{ color: accentColor }} className="text-xl font-black">
              {getInitials(user?.fullName)}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-lg font-black text-white">{user?.fullName || "e-darschi"}</Text>
            <Text className="text-xs text-slate-400 mt-0.5">{user?.email}</Text>
            <View className="flex-row items-center mt-2">
              <View
                style={{ backgroundColor: `${accentColor}20`, borderColor: `${accentColor}50` }}
                className="px-2.5 py-0.5 rounded-full border mr-2"
              >
                <Text style={{ color: accentColor }} className="text-[11px] font-bold">
                  {roleLabel}
                </Text>
              </View>
              {centerName && (
                <Text className="text-xs text-slate-400 font-medium" numberOfLines={1}>
                  • {centerName}
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Language Selector */}
      <View className="p-4 rounded-3xl bg-slate-800/70 border border-slate-700/50 mb-5">
        <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          {t("common.language")}
        </Text>
        <View className="flex-row gap-3">
          {[
            { code: "ru", label: "🇷🇺 Русский" },
            { code: "uz", label: "🇺🇿 O'zbekcha" },
          ].map((lang) => {
            const active = i18n.language === lang.code;
            return (
              <TouchableOpacity
                key={lang.code}
                onPress={() => i18n.changeLanguage(lang.code)}
                className={`flex-1 py-3 px-4 rounded-2xl border flex-row items-center justify-between ${
                  active
                    ? "bg-indigo-600/20 border-indigo-500"
                    : "bg-slate-900/60 border-slate-700/70"
                }`}
              >
                <Text className={`text-sm font-bold ${active ? "text-white" : "text-slate-400"}`}>
                  {lang.label}
                </Text>
                {active && <Check size={16} color="#818CF8" />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {__DEV__ && (
        <DevRoleSwitcher
          userEmail={user?.email}
          activeRole={activeRole}
          onSwitch={handleQuickRoleSwitch}
          switchingEmail={switchingEmail}
        />
      )}

      {/* Privacy Policy & Data Disclosure */}
      <View className="p-4 rounded-3xl bg-slate-800/70 border border-slate-700/50 mb-5">
        <View className="flex-row items-center mb-3">
          <Shield size={16} color="#818CF8" />
          <Text className="text-xs font-bold text-slate-300 uppercase tracking-wider ml-2">
            Безопасность и данные (App Store / Play)
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => Linking.openURL("https://edarschi.uz/privacy").catch(() => {})}
          className="p-3 mb-3 rounded-2xl bg-slate-900/80 border border-slate-700/60 flex-row items-center justify-between"
        >
          <View className="flex-row items-center">
            <FileText size={16} color="#A5B4FC" />
            <Text className="text-xs font-semibold text-indigo-300 ml-2.5">
              Политика конфиденциальности
            </Text>
          </View>
          <ChevronRight size={16} color="#64748B" />
        </TouchableOpacity>

        <View className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 mb-2">
          <Text className="text-[11px] font-bold text-slate-300 mb-1">
            Собираемые данные приложения:
          </Text>
          <Text className="text-[10px] text-slate-400 leading-4">
            • Профиль: ФИО, email, статус учетной записи\n
            • Устройства: Push-токен и ОС (для уведомлений)\n
            • Безопасность: IP-адрес и user-agent сессий
          </Text>
        </View>

        <View className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-900/60">
          <View className="flex-row items-center mb-1">
            <Info size={13} color="#818CF8" />
            <Text className="text-[11px] font-bold text-indigo-200 ml-1.5">
              Данные несовершеннолетних (детей):
            </Text>
          </View>
          <Text className="text-[10px] text-indigo-300/80 leading-4">
            Хранятся исключительно учебные записи (оценки, посещаемость, сданные ДЗ) с привязкой к родителю. Рекламный трекинг (IDFA/GAID), геолокация и передача третьим лицам строго отсутствуют.
          </Text>
        </View>
      </View>

      {/* Delete Account (App Store Mandatory Requirement) */}
      <View className="p-4 rounded-3xl bg-rose-950/20 border border-rose-900/40 mb-5">
        <Text className="text-xs font-bold text-rose-300 uppercase tracking-wider mb-1">
          Удаление аккаунта
        </Text>
        <Text className="text-[11px] text-rose-400/80 mb-3">
          Безвозвратная деактивация профиля и немедленный отзыв всех активных сессий
        </Text>

        <TouchableOpacity
          onPress={() => {
            Alert.alert(
              "Удаление аккаунта",
              "Вы уверены, что хотите деактивировать аккаунт? Все ваши активные сессии будут немедленно отозваны.",
              [
                { text: "Отмена", style: "cancel" },
                {
                  text: "Удалить",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await apiClient(API_ENDPOINTS.DELETE_ACCOUNT, { method: "DELETE" });
                    } catch {}
                    await handleLogout();
                  },
                },
              ]
            );
          }}
          activeOpacity={0.8}
          className="w-full py-3.5 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex-row items-center justify-center"
        >
          <Trash2 size={16} color="#FB7185" />
          <Text className="text-xs font-bold text-rose-300 ml-2">Удалить мой аккаунт</Text>
        </TouchableOpacity>
      </View>

      {/* Logout Button */}
      <TouchableOpacity
        onPress={handleLogout}
        activeOpacity={0.8}
        className="w-full py-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex-row items-center justify-center"
      >
        <LogOut size={18} color="#FB7185" />
        <Text className="text-sm font-bold text-rose-400 ml-2">{t("common.logout")}</Text>
      </TouchableOpacity>
    </View>
  );
}
