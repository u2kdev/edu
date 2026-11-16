import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "../src/lib/db";
import { signJWT, hashPassword } from "../src/lib/auth";
import { encryptSecret, decryptSecret } from "../src/lib/crypto-cipher";
import { generateTotpSecret, generateTotpCode } from "../src/lib/totp";
import { encryptTwoFactorSecret } from "../src/lib/two-factor-cipher";
import {
  CLICK_ERROR,
  computeClickPrepareSign,
  computeClickCompleteSign,
  reconcileStaleClickIntents,
} from "../src/lib/click";
import { GET as getMerchantConfig, PUT as putMerchantConfig, POST as testMerchantConfig } from "../src/app/api/center/merchant-config/route";
import { POST as createPaymentIntentRoute } from "../src/app/api/payments/intent/route";
import { POST as clickWebhookRoute } from "../src/app/api/webhooks/click/route";
import { POST as clickReconcileCron } from "../src/app/api/cron/click-reconcile/route";

let mockToken = "";

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => {
      if (name === "auth_token") return { value: mockToken };
      return undefined;
    },
    set: vi.fn(),
  }),
}));

function makeJsonReq(url: string, method: string, body?: unknown, headers?: Record<string, string>) {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function makeFormReq(url: string, params: Record<string, string>) {
  return new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
}

describe("P1b Direct-to-Center Click Merchant Payments & Webhooks", () => {
  const ts = Date.now();
  const passwordPlain = "DirectorPass!123";
  const secretKeyPlain = `click_secret_key_${ts}_98765`;
  const serviceId = `99${String(ts).slice(-5)}`;
  const merchantId = `88${String(ts).slice(-5)}`;
  const totpSecret = generateTotpSecret();
  const createdUserIds: string[] = [];
  const createdCenterIds: string[] = [];
  const clickTransPrefix = `clk_p1b_${ts}`;

  let centerAId = "";
  let centerBId = "";

  let dirAUser: { id: string; email: string };
  let adminAUser: { id: string; email: string };
  let studentAUser: { id: string; email: string };
  let parentAUser: { id: string; email: string };
  let dirBUser: { id: string; email: string };
  let studentBUser: { id: string; email: string };

  let studentAMemberId = "";
  let studentBMemberId = "";
  let groupAId = "";
  let enrollmentAId = "";
  let merchantAccountId = "";

  function setAuth(
    user: { id: string; email: string },
    centerId: string,
    role: string,
    extra?: { impersonatedBy?: string; allowWrite?: boolean }
  ) {
    mockToken = signJWT({
      userId: user.id,
      email: user.email,
      platformRole: "NONE",
      activeCenterId: centerId,
      activeCenterRole: role,
      ...extra,
    });
  }

  beforeAll(async () => {
    const pwdHash = await hashPassword(passwordPlain);
    const now = new Date();

    const makeUser = async (
      prefix: string,
      fullName: string,
      opts?: { twoFactor?: boolean }
    ) => {
      const u = await db.platformUser.create({
        data: {
          email: `p1b_${prefix}_${ts}@test.uz`,
          fullName,
          passwordHash: pwdHash,
          emailVerified: now,
          ...(opts?.twoFactor
            ? {
                twoFactorEnabled: true,
                twoFactorSecret: encryptTwoFactorSecret(totpSecret),
              }
            : {}),
        },
      });
      createdUserIds.push(u.id);
      return u;
    };

    dirAUser = await makeUser("dira", "Director Click A", { twoFactor: true });
    adminAUser = await makeUser("adma", "Admin Click A");
    studentAUser = await makeUser("stda", "Student Click A");
    parentAUser = await makeUser("para", "Parent Click A");
    dirBUser = await makeUser("dirb", "Director Click B");
    studentBUser = await makeUser("stdb", "Student Click B");

    const centerA = await db.learningCenter.create({
      data: {
        name: "Click Edu A",
        slug: `click-a-${ts}`,
        status: "ACTIVE",
        ownerId: dirAUser.id,
      },
    });
    centerAId = centerA.id;
    createdCenterIds.push(centerAId);

    const centerB = await db.learningCenter.create({
      data: {
        name: "Click Edu B",
        slug: `click-b-${ts}`,
        status: "ACTIVE",
        ownerId: dirBUser.id,
      },
    });
    centerBId = centerB.id;
    createdCenterIds.push(centerBId);

    const dirAMem = await db.centerMembership.create({
      data: { centerId: centerAId, userId: dirAUser.id, role: "DIRECTOR", status: "ACTIVE" },
    });
    await db.centerMembership.create({
      data: { centerId: centerAId, userId: adminAUser.id, role: "CENTER_ADMIN", status: "ACTIVE" },
    });
    const stAMem = await db.centerMembership.create({
      data: { centerId: centerAId, userId: studentAUser.id, role: "STUDENT", status: "ACTIVE" },
    });
    studentAMemberId = stAMem.id;
    await db.centerMembership.create({
      data: { centerId: centerAId, userId: parentAUser.id, role: "PARENT", status: "ACTIVE" },
    });

    const dirBMem = await db.centerMembership.create({
      data: { centerId: centerBId, userId: dirBUser.id, role: "DIRECTOR", status: "ACTIVE" },
    });
    const stBMem = await db.centerMembership.create({
      data: { centerId: centerBId, userId: studentBUser.id, role: "STUDENT", status: "ACTIVE" },
    });
    studentBMemberId = stBMem.id;

    const acc = await db.account.create({
      data: {
        centerId: centerAId,
        name: "Click Merchant Bank",
        type: "BANK",
        currency: "UZS",
        isActive: true,
      },
    });
    merchantAccountId = acc.id;

    const courseA = await db.course.create({
      data: {
        centerId: centerAId,
        title: "Frontend Pro",
        priceMonthly: 600_000,
        createdByMembershipId: dirAMem.id,
      },
    });

    const grpA = await db.group.create({
      data: { centerId: centerAId, courseId: courseA.id, name: "FE-101" },
    });
    groupAId = grpA.id;

    const enrA = await db.enrollment.create({
      data: {
        centerId: centerAId,
        studentMembershipId: studentAMemberId,
        groupId: groupAId,
        status: "ACTIVE",
      },
    });
    enrollmentAId = enrA.id;

    const courseB = await db.course.create({
      data: {
        centerId: centerBId,
        title: "Math B",
        priceMonthly: 400_000,
        createdByMembershipId: dirBMem.id,
      },
    });
    const grpB = await db.group.create({
      data: { centerId: centerBId, courseId: courseB.id, name: "Math-1" },
    });
    await db.enrollment.create({
      data: {
        centerId: centerBId,
        studentMembershipId: studentBMemberId,
        groupId: grpB.id,
        status: "ACTIVE",
      },
    });
  });

  afterAll(async () => {
    await db.paymentWebhookEvent.deleteMany({
      where: { clickTransId: { startsWith: clickTransPrefix } },
    });
    for (const cid of createdCenterIds) {
      await db.paymentWebhookEvent.deleteMany({ where: { centerId: cid } });
      await db.promoCodeRedemption.deleteMany({ where: { centerId: cid } });
      await db.chargePaymentAllocation.deleteMany({ where: { centerId: cid } });
      await db.financeTransaction.deleteMany({ where: { centerId: cid } });
      await db.centerPayment.deleteMany({ where: { centerId: cid } });
      await db.paymentIntent.deleteMany({ where: { centerId: cid } });
      await db.centerMerchantConfig.deleteMany({ where: { centerId: cid } });
      await db.charge.deleteMany({ where: { centerId: cid } });
      await db.enrollment.deleteMany({ where: { centerId: cid } });
      await db.groupPricingPlan.deleteMany({ where: { centerId: cid } });
      await db.group.deleteMany({ where: { centerId: cid } });
      await db.course.deleteMany({ where: { centerId: cid } });
      await db.account.deleteMany({ where: { centerId: cid } });
      await db.financeCategory.deleteMany({ where: { centerId: cid } });
      await db.promoCode.deleteMany({ where: { centerId: cid } });
      await db.invoiceCounter.deleteMany({ where: { centerId: cid } });
      await db.auditLog.deleteMany({ where: { centerId: cid } });
      await db.parentLink.deleteMany({ where: { student: { centerId: cid } } });
      await db.centerMembership.deleteMany({ where: { centerId: cid } });
      await db.learningCenter.deleteMany({ where: { id: cid } });
    }
    if (createdUserIds.length > 0) {
      await db.platformUser.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  it("1. AES-256-GCM cipher encrypts/decrypts and rejects tampered ciphertext/tag", () => {
    const encrypted = encryptSecret("super-click-secret-987");
    expect(encrypted).not.toContain("super-click-secret-987");
    expect(decryptSecret(encrypted, { requireEncrypted: true })).toBe("super-click-secret-987");

    // Flip last character of hex tag
    const lastChar = encrypted.slice(-1) === "a" ? "b" : "a";
    const tampered = encrypted.slice(0, -1) + lastChar;
    expect(() => decryptSecret(tampered, { requireEncrypted: true })).toThrow();
  });

  it("2. Merchant config RBAC, password+2FA re-auth, impersonation block, and masked GET", async () => {
    // CENTER_ADMIN blocked
    setAuth(adminAUser, centerAId, "CENTER_ADMIN");
    const adminPut = await putMerchantConfig(
      makeJsonReq("/api/center/merchant-config", "PUT", {
        serviceId,
        merchantId,
        secretKey: secretKeyPlain,
        currentPassword: passwordPlain,
      })
    );
    expect(adminPut.status).toBe(403);

    // PARENT blocked from GET merchant config
    setAuth(parentAUser, centerAId, "PARENT");
    const parentGet = await getMerchantConfig(makeJsonReq("/api/center/merchant-config", "GET"));
    expect(parentGet.status).toBe(403);

    // Impersonated Director blocked from PUT
    setAuth(dirAUser, centerAId, "DIRECTOR", {
      impersonatedBy: dirBUser.id,
      allowWrite: true,
    });
    const impPut = await putMerchantConfig(
      makeJsonReq("/api/center/merchant-config", "PUT", {
        serviceId,
        merchantId,
        secretKey: secretKeyPlain,
        currentPassword: passwordPlain,
        totpCode: generateTotpCode(totpSecret),
      })
    );
    expect(impPut.status).toBe(403);

    // Director with wrong password -> 403
    setAuth(dirAUser, centerAId, "DIRECTOR");
    const badPwdPut = await putMerchantConfig(
      makeJsonReq("/api/center/merchant-config", "PUT", {
        serviceId,
        merchantId,
        secretKey: secretKeyPlain,
        currentPassword: "WrongPassword!",
        totpCode: generateTotpCode(totpSecret),
      })
    );
    expect(badPwdPut.status).toBe(403);

    // Director with 2FA enabled without totpCode -> 403
    const noTotpPut = await putMerchantConfig(
      makeJsonReq("/api/center/merchant-config", "PUT", {
        serviceId,
        merchantId,
        secretKey: secretKeyPlain,
        currentPassword: passwordPlain,
      })
    );
    expect(noTotpPut.status).toBe(403);

    // Director with valid password + TOTP -> 200 and encrypted in DB
    const validTotp = generateTotpCode(totpSecret);
    const okPut = await putMerchantConfig(
      makeJsonReq("/api/center/merchant-config", "PUT", {
        serviceId,
        merchantId,
        merchantUserId: "u1234",
        secretKey: secretKeyPlain,
        targetAccountId: merchantAccountId,
        isActive: true,
        currentPassword: passwordPlain,
        totpCode: validTotp,
      })
    );
    expect(okPut.status).toBe(200);
    const putBody = await okPut.json();
    expect(putBody.config.secretKeyMasked).toBe(`****${secretKeyPlain.slice(-4)}`);
    expect(putBody.config.isVerified).toBe(false);
    expect(JSON.stringify(putBody)).not.toContain(secretKeyPlain);

    // GET never returns plaintext or encrypted secret
    const getRes = await getMerchantConfig(makeJsonReq("/api/center/merchant-config", "GET"));
    expect(getRes.status).toBe(200);
    expect(getRes.headers.get("cache-control")).toBe("no-store");
    const getBody = await getRes.json();
    expect(getBody.config.secretKeyMasked).toBe(`****${secretKeyPlain.slice(-4)}`);
    expect(getBody.config.encryptedSecretKey).toBeUndefined();
    expect(JSON.stringify(getBody)).not.toContain(secretKeyPlain);
  });

  it("3. MERCHANT_NOT_VERIFIED blocks PaymentIntent until Director verifies connection", async () => {
    setAuth(studentAUser, centerAId, "STUDENT");
    const blockedRes = await createPaymentIntentRoute(
      makeJsonReq("/api/payments/intent", "POST", {
        groupId: groupAId,
        periodMonths: 1,
      })
    );
    expect(blockedRes.status).toBe(400);
    const blockedBody = await blockedRes.json();
    expect(blockedBody.code).toBe("MERCHANT_NOT_VERIFIED");

    // Director tests and verifies connection
    setAuth(dirAUser, centerAId, "DIRECTOR");
    const testRes = await testMerchantConfig(
      makeJsonReq("/api/center/merchant-config", "POST", { action: "test" })
    );
    expect(testRes.status).toBe(200);
    const testBody = await testRes.json();
    expect(testBody.config.isVerified).toBe(true);
  });

  it("4. PaymentIntent creation, parent/cross-center IDOR protection, and idempotencyKey reuse", async () => {
    // Unconfirmed Parent A blocked from paying for Student A
    setAuth(parentAUser, centerAId, "PARENT");
    const unconfirmedParentRes = await createPaymentIntentRoute(
      makeJsonReq("/api/payments/intent", "POST", {
        studentMembershipId: studentAMemberId,
        groupId: groupAId,
        periodMonths: 1,
      })
    );
    expect(unconfirmedParentRes.status).toBe(403);

    // Even when Center B has its own verified merchant config, Director B cannot create intent for Student A in Center A
    await db.centerMerchantConfig.upsert({
      where: { centerId_provider: { centerId: centerBId, provider: "CLICK" } },
      create: {
        centerId: centerBId,
        provider: "CLICK",
        serviceId: "777001",
        merchantId: "666001",
        encryptedSecretKey: encryptSecret("center-b-secret-key"),
        isActive: true,
        isVerified: true,
        verifiedAt: new Date(),
      },
      update: { isActive: true, isVerified: true },
    });
    setAuth(dirBUser, centerBId, "DIRECTOR");
    const crossCenterRes = await createPaymentIntentRoute(
      makeJsonReq("/api/payments/intent", "POST", {
        studentMembershipId: studentAMemberId,
        groupId: groupAId,
        periodMonths: 1,
      })
    );
    expect([403, 404]).toContain(crossCenterRes.status);

    // Student A creates intent with idempotencyKey
    setAuth(studentAUser, centerAId, "STUDENT");
    const idempKey = `idem-${ts}`;
    const res1 = await createPaymentIntentRoute(
      makeJsonReq("/api/payments/intent", "POST", {
        groupId: groupAId,
        periodMonths: 1,
        idempotencyKey: idempKey,
      })
    );
    expect(res1.status).toBe(201);
    const body1 = await res1.json();
    expect(body1.intent.amount).toBe(600_000);
    expect(body1.clickUrl).toContain(`service_id=${serviceId}`);
    expect(body1.clickUrl).toContain(`merchant_id=${merchantId}`);
    expect(body1.clickUrl).toContain(`transaction_param=${body1.intent.merchantTransId}`);
    expect(body1.qrDataUrl).toMatch(/^data:image\//);

    // Second call with same idempotencyKey reuses exact same intent
    const res2 = await createPaymentIntentRoute(
      makeJsonReq("/api/payments/intent", "POST", {
        groupId: groupAId,
        periodMonths: 1,
        idempotencyKey: idempKey,
      })
    );
    expect(res2.status).toBe(201);
    const body2 = await res2.json();
    expect(body2.intent.id).toBe(body1.intent.id);
    expect(body2.intent.merchantTransId).toBe(body1.intent.merchantTransId);
  });

  it("5. Click Prepare webhook validates signature, amount, cross-center service_id, action & logs redacted events", async () => {
    setAuth(studentAUser, centerAId, "STUDENT");
    const intentRes = await createPaymentIntentRoute(
      makeJsonReq("/api/payments/intent", "POST", {
        groupId: groupAId,
        periodMonths: 1,
        idempotencyKey: `prep-${ts}`,
      })
    );
    const { intent } = await intentRes.json();
    const mTransId = intent.merchantTransId as string;
    const signTime = "2026-11-16 00:10:00";
    const clickTransIdBadSig = `${clickTransPrefix}_badsig`;

    // Wrong signature -> -1
    const badSigRes = await clickWebhookRoute(
      makeFormReq("/api/webhooks/click", {
        click_trans_id: clickTransIdBadSig,
        service_id: serviceId,
        merchant_trans_id: mTransId,
        amount: "600000",
        action: "0",
        error: "0",
        sign_time: signTime,
        sign_string: "00000000000000000000000000000000",
      })
    );
    expect(badSigRes.status).toBe(200);
    const badSigJson = await badSigRes.json();
    expect(badSigJson.error).toBe(CLICK_ERROR.SIGN_CHECK_FAILED);

    // Verify failure webhook logged & sign_string redacted
    const loggedBad = await db.paymentWebhookEvent.findFirst({
      where: { clickTransId: clickTransIdBadSig },
    });
    expect(loggedBad).not.toBeNull();
    expect(loggedBad!.status).toBe("REJECTED");
    expect(loggedBad!.errorCode).toBe(CLICK_ERROR.SIGN_CHECK_FAILED);
    expect(loggedBad!.payloadRedactedJson).toContain("[REDACTED]");
    expect(loggedBad!.payloadRedactedJson).not.toContain("00000000000000000000000000000000");

    // Wrong service_id (cross-center service mismatch) -> -5
    const wrongServiceSign = computeClickPrepareSign({
      clickTransId: `${clickTransPrefix}_wrongsvc`,
      serviceId: "77777",
      secretKey: secretKeyPlain,
      merchantTransId: mTransId,
      amount: "600000",
      action: "0",
      signTime,
    });
    const wrongSvcRes = await clickWebhookRoute(
      makeFormReq("/api/webhooks/click", {
        click_trans_id: `${clickTransPrefix}_wrongsvc`,
        service_id: "77777",
        merchant_trans_id: mTransId,
        amount: "600000",
        action: "0",
        error: "0",
        sign_time: signTime,
        sign_string: wrongServiceSign,
      })
    );
    expect((await wrongSvcRes.json()).error).toBe(CLICK_ERROR.ORDER_NOT_FOUND);

    // Tampered amount -> -2
    const tamperedAmtSign = computeClickPrepareSign({
      clickTransId: `${clickTransPrefix}_badamt`,
      serviceId,
      secretKey: secretKeyPlain,
      merchantTransId: mTransId,
      amount: "100",
      action: "0",
      signTime,
    });
    const badAmtRes = await clickWebhookRoute(
      makeFormReq("/api/webhooks/click", {
        click_trans_id: `${clickTransPrefix}_badamt`,
        service_id: serviceId,
        merchant_trans_id: mTransId,
        amount: "100",
        action: "0",
        error: "0",
        sign_time: signTime,
        sign_string: tamperedAmtSign,
      })
    );
    expect((await badAmtRes.json()).error).toBe(CLICK_ERROR.INCORRECT_AMOUNT);

    // Unsupported action -> -3
    const badActionRes = await clickWebhookRoute(
      makeFormReq("/api/webhooks/click", {
        click_trans_id: `${clickTransPrefix}_badact`,
        service_id: serviceId,
        merchant_trans_id: mTransId,
        amount: "600000",
        action: "9",
        error: "0",
        sign_time: signTime,
        sign_string: "deadbeef",
      })
    );
    expect((await badActionRes.json()).error).toBe(CLICK_ERROR.ACTION_NOT_FOUND);

    // Valid Prepare -> 0 & PREPARED
    const clkGoodId = `${clickTransPrefix}_okprep`;
    const goodPrepSign = computeClickPrepareSign({
      clickTransId: clkGoodId,
      serviceId,
      secretKey: secretKeyPlain,
      merchantTransId: mTransId,
      amount: "600000",
      action: "0",
      signTime,
    });
    const goodPrepRes = await clickWebhookRoute(
      makeFormReq("/api/webhooks/click", {
        click_trans_id: clkGoodId,
        service_id: serviceId,
        click_paydoc_id: "pd_100",
        merchant_trans_id: mTransId,
        amount: "600000",
        action: "0",
        error: "0",
        sign_time: signTime,
        sign_string: goodPrepSign,
      })
    );
    const prepJson = await goodPrepRes.json();
    expect(prepJson.error).toBe(CLICK_ERROR.SUCCESS);
    expect(prepJson.merchant_prepare_id).toBeTruthy();

    const updatedIntent = await db.paymentIntent.findUnique({ where: { id: intent.id } });
    expect(updatedIntent?.status).toBe("PREPARED");
  });

  it("6. Click Complete webhook concurrency race creates strictly 1 CenterPayment + 1 FinanceTransaction (0% fee) & extends paidUntil", async () => {
    setAuth(studentAUser, centerAId, "STUDENT");
    const intentRes = await createPaymentIntentRoute(
      makeJsonReq("/api/payments/intent", "POST", {
        groupId: groupAId,
        periodMonths: 2,
        idempotencyKey: `comp-${ts}`,
      })
    );
    const { intent } = await intentRes.json();
    const mTransId = intent.merchantTransId as string;
    const expectedAmt = String(intent.amount); // 1_200_000
    const clkId = `${clickTransPrefix}_complete`;
    const signTime = "2026-11-16 00:12:00";

    // Step 1: Prepare
    const prepSign = computeClickPrepareSign({
      clickTransId: clkId,
      serviceId,
      secretKey: secretKeyPlain,
      merchantTransId: mTransId,
      amount: expectedAmt,
      action: "0",
      signTime,
    });
    const prepRes = await clickWebhookRoute(
      makeFormReq("/api/webhooks/click", {
        click_trans_id: clkId,
        service_id: serviceId,
        merchant_trans_id: mTransId,
        amount: expectedAmt,
        action: "0",
        error: "0",
        sign_time: signTime,
        sign_string: prepSign,
      })
    );
    const prepJson = await prepRes.json();
    expect(prepJson.error).toBe(0);
    const prepId = String(prepJson.merchant_prepare_id);

    // Mismatched merchant_prepare_id -> -6
    const badPrepIdSign = computeClickCompleteSign({
      clickTransId: clkId,
      serviceId,
      secretKey: secretKeyPlain,
      merchantTransId: mTransId,
      merchantPrepareId: "WRONG_PREP_ID",
      amount: expectedAmt,
      action: "1",
      signTime,
    });
    const badPrepRes = await clickWebhookRoute(
      makeFormReq("/api/webhooks/click", {
        click_trans_id: clkId,
        service_id: serviceId,
        merchant_trans_id: mTransId,
        merchant_prepare_id: "WRONG_PREP_ID",
        amount: expectedAmt,
        action: "1",
        error: "0",
        sign_time: signTime,
        sign_string: badPrepIdSign,
      })
    );
    expect((await badPrepRes.json()).error).toBe(CLICK_ERROR.TX_NOT_FOUND);

    // Step 2: Concurrent Complete race (2 parallel Complete requests)
    const compSign = computeClickCompleteSign({
      clickTransId: clkId,
      serviceId,
      secretKey: secretKeyPlain,
      merchantTransId: mTransId,
      merchantPrepareId: prepId,
      amount: expectedAmt,
      action: "1",
      signTime,
    });
    const completePayload = {
      click_trans_id: clkId,
      service_id: serviceId,
      click_paydoc_id: "pd_200",
      merchant_trans_id: mTransId,
      merchant_prepare_id: prepId,
      amount: expectedAmt,
      action: "1",
      error: "0",
      sign_time: signTime,
      sign_string: compSign,
    };

    const [r1, r2] = await Promise.all([
      clickWebhookRoute(makeFormReq("/api/webhooks/click", completePayload)),
      clickWebhookRoute(makeFormReq("/api/webhooks/click", completePayload)),
    ]);
    const [j1, j2] = await Promise.all([r1.json(), r2.json()]);
    const codes = [j1.error, j2.error].sort((a, b) => a - b);
    expect(codes).toEqual([CLICK_ERROR.ALREADY_PAID, CLICK_ERROR.SUCCESS]);

    // Strictly 1 CenterPayment + 1 FinanceTransaction on merchantAccountId with 0% fee
    const payments = await db.centerPayment.findMany({
      where: { centerId: centerAId, paymentIntentId: intent.id },
    });
    expect(payments.length).toBe(1);
    expect(payments[0].status).toBe("PAID");
    expect(payments[0].paymentMethod).toBe("ONLINE");
    expect(Math.round(payments[0].amount)).toBe(intent.amount);

    const txs = await db.financeTransaction.findMany({
      where: { centerId: centerAId, centerPaymentId: payments[0].id },
    });
    expect(txs.length).toBe(1);
    expect(txs[0].accountId).toBe(merchantAccountId);
    expect(txs[0].amount).toBe(intent.amount);

    const enr = await db.enrollment.findUnique({ where: { id: enrollmentAId } });
    expect(enr?.paidUntil).not.toBeNull();

    // Replay after confirmation returns -4 without adding another payment
    const replayRes = await clickWebhookRoute(makeFormReq("/api/webhooks/click", completePayload));
    expect((await replayRes.json()).error).toBe(CLICK_ERROR.ALREADY_PAID);
    const paymentsAfterReplay = await db.centerPayment.count({
      where: { centerId: centerAId, paymentIntentId: intent.id },
    });
    expect(paymentsAfterReplay).toBe(1);
  });

  it("7. Reconcile marks stale PREPARED (>30m) as FAILED and expired CREATED as EXPIRED", async () => {
    const staleDate = new Date(Date.now() - 45 * 60 * 1000);
    const stalePrepared = await db.paymentIntent.create({
      data: {
        centerId: centerAId,
        studentMembershipId: studentAMemberId,
        groupId: groupAId,
        enrollmentId: enrollmentAId,
        periodMonths: 1,
        originalAmount: 600_000,
        amount: 600_000,
        merchantTransId: `STALE_PREP_${ts}`,
        status: "PREPARED",
        preparedAt: staleDate,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        createdByUserId: studentAUser.id,
      },
    });
    const staleCreated = await db.paymentIntent.create({
      data: {
        centerId: centerAId,
        studentMembershipId: studentAMemberId,
        groupId: groupAId,
        enrollmentId: enrollmentAId,
        periodMonths: 1,
        originalAmount: 600_000,
        amount: 600_000,
        merchantTransId: `STALE_CR_${ts}`,
        status: "CREATED",
        expiresAt: staleDate,
        createdByUserId: studentAUser.id,
      },
    });

    const summary = await reconcileStaleClickIntents(centerAId);
    expect(summary.flaggedStaleCount).toBeGreaterThanOrEqual(1);
    expect(summary.expiredCount).toBeGreaterThanOrEqual(1);

    const checkPrep = await db.paymentIntent.findUnique({ where: { id: stalePrepared.id } });
    const checkCr = await db.paymentIntent.findUnique({ where: { id: staleCreated.id } });
    expect(checkPrep?.errorNote).toContain("STALE_PREPARED_TIMEOUT");
    expect(checkCr?.status).toBe("EXPIRED");

    // Also verify cron route responds 200 in test mode
    const cronRes = await clickReconcileCron(
      makeJsonReq("/api/cron/click-reconcile", "POST")
    );
    expect(cronRes.status).toBe(200);
  });
});
