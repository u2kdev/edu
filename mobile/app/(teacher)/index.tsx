import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../src/store/auth-store";
import { apiClient } from "../../src/services/api-client";
import { API_ENDPOINTS } from "../../src/config/api";

interface TeacherGroup {
  id: string;
  name: string;
  courseTitle: string | null;
  latestLessonId: string | null;
  latestLessonTitle: string | null;
  lessons: Array<{ id: string; title: string }>;
  activeStudentsCount: number;
  students: Array<{
    membershipId: string;
    fullName: string;
  }>;
}

interface PendingReview {
  id: string;
  homeworkId: string;
  studentMembershipId: string;
  homeworkTitle: string;
  studentName: string;
  submissionText: string | null;
  submittedAt: string;
}

interface TeacherDashboardData {
  success: boolean;
  teacher: {
    fullName: string;
    centerName: string;
  };
  groups: TeacherGroup[];
  schedule: Array<{
    id: string;
    groupId: string;
    groupName: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    roomName: string;
  }>;
  pendingReviews: PendingReview[];
}

type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT";

export default function TeacherDashboard() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [data, setData] = useState<TeacherDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingGroupId, setMarkingGroupId] = useState<string | null>(null);

  // Per-Student Attendance Modal State
  const [attendanceGroup, setAttendanceGroup] = useState<TeacherGroup | null>(null);
  const [studentStatuses, setStudentStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [savingAttendance, setSavingAttendance] = useState(false);

  // Homework Grading Modal State
  const [selectedReview, setSelectedReview] = useState<PendingReview | null>(null);
  const [gradeValue, setGradeValue] = useState("95");
  const [feedbackValue, setFeedbackValue] = useState("");
  const [savingGrade, setSavingGrade] = useState(false);

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

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === "ru" ? "uz" : "ru");
  };

  const handleQuickAttendanceAllPresent = async (group: TeacherGroup) => {
    if (!group.latestLessonId) {
      Alert.alert(t("common.error"), "Для этой группы еще не создано ни одного урока.");
      return;
    }

    setMarkingGroupId(group.id);
    try {
      await apiClient(API_ENDPOINTS.ATTENDANCE_BULK, {
        method: "POST",
        body: JSON.stringify({
          groupId: group.id,
          lessonId: group.latestLessonId,
          defaultStatus: "PRESENT",
        }),
      });
      Alert.alert("✓", t("teacher.attendanceSaved"));
    } catch (err: any) {
      Alert.alert(t("common.error"), err?.message || "Failed to save attendance");
    } finally {
      setMarkingGroupId(null);
    }
  };

  const openAttendanceJournal = (group: TeacherGroup) => {
    const initial: Record<string, AttendanceStatus> = {};
    group.students.forEach((s) => {
      initial[s.membershipId] = "PRESENT";
    });
    setStudentStatuses(initial);
    setAttendanceGroup(group);
  };

  const cycleStudentStatus = (membershipId: string) => {
    setStudentStatuses((prev) => {
      const current = prev[membershipId] || "PRESENT";
      const next: AttendanceStatus =
        current === "PRESENT" ? "LATE" : current === "LATE" ? "ABSENT" : "PRESENT";
      return { ...prev, [membershipId]: next };
    });
  };

  const handleSaveCustomAttendance = async () => {
    if (!attendanceGroup || !attendanceGroup.latestLessonId) return;
    setSavingAttendance(true);
    try {
      const records = Object.entries(studentStatuses).map(([studentMembershipId, status]) => ({
        studentMembershipId,
        status,
      }));
      await apiClient(API_ENDPOINTS.ATTENDANCE_BULK, {
        method: "POST",
        body: JSON.stringify({
          groupId: attendanceGroup.id,
          lessonId: attendanceGroup.latestLessonId,
          defaultStatus: "PRESENT",
          records,
        }),
      });
      setAttendanceGroup(null);
      Alert.alert("✓", t("teacher.attendanceSaved"));
    } catch (err: any) {
      Alert.alert(t("common.error"), err?.message || "Failed to save attendance");
    } finally {
      setSavingAttendance(false);
    }
  };

  const openGradeModal = (rev: PendingReview) => {
    setSelectedReview(rev);
    setGradeValue("95");
    setFeedbackValue("");
  };

  const handleSaveGrade = async () => {
    if (!selectedReview) return;
    const numericGrade = Math.min(100, Math.max(0, Number(gradeValue) || 0));
    setSavingGrade(true);
    try {
      await apiClient(API_ENDPOINTS.HOMEWORK, {
        method: "PATCH",
        body: JSON.stringify({
          action: "GRADE",
          homeworkId: selectedReview.homeworkId,
          studentMembershipId: selectedReview.studentMembershipId,
          grade: numericGrade,
          feedback: feedbackValue.trim() || undefined,
        }),
      });
      setSelectedReview(null);
      Alert.alert("✓", t("teacher.gradeSaved"));
      fetchDashboard();
    } catch (err: any) {
      Alert.alert(t("common.error"), err?.message || "Failed to save grade");
    } finally {
      setSavingGrade(false);
    }
  };

  if (loading && !data) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900">
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

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
              {data?.teacher.centerName || "e-darschi"}
            </Text>
            <Text className="text-xl font-black text-white mt-0.5" numberOfLines={1}>
              {user?.fullName || data?.teacher.fullName || t("roles.teacher")}
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

        {/* Schedule Today Card */}
        <View className="mb-6">
          <Text className="text-base font-bold text-white mb-3">{t("teacher.mySchedule")}</Text>
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
            <Text className="text-xs text-slate-500 italic">{t("student.noUpcomingClasses")}</Text>
          )}
        </View>

        {/* Assigned Groups with Quick Attendance & Journal */}
        <View className="mb-6">
          <Text className="text-base font-bold text-white mb-3">{t("teacher.myGroups")}</Text>
          {data?.groups && data.groups.length > 0 ? (
            data.groups.map((group) => (
              <View
                key={group.id}
                className="p-4 mb-3 rounded-2xl bg-slate-800/90 border border-slate-700/60"
              >
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-base font-extrabold text-white">{group.name}</Text>
                  <Text className="text-xs text-indigo-400 font-semibold">
                    {t("teacher.studentsCount", { count: group.activeStudentsCount })}
                  </Text>
                </View>
                {group.courseTitle && (
                  <Text className="text-xs text-slate-400 mb-3">
                    {group.courseTitle}
                    {group.latestLessonTitle ? ` • ${group.latestLessonTitle}` : ""}
                  </Text>
                )}

                <View className="gap-2">
                  <TouchableOpacity
                    onPress={() => handleQuickAttendanceAllPresent(group)}
                    disabled={markingGroupId === group.id}
                    className="w-full py-2.5 rounded-xl bg-emerald-600/20 border border-emerald-500/40 items-center justify-center active:bg-emerald-600/30"
                  >
                    {markingGroupId === group.id ? (
                      <ActivityIndicator size="small" color="#10B981" />
                    ) : (
                      <Text className="text-xs font-bold text-emerald-400">
                        {t("teacher.quickMarkAll")}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {group.students.length > 0 && (
                    <TouchableOpacity
                      onPress={() => openAttendanceJournal(group)}
                      className="w-full py-2.5 rounded-xl bg-slate-700/60 border border-slate-600 items-center justify-center"
                    >
                      <Text className="text-xs font-bold text-slate-200">
                        {t("teacher.openAttendanceModal")}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          ) : (
            <Text className="text-xs text-slate-500 italic">—</Text>
          )}
        </View>

        {/* Pending Homework Reviews (Interactive) */}
        <View className="mb-12">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-base font-bold text-white">{t("teacher.pendingReviews")}</Text>
            <Text className="text-xs text-amber-400 font-bold">{data?.pendingReviews.length || 0}</Text>
          </View>

          {data?.pendingReviews && data.pendingReviews.length > 0 ? (
            data.pendingReviews.map((rev) => (
              <TouchableOpacity
                key={rev.id}
                onPress={() => openGradeModal(rev)}
                activeOpacity={0.8}
                className="p-4 mb-2.5 rounded-xl bg-slate-800 border border-slate-700/60 flex-row items-center justify-between"
              >
                <View className="flex-1 mr-3">
                  <Text className="text-sm font-bold text-white">{rev.homeworkTitle}</Text>
                  <Text className="text-xs text-slate-400 mt-0.5">👤 {rev.studentName}</Text>
                  {rev.submissionText && (
                    <Text className="text-xs text-slate-300 mt-1" numberOfLines={1}>
                      📝 {rev.submissionText}
                    </Text>
                  )}
                </View>
                <View className="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40">
                  <Text className="text-xs font-bold text-amber-400">
                    {t("teacher.reviewAction")}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text className="text-xs text-slate-500 italic">{t("teacher.allReviewed")}</Text>
          )}
        </View>
      </ScrollView>

      {/* Per-Student Attendance Journal Modal */}
      <Modal
        visible={!!attendanceGroup}
        animationType="slide"
        transparent
        onRequestClose={() => setAttendanceGroup(null)}
      >
        <View className="flex-1 bg-black/70 justify-end">
          <View className="bg-slate-900 border-t border-slate-700 rounded-t-3xl p-6 max-h-[80%]">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-1 mr-2">
                <Text className="text-lg font-extrabold text-white">
                  {attendanceGroup?.name}
                </Text>
                <Text className="text-xs text-slate-400">
                  {attendanceGroup?.latestLessonTitle || t("teacher.openAttendanceModal")}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setAttendanceGroup(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800"
              >
                <Text className="text-xs font-bold text-slate-400">{t("common.close")}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView className="mb-4">
              {attendanceGroup?.students.map((st) => {
                const status = studentStatuses[st.membershipId] || "PRESENT";
                return (
                  <TouchableOpacity
                    key={st.membershipId}
                    onPress={() => cycleStudentStatus(st.membershipId)}
                    className="p-3.5 mb-2 rounded-xl bg-slate-800 border border-slate-700 flex-row items-center justify-between"
                  >
                    <Text className="text-sm font-semibold text-white flex-1 mr-2">
                      {st.fullName}
                    </Text>
                    <View
                      className={`px-3 py-1 rounded-lg ${
                        status === "PRESENT"
                          ? "bg-emerald-500/20 border border-emerald-500/40"
                          : status === "LATE"
                          ? "bg-amber-500/20 border border-amber-500/40"
                          : "bg-rose-500/20 border border-rose-500/40"
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          status === "PRESENT"
                            ? "text-emerald-400"
                            : status === "LATE"
                            ? "text-amber-400"
                            : "text-rose-400"
                        }`}
                      >
                        {status}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              onPress={handleSaveCustomAttendance}
              disabled={savingAttendance}
              className="w-full h-12 rounded-xl bg-indigo-600 items-center justify-center"
            >
              {savingAttendance ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-white font-bold text-sm">{t("common.save")}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Homework Grading Modal */}
      <Modal
        visible={!!selectedReview}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedReview(null)}
      >
        <View className="flex-1 bg-black/70 justify-end">
          <View className="bg-slate-900 border-t border-slate-700 rounded-t-3xl p-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-extrabold text-white flex-1 mr-2">
                {t("teacher.gradeModalTitle")}
              </Text>
              <TouchableOpacity
                onPress={() => setSelectedReview(null)}
                className="px-3 py-1 rounded-lg bg-slate-800"
              >
                <Text className="text-xs font-bold text-slate-400">{t("common.close")}</Text>
              </TouchableOpacity>
            </View>

            {selectedReview && (
              <>
                <Text className="text-sm font-bold text-indigo-400">
                  {selectedReview.homeworkTitle}
                </Text>
                <Text className="text-xs text-slate-400 mb-3">
                  👤 {selectedReview.studentName}
                </Text>

                {selectedReview.submissionText && (
                  <View className="p-3.5 rounded-xl bg-slate-800 border border-slate-700 mb-4">
                    <Text className="text-[11px] font-bold text-slate-400 mb-1">
                      {t("teacher.studentAnswer")}:
                    </Text>
                    <Text className="text-xs text-white">{selectedReview.submissionText}</Text>
                  </View>
                )}

                <Text className="text-xs font-semibold text-slate-300 mb-1.5">
                  {t("teacher.scoreLabel")}
                </Text>
                <TextInput
                  value={gradeValue}
                  onChangeText={setGradeValue}
                  keyboardType="numeric"
                  className="w-full h-11 px-4 rounded-xl bg-slate-800 border border-slate-700 text-white text-base mb-3"
                />

                <Text className="text-xs font-semibold text-slate-300 mb-1.5">
                  {t("teacher.feedbackLabel")}
                </Text>
                <TextInput
                  value={feedbackValue}
                  onChangeText={setFeedbackValue}
                  placeholder={t("teacher.feedbackPlaceholder")}
                  placeholderTextColor="#64748B"
                  className="w-full h-20 p-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm mb-4"
                   multiline
                />

                <TouchableOpacity
                  onPress={handleSaveGrade}
                  disabled={savingGrade}
                  className="w-full h-12 rounded-xl bg-indigo-600 items-center justify-center"
                >
                  {savingGrade ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text className="text-white font-bold text-sm">
                      {t("teacher.submitGrade")}
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
