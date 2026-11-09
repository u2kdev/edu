import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import {
  Sparkles,
  ChevronRight,
  GraduationCap,
  BookOpen,
  Briefcase,
  Users,
  ShieldCheck,
} from "lucide-react-native";

export const DEV_DEMO_PRESETS = [
  {
    key: "STUDENT",
    roleKey: "roles.student",
    email: "c1-student13@example.com",
    subtitle: "Кабинет ученика • ДЗ и оценки",
    color: "#6366F1",
    Icon: GraduationCap,
  },
  {
    key: "TEACHER",
    roleKey: "roles.teacher",
    email: "c1-teacher1@example.com",
    subtitle: "Журнал групп • Проверка ДЗ",
    color: "#10B981",
    Icon: BookOpen,
  },
  {
    key: "DIRECTOR",
    roleKey: "roles.director",
    email: "director1@example.com",
    subtitle: "Аналитика • Финансы • Риски",
    color: "#F59E0B",
    Icon: Briefcase,
  },
  {
    key: "PARENT",
    roleKey: "roles.parent",
    email: "c1-parent12@example.com",
    subtitle: "Контроль ребенка • Оплаты",
    color: "#EC4899",
    Icon: Users,
  },
  {
    key: "SUPERADMIN",
    roleKey: "roles.admin",
    email: "admin@platform.com",
    subtitle: "Управление всеми центрами",
    color: "#06B6D4",
    Icon: ShieldCheck,
  },
];

export const DEV_DEFAULT_PASSWORD = "MobilePass123!";

export interface DevQuickLoginProps {
  onSelect: (email: string, password: string) => void;
  activeEmail: string | null;
}

export function DevQuickLogin({ onSelect, activeEmail }: DevQuickLoginProps) {
  const { t } = useTranslation();

  if (!__DEV__) {
    return null;
  }

  return (
    <View className="mt-2">
      <View className="flex-row items-center mb-1.5">
        <Sparkles size={14} color="#A5B4FC" />
        <Text className="text-xs font-bold text-indigo-300 ml-1.5">
          {t("auth.quickDemoTitle")} [DEV ONLY]
        </Text>
      </View>
      <Text className="text-[11px] text-slate-500 mb-3">
        {t("auth.quickDemoHint")}
      </Text>
      {DEV_DEMO_PRESETS.map((preset) => {
        const isLoading = activeEmail === preset.email;
        const IconComp = preset.Icon;
        return (
          <TouchableOpacity
            key={preset.email}
            disabled={!!activeEmail}
            onPress={() => onSelect(preset.email, DEV_DEFAULT_PASSWORD)}
            activeOpacity={0.8}
            className="p-3 mb-2 rounded-2xl bg-slate-900 border border-slate-800 flex-row items-center justify-between"
          >
            <View className="flex-row items-center flex-1 mr-2">
              <View
                style={{ backgroundColor: `${preset.color}20` }}
                className="w-9 h-9 rounded-xl items-center justify-center mr-3"
              >
                <IconComp size={17} color={preset.color} />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-white">{t(preset.roleKey)}</Text>
                <Text className="text-[10px] text-slate-400 mt-0.5">{preset.subtitle}</Text>
              </View>
            </View>
            {isLoading ? (
              <ActivityIndicator size="small" color={preset.color} />
            ) : (
              <ChevronRight size={16} color="#64748B" />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export interface DevRoleSwitcherProps {
  userEmail?: string;
  activeRole?: string | null;
  onSwitch: (email: string, password: string) => void;
  switchingEmail: string | null;
}

export function DevRoleSwitcher({
  userEmail,
  activeRole,
  onSwitch,
  switchingEmail,
}: DevRoleSwitcherProps) {
  const { t } = useTranslation();

  if (!__DEV__) {
    return null;
  }

  return (
    <View className="p-4 rounded-3xl bg-slate-800/70 border border-slate-700/50 mb-5">
      <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
        {t("common.switchRole")} [DEV ONLY]
      </Text>
      <Text className="text-[11px] text-slate-500 mb-3">
        {t("auth.quickDemoHint")}
      </Text>
      {DEV_DEMO_PRESETS.map((preset) => {
        const isCurrent = activeRole === preset.key || userEmail === preset.email;
        const isLoading = switchingEmail === preset.email;
        const IconComp = preset.Icon;
        return (
          <TouchableOpacity
            key={preset.email}
            disabled={isCurrent || !!switchingEmail}
            onPress={() => onSwitch(preset.email, DEV_DEFAULT_PASSWORD)}
            className={`p-3.5 mb-2 rounded-2xl border flex-row items-center justify-between ${
              isCurrent
                ? "bg-indigo-600/15 border-indigo-500/60"
                : "bg-slate-900/70 border-slate-700/60"
            }`}
          >
            <View className="flex-row items-center flex-1 mr-2">
              <View
                style={{ backgroundColor: `${preset.color}20` }}
                className="w-10 h-10 rounded-xl items-center justify-center mr-3"
              >
                <IconComp size={18} color={preset.color} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-white">{t(preset.roleKey)}</Text>
                <Text className="text-[11px] text-slate-400 mt-0.5">{preset.email}</Text>
              </View>
            </View>

            {isLoading ? (
              <ActivityIndicator size="small" color={preset.color} />
            ) : isCurrent ? (
              <View className="px-2.5 py-1 rounded-full bg-indigo-500/20">
                <Text className="text-[10px] font-bold text-indigo-300">Активен</Text>
              </View>
            ) : (
              <ChevronRight size={18} color="#64748B" />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
