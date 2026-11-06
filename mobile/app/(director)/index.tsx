import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useTranslation } from "react-i18next";
import {
  Home,
  AlertTriangle,
  Award,
  Users,
  Layers,
  Wallet,
  TrendingUp,
  Phone,
  CheckCircle2,
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
  const { t } = useTranslation();
  const [data, setData] = useState<DirectorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("today");

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

  if (loading && !data) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-950">
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    );
  }

  const kpis = data?.kpis;
  const riskCount = kpis?.riskCount || 0;

  const tabs: TabItem[] = [
    { key: "today", label: t("tabs.today"), icon: Home },
    {
      key: "risk",
      label: t("tabs.risk"),
      icon: AlertTriangle,
      badge: riskCount,
    },
    { key: "profile", label: t("tabs.profile"), icon: Award },
  ];

  const renderRiskList = () =>
    data?.atRiskStudents && data.atRiskStudents.length > 0 ? (
      data.atRiskStudents.map((st) => (
        <View
          key={st.membershipId}
          className="p-4 mb-3 rounded-3xl bg-slate-900 border border-rose-500/30"
        >
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center flex-1 mr-2">
              <View className="w-10 h-10 rounded-2xl bg-rose-500/15 items-center justify-center mr-3">
                <Text className="text-xs font-black text-rose-400">
                  {getInitials(st.fullName)}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-extrabold text-white">
                  {st.fullName}
                </Text>
                <Text className="text-xs text-slate-400 mt-0.5">
                  {t("director.missedClasses", { count: st.missedCount })}
                </Text>
              </View>
            </View>

            <View className="px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30">
              <Text className="text-xs font-black text-rose-400">
                {st.attendancePercent}%
              </Text>
            </View>
          </View>

          <ProgressBar value={st.attendancePercent} color="#F43F5E" />

          {st.phone && (
            <TouchableOpacity
              onPress={() => Linking.openURL(`tel:${st.phone}`)}
              className="mt-3 py-2.5 rounded-2xl bg-slate-800 border border-slate-700 flex-row items-center justify-center"
            >
              <Phone size={14} color="#FBBF24" />
              <Text className="text-xs font-extrabold text-amber-400 ml-2">
                {t("director.callStudent")}: {st.phone}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ))
    ) : (
      <View className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 items-center">
        <CheckCircle2 size={32} color="#10B981" />
        <Text className="text-sm font-bold text-slate-300 mt-3 text-center">
          {t("director.noAtRisk")}
        </Text>
      </View>
    );

  return (
    <View className="flex-1 bg-slate-950">
      <AppHeader
        title={t("roles.director")}
        subtitle={data?.center.name || "e-darschi"}
        accentColor="#F59E0B"
        onAvatarPress={() => setActiveTab("profile")}
      />

      <ScrollView
        className="flex-1 px-5 pt-5"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" />
        }
      >
        {/* TAB 1: EXECUTIVE DASHBOARD */}
        {activeTab === "today" && (
          <View className="pb-10">
            {/* Revenue Hero Card */}
            <View className="mb-4 p-5 rounded-3xl bg-emerald-950/50 border border-emerald-500/30">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                  {t("director.totalRevenue")}
                </Text>
                <Wallet size={18} color="#34D399" />
              </View>
              <Text className="text-2xl font-black text-white mt-1">
                {(kpis?.totalRevenue || 0).toLocaleString()} UZS
              </Text>
            </View>

            {/* KPI Grid */}
            <View className="flex-row flex-wrap justify-between mb-6">
              <View className="w-[48%] p-4 mb-3 rounded-3xl bg-slate-900 border border-slate-800">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-xs text-slate-400 font-semibold">
                    {t("director.activeStudents")}
                  </Text>
                  <Users size={16} color="#818CF8" />
                </View>
                <Text className="text-2xl font-black text-white">
                  {kpis?.activeStudentsCount ?? 0}
                </Text>
              </View>

              <View className="w-[48%] p-4 mb-3 rounded-3xl bg-slate-900 border border-slate-800">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-xs text-slate-400 font-semibold">
                    {t("director.activeGroups")}
                  </Text>
                  <Layers size={16} color="#FBBF24" />
                </View>
                <Text className="text-2xl font-black text-white">
                  {kpis?.activeGroupsCount ?? 0}
                </Text>
              </View>

              <View className="w-full p-4 rounded-3xl bg-slate-900 border border-slate-800">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-xs text-slate-400 font-semibold">
                    {t("director.avgAttendance")}
                  </Text>
                  <View className="flex-row items-center">
                    <TrendingUp size={15} color="#34D399" />
                    <Text className="text-base font-black text-emerald-400 ml-1.5">
                      {kpis?.averageAttendancePercent ?? 100}%
                    </Text>
                  </View>
                </View>
                <ProgressBar
                  value={kpis?.averageAttendancePercent ?? 100}
                  color="#10B981"
                />
              </View>
            </View>

            {/* At-Risk Preview */}
            <View>
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-base font-extrabold text-white">
                  {t("director.atRiskTitle")}
                </Text>
                <View className="px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40">
                  <Text className="text-xs font-extrabold text-rose-400">
                    {riskCount}
                  </Text>
                </View>
              </View>
              {renderRiskList()}
            </View>
          </View>
        )}

        {/* TAB 2: DEDICATED RISK CRM */}
        {activeTab === "risk" && (
          <View className="pb-10">
            <Text className="text-base font-extrabold text-white mb-3">
              {t("director.atRiskTitle")} ({riskCount})
            </Text>
            {renderRiskList()}
          </View>
        )}

        {/* TAB 3: PROFILE */}
        {activeTab === "profile" && (
          <ProfileAndSettingsView
            centerName={data?.center.name}
            roleLabel={t("roles.director")}
            accentColor="#F59E0B"
          />
        )}
      </ScrollView>

      <BottomTabBar
        tabs={tabs}
        activeTab={activeTab}
        onSelect={setActiveTab}
        accentColor="#F59E0B"
      />
    </View>
  );
}
