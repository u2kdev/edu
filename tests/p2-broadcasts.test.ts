import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "../src/lib/db";
import { signJWT, hashPassword } from "../src/lib/auth";
import { fromTashkentParts, addCalendarDays } from "../src/lib/billing";
import {
  renderBroadcastText,
  previewBroadcast,
  processDueScheduledBroadcasts,
} from "../src/lib/broadcasts";
import {
  GET as getTemplatesRoute,
  POST as postTemplatesRoute,
  DELETE as deleteTemplateRoute,
} from "../src/app/api/communications/templates/route";
import {
  GET as getBroadcastsRoute,
  POST as postBroadcastsRoute,
} from "../src/app/api/communications/broadcasts/route";

let mockToken = "";

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => (name === "auth_token" ? { value: mockToken } : undefined),
    set: vi.fn(),
  }),
}));

describe("P2 Bilingual Broadcasts, Segments, SMS Preview & Templates", () => {
  const ts = Date.now();
  const createdCenterIds: string[] = [];
  const createdUserIds: string[] = [];

  let centerAId = "";
  let centerBId = "";
  let dirAUserId = "";
  let dirAEmail = "";
  let stuUserId = "";
  let stuEmail = "";
  let teacherUserId = "";
  let teacherEmail = "";
  let supportUserId = "";
  let supportEmail = "";
  let groupAId = "";
  let groupBId = "";

  beforeAll(async () => {
    const passHash = await hashPassword("BcastTest!123");

    const dirA = await db.platformUser.create({
      data: {
        email: `bc_dirA_${ts}@test.uz`,
        fullName: "Broadcast Director A",
        passwordHash: passHash,
        emailVerified: new Date(),
      },
    });
    const dirB = await db.platformUser.create({
      data: {
        email: `bc_dirB_${ts}@test.uz`,
        fullName: "Broadcast Director B",
        passwordHash: passHash,
        emailVerified: new Date(),
      },
    });
    const stu = await db.platformUser.create({
      data: {
        email: `bc_stu_${ts}@test.uz`,
        phone: `+99890${String(ts).slice(-7)}`,
        fullName: "Zarina Debtor",
        preferredLanguage: "uz_Latn",
        passwordHash: passHash,
        emailVerified: new Date(),
      },
    });
    const tch = await db.platformUser.create({
      data: {
        email: `bc_tch_${ts}@test.uz`,
        fullName: "Broadcast Teacher",
        passwordHash: passHash,
        emailVerified: new Date(),
      },
    });
    const sup = await db.platformUser.create({
      data: {
        email: `bc_sup_${ts}@test.uz`,
        fullName: "Support User",
        platformRole: "PLATFORM_SUPPORT",
        passwordHash: passHash,
        emailVerified: new Date(),
      },
    });

    createdUserIds.push(dirA.id, dirB.id, stu.id, tch.id, sup.id);
    dirAUserId = dirA.id;
    dirAEmail = dirA.email;
    stuUserId = stu.id;
    stuEmail = stu.email;
    teacherUserId = tch.id;
    teacherEmail = tch.email;
    supportUserId = sup.id;
    supportEmail = sup.email;

    const cA = await db.learningCenter.create({
      data: {
        name: "Broadcast Center A",
        slug: `bc-center-a-${ts}`,
        status: "ACTIVE",
        ownerId: dirA.id,
        smsEnabled: true,
        emailEnabled: true,
        quietHoursStart: 8,
        quietHoursEnd: 8, // Disable quiet hours for synchronous broadcast assertions
      },
    });
    const cB = await db.learningCenter.create({
      data: {
        name: "Broadcast Center B",
        slug: `bc-center-b-${ts}`,
        status: "ACTIVE",
        ownerId: dirB.id,
      },
    });
    createdCenterIds.push(cA.id, cB.id);
    centerAId = cA.id;
    centerBId = cB.id;

    const [dirAMem, dirBMem, stuMem] = await Promise.all([
      db.centerMembership.create({
        data: { userId: dirA.id, centerId: centerAId, role: "DIRECTOR", status: "ACTIVE" },
      }),
      db.centerMembership.create({
        data: { userId: dirB.id, centerId: centerBId, role: "DIRECTOR", status: "ACTIVE" },
      }),
      db.centerMembership.create({
        data: { userId: stu.id, centerId: centerAId, role: "STUDENT", status: "ACTIVE" },
      }),
      db.centerMembership.create({
        data: { userId: tch.id, centerId: centerAId, role: "TEACHER", status: "ACTIVE" },
      }),
    ]);

    const courseA = await db.course.create({
      data: { centerId: centerAId, title: "Frontend", priceMonthly: 500000, createdByMembershipId: dirAMem.id },
    });
    const groupA = await db.group.create({
      data: { centerId: centerAId, courseId: courseA.id, name: "FE-01", teacherMembershipId: dirAMem.id },
    });
    groupAId = groupA.id;

    const courseB = await db.course.create({
      data: { centerId: centerBId, title: "Other Course", priceMonthly: 500000, createdByMembershipId: dirBMem.id },
    });
    const groupB = await db.group.create({
      data: { centerId: centerBId, courseId: courseB.id, name: "Other-Grp", teacherMembershipId: dirBMem.id },
    });
    groupBId = groupB.id;

    const duePast = addCalendarDays(new Date(), -2);
    const enrollmentA = await db.enrollment.create({
      data: {
        centerId: centerAId,
        groupId: groupAId,
        studentMembershipId: stuMem.id,
        status: "ACTIVE",
        paidUntil: duePast,
      },
    });
    await db.charge.create({
      data: {
        centerId: centerAId,
        enrollmentId: enrollmentA.id,
        studentMembershipId: stuMem.id,
        groupId: groupAId,
        invoiceNumber: `INV-BC-${ts}`,
        periodMonths: 1,
        periodStart: duePast,
        periodEnd: addCalendarDays(duePast, 30),
        originalAmount: 500000,
        amount: 500000,
        paidAmount: 0,
        dueDate: duePast,
        status: "PENDING",
      },
    });
  });

  afterAll(async () => {
    for (const cid of createdCenterIds) {
      await db.charge.deleteMany({ where: { centerId: cid } }).catch(() => null);
      await db.learningCenter.delete({ where: { id: cid } }).catch(() => null);
    }
    for (const uid of createdUserIds) {
      await db.platformUser.delete({ where: { id: uid } }).catch(() => null);
    }
  });

  it("renders template variables cleanly and escapes HTML values when requested", () => {
    const outPlain = renderBroadcastText("Hi {{studentName}}, pay {{amount}} for {{groupName}}", {
      studentName: "Ali <Admin>",
      amount: "500 000",
      groupName: "FE-01",
    });
    expect(outPlain).toBe("Hi Ali <Admin>, pay 500 000 for FE-01");

    const outHtml = renderBroadcastText(
      "Hi {{studentName}}, url={{payUrl}}",
      {
        studentName: '<script>xss()</script>',
        payUrl: 'https://click.uz/"bad',
      },
      { escapeHtmlValues: true }
    );
    expect(outHtml).toContain("&lt;script&gt;xss()&lt;/script&gt;");
    expect(outHtml).not.toContain("<script>");
  });

  it("supports bilingual template CRUD and enforces RBAC + PLATFORM_SUPPORT blocks", async () => {
    // Student/Teacher/Support cannot create templates
    mockToken = await signJWT({ userId: stuUserId, email: stuEmail, platformRole: "NONE", activeCenterId: centerAId });
    const stuRes = await postTemplatesRoute(
      new Request("http://localhost/api/communications/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "t1", locale: "ru", title: "T", body: "B" }),
      })
    );
    expect(stuRes.status).toBe(403);

    mockToken = await signJWT({
      userId: teacherUserId,
      email: teacherEmail,
      platformRole: "NONE",
      activeCenterId: centerAId,
    });
    const tchRes = await postTemplatesRoute(
      new Request("http://localhost/api/communications/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "t1", locale: "ru", title: "T", body: "B" }),
      })
    );
    expect(tchRes.status).toBe(403);

    mockToken = await signJWT({
      userId: supportUserId,
      email: supportEmail,
      platformRole: "PLATFORM_SUPPORT",
      activeCenterId: centerAId,
    });
    const supRes = await postTemplatesRoute(
      new Request("http://localhost/api/communications/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "t1", locale: "ru", title: "T", body: "B" }),
      })
    );
    expect(supRes.status).toBe(403);

    // Director saves RU and uz-Latn templates
    mockToken = await signJWT({ userId: dirAUserId, email: dirAEmail, platformRole: "NONE", activeCenterId: centerAId });
    const createRu = await postTemplatesRoute(
      new Request("http://localhost/api/communications/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "debt_notice",
          locale: "ru",
          title: "Долг",
          body: "Уважаемый {{studentName}}, сумма {{amount}}",
        }),
      })
    );
    expect(createRu.status).toBe(201);
    expect(createRu.headers.get("cache-control")).toBe("no-store");

    const createUz = await postTemplatesRoute(
      new Request("http://localhost/api/communications/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "debt_notice",
          locale: "uz-Latn",
          title: "Qarz eslatmasi",
          body: "Hurmatli {{studentName}}, summa {{amount}}",
        }),
      })
    );
    expect(createUz.status).toBe(201);
    const uzJson = await createUz.json();

    const listRes = await getTemplatesRoute(
      new Request("http://localhost/api/communications/templates?locale=uz-Latn")
    );
    expect(listRes.status).toBe(200);
    const listJson = await listRes.json();
    expect(listJson.templates.length).toBe(1);
    expect(listJson.templates[0].key).toBe("debt_notice");

    const delRes = await deleteTemplateRoute(
      new Request(`http://localhost/api/communications/templates?id=${uzJson.template.id}`, {
        method: "DELETE",
      })
    );
    expect(delRes.status).toBe(200);
  });

  it("previews segments + SMS cost, blocks cross-tenant group, requires confirmation, and executes scheduled & immediate broadcasts", async () => {
    mockToken = await signJWT({ userId: dirAUserId, email: dirAEmail, platformRole: "NONE", activeCenterId: centerAId });

    // Cross-tenant groupId blocked with 404
    const crossGrp = await postBroadcastsRoute(
      new Request("http://localhost/api/communications/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview",
          title: "Bad",
          bodyRu: "Hi",
          channel: "IN_APP",
          audience: "GROUP",
          targetGroupId: groupBId,
        }),
      })
    );
    expect(crossGrp.status).toBe(404);

    // Preview SMS for DEBTORS (finds Zarina Debtor with uz_Latn locale & phone)
    const prevDebtors = await previewBroadcast({
      centerId: centerAId,
      audience: "DEBTORS",
      channel: "SMS",
      bodyRu: "Оплатите {{amount}} сум",
      bodyUz: "Hurmatli {{studentName}}, {{amount}} so'm to'lang",
    });
    expect(prevDebtors.totalRecipients).toBe(1);
    expect(prevDebtors.estimatedSmsSegments).toBeGreaterThanOrEqual(1);
    expect(prevDebtors.estimatedCostUzs).toBeGreaterThan(0);
    expect(prevDebtors.sampleMessages[0].text).toContain("Zarina Debtor");

    // Attempt send WITHOUT confirmed: true -> 400
    const unconfirmed = await postBroadcastsRoute(
      new Request("http://localhost/api/communications/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          title: "Должникам",
          bodyRu: "Оплатите {{amount}} сум",
          bodyUz: "Tolov: {{amount}}",
          channel: "SMS",
          audience: "OVERDUE",
          confirmed: false,
        }),
      })
    );
    expect(unconfirmed.status).toBe(400);

    // Immediate send with confirmed: true & audience=GROUP
    const sentRes = await postBroadcastsRoute(
      new Request("http://localhost/api/communications/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          title: "Урок перенесён",
          bodyRu: "Группа {{groupName}}: занятие завтра",
          bodyUz: "{{groupName}} guruhi: dars ertaga",
          channel: "SMS",
          audience: "GROUP",
          targetGroupId: groupAId,
          confirmed: true,
        }),
      })
    );
    expect(sentRes.status).toBe(201);
    const sentJson = await sentRes.json();
    expect(sentJson.summary.sentCount).toBe(1);
    expect(sentJson.broadcast.status).toBe("COMPLETED");

    // Schedule future broadcast -> then execute via processDueScheduledBroadcasts
    const schedAt = fromTashkentParts(2026, 12, 1, 14, 0, 0);
    const schedRes = await postBroadcastsRoute(
      new Request("http://localhost/api/communications/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "schedule",
          title: "Плановая рассылка",
          bodyRu: "Новости центра {{centerName}}",
          channel: "IN_APP",
          audience: "ROLE",
          targetRole: "STUDENT",
          scheduledAt: schedAt.toISOString(),
        }),
      })
    );
    expect(schedRes.status).toBe(201);
    const schedJson = await schedRes.json();
    expect(schedJson.broadcast.status).toBe("SCHEDULED");

    const processedCount = await processDueScheduledBroadcasts({
      now: fromTashkentParts(2026, 12, 1, 14, 5, 0),
    });
    expect(processedCount).toBeGreaterThanOrEqual(1);

    const afterSched = await db.broadcast.findUnique({ where: { id: schedJson.broadcast.id } });
    expect(afterSched?.status).toBe("COMPLETED");

    // History list with pagination & search
    const histRes = await getBroadcastsRoute(
      new Request("http://localhost/api/communications/broadcasts?search=Урок&pageSize=10")
    );
    expect(histRes.status).toBe(200);
    expect(histRes.headers.get("cache-control")).toBe("no-store");
    const histJson = await histRes.json();
    expect(histJson.broadcasts.some((b: { id: string }) => b.id === sentJson.broadcast.id)).toBe(true);
  });
});
