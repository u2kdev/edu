const memoryStorage = new Map<string, string>();

async function getSecureStore() {
  try {
    return await import("expo-secure-store");
  } catch {
    return null;
  }
}

export const AuthStorage = {
  async setItem(key: string, value: string): Promise<void> {
    const SecureStore = await getSecureStore();
    if (SecureStore && typeof SecureStore.setItemAsync === "function") {
      try {
        await SecureStore.setItemAsync(key, value);
        return;
      } catch {}
    }
    memoryStorage.set(key, value);
  },

  async getItem(key: string): Promise<string | null> {
    const SecureStore = await getSecureStore();
    if (SecureStore && typeof SecureStore.getItemAsync === "function") {
      try {
        const val = await SecureStore.getItemAsync(key);
        if (val !== null) return val;
      } catch {}
    }
    return memoryStorage.get(key) || null;
  },

  async removeItem(key: string): Promise<void> {
    const SecureStore = await getSecureStore();
    if (SecureStore && typeof SecureStore.deleteItemAsync === "function") {
      try {
        await SecureStore.deleteItemAsync(key);
        return;
      } catch {}
    }
    memoryStorage.delete(key);
  },

  async clearAll(): Promise<void> {
    const allKeys = [
      "auth_token",
      "auth_refresh_token",
      "auth_device_id",
      "auth_user",
      "auth_memberships",
      "auth_active_center",
      "auth_active_role",
      "offline_cache_student",
      "offline_cache_teacher",
      "offline_cache_parent",
      "offline_cache_director",
      "offline_cache_platform",
      "offline_cache_schedule",
      "offline_cache_grades",
      "offline_cache_homework",
    ];
    for (const k of allKeys) {
      await this.removeItem(k);
    }
    memoryStorage.clear();
  },
};
