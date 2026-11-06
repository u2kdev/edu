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
import { useTranslation } from "react-i18next";
import {
  Home,
  Calendar,
  BookOpenCheck,
  Award,
  Clock,
  MapPin,
  User as UserIcon,
  CheckCircle2,
  Send,
  MessageSquare,
  ChevronRight,
  X,
} from "lucide-react-native";
import { useAuthStore } from "../../src/store/auth-store";
import { apiClient } from "../../src/services/api-client";
import { API_ENDPOINTS } from "../../src/config/api";
import {
  AppHeader,
  BottomTabBar,
  ProgressBar,
  ProfileAndSettingsView,
  TabItem,
} from "../../src/components/ui";

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
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Navigation & Filters
  const [activeTab, setActiveTab] = useState<string>("today");
  const [selectedDay, setSelectedDay] = useState<number>(0); // 0 = All
  const [hwFilter, setHwFilter] = useState<"ALL" | "PENDING" | "GRADED">("ALL");

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
      <View className="flex-1 items-center justify-center bg-slate-950">
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  const nextClass = data?.upcomingSchedule[0];
  const pendingHwCount =
    data?.activeHomework.filter((h) => h.status === "ASSIGNED").length || 0;

  const tabs: TabItem[] = [
    { key: "today", label: t("tabs.today"), icon: Home },
    { key: "schedule", label: t("tabs.schedule"), icon: Calendar },
    {
      key: "homework",
      label: t("tabs.homework"),
      icon: BookOpenCheck,
      badge: pendingHwCount,
    },
    { key: "profile", label: t("tabs.profile"), icon: Award },
  ];

  const filteredSchedule = (data?.upcomingSchedule || []).filter((slot) =>
    selectedDay === 0 ? true : slot.dayOfWeek === selectedDay
  );

  const filteredHomework = (data?.activeHomework || []).filter((hw) => {
    if (hwFilter === "PENDING") return hw.status === "ASSIGNED" || hw.status === "SUBMITTED";
    if (hwFilter === "GRADED") return hw.status === "REVIEWED" || hw.status === "ACCEPTED" || hw.grade !== null;
    return true;
  });

  return (
    <View className="flex-1 bg-slate-950">
      <AppHeader
        title={user?.fullName || data?.student.fullName || t("roles.student")}
        subtitle={data?.student.centerName || "e-darschi"}
        accentColor="#6366F1"
        onAvatarPress={() => setActiveTab("profile")}
      />

      <ScrollView
        className="flex-1 px-5 pt-5"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
        }
      >
        {/* TAB 1: TODAY / OVERVIEW */}
        {activeTab === "today" && (
          <View className="pb-10">
            {/* Next Class Hero Card */}
            <View className="mb-5 p-5 rounded-3xl bg-indigo-950/60 border border-indigo-500/40">
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center">
                  <Clock size={14} color="#818CF8" />
                  <Text className="text-xs font-extrabold text-indigo-300 uppercase tracking-wider ml-1.5">
                    {t("student.nextClass")}
                  </Text>
                </View>
                {nextClass && (
                  <View className="px-3 py-1 rounded-full bg-indigo-500/25 border border-indigo-400/40">
                    <Text className="text-xs font-black text-indigo-200">
                      {nextClass.startTime} – {nextClass.endTime}
                    </Text>
                  </View>
                )}
              </View>

              {nextClass ? (
                <>
                  <Text className="text-xl font-black text-white mb-3">
                    {nextClass.groupName}
                  </Text>
                  <View className="flex-row items-center justify-between pt-3 border-t border-indigo-500/20">
                    <View className="flex-row items-center">
                      <MapPin size={14} color="#94A3B8" />
                      <Text className="text-xs font-semibold text-slate-300 ml-1.5">
                        {nextClass.roomName}
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <UserIcon size={14} color="#94A3B8" />
                      <Text className="text-xs font-semibold text-slate-300 ml-1.5">
                        {nextClass.teacherName}
                      </Text>
                    </View>
                  </View>
                </>
              ) : (
                <Text className="text-sm text-slate-400">
                  {t("student.noUpcomingClasses")}
                </Text>
              )}
            </View>

            {/* Metric Cards with Progress Bars */}
            <View className="flex-row gap-3 mb-6">
              <View className="flex-1 p-4 rounded-3xl bg-slate-900 border border-slate-800">
                <Text className="text-xs text-slate-400 font-semibold">
                  {t("student.attendance")}
                </Text>
                <Text className="text-2xl font-black text-emerald-400 mt-1">
                  {data?.metrics.attendancePercent ?? 100}%
                </Text>
                <ProgressBar
                  value={data?.metrics.attendancePercent ?? 100}
                  color="#10B981"
                />
                <Text className="text-[11px] text-slate-500 mt-2">
                  {data?.metrics.presentCount ?? 0} / {data?.metrics.totalClasses ?? 0} уроков
                </Text>
              </View>

              <View className="flex-1 p-4 rounded-3xl bg-slate-900 border border-slate-800">
                <Text className="text-xs text-slate-400 font-semibold">
                  {t("student.averageScore")}
                </Text>
                <Text className="text-2xl font-black text-indigo-400 mt-1">
                  {data?.metrics.averageScore ?? "—"}
                </Text>
                <ProgressBar
                  value={data?.metrics.averageScore ?? 0}
                  color="#6366F1"
                />
                <Text className="text-[11px] text-slate-500 mt-2">из 100 баллов</Text>
              </View>
            </View>

            {/* Homework Preview Section */}
            <View className="mb-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-base font-extrabold text-white">
                  {t("student.homeworkDue")}
                </Text>
                <TouchableOpacity onPress={() => setActiveTab("homework")}>
                  <Text className="text-xs font-bold text-indigo-400">
                    Все ({data?.activeHomework.length || 0}) →
                  </Text>
                </TouchableOpacity>
              </View>

              {data?.activeHomework && data.activeHomework.length > 0 ? (
                data.activeHomework.slice(0, 3).map((hw) => (
                  <TouchableOpacity
                    key={hw.id}
                    onPress={() => openHomeworkModal(hw)}
                    activeOpacity={0.8}
                    className="p-4 mb-2.5 rounded-2xl bg-slate-900 border border-slate-800 flex-row items-center justify-between"
                  >
                    <View className="flex-1 mr-3">
                      <Text className="text-sm font-extrabold text-white">
                        {hw.title}
                      </Text>
                      <Text className="text-xs text-slate-400 mt-0.5">
                        {hw.lessonTitle}
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <View
                        className={`px-2.5 py-1 rounded-xl mr-2 ${
                          hw.grade !== null
                            ? "bg-emerald-500/15 border border-emerald-500/30"
                            : hw.status === "SUBMITTED"
                            ? "bg-amber-500/15 border border-amber-500/30"
                            : "bg-indigo-500/15 border border-indigo-500/30"
                        }`}
                      >
                        <Text
                          className={`text-xs font-extrabold ${
                            hw.grade !== null
                              ? "text-emerald-400"
                              : hw.status === "SUBMITTED"
                              ? "text-amber-400"
                              : "text-indigo-300"
                          }`}
                        >
                          {hw.grade !== null ? `${hw.grade}/100` : hw.status}
                        </Text>
                      </View>
                      <ChevronRight size={16} color="#64748B" />
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 items-center">
                  <CheckCircle2 size={24} color="#10B981" />
                  <Text className="text-xs text-slate-400 mt-2">
                    {t("student.noHomework")}
                  </Text>
                </View>
              )}
            </View>

            {/* Recent Grades Preview */}
            <View>
              <Text className="text-base font-extrabold text-white mb-3">
                {t("tabs.grades")}
              </Text>
              {data?.recentGrades && data.recentGrades.length > 0 ? (
                data.recentGrades.slice(0, 4).map((g) => (
                  <View
                    key={g.id}
                    className="p-4 mb-2 rounded-2xl bg-slate-900 border border-slate-800 flex-row items-center justify-between"
                  >
                    <View className="flex-row items-center flex-1 mr-3">
                      <View className="w-9 h-9 rounded-xl bg-indigo-500/15 items-center justify-center mr-3">
                        <Award size={18} color="#818CF8" />
                      </View>
                      <Text className="text-sm font-bold text-slate-200 flex-1">
                        {g.lessonTitle || t("tabs.grades")}
                      </Text>
                    </View>
                    <View className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30">
                      <Text className="text-sm font-black text-emerald-400">
                        {g.score}/{g.maxScore}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text className="text-xs text-slate-500 italic">
                  {t("student.noGrades")}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* TAB 2: SCHEDULE WITH DAY FILTER */}
        {activeTab === "schedule" && (
          <View className="pb-10">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-5"
            >
              {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                const isSelected = selectedDay === day;
                const label = day === 0 ? t("days.all") : t(`days.${day}`);
                return (
                  <TouchableOpacity
                    key={day}
                    onPress={() => setSelectedDay(day)}
                    className={`mr-2 px-4 py-2.5 rounded-2xl border ${
                      isSelected
                        ? "bg-indigo-600 border-indigo-500"
                        : "bg-slate-900 border-slate-800"
                    }`}
                  >
                    <Text
                      className={`text-xs font-extrabold ${
                        isSelected ? "text-white" : "text-slate-400"
                      }`}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {filteredSchedule.length > 0 ? (
              filteredSchedule.map((slot) => (
                <View
                  key={slot.id}
                  className="p-4 mb-3 rounded-3xl bg-slate-900 border border-slate-800 flex-row items-center"
                >
                  <View className="px-3 py-2.5 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 items-center justify-center mr-4">
                    <Text className="text-xs font-black text-indigo-300">
                      {slot.startTime}
                    </Text>
                    <Text className="text-[10px] font-semibold text-indigo-400/80 mt-0.5">
                      {slot.endTime}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-extrabold text-white">
                      {slot.groupName}
                    </Text>
                    <View className="flex-row items-center mt-1.5">
                      <MapPin size={13} color="#94A3B8" />
                      <Text className="text-xs text-slate-400 ml-1 mr-3">
                        {slot.roomName}
                      </Text>
                      <UserIcon size={13} color="#94A3B8" />
                      <Text className="text-xs text-slate-400 ml-1">
                        {slot.teacherName}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <View className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 items-center">
                <Calendar size={28} color="#64748B" />
                <Text className="text-sm font-bold text-slate-400 mt-3">
                  {t("student.noUpcomingClasses")}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* TAB 3: HOMEWORK WORKSPACE */}
        {activeTab === "homework" && (
          <View className="pb-10">
            {/* Segmented Filter */}
            <View className="flex-row p-1 rounded-2xl bg-slate-900 border border-slate-800 mb-5">
              {[
                { key: "ALL", label: t("student.filterAll") },
                { key: "PENDING", label: t("student.filterPending") },
                { key: "GRADED", label: t("student.filterGraded") },
              ].map((tab) => {
                const active = hwFilter === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    onPress={() => setHwFilter(tab.key as any)}
                    className={`flex-1 py-2.5 rounded-xl items-center ${
                      active ? "bg-indigo-600" : ""
                    }`}
                  >
                    <Text
                      className={`text-xs font-extrabold ${
                        active ? "text-white" : "text-slate-400"
                      }`}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {filteredHomework.length > 0 ? (
              filteredHomework.map((hw) => (
                <TouchableOpacity
                  key={hw.id}
                  onPress={() => openHomeworkModal(hw)}
                  activeOpacity={0.85}
                  className="p-5 mb-3 rounded-3xl bg-slate-900 border border-slate-800"
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-base font-extrabold text-white flex-1 mr-2">
                      {hw.title}
                    </Text>
                    <View
                      className={`px-3 py-1 rounded-full ${
                        hw.grade !== null
                          ? "bg-emerald-500/15 border border-emerald-500/40"
                          : hw.status === "SUBMITTED"
                          ? "bg-amber-500/15 border border-amber-500/40"
                          : "bg-indigo-500/15 border border-indigo-500/40"
                      }`}
                    >
                      <Text
                        className={`text-xs font-extrabold ${
                          hw.grade !== null
                            ? "text-emerald-400"
                            : hw.status === "SUBMITTED"
                            ? "text-amber-400"
                            : "text-indigo-300"
                        }`}
                      >
                        {hw.grade !== null ? `${hw.grade} / 100` : hw.status}
                      </Text>
                    </View>
                  </View>

                  <Text className="text-xs text-slate-400">{hw.lessonTitle}</Text>

                  {hw.description && (
                    <Text className="text-xs text-slate-300 mt-2">
                      {hw.description}
                    </Text>
                  )}

                  {hw.feedback && (
                    <View className="mt-3 p-3 rounded-2xl bg-slate-950 border border-slate-800 flex-row items-start">
                      <MessageSquare size={14} color="#818CF8" />
                      <Text className="text-xs text-slate-300 ml-2 flex-1">
                        {t("student.teacherFeedback")}: {hw.feedback}
                      </Text>
                    </View>
                  )}

                  <View className="mt-4 pt-3 border-t border-slate-800 flex-row items-center justify-between">
                    <Text className="text-xs text-slate-500">
                      {hw.dueDate
                        ? `Срок: ${new Date(hw.dueDate).toLocaleDateString()}`
                        : ""}
                    </Text>
                    <View className="flex-row items-center">
                      <Send size={13} color="#818CF8" />
                      <Text className="text-xs font-extrabold text-indigo-400 ml-1.5">
                        {hw.submissionText
                          ? t("student.updateSubmission")
                          : t("student.submitHomework")}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 items-center">
                <BookOpenCheck size={28} color="#64748B" />
                <Text className="text-sm font-bold text-slate-400 mt-3">
                  {t("student.noHomework")}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* TAB 4: PROFILE & SETTINGS */}
        {activeTab === "profile" && (
          <ProfileAndSettingsView
            centerName={data?.student.centerName}
            roleLabel={t("roles.student")}
            accentColor="#6366F1"
          />
        )}
      </ScrollView>

      <BottomTabBar
        tabs={tabs}
        activeTab={activeTab}
        onSelect={setActiveTab}
        accentColor="#6366F1"
      />

      {/* Homework Submission Bottom Sheet Modal */}
      <Modal
        visible={!!selectedHomework}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedHomework(null)}
      >
        <View className="flex-1 bg-black/75 justify-end">
          <View className="bg-slate-900 border-t border-slate-800 rounded-t-3xl p-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-black text-white flex-1 mr-2">
                {t("student.homeworkModalTitle")}
              </Text>
              <TouchableOpacity
                onPress={() => setSelectedHomework(null)}
                className="w-9 h-9 rounded-full bg-slate-800 items-center justify-center"
              >
                <X size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {selectedHomework && (
              <>
                <Text className="text-sm font-extrabold text-indigo-400 mb-1">
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
                  className="w-full min-h-[120px] p-4 rounded-2xl bg-slate-950 border border-slate-800 text-white text-sm mb-4"
                  style={{ textAlignVertical: "top" }}
                />

                <TouchableOpacity
                  onPress={handleSubmitHomework}
                  disabled={submittingHw || !submissionText.trim()}
                  className={`w-full py-4 rounded-2xl flex-row items-center justify-center ${
                    submittingHw || !submissionText.trim()
                      ? "bg-indigo-600/40"
                      : "bg-indigo-600"
                  }`}
                >
                  {submittingHw ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Send size={16} color="#FFFFFF" />
                      <Text className="text-white font-extrabold text-sm ml-2">
                        {t("student.submitHomework")}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
