import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../src/lib/db";
import { checkSubscriptionLimit } from "../src/lib/limits";

describe("Subscription Limits (Trial)", () => {
  let centerId: string;
  let planId: string;

  let ownerId: string;

  beforeAll(async () => {
    // create plan
    const plan = await db.subscriptionPlan.create({
      data: {
        name: "Test Plan",
        maxStudents: 5,
        maxTeachers: 5,
        maxCourses: 5,
        maxBranches: 1,
        priceMonthly: 0,
      }
    });
    planId = plan.id;
    const u = await db.platformUser.create({ data: { email: `u-${Date.now()}@test.com`, fullName: "U", passwordHash: "x" }});
    ownerId = u.id;
  });

  it("trial center respects limits", async () => {
    const center = await db.learningCenter.create({
      data: { name: "Trial Center", slug: `tc-${Date.now()}`, timeZone: "Asia/Tashkent", status: "TRIAL", ownerId }
    });
    await db.subscription.create({
      data: {
        centerId: center.id,
        planId,
        status: "TRIAL",
        currentPeriodStartsAt: new Date(),
        currentPeriodEndsAt: new Date(Date.now() + 86400000)
      }
    });

    const canAdd1 = await checkSubscriptionLimit(center.id, "students", 1);
    expect(canAdd1).toBe(true);

    const canAdd6 = await checkSubscriptionLimit(center.id, "students", 6);
    expect(canAdd6).toBe(false); // Because maxStudents = 5
  });

  it("paused/blocked/cancelled/overdue center has no active subscription limits bypass", async () => {
    for (const status of ["PAUSED", "BLOCKED", "CANCELLED", "OVERDUE"]) {
      const center = await db.learningCenter.create({
        data: { name: `Status Center ${status}`, slug: `sc-${status.toLowerCase()}-${Date.now()}`, timeZone: "Asia/Tashkent", status, ownerId }
      });
      await db.subscription.create({
        data: {
          centerId: center.id,
          planId,
          status,
          currentPeriodStartsAt: new Date(),
          currentPeriodEndsAt: new Date(Date.now() + 86400000)
        }
      });

      const canAdd = await checkSubscriptionLimit(center.id, "students", 1);
      expect(canAdd).toBe(false);
    }
  });
});
