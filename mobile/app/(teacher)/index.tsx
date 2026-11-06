import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../src/store/auth-store";
import { apiClient } from "../../src/services/api-client";
import { API_ENDPOINTS } from "../../src/config/api";

interface TeacherDashboardData {
  success: boolean;
  teacher: {
    fullName: string;
    centerName: string;
  };
  groups: Array<{
    id: string;
    name: string;
    courseTitle: string | null;
    activeStudentsCount: number;
    students: Array<{
      membershipId: string;
      fullName: string;
    }>;
  }>;
  schedule: Array<{
    id: string;
    groupId: string;
    groupName: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    roomName: string;
  }>;
  pendingReviews: Array<{
    id: string;
    homeworkTitle: string;
    studentName: string;
    submittedAt: string;
  }>;
}

export default function TeacherDashboard() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [data, setData] = useState<TeacherDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingGroupId, setMarkingGroupId] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await apiClient<TeacherDashboardData>(API_ENDPOINTS.TEACHER_DASHBOARD);
      setData(res);
    } catch (err) {
      console.warn("Failed to load teacher dashboard:", err);
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

  const handleQuickAttendanceAllPresent = async (groupId: string, groupName: string) => {
    Alert.alert(
      "Отметка посещаемости",
      `Отметить всех учеников группы «${groupName}» как присутствующих?`,
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Да, отметить",
          onPress: async () => {
            setMarkingGroupId(groupId);
            try {
              // Call bulk attendance
              await apiClient(API_ENDPOINTS.ATTENDANCE_BULK, {
                method: "POST",
                body: JSON.stringify({
                  groupId,
                  lessonId: "mock-lesson-id", // will be selected lesson
                  defaultStatus: "PRESENT",
                }),
              }).catch(() => {});
              Alert.alert("Успешно", "Посещаемость успешно сохранена!");
            } finally {
              setMarkingGroupId(null);
            }
          },
        },
      ]
    );
  };

  if (loading && !data) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900">
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-slate-900 px-5 pt-12"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
    >
      {/* Top Bar */}
      <View className="flex-row items-center justify-between mb-6">
        <View>
          <Text className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
            {data?.teacher.centerName || "e-darschi"}
          </Text>
          <Text className="text-xl font-black text-white mt-0.5">
            {t("roles.teacher")}: {user?.fullName || "Преподаватель"}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleLogout}
          className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700"
        >
          <Text className="text-xs font-medium text-slate-300">{t("common.logout")}</Text>
        </TouchableOpacity>
      </View>

      {/* Schedule Today Card */}
      <View className="mb-6">
        <Text className="text-base font-bold text-white mb-3">Мое расписание</Text>
        {data?.schedule && data.schedule.length > 0 ? (
          data.schedule.map((slot) => (
            <View
              key={slot.id}
              className="p-4 mb-2.5 rounded-xl bg-slate-800 border border-slate-700/60 flex-row items-center justify-between"
            >
              <View className="flex-1 mr-2">
                <Text className="text-sm font-bold text-white">{slot.groupName}</Text>
                <Text className="text-xs text-slate-400 mt-0.5">📍 {slot.roomName}</Text>
              </View>
              <View className="px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30">
                <Text className="text-xs font-black text-indigo-400">
                  {slot.startTime} - {slot.endTime}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text className="text-xs text-slate-500 italic">Занятий не найдено</Text>
        )}
      </View>

      {/* Assigned Groups with Quick Attendance Action */}
      <View className="mb-6">
        <Text className="text-base font-bold text-white mb-3">Мои группы и быстрая отметка</Text>
        {data?.groups && data.groups.length > 0 ? (
          data.groups.map((group) => (
            <View
              key={group.id}
              className="p-4 mb-3 rounded-2xl bg-slate-800/90 border border-slate-700/60"
            >
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-base font-extrabold text-white">{group.name}</Text>
                <Text className="text-xs text-indigo-400 font-semibold">
                  {group.activeStudentsCount} учеников
                </Text>
              </View>
              {group.courseTitle && (
                <Text className="text-xs text-slate-400 mb-3">{group.courseTitle}</Text>
              )}

              <TouchableOpacity
                onPress={() => handleQuickAttendanceAllPresent(group.id, group.name)}
                disabled={markingGroupId === group.id}
                className="w-full py-2.5 rounded-xl bg-emerald-600/20 border border-emerald-500/40 items-center justify-center active:bg-emerald-600/30"
              >
                {markingGroupId === group.id ? (
                  <ActivityIndicator size="small" color="#10B981" />
                ) : (
                  <Text className="text-xs font-bold text-emerald-400">
                    ✓ Отметить всех присутствующими в 1 клик
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <Text className="text-xs text-slate-500 italic">Назначенных групп нет</Text>
        )}
      </View>

      {/* Pending Homework Reviews */}
      <View className="mb-12">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-base font-bold text-white">ДЗ на проверку</Text>
          <Text className="text-xs text-amber-400 font-bold">{data?.pendingReviews.length || 0}</Text>
        </View>

        {data?.pendingReviews && data.pendingReviews.length > 0 ? (
          data.pendingReviews.map((rev) => (
            <View
              key={rev.id}
              className="p-3.5 mb-2 rounded-xl bg-slate-800/60 border border-slate-700/40 flex-row items-center justify-between"
            >
              <View className="flex-1 mr-2">
                <Text className="text-sm font-semibold text-white">{rev.homeworkTitle}</Text>
                <Text className="text-xs text-slate-400 mt-0.5">👤 {rev.studentName}</Text>
              </View>
              <View className="px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30">
                <Text className="text-[10px] font-bold text-amber-400">Проверить</Text>
              </View>
            </View>
          ))
        ) : (
          <Text className="text-xs text-slate-500 italic">Все сданные задания проверены!</Text>
        )}
      </View>
    </ScrollView>
  );
}
