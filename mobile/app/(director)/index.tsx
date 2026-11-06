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

interface DirectorDashboardData {
  success: boolean;
  center: {
    id: string;
    name: string;
    status: string;
  };
  kpis: {
    activeStudentsCount: number;
    activeTeachersCount: number;
    activeGroupsCount: number;
    totalRevenue: number;
    pendingPaymentsCount: number;
    averageAttendancePercent: number;
    riskCount: number;
  };
  atRiskStudents: Array<{
    membershipId: string;
    fullName: string;
    phone: string | null;
    attendancePercent: number;
    missedCount: number;
  }>;
}

export default function DirectorDashboard() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { logout } = useAuthStore();
  const [data, setData] = useState<DirectorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await apiClient<DirectorDashboardData>(API_ENDPOINTS.DIRECTOR_DASHBOARD);
      setData(res);
    } catch (err) {
      console.warn("Failed to load director dashboard:", err);
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
          <View className="flex-row items-center gap-2">
            <Text className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
              {data?.center.name || "e-darschi"}
            </Text>
            <View className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40">
              <Text className="text-[10px] font-bold text-emerald-400">
                {data?.center.status || "ACTIVE"}
              </Text>
            </View>
          </View>
          <Text className="text-xl font-black text-white mt-0.5">
            {t("roles.director")}
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
          <Text className="text-xs text-slate-400 font-medium">{t("director.activeStudents")}</Text>
          <Text className="text-2xl font-black text-white mt-1">
            {kpis?.activeStudentsCount ?? 0}
          </Text>
        </View>

        <View className="w-[48%] p-4 rounded-2xl bg-slate-800 border border-slate-700/60">
          <Text className="text-xs text-slate-400 font-medium">{t("director.activeGroups")}</Text>
          <Text className="text-2xl font-black text-white mt-1">
            {kpis?.activeGroupsCount ?? 0}
          </Text>
        </View>

        <View className="w-[48%] p-4 rounded-2xl bg-slate-800 border border-slate-700/60">
          <Text className="text-xs text-slate-400 font-medium">{t("director.totalRevenue")}</Text>
          <Text className="text-lg font-black text-emerald-400 mt-1">
            {(kpis?.totalRevenue || 0).toLocaleString()} UZS
          </Text>
        </View>

        <View className="w-[48%] p-4 rounded-2xl bg-slate-800 border border-slate-700/60">
          <Text className="text-xs text-slate-400 font-medium">{t("director.avgAttendance")}</Text>
          <Text className="text-2xl font-black text-indigo-400 mt-1">
            {kpis?.averageAttendancePercent ?? 100}%
          </Text>
        </View>
      </View>

      {/* Risk List Section */}
      <View className="mb-12">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-base font-bold text-white">{t("director.atRiskTitle")}</Text>
          <View className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40">
            <Text className="text-[10px] font-bold text-rose-400">{kpis?.riskCount || 0}</Text>
          </View>
        </View>

        {data?.atRiskStudents && data.atRiskStudents.length > 0 ? (
          data.atRiskStudents.map((st) => (
            <View
              key={st.membershipId}
              className="p-4 mb-2.5 rounded-xl bg-slate-800/80 border border-rose-500/30 flex-row items-center justify-between"
            >
              <View className="flex-1 mr-2">
                <Text className="text-sm font-bold text-white">{st.fullName}</Text>
                <Text className="text-xs text-slate-400 mt-0.5">
                  {t("director.missedClasses", { count: st.missedCount })}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-sm font-extrabold text-rose-400">
                  {st.attendancePercent}%
                </Text>
                {st.phone && (
                  <Text className="text-[10px] text-slate-400 mt-0.5">{st.phone}</Text>
                )}
              </View>
            </View>
          ))
        ) : (
          <Text className="text-xs text-slate-500 italic">{t("director.noAtRisk")}</Text>
        )}
      </View>
    </ScrollView>
  );
}
