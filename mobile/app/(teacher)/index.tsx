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
import { useTranslation } from "react-i18next";
import {
  Home,
  Users,
  CheckSquare,
  UserCheck,
  Clock,
  MapPin,
  BookOpen,
  ClipboardCheck,
  CheckCircle2,
  X,
  Award,
} from "lucide-react-native";
import { useAuthStore } from "../../src/store/auth-store";
import { apiClient } from "../../src/services/api-client";
import { API_ENDPOINTS } from "../../src/config/api";
import {
  AppHeader,
  BottomTabBar,
  ProfileAndSettingsView,
  TabItem,
  getInitials,
} from "../../src/components/ui";

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
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [data, setData] = useState<TeacherDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingGroupId, setMarkingGroupId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("today");

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

  const setStudentStatus = (membershipId: string, status: AttendanceStatus) => {
    setStudentStatuses((prev) => ({ ...prev, [membershipId]: status }));
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
      <View className="flex-1 items-center justify-center bg-slate-950">
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  const totalStudents =
    data?.groups.reduce((sum, g) => sum + g.activeStudentsCount, 0) || 0;
  const reviewsCount = data?.pendingReviews.length || 0;

  const tabs: TabItem[] = [
    { key: "today", label: t("tabs.today"), icon: Home },
    { key: "groups", label: t("tabs.groups"), icon: Users },
    {
      key: "reviews",
      label: t("tabs.reviews"),
      icon: ClipboardCheck,
      badge: reviewsCount,
    },
    { key: "profile", label: t("tabs.profile"), icon: Award },
  ];

  const renderGroupCard = (group: TeacherGroup) => (
    <View
      key={group.id}
      className="p-5 mb-3.5 rounded-3xl bg-slate-900 border border-slate-800"
    >
      <View className="flex-row items-center justify-between mb-1.5">
        <Text className="text-base font-extrabold text-white flex-1 mr-2">
          {group.name}
        </Text>
        <View className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30">
          <Text className="text-xs font-extrabold text-emerald-400">
            {t("teacher.studentsCount", { count: group.activeStudentsCount })}
          </Text>
        </View>
      </View>

      {group.courseTitle && (
        <View className="flex-row items-center mb-4">
          <BookOpen size={13} color="#94A3B8" />
          <Text className="text-xs text-slate-400 ml-1.5" numberOfLines={1}>
            {group.courseTitle}
            {group.latestLessonTitle ? ` • ${group.latestLessonTitle}` : ""}
          </Text>
        </View>
      )}

      <View className="gap-2.5">
        <TouchableOpacity
          onPress={() => handleQuickAttendanceAllPresent(group)}
          disabled={markingGroupId === group.id}
          activeOpacity={0.8}
          className="w-full py-3.5 rounded-2xl bg-emerald-600 flex-row items-center justify-center"
        >
          {markingGroupId === group.id ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <UserCheck size={16} color="#FFFFFF" />
              <Text className="text-xs font-extrabold text-white ml-2">
                {t("teacher.quickMarkAll")}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {group.students.length > 0 && (
          <TouchableOpacity
            onPress={() => openAttendanceJournal(group)}
            activeOpacity={0.8}
            className="w-full py-3 rounded-2xl bg-slate-800 border border-slate-700 flex-row items-center justify-center"
          >
            <CheckSquare size={15} color="#CBD5E1" />
            <Text className="text-xs font-bold text-slate-200 ml-2">
              {t("teacher.openAttendanceModal")}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-slate-950">
      <AppHeader
        title={user?.fullName || data?.teacher.fullName || t("roles.teacher")}
        subtitle={data?.teacher.centerName || "e-darschi"}
        accentColor="#10B981"
        onAvatarPress={() => setActiveTab("profile")}
      />

      <ScrollView
        className="flex-1 px-5 pt-5"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />
        }
      >
        {/* TAB 1: OVERVIEW */}
        {activeTab === "today" && (
          <View className="pb-10">
            {/* Teacher Summary KPI Row */}
            <View className="flex-row gap-3 mb-6">
              <View className="flex-1 p-4 rounded-3xl bg-slate-900 border border-slate-800">
                <Text className="text-xs text-slate-400 font-semibold">
                  {t("tabs.groups")}
                </Text>
                <Text className="text-2xl font-black text-emerald-400 mt-1">
                  {data?.groups.length || 0}
                </Text>
                <Text className="text-[11px] text-slate-500 mt-1">
                  {totalStudents} учеников
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setActiveTab("reviews")}
                activeOpacity={0.8}
                className="flex-1 p-4 rounded-3xl bg-slate-900 border border-slate-800"
              >
                <Text className="text-xs text-slate-400 font-semibold">
                  {t("teacher.pendingReviews")}
                </Text>
                <Text className="text-2xl font-black text-amber-400 mt-1">
                  {reviewsCount}
                </Text>
                <Text className="text-[11px] text-amber-400/80 font-bold mt-1">
                  Нажмите для проверки →
                </Text>
              </TouchableOpacity>
            </View>

            {/* Schedule Section */}
            <View className="mb-6">
              <Text className="text-base font-extrabold text-white mb-3">
                {t("teacher.mySchedule")}
              </Text>
              {data?.schedule && data.schedule.length > 0 ? (
                data.schedule.map((slot) => (
                  <View
                    key={slot.id}
                    className="p-4 mb-2.5 rounded-3xl bg-slate-900 border border-slate-800 flex-row items-center justify-between"
                  >
                    <View className="flex-1 mr-3">
                      <Text className="text-sm font-extrabold text-white">
                        {slot.groupName}
                      </Text>
                      <View className="flex-row items-center mt-1">
                        <MapPin size={13} color="#94A3B8" />
                        <Text className="text-xs text-slate-400 ml-1">
                          {slot.roomName}
                        </Text>
                      </View>
                    </View>
                    <View className="px-3.5 py-2 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex-row items-center">
                      <Clock size={13} color="#34D399" />
                      <Text className="text-xs font-black text-emerald-300 ml-1.5">
                        {slot.startTime} – {slot.endTime}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text className="text-xs text-slate-500 italic">
                  {t("student.noUpcomingClasses")}
                </Text>
              )}
            </View>

            {/* Quick Groups Attendance */}
            <View>
              <Text className="text-base font-extrabold text-white mb-3">
                {t("teacher.myGroups")}
              </Text>
              {data?.groups.map(renderGroupCard)}
            </View>
          </View>
        )}

        {/* TAB 2: GROUPS & JOURNAL */}
        {activeTab === "groups" && (
          <View className="pb-10">
            <Text className="text-base font-extrabold text-white mb-3">
              {t("teacher.myGroups")} ({data?.groups.length || 0})
            </Text>
            {data?.groups.map(renderGroupCard)}
          </View>
        )}

        {/* TAB 3: HOMEWORK REVIEWS */}
        {activeTab === "reviews" && (
          <View className="pb-10">
            <Text className="text-base font-extrabold text-white mb-3">
              {t("teacher.pendingReviews")} ({reviewsCount})
            </Text>
            {data?.pendingReviews && data.pendingReviews.length > 0 ? (
              data.pendingReviews.map((rev) => (
                <TouchableOpacity
                  key={rev.id}
                  onPress={() => openGradeModal(rev)}
                  activeOpacity={0.85}
                  className="p-5 mb-3 rounded-3xl bg-slate-900 border border-slate-800"
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center flex-1 mr-2">
                      <View className="w-9 h-9 rounded-xl bg-amber-500/15 items-center justify-center mr-3">
                        <Text className="text-xs font-black text-amber-400">
                          {getInitials(rev.studentName)}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-extrabold text-white">
                          {rev.studentName}
                        </Text>
                        <Text className="text-xs text-indigo-400 font-semibold">
                          {rev.homeworkTitle}
                        </Text>
                      </View>
                    </View>
                    <View className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40">
                      <Text className="text-xs font-extrabold text-amber-300">
                        {t("teacher.reviewAction")}
                      </Text>
                    </View>
                  </View>

                  {rev.submissionText && (
                    <View className="mt-2 p-3 rounded-2xl bg-slate-950 border border-slate-800">
                      <Text className="text-xs text-slate-300" numberOfLines={2}>
                        “{rev.submissionText}”
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))
            ) : (
              <View className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 items-center">
                <CheckCircle2 size={32} color="#10B981" />
                <Text className="text-sm font-bold text-slate-300 mt-3">
                  {t("teacher.allReviewed")}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* TAB 4: PROFILE */}
        {activeTab === "profile" && (
          <ProfileAndSettingsView
            centerName={data?.teacher.centerName}
            roleLabel={t("roles.teacher")}
            accentColor="#10B981"
          />
        )}
      </ScrollView>

      <BottomTabBar
        tabs={tabs}
        activeTab={activeTab}
        onSelect={setActiveTab}
        accentColor="#10B981"
      />

      {/* Per-Student Segmented Attendance Journal Modal */}
      <Modal
        visible={!!attendanceGroup}
        animationType="slide"
        transparent
        onRequestClose={() => setAttendanceGroup(null)}
      >
        <View className="flex-1 bg-black/75 justify-end">
          <View className="bg-slate-900 border-t border-slate-800 rounded-t-3xl p-6 max-h-[85%]">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-1 mr-2">
                <Text className="text-lg font-black text-white">
                  {attendanceGroup?.name}
                </Text>
                <Text className="text-xs text-emerald-400 font-semibold mt-0.5">
                  {attendanceGroup?.latestLessonTitle || t("teacher.openAttendanceModal")}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setAttendanceGroup(null)}
                className="w-9 h-9 rounded-full bg-slate-800 items-center justify-center"
              >
                <X size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView className="mb-4">
              {attendanceGroup?.students.map((st) => {
                const current = studentStatuses[st.membershipId] || "PRESENT";
                return (
                  <View
                    key={st.membershipId}
                    className="p-3.5 mb-2.5 rounded-2xl bg-slate-950 border border-slate-800 flex-row items-center justify-between"
                  >
                    <Text
                      className="text-sm font-bold text-white flex-1 mr-2"
                      numberOfLines={1}
                    >
                      {st.fullName}
                    </Text>

                    {/* Segmented 3-state Attendance Selector */}
                    <View className="flex-row gap-1.5">
                      {(
                        [
                          {
                            code: "PRESENT",
                            label: t("teacher.statusPresent"),
                            activeBg: "bg-emerald-600 border-emerald-500",
                          },
                          {
                            code: "LATE",
                            label: t("teacher.statusLate"),
                            activeBg: "bg-amber-600 border-amber-500",
                          },
                          {
                            code: "ABSENT",
                            label: t("teacher.statusAbsent"),
                            activeBg: "bg-rose-600 border-rose-500",
                          },
                        ] as const
                      ).map((opt) => {
                        const isSelected = current === opt.code;
                        return (
                          <TouchableOpacity
                            key={opt.code}
                            onPress={() =>
                              setStudentStatus(st.membershipId, opt.code)
                            }
                            className={`px-2.5 py-1.5 rounded-xl border ${
                              isSelected
                                ? opt.activeBg
                                : "bg-slate-900 border-slate-800"
                            }`}
                          >
                            <Text
                              className={`text-[11px] font-extrabold ${
                                isSelected ? "text-white" : "text-slate-400"
                              }`}
                            >
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              onPress={handleSaveCustomAttendance}
              disabled={savingAttendance}
              className="w-full py-4 rounded-2xl bg-emerald-600 items-center justify-center"
            >
              {savingAttendance ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-white font-extrabold text-sm">
                  {t("common.save")}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Homework Grading Modal with Quick Presets */}
      <Modal
        visible={!!selectedReview}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedReview(null)}
      >
        <View className="flex-1 bg-black/75 justify-end">
          <View className="bg-slate-900 border-t border-slate-800 rounded-t-3xl p-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-black text-white flex-1 mr-2">
                {t("teacher.gradeModalTitle")}
              </Text>
              <TouchableOpacity
                onPress={() => setSelectedReview(null)}
                className="w-9 h-9 rounded-full bg-slate-800 items-center justify-center"
              >
                <X size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {selectedReview && (
              <>
                <Text className="text-sm font-extrabold text-emerald-400">
                  {selectedReview.homeworkTitle}
                </Text>
                <Text className="text-xs text-slate-400 mb-3">
                  {selectedReview.studentName}
                </Text>

                {selectedReview.submissionText && (
                  <View className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 mb-4">
                    <Text className="text-[11px] font-bold text-slate-400 mb-1">
                      {t("teacher.studentAnswer")}:
                    </Text>
                    <Text className="text-xs text-white">
                      {selectedReview.submissionText}
                    </Text>
                  </View>
                )}

                <Text className="text-xs font-bold text-slate-300 mb-2">
                  {t("teacher.scoreLabel")}
                </Text>

                {/* Quick 1-Tap Score Presets */}
                <View className="flex-row gap-2 mb-3">
                  {["100", "95", "85", "75", "60"].map((preset) => {
                    const active = gradeValue === preset;
                    return (
                      <TouchableOpacity
                        key={preset}
                        onPress={() => setGradeValue(preset)}
                        className={`flex-1 py-2 rounded-xl border items-center ${
                          active
                            ? "bg-emerald-600 border-emerald-500"
                            : "bg-slate-950 border-slate-800"
                        }`}
                      >
                        <Text
                          className={`text-xs font-extrabold ${
                            active ? "text-white" : "text-slate-300"
                          }`}
                        >
                          {preset}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TextInput
                  value={gradeValue}
                  onChangeText={setGradeValue}
                  keyboardType="numeric"
                  className="w-full h-12 px-4 rounded-2xl bg-slate-950 border border-slate-800 text-white text-base font-bold mb-3"
                />

                <Text className="text-xs font-bold text-slate-300 mb-1.5">
                  {t("teacher.feedbackLabel")}
                </Text>
                <TextInput
                  value={feedbackValue}
                  onChangeText={setFeedbackValue}
                  placeholder={t("teacher.feedbackPlaceholder")}
                  placeholderTextColor="#64748B"
                  className="w-full h-20 p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-white text-sm mb-4"
                  multiline
                />

                <TouchableOpacity
                  onPress={handleSaveGrade}
                  disabled={savingGrade}
                  className="w-full py-4 rounded-2xl bg-emerald-600 items-center justify-center"
                >
                  {savingGrade ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text className="text-white font-extrabold text-sm">
                      {t("teacher.submitGrade")}
                    </Text>
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
