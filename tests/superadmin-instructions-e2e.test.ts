import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/lib/db";
import { createSessionToken, hashPassword } from "@/lib/auth";
import { calculatePlatformMRR } from "@/lib/platform-finance";

// Routes to test
import { POST as createCenterRoute } from "@/app/api/platform/centers/route";
import { GET as getCenterDetailsRoute } from "@/app/api/platform/centers/[id]/route";
import { POST as createUserRoute } from "@/app/api/platform/users/route";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as changePasswordRoute } from "@/app/api/account/change-password/route";
import { POST as impersonateRoute } from "@/app/api/platform/impersonate/route";
import { ORIGINAL_SESSION_COOKIE } from "@/lib/impersonation";
import { POST as stopImpersonateRoute } from "@/app/api/platform/impersonate/stop/route";
import { POST as recordPaymentRoute } from "@/app/api/platform/finance/payments/route";
import { POST as refundPaymentRoute } from "@/app/api/platform/finance/payments/[id]/refund/route";
import { GET as runCronRoute } from "@/app/api/cron/subscriptions/route";
import { POST as createTicketRoute } from "@/app/api/platform/support/route";
import { GET as getTicketRoute } from "@/app/api/platform/support/[id]/route";
import { POST as createMessageRoute } from "@/app/api/platform/support/[id]/messages/route";
import { GET as getDashboardRoute } from "@/app/api/platform/dashboard/route";

describe("Superadmin Role Verification Instructions (Database: lms_stage_test)", () => {
  let superadminUser: { id: string; email: string; platformRole: string };
  let platformAdminUser: { id: string; email: string; platformRole: string };
  let directorUser: { id: string; email: string };
  let superadminToken: string;
  let platformAdminToken: string;
  let directorToken: string;
  let testPlan: { id: string; name: string; priceMonthly: number };

  beforeAll(async () => {
    // 1. Fetch or create SUPERADMIN
    const fetchedSuperadmin = await db.platformUser.findUnique({
      where: { email: "admin@platform.com" },
    });
    if (fetchedSuperadmin) {
      superadminUser = fetchedSuperadmin;
    } else {
      superadminUser = await db.platformUser.create({
        data: {
          email: "admin@platform.com",
          fullName: "Platform Superadmin",
          passwordHash: await hashPassword("Password123!"),
          platformRole: "SUPERADMIN",
          isActive: true,
          emailVerified: new Date(),
        },
      });
    }

    // 2. Fetch or create PLATFORM_ADMIN
    const fetchedAdmin = await db.platformUser.findFirst({
      where: { platformRole: "PLATFORM_ADMIN" },
    });
    if (fetchedAdmin) {
      platformAdminUser = fetchedAdmin;
    } else {
      platformAdminUser = await db.platformUser.create({
        data: {
          email: "support_admin@platform.com",
          fullName: "Platform Admin Support",
          passwordHash: await hashPassword("Password123!"),
          platformRole: "PLATFORM_ADMIN",
          isActive: true,
          emailVerified: new Date(),
        },
      });
    }

    // 3. Fetch or create Director
    const fetchedDirector = await db.platformUser.findFirst({
      where: { email: "director1@example.com" },
    });
    if (fetchedDirector) {
      directorUser = fetchedDirector;
    } else {
      directorUser = await db.platformUser.create({
        data: {
          email: "director1@example.com",
          fullName: "Director One",
          passwordHash: await hashPassword("Password123!"),
          platformRole: "NONE",
          isActive: true,
          emailVerified: new Date(),
        },
      });
    }

    // 4. Subscription Plan
    const fetchedPlan = await db.subscriptionPlan.findFirst({ where: { isActive: true } });
    if (fetchedPlan) {
      testPlan = fetchedPlan;
    } else {
      testPlan = await db.subscriptionPlan.create({
        data: {
          name: "Standard Plan",
          priceMonthly: 500000,
          maxStudents: 100,
          maxTeachers: 20,
          maxCourses: 50,
          maxBranches: 5,
        },
      });
    }

    superadminToken = await createSessionToken(
      { userId: superadminUser.id, email: superadminUser.email, platformRole: "SUPERADMIN" },
      { maxAgeSeconds: 3600 }
    );

    platformAdminToken = await createSessionToken(
      { userId: platformAdminUser.id, email: platformAdminUser.email, platformRole: "PLATFORM_ADMIN" },
      { maxAgeSeconds: 3600 }
    );

    directorToken = await createSessionToken(
      { userId: directorUser.id, email: directorUser.email, platformRole: "NONE" },
      { maxAgeSeconds: 3600 }
    );
  });

  // --------------------------------------------------------------------------
  // ПУНКТ 2: Создайте центр через визард
  // --------------------------------------------------------------------------
  let createdCenterId: string;
  let createdResetUrl: string;

  describe("Пункт 2: Создание центра через визард и ссылка установки пароля", () => {
    it("создаёт центр, возвращает resetUrl на экране и позволяет открыть/использовать токен", async () => {
      const ts = Date.now();
      const directorEmail = `wizard_dir_${ts}@test.com`;

      const req = new Request("http://localhost:3000/api/platform/centers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${superadminToken}`,
        },
        body: JSON.stringify({
          name: `Wizard Center ${ts}`,
          slug: `wizard-center-${ts}`,
          phone: "+998901234567",
          email: `center_${ts}@test.com`,
          organizationKind: "LEARNING_CENTER",
          directorEmail,
          directorFullName: "Wizard Director",
          directorPhone: "+998907654321",
        }),
      });

      const res = await createCenterRoute(req);
      expect([200, 201]).toContain(res.status);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.center).toBeDefined();
      expect(json.resetUrl).toBeDefined();
      expect(json.resetUrl).toContain("token=");

      createdCenterId = json.center.id;
      createdResetUrl = json.resetUrl;

      // Проверяем, что токен существует в базе и действует
      const tokenStr = new URL(createdResetUrl, "http://localhost:3000").searchParams.get("token");
      expect(tokenStr).toBeTruthy();

      const resetRecord = await db.passwordResetToken.findFirst({
        where: {
          user: { email: directorEmail },
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
      expect(resetRecord).not.toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // ПУНКТ 3: Создайте пользователя с телефоном и username
  // --------------------------------------------------------------------------
  describe("Пункт 3: Вход по email, телефону и username + принудительная смена пароля", () => {
    const ts = Date.now();
    const testEmail = `multi_auth_${ts}@test.com`;
    const testPhone = "+998901239876";
    const testUsername = `user_${ts}`;
    const initialPassword = "InitialPassword123!";
    const newPassword = "NewSecurePassword456!";
    let createdUserId: string;

    it("создаёт пользователя с телефоном, username и флагом mustChangePassword", async () => {
      const req = new Request("http://localhost:3000/api/platform/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${superadminToken}`,
        },
        body: JSON.stringify({
          fullName: "Multi Auth Tester",
          email: testEmail,
          phone: testPhone,
          username: testUsername,
          password: initialPassword,
          mustChangePassword: true,
        }),
      });

      const res = await createUserRoute(req);
      expect([200, 201]).toContain(res.status);
      const json = await res.json();
      expect(json.user).toBeDefined();
      expect(json.user.phone).toBe(testPhone);
      expect(json.user.username).toBe(testUsername);
      expect(json.user.mustChangePassword).toBe(true);
      createdUserId = json.user.id;
    });

    it("вход способ 1 (по Email): успешен и возвращает mustChangePassword=true", async () => {
      const req = new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login: testEmail,
          password: initialPassword,
        }),
      });

      const res = await loginRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.mustChangePassword).toBe(true);
    });

    it("вход способ 2 (по Номеру телефона): успешен и возвращает mustChangePassword=true", async () => {
      const req = new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login: testPhone,
          password: initialPassword,
        }),
      });

      const res = await loginRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.mustChangePassword).toBe(true);
    });

    it("вход способ 3 (по Username): успешен и возвращает mustChangePassword=true", async () => {
      const req = new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login: testUsername,
          password: initialPassword,
        }),
      });

      const res = await loginRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.mustChangePassword).toBe(true);
    });

    it("меняет пароль через /api/account/change-password и сбрасывает mustChangePassword", async () => {
      const userToken = await createSessionToken(
        { userId: createdUserId, email: testEmail, platformRole: "NONE" },
        { maxAgeSeconds: 3600 }
      );

      const req = new Request("http://localhost:3000/api/account/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          currentPassword: initialPassword,
          newPassword,
          confirmPassword: newPassword,
        }),
      });

      const res = await changePasswordRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);

      // Проверяем статус в БД
      const updatedUser = await db.platformUser.findUnique({ where: { id: createdUserId } });
      expect(updatedUser?.mustChangePassword).toBe(false);

      // Проверяем логин с новым паролем
      const loginCheck = await loginRoute(
        new Request("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            login: testEmail,
            password: newPassword,
          }),
        })
      );
      const loginJson = await loginCheck.json();
      expect(loginCheck.status).toBe(200);
      expect(loginJson.mustChangePassword).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // ПУНКТ 4: «Войти как» директор
  // --------------------------------------------------------------------------
  describe("Пункт 4: «Войти как» директор (плашка имперсонации и возврат)", () => {
    let impersonatedToken: string;
    let originalCookieVal: string;
    let targetCenter: { id: string; memberships: { userId: string }[] } | null;

    beforeAll(async () => {
      targetCenter = await db.learningCenter.findFirst({
        where: { id: createdCenterId },
        include: { memberships: { where: { role: "DIRECTOR" } } },
      });
      if (!targetCenter || targetCenter.memberships.length === 0) {
        targetCenter = await db.learningCenter.findFirst({
          include: { memberships: { where: { role: "DIRECTOR" } } },
        });
      }
    });

    it("суперадмин начинает имперсонацию директора центра", async () => {
      expect(targetCenter).toBeTruthy();
      const directorMember = targetCenter!.memberships[0];

      const req = new Request("http://localhost:3000/api/platform/impersonate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${superadminToken}`,
        },
        body: JSON.stringify({
          targetUserId: directorMember.userId,
          targetCenterId: targetCenter!.id,
          reason: "Support verification session",
        }),
      });

      const res = await impersonateRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.user.id).toBe(directorMember.userId);
      expect(json.maxAgeSeconds).toBe(3600);

      // Извлекаем куки имперсонации и оригинальной сессии
      const authCookie = res.cookies.get("auth_token");
      const origCookie = res.cookies.get(ORIGINAL_SESSION_COOKIE);
      expect(authCookie?.value).toBeDefined();
      expect(origCookie?.value).toBeDefined();

      impersonatedToken = authCookie!.value;
      originalCookieVal = origCookie!.value;

      // Проверяем аудит имперсонации
      const audit = await db.auditLog.findFirst({
        where: {
          actorUserId: superadminUser.id,
          action: "PLATFORM_IMPERSONATION_STARTED",
        },
      });
      expect(audit).not.toBeNull();
      const details = typeof audit?.detailsJson === "string" ? JSON.parse(audit.detailsJson) : audit?.detailsJson;
      expect(details?.impersonatorEmail).toBe(superadminUser.email);
    });

    it("завершает имперсонацию через /stop и восстанавливает сессию суперадмина", async () => {
      const req = new Request("http://localhost:3000/api/platform/impersonate/stop", {
        method: "POST",
        headers: {
          cookie: `${ORIGINAL_SESSION_COOKIE}=${originalCookieVal}; auth_token=${impersonatedToken}`,
        },
      });

      const res = await stopImpersonateRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.redirectUrl).toBe("/platform-admin");

      const restoredAuthCookie = res.cookies.get("auth_token");
      expect(restoredAuthCookie?.value).toBeDefined();

      // Проверяем аудит остановки
      const auditStop = await db.auditLog.findFirst({
        where: {
          actorUserId: superadminUser.id,
          action: "PLATFORM_IMPERSONATION_STOPPED",
        },
      });
      expect(auditStop).not.toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // ПУНКТ 5: Запись оплаты, продление подписки, статус ACTIVE, счёт, MRR
  // --------------------------------------------------------------------------
  describe("Пункт 5: Запись оплаты, продление подписки, статус ACTIVE, счёт, MRR", () => {
    let centerForPayment: { id: string; name: string };
    let paymentId: string;

    beforeAll(async () => {
      centerForPayment = await db.learningCenter.create({
        data: {
          name: `Finance Test Center ${Date.now()}`,
          slug: `fin-center-${Date.now()}`,
          status: "OVERDUE",
          ownerId: superadminUser.id,
        },
      });

      await db.subscription.create({
        data: {
          centerId: centerForPayment.id,
          planId: testPlan.id,
          status: "PAST_DUE",
          currentPeriodStartsAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
          currentPeriodEndsAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        },
      });
    });

    it("записывает оплату: создаётся номер счёта INV-YYYY-XXXX, подписка продлевается, центр становится ACTIVE", async () => {
      const req = new Request("http://localhost:3000/api/platform/finance/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${superadminToken}`,
        },
        body: JSON.stringify({
          centerId: centerForPayment.id,
          planId: testPlan.id,
          amount: testPlan.priceMonthly,
          months: 1,
          paymentMethod: "BANK_TRANSFER",
        }),
      });

      const res = await recordPaymentRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.payment).toBeDefined();
      expect(json.payment.invoiceNumber).toMatch(/^INV-\d{4}-\d{4}$/);

      paymentId = json.payment.id;

      // Проверяем, что центр перешёл в статус ACTIVE
      const updatedCenter = await db.learningCenter.findUnique({
        where: { id: centerForPayment.id },
      });
      expect(updatedCenter?.status).toBe("ACTIVE");

      // Проверяем, что подписка продлена в будущее
      const updatedSub = await db.subscription.findFirst({
        where: { centerId: centerForPayment.id },
      });
      expect(updatedSub?.status).toBe("ACTIVE");
      expect(new Date(updatedSub!.currentPeriodEndsAt).getTime()).toBeGreaterThan(Date.now());
    });

    it("расчёт MRR включает активный тариф", async () => {
      const mrrData = await calculatePlatformMRR();
      expect(mrrData.mrr).toBeGreaterThanOrEqual(testPlan.priceMonthly);
      expect(mrrData.activeSubscriptionsCount).toBeGreaterThanOrEqual(1);
    });
  });

  // --------------------------------------------------------------------------
  // ПУНКТ 6: Оформление возврата под PLATFORM_ADMIN и SUPERADMIN
  // --------------------------------------------------------------------------
  describe("Пункт 6: Возврат платежа (отказ PLATFORM_ADMIN, успех SUPERADMIN)", () => {
    let paymentToRefund: { id: string; amount: number; status: string };

    beforeAll(async () => {
      paymentToRefund = await db.platformPayment.create({
        data: {
          centerId: createdCenterId,
          amount: 500000,
          currency: "UZS",
          status: "PAID",
          paymentMethod: "BANK_TRANSFER",
          invoiceNumber: `INV-${new Date().getFullYear()}-9999`,
        },
      });
    });

    it("PLATFORM_ADMIN получает отказ 403 при попытке оформить возврат", async () => {
      const req = new Request(
        `http://localhost:3000/api/platform/finance/payments/${paymentToRefund.id}/refund`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${platformAdminToken}`,
          },
          body: JSON.stringify({
            refundAmount: 500000,
            reason: "Platform admin refund attempt",
          }),
        }
      );

      const res = await refundPaymentRoute(req, { params: { id: paymentToRefund.id } });
      expect(res.status).toBe(403);
    });

    it("SUPERADMIN успешно оформляет возврат с обязательной причиной", async () => {
      const req = new Request(
        `http://localhost:3000/api/platform/finance/payments/${paymentToRefund.id}/refund`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${superadminToken}`,
          },
          body: JSON.stringify({
            refundAmount: 500000,
            reason: "Client overpayment refund requested",
          }),
        }
      );

      const res = await refundPaymentRoute(req, { params: { id: paymentToRefund.id } });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);

      const updated = await db.platformPayment.findUnique({
        where: { id: paymentToRefund.id },
      });
      expect(updated?.status).toBe("REFUNDED");
      expect(updated?.refundAmount).toBe(500000);
      expect(updated?.refundReason).toBe("Client overpayment refund requested");
    });
  });

  // --------------------------------------------------------------------------
  // ПУНКТ 7: Ручной запуск cron дважды без дублей
  // --------------------------------------------------------------------------
  describe("Пункт 7: Идемпотентность cron (/api/cron/subscriptions)", () => {
    beforeAll(async () => {
      process.env.CRON_SECRET = "test-cron-secret-12345";
    });

    it("запуск cron дважды подряд не создаёт дублей", async () => {
      const req1 = new Request("http://localhost:3000/api/cron/subscriptions", {
        headers: { Authorization: "Bearer test-cron-secret-12345" },
      });
      const res1 = await runCronRoute(req1);
      expect(res1.status).toBe(200);
      const json1 = await res1.json();
      expect(json1.success).toBe(true);

      const notificationsCount1 = await db.notification.count();

      // Второй запуск сразу
      const req2 = new Request("http://localhost:3000/api/cron/subscriptions", {
        headers: { Authorization: "Bearer test-cron-secret-12345" },
      });
      const res2 = await runCronRoute(req2);
      expect(res2.status).toBe(200);
      const json2 = await res2.json();
      expect(json2.success).toBe(true);

      const notificationsCount2 = await db.notification.count();
      expect(notificationsCount2).toBe(notificationsCount1);
    });
  });

  // --------------------------------------------------------------------------
  // ПУНКТ 8: Тикеты поддержки и скрытие внутренних заметок
  // --------------------------------------------------------------------------
  describe("Пункт 8: Поддержка (ответ клиенту и приватность внутренних заметок)", () => {
    let ticketId: string;

    it("директор создаёт тикет в службу поддержки", async () => {
      const req = new Request("http://localhost:3000/api/platform/support", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${directorToken}`,
        },
        body: JSON.stringify({
          subject: "Вопрос по интеграции телефонии",
          message: "Здравствуйте, подскажите как подключить SIP-телефонию?",
          priority: "HIGH",
          centerId: createdCenterId,
        }),
      });

      const res = await createTicketRoute(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.ticket).toBeDefined();
      ticketId = json.ticket.id;
    });

    it("суперадмин пишет публичный ответ клиенту — автор получает уведомление", async () => {
      const req = new Request(`http://localhost:3000/api/platform/support/${ticketId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${superadminToken}`,
        },
        body: JSON.stringify({
          message: "Здравствуйте! Перейдите в настройки филиала для включения SIP.",
          isInternal: false,
        }),
      });

      const res = await createMessageRoute(req, { params: { id: ticketId } });
      expect(res.status).toBe(201);

      // Проверяем уведомление для директора
      const notif = await db.notification.findFirst({
        where: {
          userId: directorUser.id,
          type: "GENERAL",
        },
        orderBy: { createdAt: "desc" },
      });
      expect(notif).not.toBeNull();
    });

    it("суперадмин оставляет внутреннюю заметку — автору не идёт уведомление, доступ директору к платформенному тикету заблокирован (403)", async () => {
      const notifCountBefore = await db.notification.count({
        where: { userId: directorUser.id },
      });

      // 1. Создание внутренней заметки
      const reqInternal = new Request(
        `http://localhost:3000/api/platform/support/${ticketId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${superadminToken}`,
          },
          body: JSON.stringify({
            message: "СЕКРЕТНАЯ ВНУТРЕННЯЯ ЗАМЕТКА: проверить лог провайдера связи",
            isInternal: true,
          }),
        }
      );

      const resInternal = await createMessageRoute(reqInternal, { params: { id: ticketId } });
      expect(resInternal.status).toBe(201);

      // Проверяем, что внутренняя заметка НЕ создала уведомление автору
      const notifCountAfter = await db.notification.count({
        where: { userId: directorUser.id },
      });
      expect(notifCountAfter).toBe(notifCountBefore);

      // Проверяем, что директору доступ к платформенному API тикетов запрещён (403 Forbidden)
      const reqClientView = new Request(`http://localhost:3000/api/platform/support/${ticketId}`, {
        headers: { Authorization: `Bearer ${directorToken}` },
      });

      const resClientView = await getTicketRoute(reqClientView, { params: { id: ticketId } });
      expect(resClientView.status).toBe(403);
    });
  });

  // --------------------------------------------------------------------------
  // ПУНКТ 9: Дашборд на реальных данных (быстродействие и отсутствие ошибок)
  // --------------------------------------------------------------------------
  describe("Пункт 9: Загрузка дашборда на реальных данных", () => {
    it("дашборд отдаёт все 6 блоков без ошибок быстрее 1000мс", async () => {
      const startTime = performance.now();

      const req = new Request("http://localhost:3000/api/platform/dashboard?period=30d", {
        headers: { Authorization: `Bearer ${superadminToken}` },
      });

      const res = await getDashboardRoute(req);
      const endTime = performance.now();
      const elapsedMs = endTime - startTime;

      expect(res.status).toBe(200);
      const json = await res.json();

      // Проверка структуры всех 6 блоков
      expect(json.finance).toBeDefined();
      expect(json.finance.mrr).toBeGreaterThanOrEqual(0);
      expect(json.growth).toBeDefined();
      expect(json.numbers).toBeDefined();
      expect(json.numbers.centers).toBeDefined();
      expect(json.numbers.centers.byKind).toBeDefined();
      expect(json.attentionItems).toBeDefined();
      expect(json.events).toBeDefined();
      expect(json.health).toBeDefined();
      expect(json.health.dbStatus).toBe("HEALTHY");

      // Быстродействие
      expect(elapsedMs).toBeLessThan(1000);
    });
  });
});
