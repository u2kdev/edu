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

interface ChildSummary {
  membershipId: string;
  fullName: string;
  email: string;
  groups: Array<{ id: string; name: string }>;
}

interface ParentDashboardData {
  success: boolean;
  children: ChildSummary[];
  activeChild: {
    membershipId: string;
    fullName: string;
    todayStatus: string;
    metrics: {
      attendancePercent: number;
      totalClasses: number;
      presentCount: number;
      averageScore: number | null;
    };
    recentGrades: Array<{
      id: string;
      score: number;
      lessonTitle: string | null;
      notes: string | null;
    }>;
    upcomingSchedule: Array<{
      id: string;
      groupName: string;
      teacherName: string;
      startTime: string;
      endTime: string;
    }>;
    payments?: Array<{
      id: string;
      amount: number;
      currency: string;
      status: string;
      dueDate: string | null;
      paidAt: string | null;
      description: string | null;
    }>;
  } | null;
}

export default function ParentDashboard() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { logout } = useAuthStore();
  const [data, setData] = useState<ParentDashboardData | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = useCallback(async (childId?: string | null) => {
    try {
      const endpoint = childId
        ? `${API_ENDPOINTS.PARENT_DASHBOARD}?childId=${childId}`
        : API_ENDPOINTS.PARENT_DASHBOARD;
      const res = await apiClient<ParentDashboardData>(endpoint);
      setData(res);
      if (!selectedChildId && res.activeChild) {
        setSelectedChildId(res.activeChild.membershipId);
      }
    } catch (err) {
      console.warn("Failed to load parent dashboard:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedChildId]);

  useEffect(() => {
    fetchDashboard(selectedChildId);
  }, [fetchDashboard, selectedChildId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboard(selectedChildId);
  };

  const handleSelectChild = (childId: string) => {
    setSelectedChildId(childId);
    setLoading(true);
    fetchDashboard(childId);
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

  const active = data?.activeChild;

  return (
    <ScrollView
      className="flex-1 bg-slate-900 px-5 pt-12"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
    >
      {/* Top Bar */}
      <View className="flex-row items-center justify-between mb-5">
        <View className="flex-1 mr-3">
          <Text className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
            {t("roles.parent")}
          </Text>
          <Text className="text-xl font-black text-white mt-0.5">
            {t("parent.title")}
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

      {/* Child Switcher Tabs */}
      {data?.children && data.children.length > 1 && (
        <View className="mb-5">
          <Text className="text-xs font-medium text-slate-400 mb-2">{t("parent.selectChild")}:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
            {data.children.map((child) => {
              const isSelected = child.membershipId === selectedChildId;
              return (
                <TouchableOpacity
                  key={child.membershipId}
                  onPress={() => handleSelectChild(child.membershipId)}
                  className={`mr-2.5 px-4 py-2 rounded-xl border ${
                    isSelected
                      ? "bg-indigo-600 border-indigo-500 shadow-md shadow-indigo-500/30"
                      : "bg-slate-800 border-slate-700"
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      isSelected ? "text-white" : "text-slate-300"
                    }`}
                  >
                    👤 {child.fullName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {active ? (
        <>
          {/* Today Status Hero Banner */}
          <View className="mb-6 p-5 rounded-2xl bg-slate-800 border border-slate-700/60">
            <Text className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
              {t("parent.attendanceStatus")}
            </Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-black text-white flex-1 mr-2">{active.fullName}</Text>
              <View
                className={`px-3 py-1 rounded-full ${
                  active.todayStatus === "PRESENT"
                    ? "bg-emerald-500/10 border border-emerald-500/30"
                    : active.todayStatus === "LATE"
                    ? "bg-amber-500/10 border border-amber-500/30"
                    : active.todayStatus === "ABSENT"
                    ? "bg-rose-500/10 border border-rose-500/30"
                    : "bg-slate-700 border border-slate-600"
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    active.todayStatus === "PRESENT"
                      ? "text-emerald-400"
                      : active.todayStatus === "LATE"
                      ? "text-amber-400"
                      : active.todayStatus === "ABSENT"
                      ? "text-rose-400"
                      : "text-slate-400"
                  }`}
                >
                  {active.todayStatus === "PRESENT"
                    ? `✓ ${t("parent.present")}`
                    : active.todayStatus === "LATE"
                    ? `⏰ ${t("parent.late")}`
                    : active.todayStatus === "ABSENT"
                    ? `✕ ${t("parent.absent")}`
                    : t("parent.noLesson")}
                </Text>
              </View>
            </View>
          </View>

          {/* Child Metrics Row */}
          <View className="flex-row gap-3 mb-6">
            <View className="flex-1 p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60">
              <Text className="text-xs text-slate-400 font-medium">{t("student.attendance")}</Text>
              <Text className="text-2xl font-black text-emerald-400 mt-1">
                {active.metrics.attendancePercent}%
              </Text>
              <Text className="text-[10px] text-slate-500 mt-0.5">
                {active.metrics.presentCount}/{active.metrics.totalClasses}
              </Text>
            </View>

            <View className="flex-1 p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60">
              <Text className="text-xs text-slate-400 font-medium">{t("student.averageScore")}</Text>
              <Text className="text-2xl font-black text-indigo-400 mt-1">
                {active.metrics.averageScore ?? "—"}
              </Text>
              <Text className="text-[10px] text-slate-500 mt-0.5">/ 100</Text>
            </View>
          </View>

          {/* Upcoming Schedule */}
          {active.upcomingSchedule && active.upcomingSchedule.length > 0 && (
            <View className="mb-6">
              <Text className="text-base font-bold text-white mb-3">
                {t("parent.upcomingSchedule")}
              </Text>
              {active.upcomingSchedule.map((slot) => (
                <View
                  key={slot.id}
                  className="p-3.5 mb-2 rounded-xl bg-slate-800/70 border border-slate-700/50 flex-row items-center justify-between"
                >
                  <View className="flex-1 mr-2">
                    <Text className="text-sm font-bold text-white">{slot.groupName}</Text>
                    <Text className="text-xs text-slate-400 mt-0.5">👤 {slot.teacherName}</Text>
                  </View>
                  <View className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30">
                    <Text className="text-xs font-bold text-indigo-400">
                      {slot.startTime} - {slot.endTime}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Recent Grades */}
          <View className="mb-6">
            <Text className="text-base font-bold text-white mb-3">{t("parent.recentGrades")}</Text>
            {active.recentGrades && active.recentGrades.length > 0 ? (
              active.recentGrades.map((g) => (
                <View
                  key={g.id}
                  className="p-3.5 mb-2 rounded-xl bg-slate-800/60 border border-slate-700/40 flex-row items-center justify-between"
                >
                  <Text className="text-sm text-slate-300 flex-1 mr-2">
                    {g.lessonTitle || t("tabs.grades")}
                  </Text>
                  <View className="px-3 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30">
                    <Text className="text-sm font-black text-indigo-400">{g.score}</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text className="text-xs text-slate-500 italic">{t("student.noGrades")}</Text>
            )}
          </View>

          {/* Payments Section */}
          {active.payments && active.payments.length > 0 && (
            <View className="mb-12">
              <Text className="text-base font-bold text-white mb-3">{t("parent.payments")}</Text>
              {active.payments.map((p) => (
                <View
                  key={p.id}
                  className="p-4 mb-2 rounded-xl bg-slate-800 border border-slate-700/60 flex-row items-center justify-between"
                >
                  <View className="flex-1 mr-2">
                    <Text className="text-sm font-bold text-white">
                      {p.amount.toLocaleString()} {p.currency}
                    </Text>
                    <Text className="text-xs text-slate-400 mt-0.5">
                      {p.description || t("tabs.payments")}
                    </Text>
                  </View>
                  <View
                    className={`px-2.5 py-1 rounded-lg ${
                      p.status === "PAID"
                        ? "bg-emerald-500/10 border border-emerald-500/30"
                        : "bg-amber-500/10 border border-amber-500/30"
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        p.status === "PAID" ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {p.status === "PAID" ? t("parent.paid") : t("parent.pending")}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      ) : (
        <View className="p-8 items-center justify-center">
          <Text className="text-sm text-slate-400 text-center">
            {t("parent.noChildren")}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
