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
    await this.removeItem("auth_token");
    await this.removeItem("auth_user");
    await this.removeItem("auth_active_center");
    await this.removeItem("auth_active_role");
    memoryStorage.clear();
  },
};
