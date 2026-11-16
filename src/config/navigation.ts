import { hasPermission, type CenterRole, type Permission, type PlatformRole } from "@/lib/permissions";
import type { PlanFeatureKey, PlanFeatures } from "@/lib/plan-features";

export type AppScope = "platform" | "center" | "developer";

export type CenterStatusType =
  | "TRIAL"
  | "ACTIVE"
  | "PAUSED"
  | "OVERDUE"
  | "BLOCKED"
  | "CANCELLED";

export type NavIconName =
  | "home"
  | "building-2"
  | "file-text"
  | "credit-card"
  | "wallet"
  | "receipt"
  | "bar-chart-3"
  | "users"
  | "user-check"
  | "user-plus"
  | "help-circle"
  | "megaphone"
  | "shield"
  | "shield-alert"
  | "sliders"
  | "activity"
  | "globe"
  | "terminal"
  | "database"
  | "calendar-days"
  | "book-open"
  | "clipboard-check"
  | "graduation-cap"
  | "file-check-2"
  | "folder-open"
  | "calendar-range"
  | "send"
  | "heart"
  | "key-round"
  | "tag"
  | "clipboard-list"
  | "settings";

export interface NavItemConfig {
  id: string;
  scope: AppScope;
  groupId: string | null;
  groupLabelKey?: string;
  groupLabelByRole?: Partial<Record<CenterRole, string>>;
  labelKey: string;
  labelByRole?: Partial<Record<CenterRole, string>>;
  href: string;
  icon: NavIconName;
  exact?: boolean;
  /** Roles allowed in the active scope (centerRole for "center", platformRole for "platform"/"developer"). */
  roles: string[];
  requiredPermission?: Permission;
  anyPermissions?: Permission[];
  /** Student has self-service access to /center/payments even without broad center payments.read permission. */
  allowStudentSelfAccess?: boolean;
  requirePlanFeature?: PlanFeatureKey;
  excludeCenterStatuses?: CenterStatusType[];
  allowedCenterStatuses?: CenterStatusType[];
}

export interface NavigationContext {
  scope: AppScope;
  platformRole?: PlatformRole | string;
  centerRole?: CenterRole | string;
  membershipPermissions?: string | null;
  planFeatures?: Partial<PlanFeatures> | null;
  centerStatus?: CenterStatusType | string | null;
}

export interface ResolvedNavItem {
  id: string;
  scope: AppScope;
  groupId: string | null;
  labelKey: string;
  href: string;
  icon: NavIconName;
  exact?: boolean;
}

export interface ResolvedNavGroup {
  id: string;
  labelKey: string | null;
  items: ResolvedNavItem[];
}

export const NAV_ITEMS: NavItemConfig[] = [
  // =========================================================================
  // PLATFORM ADMIN (/platform-admin)
  // =========================================================================
  {
    id: "platform-overview",
    scope: "platform",
    groupId: null,
    labelKey: "nav.overview",
    href: "/platform-admin",
    icon: "home",
    exact: true,
    roles: ["DEVELOPER", "SUPERADMIN", "PLATFORM_ADMIN", "FULL_ACCESS", "PLATFORM_SUPPORT"],
    requiredPermission: "platform.dashboard",
  },
  {
    id: "platform-centers",
    scope: "platform",
    groupId: "clients",
    groupLabelKey: "navGroups.clients",
    labelKey: "nav.platformCenters",
    href: "/platform-admin/centers",
    icon: "building-2",
    roles: ["DEVELOPER", "SUPERADMIN", "PLATFORM_ADMIN", "FULL_ACCESS"],
    anyPermissions: ["platform.centers.read", "platform.tenants.read"],
  },
  {
    id: "platform-subscriptions",
    scope: "platform",
    groupId: "clients",
    groupLabelKey: "navGroups.clients",
    labelKey: "nav.platformSubscriptions",
    href: "/platform-admin/subscriptions",
    icon: "file-text",
    roles: ["DEVELOPER", "SUPERADMIN", "PLATFORM_ADMIN"],
    requiredPermission: "platform.billing.read",
  },
  {
    id: "platform-plans",
    scope: "platform",
    groupId: "clients",
    groupLabelKey: "navGroups.clients",
    labelKey: "nav.platformPlans",
    href: "/platform-admin/plans",
    icon: "credit-card",
    roles: ["DEVELOPER", "SUPERADMIN", "PLATFORM_ADMIN"],
    requiredPermission: "platform.plans.manage",
  },
  {
    id: "platform-payments",
    scope: "platform",
    groupId: "finance",
    groupLabelKey: "navGroups.finance",
    labelKey: "nav.platformPayments",
    href: "/platform-admin/finance/payments",
    icon: "wallet",
    roles: ["DEVELOPER", "SUPERADMIN", "PLATFORM_ADMIN"],
    requiredPermission: "platform.billing.read",
  },
  {
    id: "platform-expenses",
    scope: "platform",
    groupId: "finance",
    groupLabelKey: "navGroups.finance",
    labelKey: "nav.platformExpenses",
    href: "/platform-admin/finance/expenses",
    icon: "receipt",
    roles: ["DEVELOPER", "SUPERADMIN"],
    requiredPermission: "platform.expenses.manage",
  },
  {
    id: "platform-finance-reports",
    scope: "platform",
    groupId: "finance",
    groupLabelKey: "navGroups.finance",
    labelKey: "nav.platformFinanceReports",
    href: "/platform-admin/finance",
    icon: "bar-chart-3",
    exact: true,
    roles: ["DEVELOPER", "SUPERADMIN", "PLATFORM_ADMIN"],
    requiredPermission: "platform.billing.read",
  },
  {
    id: "platform-users",
    scope: "platform",
    groupId: "people",
    groupLabelKey: "navGroups.people",
    labelKey: "nav.platformUsers",
    href: "/platform-admin/users",
    icon: "users",
    roles: ["DEVELOPER", "SUPERADMIN", "PLATFORM_ADMIN"],
    requiredPermission: "platform.users.read",
  },
  {
    id: "platform-team",
    scope: "platform",
    groupId: "people",
    groupLabelKey: "navGroups.people",
    labelKey: "nav.platformTeam",
    href: "/platform-admin/team",
    icon: "user-check",
    roles: ["DEVELOPER", "SUPERADMIN"],
    requiredPermission: "platform.team.manage",
  },
  {
    id: "platform-registrations",
    scope: "platform",
    groupId: "people",
    groupLabelKey: "navGroups.people",
    labelKey: "nav.platformRegistrations",
    href: "/platform-admin/registrations",
    icon: "user-plus",
    roles: ["DEVELOPER", "SUPERADMIN", "PLATFORM_ADMIN"],
    requiredPermission: "platform.users.read",
  },
  {
    id: "platform-support",
    scope: "platform",
    groupId: "operations",
    groupLabelKey: "navGroups.operations",
    labelKey: "nav.support",
    href: "/platform-admin/support",
    icon: "help-circle",
    roles: ["DEVELOPER", "SUPERADMIN", "PLATFORM_ADMIN", "FULL_ACCESS", "PLATFORM_SUPPORT"],
    requiredPermission: "platform.support",
  },
  {
    id: "platform-announcements",
    scope: "platform",
    groupId: "operations",
    groupLabelKey: "navGroups.operations",
    labelKey: "nav.announcements",
    href: "/platform-admin/announcements",
    icon: "megaphone",
    roles: ["DEVELOPER", "SUPERADMIN", "PLATFORM_ADMIN", "PLATFORM_SUPPORT"],
    requiredPermission: "platform.announcements.read",
  },
  {
    id: "platform-audit",
    scope: "platform",
    groupId: "system",
    groupLabelKey: "navGroups.system",
    labelKey: "nav.auditLog",
    href: "/platform-admin/audit",
    icon: "shield",
    roles: ["DEVELOPER", "SUPERADMIN"],
    requiredPermission: "platform.audit.read",
  },
  {
    id: "platform-security",
    scope: "platform",
    groupId: "system",
    groupLabelKey: "navGroups.system",
    labelKey: "nav.security",
    href: "/platform-admin/security",
    icon: "shield-alert",
    roles: ["DEVELOPER", "SUPERADMIN"],
    requiredPermission: "platform.security",
  },
  {
    id: "platform-settings",
    scope: "platform",
    groupId: "system",
    groupLabelKey: "navGroups.system",
    labelKey: "nav.platformSettings",
    href: "/platform-admin/settings",
    icon: "sliders",
    roles: ["DEVELOPER", "SUPERADMIN", "PLATFORM_ADMIN", "SEO_ADMIN"],
    anyPermissions: ["platform.settings.read", "platform.settings.manage"],
  },
  {
    id: "platform-seo",
    scope: "platform",
    groupId: "system",
    groupLabelKey: "navGroups.system",
    labelKey: "nav.platformSeo",
    href: "/platform-admin/seo",
    icon: "globe",
    roles: ["SEO_ADMIN", "FULL_ACCESS"],
    anyPermissions: ["platform.settings.manage", "platform.dashboard"],
  },
  {
    id: "platform-health",
    scope: "platform",
    groupId: "system",
    groupLabelKey: "navGroups.system",
    labelKey: "nav.systemHealth",
    href: "/platform-admin/system-health",
    icon: "activity",
    roles: ["DEVELOPER", "SUPERADMIN", "PLATFORM_ADMIN", "FULL_ACCESS", "PLATFORM_SUPPORT"],
    requiredPermission: "platform.system.health",
  },

  // =========================================================================
  // DEVELOPER (/developer)
  // =========================================================================
  {
    id: "dev-health",
    scope: "developer",
    groupId: "system",
    groupLabelKey: "navGroups.system",
    labelKey: "nav.systemHealth",
    href: "/developer",
    icon: "activity",
    exact: true,
    roles: ["DEVELOPER", "SUPERADMIN"],
  },
  {
    id: "dev-audit",
    scope: "developer",
    groupId: "system",
    groupLabelKey: "navGroups.system",
    labelKey: "nav.globalAudit",
    href: "/developer/audit",
    icon: "database",
    roles: ["DEVELOPER", "SUPERADMIN"],
  },
  {
    id: "dev-owners",
    scope: "developer",
    groupId: "system",
    groupLabelKey: "navGroups.system",
    labelKey: "nav.platformOwners",
    href: "/developer/owners",
    icon: "users",
    roles: ["DEVELOPER", "SUPERADMIN"],
  },

  // =========================================================================
  // CENTER (/center)
  // =========================================================================
  {
    id: "center-overview",
    scope: "center",
    groupId: null,
    labelKey: "nav.overview",
    href: "/center",
    icon: "home",
    exact: true,
    roles: [
      "DIRECTOR",
      "CENTER_ADMIN",
      "ACCOUNTANT",
      "TEACHER",
      "TEACHER_ASSISTANT",
      "CENTER_SUPPORT",
      "STUDENT",
      "PARENT",
    ],
  },
  // Academic / Classes / Study / Child
  {
    id: "center-schedule",
    scope: "center",
    groupId: "academic",
    groupLabelKey: "navGroups.academic",
    groupLabelByRole: {
      TEACHER: "navGroups.classes",
      TEACHER_ASSISTANT: "navGroups.classes",
      STUDENT: "navGroups.study",
      PARENT: "navGroups.child",
    },
    labelKey: "nav.schedule",
    href: "/center/schedule",
    icon: "calendar-days",
    roles: ["DIRECTOR", "CENTER_ADMIN", "TEACHER", "TEACHER_ASSISTANT", "STUDENT", "PARENT"],
    requiredPermission: "schedule.read",
    excludeCenterStatuses: ["BLOCKED", "CANCELLED"],
  },
  {
    id: "center-groups",
    scope: "center",
    groupId: "academic",
    groupLabelKey: "navGroups.academic",
    groupLabelByRole: {
      TEACHER: "navGroups.classes",
      TEACHER_ASSISTANT: "navGroups.classes",
    },
    labelKey: "nav.groups",
    labelByRole: {
      TEACHER: "nav.myGroups",
      TEACHER_ASSISTANT: "nav.myGroups",
    },
    href: "/center/groups",
    icon: "users",
    roles: ["DIRECTOR", "CENTER_ADMIN", "TEACHER", "TEACHER_ASSISTANT"],
    requiredPermission: "groups.read",
    excludeCenterStatuses: ["BLOCKED", "CANCELLED"],
  },
  {
    id: "center-courses",
    scope: "center",
    groupId: "academic",
    groupLabelKey: "navGroups.academic",
    groupLabelByRole: {
      TEACHER: "navGroups.classes",
      TEACHER_ASSISTANT: "navGroups.classes",
      STUDENT: "navGroups.study",
    },
    labelKey: "nav.courses",
    href: "/center/courses",
    icon: "book-open",
    roles: ["DIRECTOR", "CENTER_ADMIN", "TEACHER", "TEACHER_ASSISTANT", "STUDENT"],
    requiredPermission: "courses.read",
    excludeCenterStatuses: ["BLOCKED", "CANCELLED"],
  },
  {
    id: "center-attendance",
    scope: "center",
    groupId: "academic",
    groupLabelKey: "navGroups.academic",
    groupLabelByRole: {
      TEACHER: "navGroups.classes",
      TEACHER_ASSISTANT: "navGroups.classes",
      STUDENT: "navGroups.study",
      PARENT: "navGroups.child",
    },
    labelKey: "nav.attendance",
    href: "/center/attendance",
    icon: "clipboard-check",
    roles: ["DIRECTOR", "CENTER_ADMIN", "TEACHER", "TEACHER_ASSISTANT", "STUDENT", "PARENT"],
    requiredPermission: "attendance.read",
    excludeCenterStatuses: ["BLOCKED", "CANCELLED"],
  },
  {
    id: "center-grades",
    scope: "center",
    groupId: "academic",
    groupLabelKey: "navGroups.academic",
    groupLabelByRole: {
      TEACHER: "navGroups.classes",
      TEACHER_ASSISTANT: "navGroups.classes",
      STUDENT: "navGroups.study",
      PARENT: "navGroups.child",
    },
    labelKey: "nav.grades",
    href: "/center/grades",
    icon: "graduation-cap",
    roles: ["DIRECTOR", "CENTER_ADMIN", "TEACHER", "TEACHER_ASSISTANT", "STUDENT", "PARENT"],
    requiredPermission: "grades.read",
    excludeCenterStatuses: ["BLOCKED", "CANCELLED"],
  },
  {
    id: "center-homework",
    scope: "center",
    groupId: "academic",
    groupLabelKey: "navGroups.academic",
    groupLabelByRole: {
      TEACHER: "navGroups.classes",
      TEACHER_ASSISTANT: "navGroups.classes",
      STUDENT: "navGroups.study",
      PARENT: "navGroups.child",
    },
    labelKey: "nav.homework",
    href: "/center/homework",
    icon: "book-open",
    roles: ["DIRECTOR", "CENTER_ADMIN", "TEACHER", "TEACHER_ASSISTANT", "STUDENT", "PARENT"],
    requiredPermission: "assignments.read",
    excludeCenterStatuses: ["BLOCKED", "CANCELLED"],
  },
  {
    id: "center-tests",
    scope: "center",
    groupId: "academic",
    groupLabelKey: "navGroups.academic",
    groupLabelByRole: {
      TEACHER: "navGroups.classes",
      TEACHER_ASSISTANT: "navGroups.classes",
      STUDENT: "navGroups.study",
    },
    labelKey: "nav.tests",
    href: "/center/tests",
    icon: "file-check-2",
    roles: ["DIRECTOR", "CENTER_ADMIN", "TEACHER", "TEACHER_ASSISTANT", "STUDENT"],
    requiredPermission: "assignments.read",
    excludeCenterStatuses: ["BLOCKED", "CANCELLED"],
  },
  {
    id: "center-materials",
    scope: "center",
    groupId: "academic",
    groupLabelKey: "navGroups.academic",
    groupLabelByRole: {
      TEACHER: "navGroups.classes",
      TEACHER_ASSISTANT: "navGroups.classes",
      STUDENT: "navGroups.study",
    },
    labelKey: "nav.materials",
    href: "/center/materials",
    icon: "folder-open",
    roles: ["DIRECTOR", "CENTER_ADMIN", "TEACHER", "TEACHER_ASSISTANT", "STUDENT"],
    requiredPermission: "materials.read",
    excludeCenterStatuses: ["BLOCKED", "CANCELLED"],
  },

  // People (Director / Center Admin)
  {
    id: "center-students",
    scope: "center",
    groupId: "people",
    groupLabelKey: "navGroups.people",
    labelKey: "nav.students",
    href: "/center/students",
    icon: "users",
    roles: ["DIRECTOR", "CENTER_ADMIN"],
    requiredPermission: "students.read",
    excludeCenterStatuses: ["BLOCKED", "CANCELLED"],
  },
  {
    id: "center-parents",
    scope: "center",
    groupId: "people",
    groupLabelKey: "navGroups.people",
    labelKey: "nav.parents",
    href: "/center/parents",
    icon: "heart",
    roles: ["DIRECTOR", "CENTER_ADMIN"],
    requiredPermission: "students.read",
    excludeCenterStatuses: ["BLOCKED", "CANCELLED"],
  },
  {
    id: "center-staff",
    scope: "center",
    groupId: "people",
    groupLabelKey: "navGroups.people",
    labelKey: "nav.staff",
    href: "/center/staff",
    icon: "user-plus",
    roles: ["DIRECTOR", "CENTER_ADMIN"],
    requiredPermission: "users.read",
    excludeCenterStatuses: ["BLOCKED", "CANCELLED"],
  },
  {
    id: "center-invites",
    scope: "center",
    groupId: "people",
    groupLabelKey: "navGroups.people",
    labelKey: "nav.invites",
    href: "/center/invites",
    icon: "key-round",
    roles: ["DIRECTOR", "CENTER_ADMIN"],
    requiredPermission: "invites.read",
    excludeCenterStatuses: ["PAUSED", "OVERDUE", "BLOCKED", "CANCELLED"],
  },

  // Finance (Director / Center Admin / Accountant / Student / Parent)
  {
    id: "center-payments",
    scope: "center",
    groupId: "finance",
    groupLabelKey: "navGroups.finance",
    groupLabelByRole: {
      STUDENT: "nav.payment",
      PARENT: "nav.payment",
    },
    labelKey: "nav.payments",
    labelByRole: {
      STUDENT: "nav.payment",
      PARENT: "nav.payment",
    },
    href: "/center/payments",
    icon: "credit-card",
    roles: ["DIRECTOR", "CENTER_ADMIN", "ACCOUNTANT", "STUDENT", "PARENT"],
    requiredPermission: "payments.read",
    allowStudentSelfAccess: true,
    excludeCenterStatuses: ["BLOCKED", "CANCELLED"],
  },
  {
    id: "center-debts",
    scope: "center",
    groupId: "finance",
    groupLabelKey: "navGroups.finance",
    labelKey: "nav.debts",
    href: "/center/finance?tab=debts",
    icon: "receipt",
    roles: ["DIRECTOR", "CENTER_ADMIN", "ACCOUNTANT"],
    requiredPermission: "finance.read",
    requirePlanFeature: "financeAccounting",
    excludeCenterStatuses: ["BLOCKED", "CANCELLED"],
  },
  {
    id: "center-finance",
    scope: "center",
    groupId: "finance",
    groupLabelKey: "navGroups.finance",
    labelKey: "nav.finance",
    href: "/center/finance",
    icon: "wallet",
    exact: true,
    roles: ["DIRECTOR", "CENTER_ADMIN", "ACCOUNTANT"],
    requiredPermission: "finance.read",
    requirePlanFeature: "financeAccounting",
    excludeCenterStatuses: ["BLOCKED", "CANCELLED"],
  },
  {
    id: "center-salaries",
    scope: "center",
    groupId: "finance",
    groupLabelKey: "navGroups.finance",
    labelKey: "nav.salaries",
    href: "/center/finance?tab=salaries",
    icon: "wallet",
    roles: ["DIRECTOR", "CENTER_ADMIN", "ACCOUNTANT"],
    requiredPermission: "finance.read",
    requirePlanFeature: "financeAccounting",
    excludeCenterStatuses: ["BLOCKED", "CANCELLED"],
  },
  {
    id: "center-promo-codes",
    scope: "center",
    groupId: "finance",
    groupLabelKey: "navGroups.finance",
    labelKey: "nav.promoCodes",
    href: "/center/promo-codes",
    icon: "tag",
    roles: ["DIRECTOR", "CENTER_ADMIN", "ACCOUNTANT"],
    anyPermissions: ["payments.manage", "finance.read"],
    requirePlanFeature: "promoCodes",
    excludeCenterStatuses: ["BLOCKED", "CANCELLED"],
  },
  {
    id: "center-reports",
    scope: "center",
    groupId: "finance",
    groupLabelKey: "navGroups.finance",
    labelKey: "nav.reports",
    href: "/center/reports",
    icon: "bar-chart-3",
    roles: ["DIRECTOR", "CENTER_ADMIN", "ACCOUNTANT"],
    requiredPermission: "reports.read",
    requirePlanFeature: "advancedReports",
    excludeCenterStatuses: ["BLOCKED", "CANCELLED"],
  },

  // Teacher / Assistant Work group
  {
    id: "center-substitutions",
    scope: "center",
    groupId: "work",
    groupLabelKey: "navGroups.work",
    labelKey: "nav.substitutions",
    href: "/center/substitutions",
    icon: "calendar-range",
    roles: ["TEACHER", "TEACHER_ASSISTANT"],
    requiredPermission: "schedule.read",
    excludeCenterStatuses: ["BLOCKED", "CANCELLED"],
  },
  {
    id: "center-my-salary",
    scope: "center",
    groupId: "work",
    groupLabelKey: "navGroups.work",
    labelKey: "nav.mySalary",
    href: "/center/my-salary",
    icon: "wallet",
    roles: ["TEACHER", "TEACHER_ASSISTANT"],
    excludeCenterStatuses: ["BLOCKED", "CANCELLED"],
  },
  {
    id: "center-teacher-announcements",
    scope: "center",
    groupId: "work",
    groupLabelKey: "navGroups.work",
    labelKey: "nav.announcements",
    href: "/center/announcements",
    icon: "megaphone",
    roles: ["TEACHER", "TEACHER_ASSISTANT"],
    requiredPermission: "announcements.read",
    excludeCenterStatuses: ["BLOCKED", "CANCELLED"],
  },
  {
    id: "center-teacher-support",
    scope: "center",
    groupId: "work",
    groupLabelKey: "navGroups.work",
    labelKey: "nav.support",
    href: "/center/support",
    icon: "help-circle",
    roles: ["TEACHER", "TEACHER_ASSISTANT"],
    requiredPermission: "support.read",
  },

  // Communications (Director / Admin / Support / Student / Parent / Accountant)
  {
    id: "center-announcements",
    scope: "center",
    groupId: "communications",
    groupLabelKey: "navGroups.communications",
    labelKey: "nav.announcements",
    href: "/center/announcements",
    icon: "megaphone",
    roles: ["DIRECTOR", "CENTER_ADMIN", "CENTER_SUPPORT", "STUDENT", "PARENT"],
    requiredPermission: "announcements.read",
    excludeCenterStatuses: ["BLOCKED", "CANCELLED"],
  },
  {
    id: "center-communications",
    scope: "center",
    groupId: "communications",
    groupLabelKey: "navGroups.communications",
    labelKey: "nav.communications",
    href: "/center/communications",
    icon: "send",
    roles: ["DIRECTOR", "CENTER_ADMIN"],
    requiredPermission: "announcements.manage",
    requirePlanFeature: "broadcasts",
    excludeCenterStatuses: ["PAUSED", "OVERDUE", "BLOCKED", "CANCELLED"],
  },
  {
    id: "center-support",
    scope: "center",
    groupId: "communications",
    groupLabelKey: "navGroups.communications",
    labelKey: "nav.support",
    href: "/center/support",
    icon: "help-circle",
    roles: ["DIRECTOR", "CENTER_ADMIN", "ACCOUNTANT", "CENTER_SUPPORT", "PARENT"],
    requiredPermission: "support.read",
  },

  // Center Administration (Director / Center Admin)
  {
    id: "center-branches",
    scope: "center",
    groupId: "center",
    groupLabelKey: "navGroups.center",
    labelKey: "nav.branches",
    href: "/center/branches",
    icon: "building-2",
    roles: ["DIRECTOR", "CENTER_ADMIN"],
    requiredPermission: "branches.read",
    excludeCenterStatuses: ["BLOCKED", "CANCELLED"],
  },
  {
    id: "center-settings",
    scope: "center",
    groupId: "center",
    groupLabelKey: "navGroups.center",
    labelKey: "nav.centerSettings",
    href: "/center/settings",
    icon: "settings",
    exact: true,
    roles: ["DIRECTOR", "CENTER_ADMIN"],
    requiredPermission: "settings.read",
    excludeCenterStatuses: ["BLOCKED", "CANCELLED"],
  },
  {
    id: "center-audit",
    scope: "center",
    groupId: "center",
    groupLabelKey: "navGroups.center",
    labelKey: "nav.audit",
    href: "/center/audit",
    icon: "clipboard-list",
    roles: ["DIRECTOR", "CENTER_ADMIN"],
    requiredPermission: "audit.read",
    excludeCenterStatuses: ["BLOCKED", "CANCELLED"],
  },
];

function isCenterStatusAllowed(item: NavItemConfig, centerStatus?: CenterStatusType | string | null): boolean {
  if (!centerStatus) return true;
  const normalized = String(centerStatus) as CenterStatusType;
  if (item.allowedCenterStatuses && !item.allowedCenterStatuses.includes(normalized)) {
    return false;
  }
  if (item.excludeCenterStatuses && item.excludeCenterStatuses.includes(normalized)) {
    return false;
  }
  return true;
}

export function isNavItemVisible(item: NavItemConfig, ctx: NavigationContext): boolean {
  if (item.scope !== ctx.scope) return false;

  const platformRole = ctx.platformRole ?? "NONE";
  const centerRole = ctx.centerRole;

  if (ctx.scope === "center") {
    if (!centerRole || !item.roles.includes(centerRole)) {
      return false;
    }
    if (!isCenterStatusAllowed(item, ctx.centerStatus)) {
      return false;
    }
    if (item.requirePlanFeature && ctx.planFeatures) {
      const enabled = ctx.planFeatures[item.requirePlanFeature];
      if (enabled === false) {
        return false;
      }
    }
    const skipStudentSelfPerm = item.allowStudentSelfAccess && centerRole === "STUDENT";
    if (!skipStudentSelfPerm) {
      if (
        item.requiredPermission &&
        !hasPermission(item.requiredPermission, platformRole, centerRole, ctx.membershipPermissions)
      ) {
        return false;
      }
      if (item.anyPermissions && item.anyPermissions.length > 0) {
        const hasAny = item.anyPermissions.some((p) =>
          hasPermission(p, platformRole, centerRole, ctx.membershipPermissions)
        );
        if (!hasAny) return false;
      }
    }
    return true;
  }

  // platform or developer scope
  if (!item.roles.includes(String(platformRole))) {
    return false;
  }
  if (item.requiredPermission && !hasPermission(item.requiredPermission, platformRole)) {
    return false;
  }
  if (item.anyPermissions && item.anyPermissions.length > 0) {
    const hasAny = item.anyPermissions.some((p) => hasPermission(p, platformRole));
    if (!hasAny) return false;
  }
  return true;
}

export function getVisibleNavigation(ctx: NavigationContext): ResolvedNavGroup[] {
  const groups = new Map<string, ResolvedNavGroup>();
  const centerRole = ctx.centerRole as CenterRole | undefined;

  for (const item of NAV_ITEMS) {
    if (!isNavItemVisible(item, ctx)) continue;

    const groupKey = item.groupId ?? "__overview__";
    const resolvedGroupLabelKey =
      (centerRole && item.groupLabelByRole?.[centerRole]) || item.groupLabelKey || null;
    const resolvedItemLabelKey =
      (centerRole && item.labelByRole?.[centerRole]) || item.labelKey;

    let group = groups.get(groupKey);
    if (!group) {
      group = {
        id: groupKey,
        labelKey: item.groupId ? resolvedGroupLabelKey : null,
        items: [],
      };
      groups.set(groupKey, group);
    }

    group.items.push({
      id: item.id,
      scope: item.scope,
      groupId: item.groupId,
      labelKey: resolvedItemLabelKey,
      href: item.href,
      icon: item.icon,
      exact: item.exact,
    });
  }

  // Guarantee zero empty groups
  return Array.from(groups.values()).filter((g) => g.items.length > 0);
}

export function isNavItemActive(
  item: Pick<ResolvedNavItem, "href" | "exact">,
  pathname: string,
  searchParamsString?: string
): boolean {
  const [itemPath, itemQuery] = item.href.split("?");

  if (itemQuery) {
    if (pathname !== itemPath) return false;
    const itemParams = new URLSearchParams(itemQuery);
    const currentParams = new URLSearchParams(searchParamsString || "");
    for (const [k, v] of itemParams.entries()) {
      if (currentParams.get(k) !== v) return false;
    }
    return true;
  }

  if (itemPath === "/center/finance") {
    if (pathname !== itemPath) return false;
    const tab = new URLSearchParams(searchParamsString || "").get("tab");
    return tab !== "debts" && tab !== "salaries";
  }

  if (item.exact) {
    return pathname === itemPath;
  }

  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

export interface BreadcrumbSeed {
  labelKey?: string;
  labelFallback?: string;
  href?: string;
}

const EXTRA_ROUTE_LABELS: Record<string, string> = {
  "/account": "account.title",
  "/center/notifications": "notifications.title",
  "/center/activity": "nav.activity",
  "/center/settings/calendar": "nav.calendarSettings",
  "/center/upgrade": "nav.upgradePlan",
  "/platform-admin/centers/create": "platform.createCenter",
};

export function getBreadcrumbs(
  pathname: string,
  searchParamsString: string | undefined,
  groups: ResolvedNavGroup[],
  ctx: NavigationContext
): BreadcrumbSeed[] {
  const rootHref =
    ctx.scope === "platform"
      ? "/platform-admin"
      : ctx.scope === "developer"
        ? "/developer"
        : "/center";
  const rootLabelKey =
    ctx.scope === "platform"
      ? "shell.platformBadge"
      : ctx.scope === "developer"
        ? "roles.DEVELOPER"
        : "nav.center";

  const crumbs: BreadcrumbSeed[] = [{ labelKey: rootLabelKey, href: rootHref }];

  if (pathname === rootHref) {
    crumbs.push({ labelKey: "nav.overview" });
    return crumbs;
  }

  const allItems = groups.flatMap((g) => g.items.map((item) => ({ item, group: g })));
  const matched =
    allItems.find(({ item }) => isNavItemActive(item, pathname, searchParamsString)) ||
    allItems.find(({ item }) => pathname.startsWith(item.href.split("?")[0] + "/"));

  if (matched) {
    if (matched.group.labelKey) {
      crumbs.push({ labelKey: matched.group.labelKey });
    }
    const baseItemPath = matched.item.href.split("?")[0];
    const isDetailSubroute = pathname !== baseItemPath && !matched.item.href.includes("?");
    crumbs.push({
      labelKey: matched.item.labelKey,
      href: isDetailSubroute ? matched.item.href : undefined,
    });
    if (isDetailSubroute) {
      const extraKey = EXTRA_ROUTE_LABELS[pathname];
      if (extraKey) {
        crumbs.push({ labelKey: extraKey });
      }
    }
    return crumbs;
  }

  const extraKey = EXTRA_ROUTE_LABELS[pathname];
  if (extraKey) {
    crumbs.push({ labelKey: extraKey });
    return crumbs;
  }

  const tail = pathname.split("/").filter(Boolean).pop();
  if (tail) {
    crumbs.push({ labelFallback: tail });
  }
  return crumbs;
}
