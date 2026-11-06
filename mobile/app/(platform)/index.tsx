import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../src/store/auth-store";
import { apiClient } from "../../src/services/api-client";
import { API_ENDPOINTS } from "../../src/config/api";

interface PlatformDashboardData {
  success: boolean;
  admin: {
    fullName: string;
    email: string;
    systemRole: string;
  };
  kpis: {
    totalCenters: number;
    activeCenters: number;
    totalUsers: number;
    totalStudents: number;
    openTicketsCount: number;
  };
  centers: Array<{
    id: string;
    name: string;
    status: string;
    ownerName: string;
    membersCount: number;
    groupsCount: number;
  }>;
}

export default function PlatformDashboard() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { logout } = useAuthStore();
  const [data, setData] = useState<PlatformDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await apiClient<PlatformDashboardData>(API_ENDPOINTS.PLATFORM_DASHBOARD);
      setData(res);
    } catch (err) {
      console.warn("Failed to load platform dashboard:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === "ru" ? "uz" : "ru");
  };

  if (loading && !data) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900">
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  const kpis = data?.kpis;

  return (
    <ScrollView
      className="flex-1 bg-slate-900 px-5 pt-12"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
    >
      {/* Top Bar */}
      <View className="flex-row items-center justify-between mb-6">
        <View className="flex-1 mr-3">
          <Text className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
            {data?.admin.systemRole || "SUPERADMIN"}
          </Text>
          <Text className="text-xl font-black text-white mt-0.5">
            {t("platform.title")}
          </Text>
        </View>

        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={toggleLanguage}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700"
          >
            <Text className="text-xs font-bold text-indigo-400">
              {i18n.language === "ru" ? "UZ" : "RU"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleLogout}
            className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700"
          >
            <Text className="text-xs font-medium text-slate-300">{t("common.logout")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* KPI Grid */}
      <View className="flex-row flex-wrap gap-3 mb-6">
        <View className="w-[48%] p-4 rounded-2xl bg-slate-800 border border-slate-700/60">
          <Text className="text-xs text-slate-400 font-medium">{t("platform.activeCenters")}</Text>
          <Text className="text-2xl font-black text-emerald-400 mt-1">
            {kpis?.activeCenters ?? 0} / {kpis?.totalCenters ?? 0}
          </Text>
        </View>

        <View className="w-[48%] p-4 rounded-2xl bg-slate-800 border border-slate-700/60">
          <Text className="text-xs text-slate-400 font-medium">{t("platform.totalUsers")}</Text>
          <Text className="text-2xl font-black text-white mt-1">
            {kpis?.totalUsers ?? 0}
          </Text>
        </View>

        <View className="w-[48%] p-4 rounded-2xl bg-slate-800 border border-slate-700/60">
          <Text className="text-xs text-slate-400 font-medium">{t("platform.totalStudents")}</Text>
          <Text className="text-2xl font-black text-indigo-400 mt-1">
            {kpis?.totalStudents ?? 0}
          </Text>
        </View>

        <View className="w-[48%] p-4 rounded-2xl bg-slate-800 border border-slate-700/60">
          <Text className="text-xs text-slate-400 font-medium">{t("platform.openTickets")}</Text>
          <Text className="text-2xl font-black text-amber-400 mt-1">
            {kpis?.openTicketsCount ?? 0}
          </Text>
        </View>
      </View>

      {/* Centers List */}
      <View className="mb-12">
        <Text className="text-base font-bold text-white mb-3">{t("platform.centersList")}</Text>
        {data?.centers && data.centers.length > 0 ? (
          data.centers.map((center) => (
            <View
              key={center.id}
              className="p-4 mb-2.5 rounded-2xl bg-slate-800 border border-slate-700/60"
            >
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-base font-extrabold text-white flex-1 mr-2">
                  {center.name}
                </Text>
                <View className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40">
                  <Text className="text-[10px] font-bold text-emerald-400">{center.status}</Text>
                </View>
              </View>
              <Text className="text-xs text-slate-400">
                👤 {t("platform.owner")}: {center.ownerName}
              </Text>
              <View className="flex-row items-center gap-4 mt-2 pt-2 border-t border-slate-700/50">
                <Text className="text-xs text-indigo-400 font-semibold">
                  👥 {center.membersCount}
                </Text>
                <Text className="text-xs text-slate-300 font-semibold">
                  📚 {center.groupsCount}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text className="text-xs text-slate-500 italic">—</Text>
        )}
      </View>
    </ScrollView>
  );
}
