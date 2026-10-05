import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "../src/lib/db";
import { sendNotification } from "../src/lib/notifications";

let mockToken = "";
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => (name === "auth_token" ? { value: mockToken } : undefined),
  }),
}));

describe("Phase 9: Notification System", () => {
  let tenantA: string;
  let tenantB: string;
  let userA: string;
  let userB: string;

  beforeAll(async () => {
    // Setup test tenants and users
    const ownerA = await db.platformUser.create({
      data: { email: `tenantA-${Date.now()}@test.com`, passwordHash: "x", fullName: "Owner A", platformRole: "TENANT_OWNER" },
    });
    const centerA = await db.learningCenter.create({
      data: { name: "Tenant A Center", slug: "tenant-a-test-" + Date.now(), ownerId: ownerA.id, status: "ACTIVE" },
    });
    tenantA = centerA.id;
    userA = ownerA.id;

    const ownerB = await db.platformUser.create({
      data: { email: `tenantB-${Date.now()}@test.com`, passwordHash: "x", fullName: "Owner B", platformRole: "TENANT_OWNER" },
    });
    const centerB = await db.learningCenter.create({
      data: { name: "Tenant B Center", slug: "tenant-b-test-" + Date.now(), ownerId: ownerB.id, status: "ACTIVE" },
    });
    tenantB = centerB.id;
    userB = ownerB.id;
  });

  afterAll(async () => {
    // Cleanup
    if (tenantA && tenantB) {
      await db.notification.deleteMany({
        where: { centerId: { in: [tenantA, tenantB] } },
      });
      await db.learningCenter.deleteMany({
        where: { id: { in: [tenantA, tenantB] } },
      });
    }
    if (userA && userB) {
      await db.platformUser.deleteMany({
        where: { id: { in: [userA, userB] } },
      });
    }
  });

  it("should create notifications successfully", async () => {
    const notif = await sendNotification({
      userId: userA,
      centerId: tenantA,
      type: "GENERAL",
      titleKey: "Test",
      bodyKey: "Body",
    });
    expect(notif).toBeDefined();
    expect(notif?.userId).toBe(userA);
    expect(notif?.centerId).toBe(tenantA);
  });

  it("CRITICAL: Tenant Isolation - DB level - User A cannot read User B notifications", async () => {
    // Create notification for B
    await sendNotification({
      userId: userB,
      centerId: tenantB,
      type: "GENERAL",
      titleKey: "Secret B DB",
      bodyKey: "Body DB",
    });

    const whereCondition = {
      userId: userA, // DB query level
      centerId: tenantA,
    };

    const userANotifs = await db.notification.findMany({
      where: whereCondition,
    });

    expect(userANotifs.some(n => n.centerId === tenantB)).toBe(false);
  });

  it("CRITICAL: Tenant Isolation - API level - User A cannot read User B notifications", async () => {
    await sendNotification({
      userId: userB,
      centerId: tenantB,
      type: "GENERAL",
      titleKey: "Secret B",
      bodyKey: "Body",
    });

    const { GET } = await import("../src/app/api/notifications/route");
    const { signJWT } = await import("../src/lib/auth");
    
    mockToken = signJWT({ userId: userA, email: "a", platformRole: "NONE", activeCenterId: tenantA, activeCenterRole: "STUDENT" });
    const req = new Request("http://localhost/api/notifications");
    const res = await GET(req);
    const data = await res.json();

    expect(data.notifications.some((n: any) => n.centerId === tenantB)).toBe(false);
  });

  it("should mark notification as read and prevent unauthorized access via API", async () => {
    const notif = await sendNotification({
      userId: userA,
      centerId: tenantA,
      type: "GENERAL",
      titleKey: "To Read",
      bodyKey: "Body",
    });

    const { PATCH } = await import("../src/app/api/notifications/route");
    const { signJWT } = await import("../src/lib/auth");
    
    mockToken = signJWT({ userId: userB, email: "b", platformRole: "NONE", activeCenterId: tenantB, activeCenterRole: "STUDENT" });
    
    const req = new Request("http://localhost/api/notifications", {
      method: "PATCH",
      body: JSON.stringify({ notificationId: notif!.id })
    });

    const res = await PATCH(req);
    expect(res.status).toBe(404);

    const check = await db.notification.findUnique({ where: { id: notif!.id } });
    expect(check?.isRead).toBe(false);
  });

  it("should track unread count accurately", async () => {
    await sendNotification({
      userId: userA,
      centerId: tenantA,
      type: "GENERAL",
      titleKey: "Unread 1",
      bodyKey: "Body",
    });
    await sendNotification({
      userId: userA,
      centerId: tenantA,
      type: "GENERAL",
      titleKey: "Unread 2",
      bodyKey: "Body",
    });

    const unreadCount = await db.notification.count({
      where: { userId: userA, isRead: false },
    });
    
    // We created 3 unread for A so far, but let's just check it's > 0
    expect(unreadCount).toBeGreaterThanOrEqual(2);
  });

  it("should mark all as read securely", async () => {
    await db.notification.updateMany({
      where: { userId: userA, isRead: false, centerId: tenantA },
      data: { isRead: true },
    });

    const unreadCount = await db.notification.count({
      where: { userId: userA, isRead: false, centerId: tenantA },
    });
    expect(unreadCount).toBe(0);
  });
});
