import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useTranslation } from "react-i18next";
import {
  Home,
  Building2,
  Award,
  Users,
  GraduationCap,
  LifeBuoy,
  Search,
  Layers,
} from "lucide-react-native";
import { apiClient } from "../../src/services/api-client";
import { API_ENDPOINTS } from "../../src/config/api";
import {
  AppHeader,
  BottomTabBar,
  ProfileAndSettingsView,
  TabItem,
} from "../../src/components/ui";

interface PlatformDashboardData {
  success: boolean;
  admin: {
    fullName: string;
    email: string;
    systemRole: string;
  };
  kpis: {
    totalCenters: number;
    activeCenters: number;
    totalUsers: number;
    totalStudents: number;
    openTicketsCount: number;
  };
  centers: Array<{
    id: string;
    name: string;
    status: string;
    ownerName: string;
    membersCount: number;
    groupsCount: number;
  }>;
}

export default function PlatformDashboard() {
  const { t } = useTranslation();
  const [data, setData] = useState<PlatformDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("today");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await apiClient<PlatformDashboardData>(API_ENDPOINTS.PLATFORM_DASHBOARD);
      setData(res);
    } catch (err) {
      console.warn("Failed to load platform dashboard:", err);
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
        <ActivityIndicator size="large" color="#06B6D4" />
      </View>
    );
  }

  const kpis = data?.kpis;
  const tabs: TabItem[] = [
    { key: "today", label: t("tabs.today"), icon: Home },
    {
      key: "centers",
      label: t("tabs.centers"),
      icon: Building2,
      badge: kpis?.totalCenters,
    },
    { key: "profile", label: t("tabs.profile"), icon: Award },
  ];

  const filteredCenters = (data?.centers || []).filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.ownerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderCentersList = () => (
    <>
      <View className="w-full h-12 px-4 rounded-2xl bg-slate-900 border border-slate-800 flex-row items-center mb-4">
        <Search size={16} color="#64748B" />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t("platform.searchPlaceholder")}
          placeholderTextColor="#64748B"
          className="flex-1 ml-2.5 text-sm text-white"
        />
      </View>

      {filteredCenters.map((center) => (
        <View
          key={center.id}
          className="p-4 mb-3 rounded-3xl bg-slate-900 border border-slate-800"
        >
          <View className="flex-row items-center justify-between mb-1.5">
            <Text className="text-base font-extrabold text-white flex-1 mr-2">
              {center.name}
            </Text>
            <View className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40">
              <Text className="text-[10px] font-bold text-emerald-400">
                {center.status}
              </Text>
            </View>
          </View>
          <Text className="text-xs text-slate-400">
            {t("platform.owner")}: {center.ownerName}
          </Text>
          <View className="flex-row items-center gap-5 mt-3 pt-2.5 border-t border-slate-800">
            <View className="flex-row items-center">
              <Users size={13} color="#22D3EE" />
              <Text className="text-xs text-cyan-400 font-bold ml-1.5">
                {center.membersCount} участников
              </Text>
            </View>
            <View className="flex-row items-center">
              <Layers size={13} color="#94A3B8" />
              <Text className="text-xs text-slate-300 font-bold ml-1.5">
                {center.groupsCount} групп
              </Text>
            </View>
          </View>
        </View>
      ))}
    </>
  );

  return (
    <View className="flex-1 bg-slate-950">
      <AppHeader
        title={t("platform.title")}
        subtitle={data?.admin.systemRole || "SUPERADMIN"}
        accentColor="#06B6D4"
        onAvatarPress={() => setActiveTab("profile")}
      />

      <ScrollView
        className="flex-1 px-5 pt-5"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#06B6D4" />
        }
      >
        {/* TAB 1: PLATFORM OVERVIEW */}
        {activeTab === "today" && (
          <View className="pb-10">
            <View className="flex-row flex-wrap justify-between mb-5">
              <View className="w-[48%] p-4 mb-3 rounded-3xl bg-slate-900 border border-slate-800">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-xs text-slate-400 font-semibold">
                    {t("platform.activeCenters")}
                  </Text>
                  <Building2 size={16} color="#22D3EE" />
                </View>
                <Text className="text-2xl font-black text-emerald-400">
                  {kpis?.activeCenters ?? 0} / {kpis?.totalCenters ?? 0}
                </Text>
              </View>

              <View className="w-[48%] p-4 mb-3 rounded-3xl bg-slate-900 border border-slate-800">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-xs text-slate-400 font-semibold">
                    {t("platform.totalUsers")}
                  </Text>
                  <Users size={16} color="#818CF8" />
                </View>
                <Text className="text-2xl font-black text-white">
                  {kpis?.totalUsers ?? 0}
                </Text>
              </View>

              <View className="w-[48%] p-4 rounded-3xl bg-slate-900 border border-slate-800">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-xs text-slate-400 font-semibold">
                    {t("platform.totalStudents")}
                  </Text>
                  <GraduationCap size={16} color="#34D399" />
                </View>
                <Text className="text-2xl font-black text-indigo-400">
                  {kpis?.totalStudents ?? 0}
                </Text>
              </View>

              <View className="w-[48%] p-4 rounded-3xl bg-slate-900 border border-slate-800">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-xs text-slate-400 font-semibold">
                    {t("platform.openTickets")}
                  </Text>
                  <LifeBuoy size={16} color="#FBBF24" />
                </View>
                <Text className="text-2xl font-black text-amber-400">
                  {kpis?.openTicketsCount ?? 0}
                </Text>
              </View>
            </View>

            <Text className="text-base font-extrabold text-white mb-3">
              {t("platform.centersList")}
            </Text>
            {renderCentersList()}
          </View>
        )}

        {/* TAB 2: TENANTS DIRECTORY */}
        {activeTab === "centers" && (
          <View className="pb-10">
            <Text className="text-base font-extrabold text-white mb-3">
              {t("platform.centersList")}
            </Text>
            {renderCentersList()}
          </View>
        )}

        {/* TAB 3: PROFILE */}
        {activeTab === "profile" && (
          <ProfileAndSettingsView
            roleLabel={t("roles.admin")}
            accentColor="#06B6D4"
          />
        )}
      </ScrollView>

      <BottomTabBar
        tabs={tabs}
        activeTab={activeTab}
        onSelect={setActiveTab}
        accentColor="#06B6D4"
      />
    </View>
  );
}
