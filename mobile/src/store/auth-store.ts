import { create } from "zustand";
import { AuthStorage } from "../services/auth-storage";
import { OfflineCache } from "../services/offline-cache";
import { apiClient, setOnUnauthorizedCallback } from "../services/api-client";
import { API_ENDPOINTS } from "../config/api";

function detectPlatform(): "ios" | "android" {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rn = require("react-native");
    if (rn?.Platform?.OS === "ios") return "ios";
  } catch {}
  return "android";
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  platformRole: string;
  preferredLanguage?: string;
  avatarUrl?: string | null;
}

export interface CenterMembership {
  id: string;
  centerId: string;
  centerName: string;
  centerSlug: string;
  centerStatus: string;
  role: string;
}

interface LoginResponse {
  success: boolean;
  token: string;
  refreshToken?: string;
  user: UserProfile;
  memberships: CenterMembership[];
  activeCenterId: string | null;
  activeCenterRole: string | null;
}

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  memberships: CenterMembership[];
  activeCenterId: string | null;
  activeRole: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string, deviceName?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  switchRole: (role: string) => Promise<void>;
  switchCenter: (centerId: string) => Promise<void>;
  switchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  memberships: [],
  activeCenterId: null,
  activeRole: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (email: string, password: string, deviceName: string = "Mobile Device") => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient<LoginResponse>(API_ENDPOINTS.LOGIN, {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          deviceName,
          platform: detectPlatform(),
        }),
      });

      const { token, refreshToken, user, memberships, activeCenterId, activeCenterRole } = response;
      const resolvedRole =
        activeCenterRole || (memberships[0]?.role ?? user.platformRole);

      await AuthStorage.setItem("auth_token", token);
      if (refreshToken) await AuthStorage.setItem("auth_refresh_token", refreshToken);
      await AuthStorage.setItem("auth_user", JSON.stringify(user));
      await AuthStorage.setItem("auth_memberships", JSON.stringify(memberships || []));
      if (activeCenterId) await AuthStorage.setItem("auth_active_center", activeCenterId);
      if (resolvedRole) await AuthStorage.setItem("auth_active_role", resolvedRole);

      set({
        token,
        user,
        memberships: memberships || [],
        activeCenterId,
        activeRole: resolvedRole,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Не удалось войти";
      set({ error: message, isLoading: false });
      return false;
    }
  },

  logout: async () => {
    try {
      await apiClient(API_ENDPOINTS.LOGOUT, { method: "POST" }).catch(() => {});
    } finally {
      await OfflineCache.clear();
      await AuthStorage.clearAll();
      set({
        token: null,
        user: null,
        memberships: [],
        activeCenterId: null,
        activeRole: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  },

  switchUser: async () => {
    await OfflineCache.clear();
    await AuthStorage.clearAll();
    set({
      token: null,
      user: null,
      memberships: [],
      activeCenterId: null,
      activeRole: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  },

  restoreSession: async () => {
    set({ isLoading: true });
    try {
      const token = await AuthStorage.getItem("auth_token");
      const userStr = await AuthStorage.getItem("auth_user");
      const membershipsStr = await AuthStorage.getItem("auth_memberships");
      const centerId = await AuthStorage.getItem("auth_active_center");
      const role = await AuthStorage.getItem("auth_active_role");

      if (token && userStr) {
        const user = JSON.parse(userStr) as UserProfile;
        const memberships = membershipsStr
          ? (JSON.parse(membershipsStr) as CenterMembership[])
          : [];
        set({
          token,
          user,
          memberships,
          activeCenterId: centerId,
          activeRole: role || memberships[0]?.role || user.platformRole,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false, isAuthenticated: false });
      }
    } catch {
      await AuthStorage.clearAll();
      set({ isLoading: false, isAuthenticated: false });
    }
  },

  switchRole: async (role: string) => {
    await AuthStorage.setItem("auth_active_role", role);
    set({ activeRole: role });
  },

  switchCenter: async (centerId: string) => {
    await AuthStorage.setItem("auth_active_center", centerId);
    const membership = get().memberships.find((m) => m.centerId === centerId);
    if (membership) {
      await AuthStorage.setItem("auth_active_role", membership.role);
      set({ activeCenterId: centerId, activeRole: membership.role });
    } else {
      set({ activeCenterId: centerId });
    }
  },
}));

// Automatically clear local auth state on 401 responses
setOnUnauthorizedCallback(() => {
  OfflineCache.clear().catch(() => {});
  AuthStorage.clearAll().catch(() => {});
  useAuthStore.setState({
    token: null,
    user: null,
    memberships: [],
    activeCenterId: null,
    activeRole: null,
    isAuthenticated: false,
    isLoading: false,
  });
});
