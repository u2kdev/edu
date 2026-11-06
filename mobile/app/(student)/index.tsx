import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../src/store/auth-store";
import { apiClient } from "../../src/services/api-client";
import { API_ENDPOINTS } from "../../src/config/api";

interface HomeworkItem {
  id: string;
  title: string;
  description: string | null;
  lessonTitle: string;
  dueDate: string | null;
  status: string;
  submissionText: string | null;
  grade: number | null;
  feedback: string | null;
}

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
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    roomName: string;
  }>;
  activeHomework: HomeworkItem[];
  recentGrades: Array<{
    id: string;
    score: number;
    maxScore: number;
    lessonTitle: string | null;
  }>;
}

export default function StudentDashboard() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Homework Submission Modal State
  const [selectedHomework, setSelectedHomework] = useState<HomeworkItem | null>(null);
  const [submissionText, setSubmissionText] = useState("");
  const [submittingHw, setSubmittingHw] = useState(false);

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

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === "ru" ? "uz" : "ru");
  };

  const openHomeworkModal = (hw: HomeworkItem) => {
    setSelectedHomework(hw);
    setSubmissionText(hw.submissionText || "");
  };

  const handleSubmitHomework = async () => {
    if (!selectedHomework || !submissionText.trim()) return;
    setSubmittingHw(true);
    try {
      await apiClient(API_ENDPOINTS.HOMEWORK, {
        method: "PATCH",
        body: JSON.stringify({
          action: "SUBMIT",
          homeworkId: selectedHomework.id,
          submissionText: submissionText.trim(),
        }),
      });
      setSelectedHomework(null);
      Alert.alert("✓", t("student.homeworkSuccess"));
      fetchDashboard();
    } catch (err: any) {
      Alert.alert(t("common.error"), err?.message || "Failed to submit homework");
    } finally {
      setSubmittingHw(false);
    }
  };

  if (loading && !data) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900">
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  const nextClass = data?.upcomingSchedule[0];

  return (
    <>
      <ScrollView
        className="flex-1 bg-slate-900 px-5 pt-12"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
      >
        {/* Top Bar */}
        <View className="flex-row items-center justify-between mb-6">
          <View className="flex-1 mr-3">
            <Text className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
              {data?.student.centerName || "e-darschi"}
            </Text>
            <Text className="text-xl font-black text-white mt-0.5" numberOfLines={1}>
              {t("student.welcome", { name: user?.fullName || data?.student.fullName || "Ученик" })}
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

        {/* Metric Cards Row */}
        <View className="flex-row gap-3 mb-6">
          <View className="flex-1 p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60">
            <Text className="text-xs text-slate-400 font-medium">{t("student.attendance")}</Text>
            <Text className="text-2xl font-black text-emerald-400 mt-1">
              {data?.metrics.attendancePercent ?? 100}%
            </Text>
            <Text className="text-[10px] text-slate-500 mt-0.5">
              {data?.metrics.presentCount ?? 0}/{data?.metrics.totalClasses ?? 0}
            </Text>
          </View>

          <View className="flex-1 p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60">
            <Text className="text-xs text-slate-400 font-medium">{t("student.averageScore")}</Text>
            <Text className="text-2xl font-black text-indigo-400 mt-1">
              {data?.metrics.averageScore !== null && data?.metrics.averageScore !== undefined
                ? data.metrics.averageScore
                : "—"}
            </Text>
            <Text className="text-[10px] text-slate-500 mt-0.5">/ 100</Text>
          </View>
        </View>

        {/* Next Class Hero Card */}
        <View className="mb-6 p-5 rounded-2xl bg-slate-800 border border-indigo-500/30">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xs font-bold text-indigo-300 uppercase tracking-wide">
              {t("student.nextClass")}
            </Text>
            {nextClass && (
              <View className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30">
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

        {/* Full Schedule Section */}
        {data?.upcomingSchedule && data.upcomingSchedule.length > 1 && (
          <View className="mb-6">
            <Text className="text-base font-bold text-white mb-3">{t("tabs.schedule")}</Text>
            {data.upcomingSchedule.map((slot) => (
              <View
                key={slot.id}
                className="p-3.5 mb-2 rounded-xl bg-slate-800/70 border border-slate-700/50 flex-row items-center justify-between"
              >
                <View className="flex-1 mr-2">
                  <Text className="text-sm font-bold text-white">{slot.groupName}</Text>
                  <Text className="text-xs text-slate-400 mt-0.5">
                    📍 {slot.roomName} • 👤 {slot.teacherName}
                  </Text>
                </View>
                <View className="px-2.5 py-1 rounded-lg bg-slate-700/80">
                  <Text className="text-xs font-bold text-indigo-300">
                    {slot.startTime} - {slot.endTime}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Active Homework (Interactive) */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-base font-bold text-white">{t("student.homeworkDue")}</Text>
            <Text className="text-xs text-indigo-400 font-bold">{data?.activeHomework.length || 0}</Text>
          </View>

          {data?.activeHomework && data.activeHomework.length > 0 ? (
            data.activeHomework.map((hw) => (
              <TouchableOpacity
                key={hw.id}
                onPress={() => openHomeworkModal(hw)}
                activeOpacity={0.8}
                className="p-4 mb-2.5 rounded-2xl bg-slate-800 border border-slate-700/60"
              >
                <View className="flex-row items-center justify-between mb-1.5">
                  <Text className="text-sm font-bold text-white flex-1 mr-2">{hw.title}</Text>
                  <View
                    className={`px-2.5 py-0.5 rounded-lg ${
                      hw.status === "REVIEWED" || hw.status === "ACCEPTED"
                        ? "bg-emerald-500/10 border border-emerald-500/30"
                        : hw.status === "SUBMITTED"
                        ? "bg-amber-500/10 border border-amber-500/30"
                        : "bg-indigo-500/10 border border-indigo-500/30"
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-bold ${
                        hw.status === "REVIEWED" || hw.status === "ACCEPTED"
                          ? "text-emerald-400"
                          : hw.status === "SUBMITTED"
                          ? "text-amber-400"
                          : "text-indigo-400"
                      }`}
                    >
                      {hw.grade !== null ? `${hw.grade}/100` : hw.status}
                    </Text>
                  </View>
                </View>

                <Text className="text-xs text-slate-400">{hw.lessonTitle}</Text>

                {hw.feedback && (
                  <View className="mt-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/50">
                    <Text className="text-[11px] text-slate-300">
                      💬 {t("student.teacherFeedback")}: {hw.feedback}
                    </Text>
                  </View>
                )}

                <View className="mt-3 pt-2.5 border-t border-slate-700/50 flex-row items-center justify-between">
                  <Text className="text-[11px] text-slate-400">
                    {hw.dueDate ? `📅 ${new Date(hw.dueDate).toLocaleDateString()}` : ""}
                  </Text>
                  <Text className="text-xs font-bold text-indigo-400">
                    {hw.submissionText ? `✎ ${t("student.updateSubmission")}` : `→ ${t("student.submitHomework")}`}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text className="text-xs text-slate-500 italic">{t("student.noHomework")}</Text>
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
                  {g.lessonTitle || t("tabs.grades")}
                </Text>
                <View className="px-3 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30">
                  <Text className="text-sm font-black text-indigo-400">
                    {g.score}/{g.maxScore}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text className="text-xs text-slate-500 italic">{t("student.noGrades")}</Text>
          )}
        </View>
      </ScrollView>

      {/* Homework Submission Modal */}
      <Modal
        visible={!!selectedHomework}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedHomework(null)}
      >
        <View className="flex-1 bg-black/70 justify-end">
          <View className="bg-slate-900 border-t border-slate-700 rounded-t-3xl p-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-extrabold text-white flex-1 mr-2">
                {t("student.homeworkModalTitle")}
              </Text>
              <TouchableOpacity
                onPress={() => setSelectedHomework(null)}
                className="px-3 py-1 rounded-lg bg-slate-800"
              >
                <Text className="text-xs font-bold text-slate-400">{t("common.close")}</Text>
              </TouchableOpacity>
            </View>

            {selectedHomework && (
              <>
                <Text className="text-sm font-bold text-indigo-400 mb-1">
                  {selectedHomework.title}
                </Text>
                {selectedHomework.description && (
                  <Text className="text-xs text-slate-300 mb-4">
                    {selectedHomework.description}
                  </Text>
                )}

                <TextInput
                  value={submissionText}
                  onChangeText={setSubmissionText}
                  multiline
                  numberOfLines={4}
                  placeholder={t("student.homeworkPlaceholder")}
                  placeholderTextColor="#64748B"
                  className="w-full min-h-[110px] p-4 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm mb-4"
                  style={{ textAlignVertical: "top" }}
                />

                <TouchableOpacity
                  onPress={handleSubmitHomework}
                  disabled={submittingHw || !submissionText.trim()}
                  className={`w-full h-12 rounded-xl items-center justify-center ${
                    submittingHw || !submissionText.trim()
                      ? "bg-indigo-600/40"
                      : "bg-indigo-600"
                  }`}
                >
                  {submittingHw ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text className="text-white font-bold text-sm">
                      {t("student.submitHomework")}
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}
