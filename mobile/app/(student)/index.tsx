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

interface StudentDashboardData {
  success: boolean;
  student: {
    fullName: string;
    centerName: string;
  };
  metrics: {
    attendancePercent: number;
    totalClasses: number;
    presentCount: number;
    averageScore: number | null;
  };
  upcomingSchedule: Array<{
    id: string;
    groupName: string;
    teacherName: string;
    startTime: string;
    endTime: string;
    roomName: string;
  }>;
  activeHomework: Array<{
    id: string;
    title: string;
    lessonTitle: string;
    dueDate: string | null;
    status: string;
    grade: number | null;
  }>;
  recentGrades: Array<{
    id: string;
    score: number;
    maxScore: number;
    lessonTitle: string | null;
  }>;
}

export default function StudentDashboard() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await apiClient<StudentDashboardData>(API_ENDPOINTS.STUDENT_DASHBOARD);
      setData(res);
    } catch (err) {
      console.warn("Failed to load student dashboard:", err);
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

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900">
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  const nextClass = data?.upcomingSchedule[0];

  return (
    <ScrollView
      className="flex-1 bg-slate-900 px-5 pt-12"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
    >
      {/* Top Bar */}
      <View className="flex-row items-center justify-between mb-6">
        <View>
          <Text className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
            {data?.student.centerName || "e-darschi"}
          </Text>
          <Text className="text-xl font-black text-white mt-0.5">
            {t("student.welcome", { name: user?.fullName || "Ученик" })}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleLogout}
          className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700"
        >
          <Text className="text-xs font-medium text-slate-300">{t("common.logout")}</Text>
        </TouchableOpacity>
      </View>

      {/* Metric Cards Row */}
      <View className="flex-row gap-3 mb-6">
        <View className="flex-1 p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60">
          <Text className="text-xs text-slate-400 font-medium">{t("student.attendance")}</Text>
          <Text className="text-2xl font-black text-emerald-400 mt-1">
            {data?.metrics.attendancePercent ?? 100}%
          </Text>
          <Text className="text-[10px] text-slate-500 mt-0.5">
            {data?.metrics.presentCount}/{data?.metrics.totalClasses} занятий
          </Text>
        </View>

        <View className="flex-1 p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60">
          <Text className="text-xs text-slate-400 font-medium">{t("student.averageScore")}</Text>
          <Text className="text-2xl font-black text-indigo-400 mt-1">
            {data?.metrics.averageScore !== null && data?.metrics.averageScore !== undefined
              ? data.metrics.averageScore
              : "—"}
          </Text>
          <Text className="text-[10px] text-slate-500 mt-0.5">из 100 баллов</Text>
        </View>
      </View>

      {/* Next Class Hero Card */}
      <View className="mb-6 p-5 rounded-2xl bg-gradient-to-br from-indigo-900/40 to-slate-800 border border-indigo-500/30">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-xs font-bold text-indigo-300 uppercase tracking-wide">
            {t("student.nextClass")}
          </Text>
          {nextClass && (
            <View className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30">
              <Text className="text-[10px] font-bold text-indigo-300">
                {nextClass.startTime} - {nextClass.endTime}
              </Text>
            </View>
          )}
        </View>

        {nextClass ? (
          <>
            <Text className="text-lg font-extrabold text-white">{nextClass.groupName}</Text>
            <View className="flex-row items-center gap-4 mt-3">
              <Text className="text-xs text-slate-300 font-medium">
                📍 {nextClass.roomName}
              </Text>
              <Text className="text-xs text-slate-300 font-medium">
                👤 {nextClass.teacherName}
              </Text>
            </View>
          </>
        ) : (
          <Text className="text-sm text-slate-400 mt-1">{t("student.noUpcomingClasses")}</Text>
        )}
      </View>

      {/* Active Homework */}
      <View className="mb-6">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-base font-bold text-white">{t("student.homeworkDue")}</Text>
          <Text className="text-xs text-slate-400">{data?.activeHomework.length || 0}</Text>
        </View>

        {data?.activeHomework && data.activeHomework.length > 0 ? (
          data.activeHomework.map((hw) => (
            <View
              key={hw.id}
              className="p-4 mb-2.5 rounded-xl bg-slate-800 border border-slate-700/60 flex-row items-center justify-between"
            >
              <View className="flex-1 mr-3">
                <Text className="text-sm font-bold text-white">{hw.title}</Text>
                <Text className="text-xs text-slate-400 mt-0.5">{hw.lessonTitle}</Text>
              </View>
              <View
                className={`px-2.5 py-1 rounded-lg ${
                  hw.status === "ACCEPTED"
                    ? "bg-emerald-500/10 border border-emerald-500/30"
                    : hw.status === "SUBMITTED"
                    ? "bg-amber-500/10 border border-amber-500/30"
                    : "bg-slate-700 border border-slate-600"
                }`}
              >
                <Text
                  className={`text-[11px] font-semibold ${
                    hw.status === "ACCEPTED"
                      ? "text-emerald-400"
                      : hw.status === "SUBMITTED"
                      ? "text-amber-400"
                      : "text-slate-300"
                  }`}
                >
                  {hw.status}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text className="text-xs text-slate-500 italic">Активных домашних заданий нет</Text>
        )}
      </View>

      {/* Recent Grades */}
      <View className="mb-12">
        <Text className="text-base font-bold text-white mb-3">{t("tabs.grades")}</Text>
        {data?.recentGrades && data.recentGrades.length > 0 ? (
          data.recentGrades.map((g) => (
            <View
              key={g.id}
              className="p-3.5 mb-2 rounded-xl bg-slate-800/60 border border-slate-700/40 flex-row items-center justify-between"
            >
              <Text className="text-sm text-slate-300 flex-1 mr-2">
                {g.lessonTitle || "Оценка за работу"}
              </Text>
              <View className="px-3 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30">
                <Text className="text-sm font-black text-indigo-400">
                  {g.score}/{g.maxScore}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text className="text-xs text-slate-500 italic">Оценок пока нет</Text>
        )}
      </View>
    </ScrollView>
  );
}
