import { describe, it, expect, beforeEach } from "vitest";
import { OfflineCache } from "../mobile/src/services/offline-cache";
import { AuthStorage } from "../mobile/src/services/auth-storage";
import { SecureCipher } from "../mobile/src/services/secure-cipher";

describe("Mobile Offline Cache Encryption for Sensitive Child & Grade Data", () => {
  beforeEach(async () => {
    await AuthStorage.clearAll();
    await SecureCipher.wipeKey();
  });

  it("encrypts grades and child data so raw device storage contains no plaintext", async () => {
    const sensitiveGrades = {
      studentName: "Alisher Navoiy",
      childId: "child-999",
      grades: [
        { subject: "Mathematics", score: 100, comment: "Top performer" },
        { subject: "History", score: 98, comment: "Excellent" },
      ],
    };

    await OfflineCache.set("grades_student_1", sensitiveGrades);

    // 1. Inspect raw storage in AuthStorage: must NOT contain plain JSON or sensitive words
    const rawStored = await AuthStorage.getItem("offline_cache_grades_student_1");
    expect(rawStored).not.toBeNull();
    expect(rawStored).not.toContain("Alisher Navoiy");
    expect(rawStored).not.toContain("Top performer");
    expect(rawStored).not.toContain("Mathematics");
    expect(rawStored).toContain("__encrypted");

    // 2. Normal get through OfflineCache decrypts cleanly
    const retrieved = await OfflineCache.get<typeof sensitiveGrades>("grades_student_1");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.studentName).toBe("Alisher Navoiy");
    expect(retrieved?.grades[0]?.score).toBe(100);
  });

  it("child/parent dashboard data is encrypted with key stored in SecureStore", async () => {
    const childrenData = {
      children: [
        { id: "child-1", fullName: "Zarina Karimova", birthDate: "2015-04-12" },
      ],
    };

    await OfflineCache.set("parent_dashboard_children", childrenData);

    const rawStored = await AuthStorage.getItem("offline_cache_parent_dashboard_children");
    expect(rawStored).not.toBeNull();
    expect(rawStored).not.toContain("Zarina Karimova");
    expect(rawStored).not.toContain("2015-04-12");

    const retrieved = await OfflineCache.get<typeof childrenData>("parent_dashboard_children");
    expect(retrieved?.children[0]?.fullName).toBe("Zarina Karimova");
  });

  it("wiping the encryption key invalidates all encrypted cache entries", async () => {
    await OfflineCache.set("grades_term_1", { score: 95 });

    // Wipe key from SecureStore
    await SecureCipher.wipeKey();

    // With key destroyed, encrypted data cannot be decrypted
    const retrieved = await OfflineCache.get("grades_term_1");
    expect(retrieved).toBeNull();
  });

  it("non-sensitive data (e.g. app schedule) is cached without overhead", async () => {
    const scheduleData = { week: 42, day: "Monday" };
    await OfflineCache.set("schedule", scheduleData);

    const rawStored = await AuthStorage.getItem("offline_cache_schedule");
    expect(rawStored).not.toBeNull();
    expect(rawStored).toContain("Monday");

    const retrieved = await OfflineCache.get<typeof scheduleData>("schedule");
    expect(retrieved?.day).toBe("Monday");
  });

  it("OfflineCache.clear() removes both data and purges registered keys", async () => {
    await OfflineCache.set("grades_test", { score: 5 });
    await OfflineCache.set("parent_children", { count: 2 });

    await OfflineCache.clear();

    expect(await OfflineCache.get("grades_test")).toBeNull();
    expect(await OfflineCache.get("parent_children")).toBeNull();
  });
});
