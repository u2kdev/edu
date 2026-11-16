import { describe, it, expect } from "vitest";
import {
  getBreadcrumbs,
  getVisibleNavigation,
  isNavItemActive,
  NAV_ITEMS,
  type CenterStatusType,
} from "@/config/navigation";
import { PLAN_PRESETS } from "@/lib/plan-features";

describe("src/config/navigation.ts", () => {
  const platformRoles = [
    "DEVELOPER",
    "SUPERADMIN",
    "PLATFORM_ADMIN",
    "FULL_ACCESS",
    "PLATFORM_SUPPORT",
    "SEO_ADMIN",
  ] as const;

  const centerRoles = [
    "DIRECTOR",
    "CENTER_ADMIN",
    "ACCOUNTANT",
    "TEACHER",
    "TEACHER_ASSISTANT",
    "CENTER_SUPPORT",
    "STUDENT",
    "PARENT",
  ] as const;

  it("never produces empty navigation groups across any platform or center role", () => {
    for (const role of platformRoles) {
      const groups = getVisibleNavigation({ scope: "platform", platformRole: role });
      expect(groups.length).toBeGreaterThan(0);
      for (const g of groups) {
        expect(g.items.length).toBeGreaterThan(0);
      }
    }

    for (const role of centerRoles) {
      for (const preset of [PLAN_PRESETS.start, PLAN_PRESETS.growth, PLAN_PRESETS.pro]) {
        for (const status of ["TRIAL", "ACTIVE", "PAUSED", "OVERDUE", "BLOCKED"] as CenterStatusType[]) {
          const groups = getVisibleNavigation({
            scope: "center",
            platformRole: "NONE",
            centerRole: role,
            planFeatures: preset,
            centerStatus: status,
          });
          expect(groups.length).toBeGreaterThan(0);
          for (const g of groups) {
            expect(g.items.length).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it("exposes complete platform navigation for SUPERADMIN and restricts PLATFORM_SUPPORT / SEO_ADMIN", () => {
    const superGroups = getVisibleNavigation({
      scope: "platform",
      platformRole: "SUPERADMIN",
    });
    const superHrefs = superGroups.flatMap((g) => g.items.map((i) => i.href));
    expect(superHrefs).toEqual(
      expect.arrayContaining([
        "/platform-admin",
        "/platform-admin/centers",
        "/platform-admin/subscriptions",
        "/platform-admin/plans",
        "/platform-admin/finance/payments",
        "/platform-admin/finance/expenses",
        "/platform-admin/finance",
        "/platform-admin/users",
        "/platform-admin/team",
        "/platform-admin/registrations",
        "/platform-admin/support",
        "/platform-admin/announcements",
        "/platform-admin/audit",
        "/platform-admin/security",
        "/platform-admin/settings",
        "/platform-admin/system-health",
      ])
    );

    const supportHrefs = getVisibleNavigation({
      scope: "platform",
      platformRole: "PLATFORM_SUPPORT",
    }).flatMap((g) => g.items.map((i) => i.href));
    expect(supportHrefs).toContain("/platform-admin");
    expect(supportHrefs).toContain("/platform-admin/support");
    expect(supportHrefs).toContain("/platform-admin/announcements");
    expect(supportHrefs).toContain("/platform-admin/system-health");
    expect(supportHrefs).not.toContain("/platform-admin/plans");
    expect(supportHrefs).not.toContain("/platform-admin/finance/payments");
    expect(supportHrefs).not.toContain("/platform-admin/team");
    expect(supportHrefs).not.toContain("/platform-admin/audit");

    const seoHrefs = getVisibleNavigation({
      scope: "platform",
      platformRole: "SEO_ADMIN",
    }).flatMap((g) => g.items.map((i) => i.href));
    expect(seoHrefs).toContain("/platform-admin/seo");
    expect(seoHrefs).toContain("/platform-admin/settings");
    expect(seoHrefs).not.toContain("/platform-admin/centers");
    expect(seoHrefs).not.toContain("/platform-admin/finance");
  });

  it("renders developer console routes only for DEVELOPER and SUPERADMIN", () => {
    for (const allowed of ["DEVELOPER", "SUPERADMIN"]) {
      const hrefs = getVisibleNavigation({ scope: "developer", platformRole: allowed }).flatMap(
        (g) => g.items.map((i) => i.href)
      );
      expect(hrefs).toEqual(["/developer", "/developer/audit", "/developer/owners"]);
    }
    for (const denied of ["PLATFORM_ADMIN", "SEO_ADMIN", "NONE"]) {
      const groups = getVisibleNavigation({ scope: "developer", platformRole: denied });
      expect(groups).toEqual([]);
    }
  });

  it("scopes center navigation accurately across all 8 center roles", () => {
    const getHrefs = (role: string) =>
      getVisibleNavigation({
        scope: "center",
        platformRole: "NONE",
        centerRole: role,
        planFeatures: PLAN_PRESETS.pro,
        centerStatus: "ACTIVE",
      }).flatMap((g) => g.items.map((i) => i.href));

    const director = getHrefs("DIRECTOR");
    expect(director).toContain("/center/branches");
    expect(director).toContain("/center/staff");
    expect(director).toContain("/center/invites");
    expect(director).toContain("/center/finance");
    expect(director).toContain("/center/finance?tab=debts");
    expect(director).toContain("/center/finance?tab=salaries");
    expect(director).toContain("/center/promo-codes");
    expect(director).toContain("/center/reports");
    expect(director).toContain("/center/communications");
    expect(director).toContain("/center/audit");

    const accountant = getHrefs("ACCOUNTANT");
    expect(accountant).toContain("/center");
    expect(accountant).toContain("/center/payments");
    expect(accountant).toContain("/center/finance?tab=debts");
    expect(accountant).toContain("/center/finance");
    expect(accountant).toContain("/center/finance?tab=salaries");
    expect(accountant).toContain("/center/promo-codes");
    expect(accountant).toContain("/center/reports");
    expect(accountant).toContain("/center/support");
    expect(accountant).not.toContain("/center/students");
    expect(accountant).not.toContain("/center/grades");

    const teacher = getHrefs("TEACHER");
    expect(teacher).toContain("/center/schedule");
    expect(teacher).toContain("/center/groups");
    expect(teacher).toContain("/center/substitutions");
    expect(teacher).toContain("/center/my-salary");
    expect(teacher).toContain("/center/announcements");
    expect(teacher).toContain("/center/support");
    expect(teacher).not.toContain("/center/finance");
    expect(teacher).not.toContain("/center/staff");

    const student = getHrefs("STUDENT");
    expect(student).toContain("/center/schedule");
    expect(student).toContain("/center/courses");
    expect(student).toContain("/center/homework");
    expect(student).toContain("/center/tests");
    expect(student).toContain("/center/grades");
    expect(student).toContain("/center/attendance");
    expect(student).toContain("/center/materials");
    expect(student).toContain("/center/payments");
    expect(student).toContain("/center/announcements");
    expect(student).not.toContain("/center/groups");
    expect(student).not.toContain("/center/support");

    const parent = getHrefs("PARENT");
    expect(parent).toContain("/center/schedule");
    expect(parent).toContain("/center/grades");
    expect(parent).toContain("/center/attendance");
    expect(parent).toContain("/center/homework");
    expect(parent).toContain("/center/payments");
    expect(parent).toContain("/center/announcements");
    expect(parent).toContain("/center/support");
    expect(parent).not.toContain("/center/courses");
    expect(parent).not.toContain("/center/tests");
    expect(parent).not.toContain("/center/materials");

    const support = getHrefs("CENTER_SUPPORT");
    expect(support).toEqual(["/center", "/center/announcements", "/center/support"]);
  });

  it("hides feature-gated items based on requirePlanFeature flags", () => {
    const startHrefs = getVisibleNavigation({
      scope: "center",
      platformRole: "NONE",
      centerRole: "DIRECTOR",
      planFeatures: PLAN_PRESETS.start,
      centerStatus: "ACTIVE",
    }).flatMap((g) => g.items.map((i) => i.href));

    expect(startHrefs).toContain("/center/payments");
    expect(startHrefs).not.toContain("/center/finance");
    expect(startHrefs).not.toContain("/center/finance?tab=debts");
    expect(startHrefs).not.toContain("/center/finance?tab=salaries");
    expect(startHrefs).not.toContain("/center/promo-codes");
    expect(startHrefs).not.toContain("/center/reports");
    expect(startHrefs).not.toContain("/center/communications");

    const growthHrefs = getVisibleNavigation({
      scope: "center",
      platformRole: "NONE",
      centerRole: "DIRECTOR",
      planFeatures: PLAN_PRESETS.growth,
      centerStatus: "ACTIVE",
    }).flatMap((g) => g.items.map((i) => i.href));

    expect(growthHrefs).toContain("/center/promo-codes");
    expect(growthHrefs).toContain("/center/reports");
    expect(growthHrefs).toContain("/center/communications");
    expect(growthHrefs).not.toContain("/center/finance");
  });

  it("respects center status restrictions and membership permission overrides", () => {
    const pausedDirectorHrefs = getVisibleNavigation({
      scope: "center",
      platformRole: "NONE",
      centerRole: "DIRECTOR",
      planFeatures: PLAN_PRESETS.pro,
      centerStatus: "PAUSED",
    }).flatMap((g) => g.items.map((i) => i.href));
    expect(pausedDirectorHrefs).not.toContain("/center/invites");
    expect(pausedDirectorHrefs).not.toContain("/center/communications");
    expect(pausedDirectorHrefs).toContain("/center/payments");
    expect(pausedDirectorHrefs).toContain("/center/support");

    const blockedHrefs = getVisibleNavigation({
      scope: "center",
      platformRole: "NONE",
      centerRole: "DIRECTOR",
      planFeatures: PLAN_PRESETS.pro,
      centerStatus: "BLOCKED",
    }).flatMap((g) => g.items.map((i) => i.href));
    expect(blockedHrefs).toEqual(["/center", "/center/support"]);

    const deniedParentHrefs = getVisibleNavigation({
      scope: "center",
      platformRole: "NONE",
      centerRole: "PARENT",
      membershipPermissions: JSON.stringify({ denied: ["payments.read", "grades.read"] }),
      planFeatures: PLAN_PRESETS.pro,
      centerStatus: "ACTIVE",
    }).flatMap((g) => g.items.map((i) => i.href));
    expect(deniedParentHrefs).not.toContain("/center/payments");
    expect(deniedParentHrefs).not.toContain("/center/grades");
    expect(deniedParentHrefs).toContain("/center/schedule");
  });

  it("distinguishes active items with query tabs and builds accurate breadcrumbs", () => {
    const financeItem = NAV_ITEMS.find((i) => i.id === "center-finance")!;
    const debtsItem = NAV_ITEMS.find((i) => i.id === "center-debts")!;
    const salariesItem = NAV_ITEMS.find((i) => i.id === "center-salaries")!;

    expect(isNavItemActive(financeItem, "/center/finance", "")).toBe(true);
    expect(isNavItemActive(debtsItem, "/center/finance", "")).toBe(false);

    expect(isNavItemActive(financeItem, "/center/finance", "tab=debts")).toBe(false);
    expect(isNavItemActive(debtsItem, "/center/finance", "tab=debts")).toBe(true);
    expect(isNavItemActive(salariesItem, "/center/finance", "tab=debts")).toBe(false);

    expect(isNavItemActive(salariesItem, "/center/finance", "tab=salaries")).toBe(true);
    expect(isNavItemActive(financeItem, "/center/finance", "tab=salaries")).toBe(false);

    const groups = getVisibleNavigation({
      scope: "center",
      platformRole: "NONE",
      centerRole: "DIRECTOR",
      planFeatures: PLAN_PRESETS.pro,
      centerStatus: "ACTIVE",
    });

    const crumbsDebts = getBreadcrumbs("/center/finance", "tab=debts", groups, {
      scope: "center",
      centerRole: "DIRECTOR",
    });
    expect(crumbsDebts.map((c) => c.labelKey)).toEqual([
      "nav.center",
      "navGroups.finance",
      "nav.debts",
    ]);

    const crumbsAccount = getBreadcrumbs("/account", "tab=security", groups, {
      scope: "center",
      centerRole: "DIRECTOR",
    });
    expect(crumbsAccount.map((c) => c.labelKey)).toEqual(["nav.center", "account.title"]);
  });
});
