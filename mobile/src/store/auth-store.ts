import { create } from "zustand";
import { AuthStorage } from "../services/auth-storage";
import { apiClient } from "../services/api-client";
import { API_ENDPOINTS } from "../config/api";

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
          platform: "ios", // default or runtime platform
        }),
      });

      const { token, user, memberships, activeCenterId, activeCenterRole } = response;

      await AuthStorage.setItem("auth_token", token);
      await AuthStorage.setItem("auth_user", JSON.stringify(user));
      if (activeCenterId) await AuthStorage.setItem("auth_active_center", activeCenterId);
      if (activeCenterRole) await AuthStorage.setItem("auth_active_role", activeCenterRole);

      set({
        token,
        user,
        memberships,
        activeCenterId,
        activeRole: activeCenterRole || (memberships[0]?.role ?? user.platformRole),
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

  restoreSession: async () => {
    set({ isLoading: true });
    try {
      const token = await AuthStorage.getItem("auth_token");
      const userStr = await AuthStorage.getItem("auth_user");
      const centerId = await AuthStorage.getItem("auth_active_center");
      const role = await AuthStorage.getItem("auth_active_role");

      if (token && userStr) {
        const user = JSON.parse(userStr) as UserProfile;
        set({
          token,
          user,
          activeCenterId: centerId,
          activeRole: role || user.platformRole,
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
