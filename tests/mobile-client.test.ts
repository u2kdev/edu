import { describe, it, expect, beforeEach } from "vitest";
import { resolveRoleRoute } from "../mobile/src/navigation/role-router";
import { AuthStorage } from "../mobile/src/services/auth-storage";
import ruLocale from "../mobile/src/i18n/locales/ru.json";
import uzLocale from "../mobile/src/i18n/locales/uz.json";

describe("Mobile Client Architecture & Routing", () => {
  beforeEach(async () => {
    await AuthStorage.clearAll();
  });

  describe("Role-Based Route Resolver", () => {
    it("routes STUDENT to /(student)", () => {
      expect(resolveRoleRoute("STUDENT")).toBe("/(student)");
    });

    it("routes PARENT to /(parent)", () => {
      expect(resolveRoleRoute("PARENT")).toBe("/(parent)");
    });

    it("routes TEACHER and TEACHER_ASSISTANT to /(teacher)", () => {
      expect(resolveRoleRoute("TEACHER")).toBe("/(teacher)");
      expect(resolveRoleRoute("TEACHER_ASSISTANT")).toBe("/(teacher)");
    });

    it("routes DIRECTOR and CENTER_ADMIN to /(director)", () => {
      expect(resolveRoleRoute("DIRECTOR")).toBe("/(director)");
      expect(resolveRoleRoute("CENTER_ADMIN")).toBe("/(director)");
    });

    it("routes platform roles to /(platform)", () => {
      expect(resolveRoleRoute("SUPERADMIN")).toBe("/(platform)");
      expect(resolveRoleRoute("PLATFORM_ADMIN")).toBe("/(platform)");
      expect(resolveRoleRoute("DEVELOPER")).toBe("/(platform)");
    });

    it("routes unauthenticated or null to /(auth)/login", () => {
      expect(resolveRoleRoute(null)).toBe("/(auth)/login");
      expect(resolveRoleRoute(undefined)).toBe("/(auth)/login");
      expect(resolveRoleRoute("NONE")).toBe("/(auth)/login");
    });
  });

  describe("Secure AuthStorage", () => {
    it("stores, retrieves, and removes tokens", async () => {
      await AuthStorage.setItem("auth_token", "sample-mobile-jwt");
      const retrieved = await AuthStorage.getItem("auth_token");
      expect(retrieved).toBe("sample-mobile-jwt");

      await AuthStorage.removeItem("auth_token");
      const afterRemoval = await AuthStorage.getItem("auth_token");
      expect(afterRemoval).toBeNull();
    });

    it("clears all authentication keys on logout", async () => {
      await AuthStorage.setItem("auth_token", "jwt-1");
      await AuthStorage.setItem("auth_user", JSON.stringify({ id: "u1" }));
      await AuthStorage.setItem("auth_active_center", "c1");
      await AuthStorage.setItem("auth_active_role", "STUDENT");

      await AuthStorage.clearAll();

      expect(await AuthStorage.getItem("auth_token")).toBeNull();
      expect(await AuthStorage.getItem("auth_user")).toBeNull();
      expect(await AuthStorage.getItem("auth_active_center")).toBeNull();
      expect(await AuthStorage.getItem("auth_active_role")).toBeNull();
    });
  });

  describe("i18n Translation Parity (ru <-> uz)", () => {
    function getKeys(obj: Record<string, unknown>, prefix = ""): string[] {
      return Object.keys(obj).flatMap((key) => {
        const val = obj[key];
        const nextKey = prefix ? `${prefix}.${key}` : key;
        if (typeof val === "object" && val !== null && !Array.isArray(val)) {
          return getKeys(val as Record<string, unknown>, nextKey);
        }
        return [nextKey];
      });
    }

    const ruKeys = getKeys(ruLocale).sort();
    const uzKeys = getKeys(uzLocale).sort();

    it("ensures 100% dictionary key parity between ru and uz locales", () => {
      expect(ruKeys).toEqual(uzKeys);
    });

    it("verifies all critical role and auth keys exist", () => {
      expect(ruKeys).toContain("auth.title");
      expect(ruKeys).toContain("auth.loginButton");
      expect(ruKeys).toContain("roles.student");
      expect(ruKeys).toContain("roles.parent");
      expect(ruKeys).toContain("student.nextClass");
      expect(ruKeys).toContain("parent.attendanceStatus");
    });
  });
});
