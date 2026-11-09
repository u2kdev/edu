import { describe, it, expect, beforeEach, vi } from "vitest";
import { OfflineCache } from "../mobile/src/services/offline-cache";
import { AuthStorage } from "../mobile/src/services/auth-storage";
import { cachedApiClient, ApiError } from "../mobile/src/services/api-client";

describe("Mobile Secure Offline Cache", () => {
  beforeEach(async () => {
    await AuthStorage.clearAll();
  });

  it("stores and retrieves data from secure storage within TTL", async () => {
    const testData = { studentId: "std-123", name: "Aziz", grades: [95, 100] };
    await OfflineCache.set("student_profile", testData, 60000);

    const cached = await OfflineCache.get<{ studentId: string; name: string }>("student_profile");
    expect(cached).not.toBeNull();
    expect(cached?.studentId).toBe("std-123");
    expect(cached?.name).toBe("Aziz");
  });

  it("expires cached items when TTL is exceeded", async () => {
    const testData = { schedule: ["Math", "Physics"] };
    // Set expired TTL (-1 ms)
    await OfflineCache.set("schedule", testData, -1);

    const cached = await OfflineCache.get<{ schedule: string[] }>("schedule");
    expect(cached).toBeNull();
  });

  it("wipes all business cache on logout via AuthStorage.clearAll()", async () => {
    await OfflineCache.set("student", { data: "secret" });
    await OfflineCache.set("teacher", { data: "journal" });

    await AuthStorage.clearAll();

    expect(await OfflineCache.get("student")).toBeNull();
    expect(await OfflineCache.get("teacher")).toBeNull();
  });

  it("cachedApiClient: falls back to offline cache on network error", async () => {
    // 1. Prime the offline cache
    const mockProfile = { id: "p-1", role: "STUDENT", name: "Offline Student" };
    await OfflineCache.set("student_dashboard", mockProfile);

    // 2. Mock global fetch to simulate network loss
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error("Network request failed"));

    try {
      const result = await cachedApiClient<{ id: string; name: string }>(
        "/api/mobile/student/dashboard",
        "student_dashboard"
      );

      expect(result.fromCache).toBe(true);
      expect(result.data.id).toBe("p-1");
      expect(result.data.name).toBe("Offline Student");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("cachedApiClient: strictly refuses to cache or serve stale cache on 401 Unauthorized and clears storage", async () => {
    // 1. Store initial data in cache
    await OfflineCache.set("student_dashboard", { sensitive: "data" });

    // 2. Mock global fetch to return 401 Unauthorized
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
      json: async () => ({ error: { code: "UNAUTHORIZED", message: "Token expired" } }),
    } as Response);

    try {
      await expect(
        cachedApiClient("/api/mobile/student/dashboard", "student_dashboard")
      ).rejects.toThrow(ApiError);

      // Verify cache was wiped and not served
      const cacheAfter = await OfflineCache.get("student_dashboard");
      expect(cacheAfter).toBeNull();
    } finally {
      global.fetch = originalFetch;
    }
  });
});
