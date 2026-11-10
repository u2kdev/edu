import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../src/lib/db";
import { signJWT } from "../src/lib/auth";
import { recordFinanceTransaction } from "../src/lib/finance";
import {
  sanitizeSpreadsheetCell,
  generateFinanceCsv,
  generateFinanceXlsx,
} from "../src/lib/finance-export";
import { GET as exportFinanceRoute } from "../src/app/api/finance/export/route";

describe("ACC-1 Item 6 & ACC-1b Item 7: CSV and XLSX Export with Mandatory Period Filter, Pagination & Formula Protection", () => {
  let centerId: string;
  let directorUserId: string;
  let accountantUserId: string;
  let teacherUserId: string;
  let directorToken: string;
  let accountantToken: string;
  let teacherToken: string;
  let cashAccId: string;
  let catIncomeId: string;

  beforeAll(async () => {
    const ts = Date.now();
    const dirUser = await db.platformUser.create({
      data: {
        email: `acc6_dir_${ts}@test.uz`,
        passwordHash: "hash",
        fullName: "Director Export",
        emailVerified: new Date(),
      },
    });
    directorUserId = dirUser.id;

    const accUser = await db.platformUser.create({
      data: {
        email: `acc6_acc_${ts}@test.uz`,
        passwordHash: "hash",
        fullName: "Accountant Export",
        emailVerified: new Date(),
      },
    });
    accountantUserId = accUser.id;

    const tchUser = await db.platformUser.create({
      data: {
        email: `acc6_tch_${ts}@test.uz`,
        passwordHash: "hash",
        fullName: "Teacher Export",
        emailVerified: new Date(),
      },
    });
    teacherUserId = tchUser.id;

    const center = await db.learningCenter.create({
      data: {
        name: "Export Security Center",
        slug: `exp-sec-${ts}`,
        status: "ACTIVE",
        ownerId: directorUserId,
      },
    });
    centerId = center.id;

    await db.centerMembership.createMany({
      data: [
        { centerId, userId: directorUserId, role: "DIRECTOR", status: "ACTIVE" },
        { centerId, userId: accountantUserId, role: "ACCOUNTANT", status: "ACTIVE" },
        { centerId, userId: teacherUserId, role: "TEACHER", status: "ACTIVE" },
      ],
    });

    directorToken = await signJWT({
      userId: directorUserId,
      email: dirUser.email,
      platformRole: "NONE",
      activeCenterId: centerId,
      activeCenterRole: "DIRECTOR",
    });

    accountantToken = await signJWT({
      userId: accountantUserId,
      email: accUser.email,
      platformRole: "NONE",
      activeCenterId: centerId,
      activeCenterRole: "ACCOUNTANT",
    });

    teacherToken = await signJWT({
      userId: teacherUserId,
      email: tchUser.email,
      platformRole: "NONE",
      activeCenterId: centerId,
      activeCenterRole: "TEACHER",
    });

    const acc = await db.account.create({
      data: { centerId, name: "Касса Экспорт", type: "CASH", currency: "UZS" },
    });
    cashAccId = acc.id;

    const cat = await db.financeCategory.create({
      data: { centerId, name: "Оплата Экспорт", type: "INCOME" },
    });
    catIncomeId = cat.id;

    // Seed 3 transactions in October 2026 with malicious formula payloads (=, +, -, @)
    const maliciousPayloads = [
      { desc: "=CMD|' /C calc'!A0", cp: "+998901234567", date: "2026-10-10T10:00:00+05:00" },
      { desc: "-2+3+cmd|' /C calc'!A0", cp: "@SUM(1+1)*cmd|' /C calc'!A0", date: "2026-10-12T10:00:00+05:00" },
      { desc: "  =HYPERLINK(\"http://evil.uz\",\"Click\")", cp: "\t+100000", date: "2026-10-15T10:00:00+05:00" },
    ];

    for (const item of maliciousPayloads) {
      await recordFinanceTransaction({
        centerId,
        type: "INCOME",
        amount: 350000,
        accountId: cashAccId,
        categoryId: catIncomeId,
        date: new Date(item.date),
        description: item.desc,
        counterparty: item.cp,
        createdBy: directorUserId,
      });
    }
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
    const uIds = [directorUserId, accountantUserId, teacherUserId].filter(Boolean);
    if (uIds.length > 0) {
      await db.userSession.deleteMany({ where: { userId: { in: uIds } } });
      await db.platformUser.deleteMany({ where: { id: { in: uIds } } });
    }
  });

  it("1. neutralizes formula injection prefixes (=, +, -, @, and leading whitespace/tabs before them) in sanitizeSpreadsheetCell", () => {
    expect(sanitizeSpreadsheetCell("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
    expect(sanitizeSpreadsheetCell("+998901234567")).toBe("'+998901234567");
    expect(sanitizeSpreadsheetCell("-50000")).toBe("'-50000");
    expect(sanitizeSpreadsheetCell("@admin")).toBe("'@admin");
    expect(sanitizeSpreadsheetCell("  =EVIL()")).toBe("'  =EVIL()");
    expect(sanitizeSpreadsheetCell("\t+EVIL()")).toBe("'\t+EVIL()");
    expect(sanitizeSpreadsheetCell("Обычный текст")).toBe("Обычный текст");
  });

  it("2. requires mandatory period filter (period=YYYY-MM or startDate & endDate) and rejects export without period (400 Bad Request)", async () => {
    // Missing period and startDate/endDate -> 400
    const noPeriodRes = await exportFinanceRoute(
      new Request("http://localhost:3000/api/finance/export?format=csv", {
        headers: { Authorization: `Bearer ${directorToken}` },
      })
    );
    expect(noPeriodRes.status).toBe(400);
    const noPeriodBody = await noPeriodRes.json();
    expect(noPeriodBody.error).toMatch(/period/i);

    // Invalid period format -> 400
    const badPeriodRes = await exportFinanceRoute(
      new Request("http://localhost:3000/api/finance/export?format=csv&period=all", {
        headers: { Authorization: `Bearer ${directorToken}` },
      })
    );
    expect(badPeriodRes.status).toBe(400);

    // Valid startDate & endDate range -> 200
    const rangeRes = await exportFinanceRoute(
      new Request(
        "http://localhost:3000/api/finance/export?format=csv&startDate=2026-10-01T00:00:00%2B05:00&endDate=2026-10-31T23:59:59%2B05:00",
        {
          headers: { Authorization: `Bearer ${directorToken}` },
        }
      )
    );
    expect(rangeRes.status).toBe(200);
  });

  it("3. exports CSV and XLSX with escaped formulas and supports export page pagination (page & pageSize with X-Export-* headers)", async () => {
    // Teacher cannot export (403)
    const tchRes = await exportFinanceRoute(
      new Request("http://localhost:3000/api/finance/export?format=csv&period=2026-10", {
        headers: { Authorization: `Bearer ${teacherToken}` },
      })
    );
    expect(tchRes.status).toBe(403);

    // Accountant exports full page 1 (all 3 rows in 2026-10)
    const csvRes = await exportFinanceRoute(
      new Request("http://localhost:3000/api/finance/export?format=csv&period=2026-10", {
        headers: { Authorization: `Bearer ${accountantToken}` },
      })
    );
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers.get("content-type")).toContain("text/csv");
    expect(csvRes.headers.get("x-export-page")).toBe("1");
    expect(csvRes.headers.get("x-export-total-rows")).toBe("3");
    expect(csvRes.headers.get("x-export-total-pages")).toBe("1");
    const csvText = await csvRes.text();

    // Ensure malicious formulas are prefixed with single quote '
    expect(csvText).toContain("'=CMD|");
    expect(csvText).toContain("'+998901234567");
    expect(csvText).toContain("'-2+3+cmd");
    expect(csvText).toContain("'@SUM(1+1)");

    // Director exports XLSX
    const xlsxRes = await exportFinanceRoute(
      new Request("http://localhost:3000/api/finance/export?format=xlsx&period=2026-10", {
        headers: { Authorization: `Bearer ${directorToken}` },
      })
    );
    expect(xlsxRes.status).toBe(200);
    expect(xlsxRes.headers.get("content-type")).toContain("spreadsheetml");

    const xlsxBytes = new Uint8Array(await xlsxRes.arrayBuffer());
    expect(xlsxBytes[0]).toBe(0x50); // 'P'
    expect(xlsxBytes[1]).toBe(0x4b); // 'K'
    const rawZipAscii = Buffer.from(xlsxBytes).toString("utf8");
    expect(rawZipAscii).toContain("xl/worksheets/sheet1.xml");
    expect(rawZipAscii).toContain("<t>&apos;=CMD|");
    expect(rawZipAscii).toContain("<t>&apos;+998901234567</t>");

    // Pagination: page=1&pageSize=2 returns 2 data rows + 1 header row = 3 lines
    const page1Res = await exportFinanceRoute(
      new Request("http://localhost:3000/api/finance/export?format=csv&period=2026-10&page=1&pageSize=2", {
        headers: { Authorization: `Bearer ${directorToken}` },
      })
    );
    expect(page1Res.status).toBe(200);
    expect(page1Res.headers.get("x-export-page")).toBe("1");
    expect(page1Res.headers.get("x-export-page-size")).toBe("2");
    expect(page1Res.headers.get("x-export-total-rows")).toBe("3");
    expect(page1Res.headers.get("x-export-total-pages")).toBe("2");
    const page1Lines = (await page1Res.text()).trim().split(/\r?\n/);
    expect(page1Lines.length).toBe(3); // 1 header + 2 rows

    // Pagination: page=2&pageSize=2 returns remaining 1 data row + 1 header row = 2 lines
    const page2Res = await exportFinanceRoute(
      new Request("http://localhost:3000/api/finance/export?format=csv&period=2026-10&page=2&pageSize=2", {
        headers: { Authorization: `Bearer ${directorToken}` },
      })
    );
    expect(page2Res.status).toBe(200);
    expect(page2Res.headers.get("x-export-page")).toBe("2");
    expect(page2Res.headers.get("x-export-page-size")).toBe("2");
    expect(page2Res.headers.get("x-export-total-rows")).toBe("3");
    expect(page2Res.headers.get("x-export-total-pages")).toBe("2");
    const page2Lines = (await page2Res.text()).trim().split(/\r?\n/);
    expect(page2Lines.length).toBe(2); // 1 header + 1 row

    // Direct generator still works for valid row sets
    expect(generateFinanceCsv([])).toContain("ID");
    expect(generateFinanceXlsx([]).length).toBeGreaterThan(0);
  });
});
