"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, Globe, ShieldCheck, User } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { NotificationPreferences, UserQuietHoursConfig } from "@/lib/notifications";
import { t } from "@/i18n";
import { ProfileTabPanel, type ProfileTabData } from "./ProfileTabPanel";
import { SecurityTabPanel } from "./SecurityTabPanel";
import { NotificationsTabPanel } from "./NotificationsTabPanel";
import { AppearanceTabPanel } from "./AppearanceTabPanel";

const ACCOUNT_TABS = ["profile", "security", "notifications", "appearance"] as const;
type AccountTab = (typeof ACCOUNT_TABS)[number];

interface AccountSettingsTabsProps {
  profile: ProfileTabData;
  preferences: NotificationPreferences;
  quietHours: UserQuietHoursConfig;
  centerSettings: {
    hasCenter: boolean;
    smsEnabled: boolean;
    smsDailyLimit: number;
    canManageCenter: boolean;
  };
  studentEnrollments?: Array<{ id: string; status: string; groupName: string }>;
  parentChildren?: Array<{ id: string; fullName: string }>;
  notificationsHref?: string;
  isReadOnly?: boolean;
  locale: string;
}

export function AccountSettingsTabs({
  profile,
  preferences,
  quietHours,
  centerSettings,
  studentEnrollments = [],
  parentChildren = [],
  notificationsHref,
  isReadOnly = false,
  locale,
}: AccountSettingsTabsProps) {
  const router = useRouter();
  const pathname = usePathname() || "/account";
  const searchParams = useSearchParams();
  const queryTab = searchParams?.get("tab") || "";

  const resolvedFromQuery: AccountTab = (ACCOUNT_TABS as readonly string[]).includes(queryTab)
    ? (queryTab as AccountTab)
    : "profile";

  const [activeTab, setActiveTab] = useState<AccountTab>(resolvedFromQuery);

  useEffect(() => {
    setActiveTab(resolvedFromQuery);
  }, [resolvedFromQuery]);

  const handleTabChange = (nextTab: string) => {
    if (!(ACCOUNT_TABS as readonly string[]).includes(nextTab)) return;
    setActiveTab(nextTab as AccountTab);
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("tab", nextTab);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const roleBadgeText = t(locale, `roles.${profile.role}`) || profile.role;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(locale, "account.title")}
        description={t(locale, "account.subtitle")}
        actions={
          <Badge variant="info">{roleBadgeText}</Badge>
        }
      />

      {isReadOnly && (
        <Alert variant="warning">{t(locale, "account.readOnlyAccountNotice")}</Alert>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="profile" className="min-h-[38px] gap-1.5">
            <User className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{t(locale, "account.tabProfile")}</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="min-h-[38px] gap-1.5">
            <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{t(locale, "account.tabSecurity")}</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="min-h-[38px] gap-1.5">
            <Bell className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{t(locale, "account.tabNotifications")}</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="min-h-[38px] gap-1.5">
            <Globe className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{t(locale, "account.tabAppearance")}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTabPanel
            profile={profile}
            locale={locale}
            isReadOnly={isReadOnly}
            studentEnrollments={studentEnrollments}
            parentChildren={parentChildren}
          />
        </TabsContent>

        <TabsContent value="security">
          <SecurityTabPanel
            initialTwoFactorEnabled={profile.twoFactorEnabled}
            locale={locale}
            isReadOnly={isReadOnly}
          />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationsTabPanel
            initialPreferences={preferences}
            initialQuietHours={quietHours}
            initialCenterSettings={centerSettings}
            locale={locale}
            isReadOnly={isReadOnly}
            notificationsHref={notificationsHref}
          />
        </TabsContent>

        <TabsContent value="appearance">
          <AppearanceTabPanel locale={locale} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
