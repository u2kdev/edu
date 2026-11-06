import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useTranslation } from "react-i18next";
import {
  Home,
  Calendar,
  CreditCard,
  Award,
  CheckCircle2,
  Clock,
  XCircle,
  User as UserIcon,
} from "lucide-react-native";
import { apiClient } from "../../src/services/api-client";
import { API_ENDPOINTS } from "../../src/config/api";
import {
  AppHeader,
  BottomTabBar,
  ProgressBar,
  ProfileAndSettingsView,
  TabItem,
  getInitials,
} from "../../src/components/ui";

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
  const { t } = useTranslation();
  const [data, setData] = useState<ParentDashboardData | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("today");

  const fetchDashboard = useCallback(
    async (childId?: string | null) => {
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
    },
    [selectedChildId]
  );

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

  if (loading && !data) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-950">
        <ActivityIndicator size="large" color="#EC4899" />
      </View>
    );
  }

  const active = data?.activeChild;
  const pendingPaymentsCount =
    active?.payments?.filter((p) => p.status !== "PAID").length || 0;

  const tabs: TabItem[] = [
    { key: "today", label: t("tabs.today"), icon: Home },
    { key: "schedule", label: t("tabs.schedule"), icon: Calendar },
    {
      key: "payments",
      label: t("tabs.payments"),
      icon: CreditCard,
      badge: pendingPaymentsCount,
    },
    { key: "profile", label: t("tabs.profile"), icon: Award },
  ];

  return (
    <View className="flex-1 bg-slate-950">
      <AppHeader
        title={t("parent.title")}
        subtitle={active?.fullName || t("roles.parent")}
        accentColor="#EC4899"
        onAvatarPress={() => setActiveTab("profile")}
      />

      <ScrollView
        className="flex-1 px-5 pt-5"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#EC4899" />
        }
      >
        {/* Child Selector Pills */}
        {data?.children && data.children.length > 0 && activeTab !== "profile" && (
          <View className="mb-5">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {data.children.map((child) => {
                const isSelected = child.membershipId === selectedChildId;
                return (
                  <TouchableOpacity
                    key={child.membershipId}
                    onPress={() => handleSelectChild(child.membershipId)}
                    className={`mr-2.5 px-4 py-2.5 rounded-2xl border flex-row items-center ${
                      isSelected
                        ? "bg-pink-600 border-pink-500"
                        : "bg-slate-900 border-slate-800"
                    }`}
                  >
                    <View
                      className={`w-6 h-6 rounded-full items-center justify-center mr-2 ${
                        isSelected ? "bg-white/20" : "bg-slate-800"
                      }`}
                    >
                      <Text className="text-[10px] font-black text-white">
                        {getInitials(child.fullName)}
                      </Text>
                    </View>
                    <Text
                      className={`text-xs font-extrabold ${
                        isSelected ? "text-white" : "text-slate-300"
                      }`}
                    >
                      {child.fullName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {active ? (
          <>
            {/* TAB 1: OVERVIEW */}
            {activeTab === "today" && (
              <View className="pb-10">
                {/* Today Attendance Status Banner */}
                <View className="mb-5 p-5 rounded-3xl bg-slate-900 border border-slate-800">
                  <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                    {t("parent.attendanceStatus")}
                  </Text>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-lg font-black text-white flex-1 mr-2">
                      {active.fullName}
                    </Text>
                    <View
                      className={`px-3.5 py-1.5 rounded-full flex-row items-center ${
                        active.todayStatus === "PRESENT"
                          ? "bg-emerald-500/15 border border-emerald-500/30"
                          : active.todayStatus === "LATE"
                          ? "bg-amber-500/15 border border-amber-500/30"
                          : active.todayStatus === "ABSENT"
                          ? "bg-rose-500/15 border border-rose-500/30"
                          : "bg-slate-800 border border-slate-700"
                      }`}
                    >
                      {active.todayStatus === "PRESENT" ? (
                        <CheckCircle2 size={14} color="#34D399" />
                      ) : active.todayStatus === "LATE" ? (
                        <Clock size={14} color="#FBBF24" />
                      ) : active.todayStatus === "ABSENT" ? (
                        <XCircle size={14} color="#FB7185" />
                      ) : (
                        <Clock size={14} color="#94A3B8" />
                      )}
                      <Text
                        className={`text-xs font-extrabold ml-1.5 ${
                          active.todayStatus === "PRESENT"
                            ? "text-emerald-400"
                            : active.todayStatus === "LATE"
                            ? "text-amber-400"
                            : active.todayStatus === "ABSENT"
                            ? "text-rose-400"
                            : "text-slate-300"
                        }`}
                      >
                        {active.todayStatus === "PRESENT"
                          ? t("parent.present")
                          : active.todayStatus === "LATE"
                          ? t("parent.late")
                          : active.todayStatus === "ABSENT"
                          ? t("parent.absent")
                          : t("parent.noLesson")}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Child Metrics with Progress Bars */}
                <View className="flex-row gap-3 mb-6">
                  <View className="flex-1 p-4 rounded-3xl bg-slate-900 border border-slate-800">
                    <Text className="text-xs text-slate-400 font-semibold">
                      {t("student.attendance")}
                    </Text>
                    <Text className="text-2xl font-black text-emerald-400 mt-1">
                      {active.metrics.attendancePercent}%
                    </Text>
                    <ProgressBar
                      value={active.metrics.attendancePercent}
                      color="#10B981"
                    />
                    <Text className="text-[11px] text-slate-500 mt-2">
                      {active.metrics.presentCount} / {active.metrics.totalClasses} уроков
                    </Text>
                  </View>

                  <View className="flex-1 p-4 rounded-3xl bg-slate-900 border border-slate-800">
                    <Text className="text-xs text-slate-400 font-semibold">
                      {t("student.averageScore")}
                    </Text>
                    <Text className="text-2xl font-black text-pink-400 mt-1">
                      {active.metrics.averageScore ?? "—"}
                    </Text>
                    <ProgressBar
                      value={active.metrics.averageScore ?? 0}
                      color="#EC4899"
                    />
                    <Text className="text-[11px] text-slate-500 mt-2">из 100 баллов</Text>
                  </View>
                </View>

                {/* Recent Grades */}
                <View className="mb-6">
                  <Text className="text-base font-extrabold text-white mb-3">
                    {t("parent.recentGrades")}
                  </Text>
                  {active.recentGrades && active.recentGrades.length > 0 ? (
                    active.recentGrades.map((g) => (
                      <View
                        key={g.id}
                        className="p-4 mb-2 rounded-2xl bg-slate-900 border border-slate-800 flex-row items-center justify-between"
                      >
                        <View className="flex-row items-center flex-1 mr-3">
                          <View className="w-9 h-9 rounded-xl bg-pink-500/15 items-center justify-center mr-3">
                            <Award size={18} color="#F472B6" />
                          </View>
                          <View className="flex-1">
                            <Text className="text-sm font-bold text-white">
                              {g.lessonTitle || t("tabs.grades")}
                            </Text>
                            {g.notes && (
                              <Text className="text-xs text-slate-400 mt-0.5">
                                {g.notes}
                              </Text>
                            )}
                          </View>
                        </View>
                        <View className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30">
                          <Text className="text-sm font-black text-emerald-400">
                            {g.score}
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

            {/* TAB 2: SCHEDULE */}
            {activeTab === "schedule" && (
              <View className="pb-10">
                <Text className="text-base font-extrabold text-white mb-3">
                  {t("parent.upcomingSchedule")}
                </Text>
                {active.upcomingSchedule && active.upcomingSchedule.length > 0 ? (
                  active.upcomingSchedule.map((slot) => (
                    <View
                      key={slot.id}
                      className="p-4 mb-2.5 rounded-3xl bg-slate-900 border border-slate-800 flex-row items-center justify-between"
                    >
                      <View className="flex-1 mr-3">
                        <Text className="text-base font-extrabold text-white">
                          {slot.groupName}
                        </Text>
                        <View className="flex-row items-center mt-1">
                          <UserIcon size={13} color="#94A3B8" />
                          <Text className="text-xs text-slate-400 ml-1">
                            {slot.teacherName}
                          </Text>
                        </View>
                      </View>
                      <View className="px-3.5 py-2 rounded-2xl bg-pink-500/15 border border-pink-500/30">
                        <Text className="text-xs font-black text-pink-300">
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
            )}

            {/* TAB 3: PAYMENTS */}
            {activeTab === "payments" && (
              <View className="pb-10">
                <Text className="text-base font-extrabold text-white mb-3">
                  {t("parent.payments")}
                </Text>
                {active.payments && active.payments.length > 0 ? (
                  active.payments.map((p) => (
                    <View
                      key={p.id}
                      className="p-4 mb-2.5 rounded-3xl bg-slate-900 border border-slate-800 flex-row items-center justify-between"
                    >
                      <View className="flex-1 mr-3">
                        <Text className="text-base font-black text-white">
                          {p.amount.toLocaleString()} {p.currency}
                        </Text>
                        <Text className="text-xs text-slate-400 mt-0.5">
                          {p.description || t("tabs.payments")}
                        </Text>
                      </View>
                      <View
                        className={`px-3 py-1.5 rounded-xl ${
                          p.status === "PAID"
                            ? "bg-emerald-500/15 border border-emerald-500/30"
                            : "bg-amber-500/15 border border-amber-500/30"
                        }`}
                      >
                        <Text
                          className={`text-xs font-extrabold ${
                            p.status === "PAID"
                              ? "text-emerald-400"
                              : "text-amber-400"
                          }`}
                        >
                          {p.status === "PAID"
                            ? t("parent.paid")
                            : t("parent.pending")}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text className="text-xs text-slate-500 italic">—</Text>
                )}
              </View>
            )}
          </>
        ) : (
          activeTab !== "profile" && (
            <View className="p-8 items-center justify-center">
              <Text className="text-sm text-slate-400 text-center">
                {t("parent.noChildren")}
              </Text>
            </View>
          )
        )}

        {/* TAB 4: PROFILE */}
        {activeTab === "profile" && (
          <ProfileAndSettingsView
            roleLabel={t("roles.parent")}
            accentColor="#EC4899"
          />
        )}
      </ScrollView>

      <BottomTabBar
        tabs={tabs}
        activeTab={activeTab}
        onSelect={setActiveTab}
        accentColor="#EC4899"
      />
    </View>
  );
}
