import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../src/lib/db";
import { signJWT } from "../src/lib/auth";
import { POST as impersonateRoute } from "../src/app/api/platform/impersonate/route";
import {
  GET as getAccounts,
  POST as postAccount,
  PATCH as patchAccount,
} from "../src/app/api/finance/accounts/route";
import {
  GET as getCategories,
  POST as postCategory,
} from "../src/app/api/finance/categories/route";
import {
  GET as getTransactions,
  POST as postTransaction,
} from "../src/app/api/finance/transactions/route";
import { POST as reverseTransactionRoute } from "../src/app/api/finance/transactions/[id]/reverse/route";
import {
  GET as getPeriods,
  POST as closePeriodRoute,
} from "../src/app/api/finance/periods/route";
import {
  GET as getSalaryRates,
  POST as postSalaryRate,
} from "../src/app/api/finance/salary-rates/route";
import { GET as getReports } from "../src/app/api/finance/reports/route";
import { GET as getExport } from "../src/app/api/finance/export/route";

describe("ACC-1b Item 6: Platform Roles on /api/finance/* (No Access Without Impersonation; Impersonation Read-Only + Audit)", () => {
  let centerId: string;
  let accountId: string;
  let categoryId: string;
  let txId: string;
  let directorId: string;
  let superAdminId: string;
  let developerId: string;
  let platformSupportId: string;
  let platformAdminId: string;
  const userIds: string[] = [];

  let superAdminDirectToken: string;
  let developerDirectToken: string;
  let platformSupportDirectToken: string;
  let platformAdminDirectToken: string;
  let directorToken: string;

  beforeAll(async () => {
    const ts = Date.now();

    const director = await db.platformUser.create({
      data: {
        email: `acc1b6_dir_${ts}@test.uz`,
        passwordHash: "hash",
        fullName: "Center Director",
        platformRole: "NONE",
        emailVerified: new Date(),
      },
    });
    directorId = director.id;
    userIds.push(directorId);

    const superAdmin = await db.platformUser.create({
      data: {
        email: `acc1b6_sa_${ts}@test.uz`,
        passwordHash: "hash",
        fullName: "Platform SuperAdmin",
        platformRole: "SUPERADMIN",
        emailVerified: new Date(),
      },
    });
    superAdminId = superAdmin.id;
    userIds.push(superAdminId);

    const developer = await db.platformUser.create({
      data: {
        email: `acc1b6_dev_${ts}@test.uz`,
        passwordHash: "hash",
        fullName: "Platform Developer",
        platformRole: "DEVELOPER",
        emailVerified: new Date(),
      },
    });
    developerId = developer.id;
    userIds.push(developerId);

    const platformSupport = await db.platformUser.create({
      data: {
        email: `acc1b6_ps_${ts}@test.uz`,
        passwordHash: "hash",
        fullName: "Platform Support",
        platformRole: "PLATFORM_SUPPORT",
        emailVerified: new Date(),
      },
    });
    platformSupportId = platformSupport.id;
    userIds.push(platformSupportId);

    const platformAdmin = await db.platformUser.create({
      data: {
        email: `acc1b6_pa_${ts}@test.uz`,
        passwordHash: "hash",
        fullName: "Platform Admin",
        platformRole: "PLATFORM_ADMIN",
        emailVerified: new Date(),
      },
    });
    platformAdminId = platformAdmin.id;
    userIds.push(platformAdminId);

    const center = await db.learningCenter.create({
      data: {
        name: "Impersonation Finance Center",
        slug: `imp-fin-${ts}`,
        status: "ACTIVE",
        ownerId: directorId,
      },
    });
    centerId = center.id;

    await db.centerMembership.create({
      data: {
        centerId,
        userId: directorId,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
    });

    const acc = await db.account.create({
      data: {
        centerId,
        name: "Касса центра",
        type: "CASH",
        isDefault: true,
      },
    });
    accountId = acc.id;

    const cat = await db.financeCategory.create({
      data: {
        centerId,
        name: "Оплата курсов",
        type: "INCOME",
      },
    });
    categoryId = cat.id;

    const tx = await db.financeTransaction.create({
      data: {
        centerId,
        type: "INCOME",
        amount: 500000,
        accountId,
        categoryId,
        date: new Date("2026-10-15T10:00:00+05:00"),
        description: "Оплата за октябрь",
        createdBy: directorId,
      },
    });
    txId = tx.id;

    directorToken = signJWT({
      userId: directorId,
      email: director.email,
      platformRole: "NONE",
      activeCenterId: centerId,
      activeCenterRole: "DIRECTOR",
    });

    // Direct tokens without impersonation flag/header
    superAdminDirectToken = signJWT({
      userId: superAdminId,
      email: superAdmin.email,
      platformRole: "SUPERADMIN",
      activeCenterId: centerId,
    });

    developerDirectToken = signJWT({
      userId: developerId,
      email: developer.email,
      platformRole: "DEVELOPER",
      activeCenterId: centerId,
    });

    platformSupportDirectToken = signJWT({
      userId: platformSupportId,
      email: platformSupport.email,
      platformRole: "PLATFORM_SUPPORT",
      activeCenterId: centerId,
    });

    platformAdminDirectToken = signJWT({
      userId: platformAdminId,
      email: platformAdmin.email,
      platformRole: "PLATFORM_ADMIN",
      activeCenterId: centerId,
    });
  });

  afterAll(async () => {
    if (centerId) {
      await db.auditLog.deleteMany({ where: { centerId } });
      await db.financeTransaction.deleteMany({ where: { centerId } });
      await db.financeCategory.deleteMany({ where: { centerId } });
      await db.account.deleteMany({ where: { centerId } });
      await db.centerMembership.deleteMany({ where: { centerId } });
      await db.learningCenter.deleteMany({ where: { id: centerId } });
    }
    if (userIds.length > 0) {
      await db.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } });
      await db.userSession.deleteMany({ where: { userId: { in: userIds } } });
      await db.platformUser.deleteMany({ where: { id: { in: userIds } } });
    }
  });

  it("1. SUPERADMIN, DEVELOPER, PLATFORM_SUPPORT, and PLATFORM_ADMIN cannot read or write /api/finance/* without impersonation (403 Forbidden)", async () => {
    for (const token of [
      superAdminDirectToken,
      developerDirectToken,
      platformSupportDirectToken,
      platformAdminDirectToken,
    ]) {
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      const accRes = await getAccounts(
        new Request(`http://localhost:3000/api/finance/accounts?centerId=${centerId}`, { headers })
      );
      expect(accRes.status).toBe(403);

      const catRes = await getCategories(
        new Request(`http://localhost:3000/api/finance/categories?centerId=${centerId}`, { headers })
      );
      expect(catRes.status).toBe(403);

      const txRes = await getTransactions(
        new Request(`http://localhost:3000/api/finance/transactions?centerId=${centerId}`, { headers })
      );
      expect(txRes.status).toBe(403);

      const repRes = await getReports(
        new Request(`http://localhost:3000/api/finance/reports?centerId=${centerId}&period=2026-10`, { headers })
      );
      expect(repRes.status).toBe(403);

      const expRes = await getExport(
        new Request(`http://localhost:3000/api/finance/export?centerId=${centerId}&period=2026-10&format=csv`, { headers })
      );
      expect(expRes.status).toBe(403);

      const postRes = await postAccount(
        new Request(`http://localhost:3000/api/finance/accounts?centerId=${centerId}`, {
          method: "POST",
          headers,
          body: JSON.stringify({ name: "Незаконный счёт", type: "CASH" }),
        })
      );
      expect(postRes.status).toBe(403);
    }
  });

  it("2. SUPERADMIN with explicit impersonation can READ /api/finance/* and every read records an AuditLog entry", async () => {
    // Test 2a: Using /api/platform/impersonate to start an impersonation session
    const impStartRes = await impersonateRoute(
      new Request("http://localhost:3000/api/platform/impersonate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${superAdminDirectToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetUserId: directorId,
          targetCenterId: centerId,
          reason: "Аудит финансового отчёта по запросу директора",
        }),
      })
    );
    expect(impStartRes.status).toBe(200);
    const setCookieHeader = impStartRes.headers.get("set-cookie") || "";
    const match = setCookieHeader.match(/auth_token=([^;]+)/);
    expect(match).toBeTruthy();
    const impersonationSessionToken = match![1];

    // Read accounts via impersonation session token
    const accRes = await getAccounts(
      new Request("http://localhost:3000/api/finance/accounts", {
        headers: { Authorization: `Bearer ${impersonationSessionToken}` },
      })
    );
    expect(accRes.status).toBe(200);

    // Read reports via impersonation header on superAdminDirectToken
    const repRes = await getReports(
      new Request("http://localhost:3000/api/finance/reports?period=2026-10", {
        headers: {
          Authorization: `Bearer ${superAdminDirectToken}`,
          "x-impersonate-center-id": centerId,
          "x-impersonation-reason": "Balance verification audit",
        },
      })
    );
    expect(repRes.status).toBe(200);

    // Verify AuditLog entries recorded for finance impersonation reads
    const auditLogs = await db.auditLog.findMany({
      where: {
        centerId,
        action: "FINANCE_IMPERSONATION_READ",
      },
      orderBy: { createdAt: "desc" },
    });
    expect(auditLogs.length).toBeGreaterThanOrEqual(2);
    expect(auditLogs[0].actorUserId).toBe(superAdminId);
  });

  it("3. Impersonation on /api/finance/* is strictly READ-ONLY: all write methods (POST/PATCH) are blocked with 403 even when impersonating", async () => {
    // Get impersonation session token for DIRECTOR
    const impStartRes = await impersonateRoute(
      new Request("http://localhost:3000/api/platform/impersonate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${superAdminDirectToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetUserId: directorId,
          targetCenterId: centerId,
          reason: "Read-only check",
        }),
      })
    );
    const setCookieHeader = impStartRes.headers.get("set-cookie") || "";
    const impToken = setCookieHeader.match(/auth_token=([^;]+)/)![1];

    // Test both impersonation session token AND header-based impersonation
    const authContexts: Record<string, string>[] = [
      {
        Authorization: `Bearer ${impToken}`,
        "Content-Type": "application/json",
      },
      {
        Authorization: `Bearer ${superAdminDirectToken}`,
        "x-impersonate-center-id": centerId,
        "x-impersonation-reason": "Attempted write during impersonation",
        "Content-Type": "application/json",
      },
    ];

    for (const headers of authContexts) {
      const postAcc = await postAccount(
        new Request("http://localhost:3000/api/finance/accounts", {
          method: "POST",
          headers,
          body: JSON.stringify({ name: "Запрещённый счёт", type: "CASH" }),
        })
      );
      expect(postAcc.status).toBe(403);

      const patchAcc = await patchAccount(
        new Request("http://localhost:3000/api/finance/accounts", {
          method: "PATCH",
          headers,
          body: JSON.stringify({ id: accountId, name: "Изменение при имперсонации" }),
        })
      );
      expect(patchAcc.status).toBe(403);

      const postCat = await postCategory(
        new Request("http://localhost:3000/api/finance/categories", {
          method: "POST",
          headers,
          body: JSON.stringify({ name: "Запрещённая категория", type: "INCOME" }),
        })
      );
      expect(postCat.status).toBe(403);

      const postTx = await postTransaction(
        new Request("http://localhost:3000/api/finance/transactions", {
          method: "POST",
          headers,
          body: JSON.stringify({
            type: "INCOME",
            amount: 100000,
            accountId,
            categoryId,
          }),
        })
      );
      expect(postTx.status).toBe(403);

      const revTx = await reverseTransactionRoute(
        new Request(`http://localhost:3000/api/finance/transactions/${txId}/reverse`, {
          method: "POST",
          headers,
          body: JSON.stringify({ reason: "Попытка сторно при имперсонации" }),
        }),
        { params: Promise.resolve({ id: txId }) }
      );
      expect(revTx.status).toBe(403);

      const closePer = await closePeriodRoute(
        new Request("http://localhost:3000/api/finance/periods", {
          method: "POST",
          headers,
          body: JSON.stringify({ year: 2026, month: 10 }),
        })
      );
      expect(closePer.status).toBe(403);

      const postRate = await postSalaryRate(
        new Request("http://localhost:3000/api/finance/salary-rates", {
          method: "POST",
          headers,
          body: JSON.stringify({
            teacherMembershipId: accountId,
            rateType: "FIXED",
            amount: 1000000,
          }),
        })
      );
      expect(postRate.status).toBe(403);
    }

    // Real center DIRECTOR (not impersonated) can still write normally
    const dirPostCat = await postCategory(
      new Request("http://localhost:3000/api/finance/categories", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${directorToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Легитимная категория директора", type: "INCOME" }),
      })
    );
    expect(dirPostCat.status).toBe(201);
  });
});
