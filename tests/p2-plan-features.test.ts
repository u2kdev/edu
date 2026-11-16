import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "../src/lib/db";
import { signJWT, hashPassword } from "../src/lib/auth";
import { encryptSecret } from "../src/lib/crypto-cipher";
import {
  PLAN_PRESETS,
  FULL_PLAN_FEATURES,
  parsePlanFeatures,
  getCenterPlanFeatures,
} from "../src/lib/plan-features";
import { POST as postIntentRoute } from "../src/app/api/payments/intent/route";
import {
  GET as getMerchantConfigRoute,
  PUT as putMerchantConfigRoute,
  POST as postVerifyMerchantRoute,
} from "../src/app/api/center/merchant-config/route";
import { GET as getPromoRoute, POST as postPromoRoute } from "../src/app/api/promo-codes/route";
import { PATCH as patchPromoRoute } from "../src/app/api/promo-codes/[id]/route";
import {
  GET as getFinanceTxRoute,
  POST as postFinanceTxRoute,
} from "../src/app/api/finance/transactions/route";
import { POST as postFinanceAccRoute } from "../src/app/api/finance/accounts/route";
import { GET as getFinanceExportRoute } from "../src/app/api/finance/export/route";
import { POST as postBroadcastsRoute } from "../src/app/api/communications/broadcasts/route";
import { POST as postTemplatesRoute } from "../src/app/api/communications/templates/route";
import {
  GET as getUpgradeRoute,
  POST as postUpgradeRoute,
} from "../src/app/api/center/upgrade-request/route";
import { PATCH as patchPlatformPlansRoute } from "../src/app/api/platform/plans/route";

let mockToken = "";

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => (name === "auth_token" ? { value: mockToken } : undefined),
    set: vi.fn(),
  }),
}));

describe("P2 SaaS Plan Feature Gating, Read-Only Downgrade & Upgrade Flow", () => {
  const ts = Date.now();
  const createdCenterIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdPlanIds: string[] = [];

  let centerId = "";
  let legacyCenterId = "";
  let dirUserId = "";
  let dirEmail = "";
  let studentUserId = "";
  let studentEmail = "";
  let studentMemId = "";
  let ownerUserId = "";
  let ownerEmail = "";
  let startPlanId = "";
  let proPlanId = "";
  let subscriptionId = "";
  let existingPromoId = "";
  let accountId = "";

  beforeAll(async () => {
    const passHash = await hashPassword("PlanGate!123");

    const owner = await db.platformUser.create({
      data: {
        email: `pf_owner_${ts}@test.uz`,
        fullName: "Platform Superadmin",
        platformRole: "SUPERADMIN",
        passwordHash: passHash,
        emailVerified: new Date(),
      },
    });
    const dir = await db.platformUser.create({
      data: {
        email: `pf_dir_${ts}@test.uz`,
        fullName: "Plan Director",
        passwordHash: passHash,
        emailVerified: new Date(),
      },
    });
    const stu = await db.platformUser.create({
      data: {
        email: `pf_stu_${ts}@test.uz`,
        fullName: "Plan Student",
        passwordHash: passHash,
        emailVerified: new Date(),
      },
    });
    createdUserIds.push(owner.id, dir.id, stu.id);
    ownerUserId = owner.id;
    ownerEmail = owner.email;
    dirUserId = dir.id;
    dirEmail = dir.email;
    studentUserId = stu.id;
    studentEmail = stu.email;

    const pStart = await db.subscriptionPlan.create({
      data: {
        name: `Start-${ts}`,
        maxStudents: 50,
        maxTeachers: 5,
        maxCourses: 10,
        priceMonthly: 290000,
        featuresJson: JSON.stringify(PLAN_PRESETS.start),
        isActive: true,
      },
    });
    const pPro = await db.subscriptionPlan.create({
      data: {
        name: `Pro-${ts}`,
        maxStudents: 500,
        maxTeachers: 50,
        maxCourses: 100,
        priceMonthly: 990000,
        featuresJson: JSON.stringify(PLAN_PRESETS.pro),
        isActive: true,
      },
    });
    createdPlanIds.push(pStart.id, pPro.id);
    startPlanId = pStart.id;
    proPlanId = pPro.id;

    const center = await db.learningCenter.create({
      data: {
        name: "Plan Gated Academy",
        slug: `pg-academy-${ts}`,
        status: "ACTIVE",
        ownerId: dir.id,
      },
    });
    const legacyCenter = await db.learningCenter.create({
      data: {
        name: "Legacy No Sub Academy",
        slug: `pg-legacy-${ts}`,
        status: "ACTIVE",
        ownerId: dir.id,
      },
    });
    createdCenterIds.push(center.id, legacyCenter.id);
    centerId = center.id;
    legacyCenterId = legacyCenter.id;

    const [dirMem, stuMem] = await Promise.all([
      db.centerMembership.create({
        data: { userId: dir.id, centerId, role: "DIRECTOR", status: "ACTIVE" },
      }),
      db.centerMembership.create({
        data: { userId: stu.id, centerId, role: "STUDENT", status: "ACTIVE" },
      }),
    ]);
    studentMemId = stuMem.id;

    // Give center existing promo code, finance account, merchant config BEFORE downgrading to Start
    const promo = await db.promoCode.create({
      data: {
        centerId,
        code: `LEGACY_${String(ts).slice(-5)}`,
        discountType: "PERCENT",
        value: 10,
        createdByUserId: dir.id,
      },
    });
    existingPromoId = promo.id;

    const acc = await db.account.create({
      data: { centerId, name: "Касса", type: "CASH", isDefault: true },
    });
    accountId = acc.id;

    await db.centerMerchantConfig.create({
      data: {
        centerId,
        provider: "CLICK",
        serviceId: "11122",
        merchantId: "33344",
        encryptedSecretKey: encryptSecret(`pf_sec_${ts}`),
        isActive: true,
        isVerified: true,
      },
    });

    const course = await db.course.create({
      data: { centerId, title: "Course", priceMonthly: 300000, createdByMembershipId: dirMem.id },
    });
    const group = await db.group.create({
      data: { centerId, courseId: course.id, name: "G1", teacherMembershipId: dirMem.id },
    });
    await db.enrollment.create({
      data: { centerId, groupId: group.id, studentMembershipId: stuMem.id, status: "ACTIVE" },
    });

    // Attach Start plan subscription
    const sub = await db.subscription.create({
      data: {
        centerId,
        planId: startPlanId,
        status: "ACTIVE",
        currentPeriodEndsAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
    });
    subscriptionId = sub.id;
  });

  afterAll(async () => {
    for (const cid of createdCenterIds) {
      await db.learningCenter.delete({ where: { id: cid } }).catch(() => null);
    }
    for (const pid of createdPlanIds) {
      await db.subscriptionPlan.delete({ where: { id: pid } }).catch(() => null);
    }
    for (const uid of createdUserIds) {
      await db.platformUser.delete({ where: { id: uid } }).catch(() => null);
    }
  });

  it("preserves backwards compatibility for legacy featuresJson arrays and subscription-less centers", async () => {
    expect(parsePlanFeatures(null)).toEqual(FULL_PLAN_FEATURES);
    expect(parsePlanFeatures(JSON.stringify(["Расширенные отчеты"]))).toEqual(FULL_PLAN_FEATURES);
    expect(parsePlanFeatures(JSON.stringify({ promoCodes: false })).promoCodes).toBe(false);

    const legacyCtx = await getCenterPlanFeatures(legacyCenterId);
    expect(legacyCtx.hasSubscription).toBe(false);
    expect(legacyCtx.features).toEqual(FULL_PLAN_FEATURES);
  });

  it("blocks gated mutations on Start plan with 403 PLAN_FEATURE_LOCKED while keeping existing rows readable", async () => {
    mockToken = await signJWT({ userId: dirUserId, email: dirEmail, platformRole: "NONE", activeCenterId: centerId });

    // 1. Click payment intent locked
    const intentRes = await postIntentRoute(
      new Request("http://localhost/api/payments/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentMembershipId: studentMemId, periodMonths: 1 }),
      })
    );
    expect(intentRes.status).toBe(403);
    const intentJson = await intentRes.json();
    expect(intentJson.code).toBe("PLAN_FEATURE_LOCKED");
    expect(intentJson.featureKey).toBe("onlinePaymentsClick");
    expect(intentJson.upgradeUrl).toBe("/center/upgrade");

    // 2. Merchant PUT/POST locked, GET remains readable
    const merchGet = await getMerchantConfigRoute(
      new Request("http://localhost/api/center/merchant-config")
    );
    expect(merchGet.status).toBe(200);

    const merchPut = await putMerchantConfigRoute(
      new Request("http://localhost/api/center/merchant-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: "123", merchantId: "456", currentPassword: "PlanGate!123" }),
      })
    );
    expect(merchPut.status).toBe(403);
    expect((await merchPut.json()).code).toBe("PLAN_FEATURE_LOCKED");

    const merchPost = await postVerifyMerchantRoute(
      new Request("http://localhost/api/center/merchant-config", { method: "POST" })
    );
    expect(merchPost.status).toBe(403);

    // 3. Promo code write locked, GET remains readable with existing code
    const promoGet = await getPromoRoute(new Request("http://localhost/api/promo-codes"));
    expect(promoGet.status).toBe(200);
    const promoGetJson = await promoGet.json();
    expect(promoGetJson.promoCodes.length).toBe(1);

    const promoPost = await postPromoRoute(
      new Request("http://localhost/api/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "NEW20", discountType: "PERCENT", value: 20 }),
      })
    );
    expect(promoPost.status).toBe(403);
    expect((await promoPost.json()).featureKey).toBe("promoCodes");

    const promoPatch = await patchPromoRoute(
      new Request(`http://localhost/api/promo-codes/${existingPromoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      }),
      { params: { id: existingPromoId } }
    );
    expect(promoPatch.status).toBe(403);

    // 4. Broadcasts & templates write locked
    const bcastPost = await postBroadcastsRoute(
      new Request("http://localhost/api/communications/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview",
          title: "X",
          bodyRu: "Y",
          channel: "EMAIL",
          audience: "ALL",
        }),
      })
    );
    expect(bcastPost.status).toBe(403);
    expect((await bcastPost.json()).featureKey).toBe("broadcasts");

    const tplPost = await postTemplatesRoute(
      new Request("http://localhost/api/communications/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "x", locale: "ru", title: "X", body: "Y" }),
      })
    );
    expect(tplPost.status).toBe(403);

    // 5. Finance write & export locked, GET transactions readable
    const finGet = await getFinanceTxRoute(new Request("http://localhost/api/finance/transactions"));
    expect(finGet.status).toBe(200);

    const finPost = await postFinanceTxRoute(
      new Request("http://localhost/api/finance/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "INCOME", amount: 100000, accountId }),
      })
    );
    expect(finPost.status).toBe(403);
    expect((await finPost.json()).featureKey).toBe("financeAccounting");

    const accPost = await postFinanceAccRoute(
      new Request("http://localhost/api/finance/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Bank", type: "BANK" }),
      })
    );
    expect(accPost.status).toBe(403);

    const expGet = await getFinanceExportRoute(
      new Request("http://localhost/api/finance/export?format=csv")
    );
    expect(expGet.status).toBe(403);
    expect((await expGet.json()).featureKey).toBe("advancedReports");
  });

  it("handles upgrade requests as PLATFORM SupportTickets, platform plan toggles, and unlock upon upgrading to Pro", async () => {
    // Student cannot request plan upgrade
    mockToken = await signJWT({ userId: studentUserId, email: studentEmail, platformRole: "NONE", activeCenterId: centerId });
    const stuUp = await postUpgradeRoute(
      new Request("http://localhost/api/center/upgrade-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestedPlanId: proPlanId }),
      })
    );
    expect(stuUp.status).toBe(403);

    // Director loads upgrade comparison and sends upgrade request
    mockToken = await signJWT({ userId: dirUserId, email: dirEmail, platformRole: "NONE", activeCenterId: centerId });
    const upGet = await getUpgradeRoute(new Request("http://localhost/api/center/upgrade-request"));
    expect(upGet.status).toBe(200);
    const upGetJson = await upGet.json();
    expect(upGetJson.currentPlan.planId).toBe(startPlanId);

    const upPost = await postUpgradeRoute(
      new Request("http://localhost/api/center/upgrade-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestedPlanId: proPlanId, comment: "Нужен Click и касса" }),
      })
    );
    expect(upPost.status).toBe(201);
    const upPostJson = await upPost.json();
    expect(upPostJson.ticket.status).toBe("OPEN");

    // Platform owner toggles features on Start plan or upgrades subscription -> immediate unlock
    mockToken = await signJWT({ userId: ownerUserId, email: ownerEmail, platformRole: "SUPERADMIN" });
    const toggleRes = await patchPlatformPlansRoute(
      new Request("http://localhost/api/platform/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: startPlanId,
          features: { ...PLAN_PRESETS.start, promoCodes: true },
        }),
      })
    );
    expect(toggleRes.status).toBe(200);

    // Promo codes unlocked on Start plan now!
    mockToken = await signJWT({ userId: dirUserId, email: dirEmail, platformRole: "NONE", activeCenterId: centerId });
    const unlockedPromo = await postPromoRoute(
      new Request("http://localhost/api/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: `UNLOCK_${String(ts).slice(-4)}`, discountType: "FIXED", value: 25000 }),
      })
    );
    expect(unlockedPromo.status).toBe(201);

    // Cancelling subscription locks back down to Start defaults
    await db.subscription.update({
      where: { id: subscriptionId },
      data: { status: "CANCELLED" },
    });
    const cancelledCheck = await getCenterPlanFeatures(centerId);
    expect(cancelledCheck.features.onlinePaymentsClick).toBe(false);
    expect(cancelledCheck.features.financeAccounting).toBe(false);
  });
});
