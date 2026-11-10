import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../src/lib/db";
import { signJWT } from "../src/lib/auth";
import { recordFinanceTransaction } from "../src/lib/finance";
import {
  sanitizeSpreadsheetCell,
  generateFinanceCsv,
  generateFinanceXlsx,
  MAX_FINANCE_EXPORT_ROWS,
} from "../src/lib/finance-export";
import { GET as exportFinanceRoute } from "../src/app/api/finance/export/route";

describe("ACC-1 Item 6: CSV and XLSX Export with Formula Injection Protection & Row Limit", () => {
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

    // Seed transactions with malicious formula payloads (=, +, -, @)
    const maliciousPayloads = [
      { desc: "=CMD|' /C calc'!A0", cp: "+998901234567" },
      { desc: "-2+3+cmd|' /C calc'!A0", cp: "@SUM(1+1)*cmd|' /C calc'!A0" },
      { desc: "  =HYPERLINK(\"http://evil.uz\",\"Click\")", cp: "\t+100000" },
    ];

    for (const item of maliciousPayloads) {
      await recordFinanceTransaction({
        centerId,
        type: "INCOME",
        amount: 350000,
        accountId: cashAccId,
        categoryId: catIncomeId,
        date: new Date("2026-10-12T10:00:00+05:00"),
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

  it("2. exports CSV and XLSX with escaped formulas and enforces row limit", async () => {
    // Teacher cannot export (403)
    const tchRes = await exportFinanceRoute(
      new Request("http://localhost:3000/api/finance/export?format=csv", {
        headers: { Authorization: `Bearer ${teacherToken}` },
      })
    );
    expect(tchRes.status).toBe(403);

    // Accountant can export CSV
    const csvRes = await exportFinanceRoute(
      new Request("http://localhost:3000/api/finance/export?format=csv&period=2026-10", {
        headers: { Authorization: `Bearer ${accountantToken}` },
      })
    );
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers.get("content-type")).toContain("text/csv");
    const csvText = await csvRes.text();

    // Ensure malicious formulas are prefixed with single quote '
    expect(csvText).toContain("'=CMD|");
    expect(csvText).toContain("'+998901234567");
    expect(csvText).toContain("'-2+3+cmd");
    expect(csvText).toContain("'@SUM(1+1)");

    // Director can export XLSX
    const xlsxRes = await exportFinanceRoute(
      new Request("http://localhost:3000/api/finance/export?format=xlsx&period=2026-10", {
        headers: { Authorization: `Bearer ${directorToken}` },
      })
    );
    expect(xlsxRes.status).toBe(200);
    expect(xlsxRes.headers.get("content-type")).toContain("spreadsheetml");

    const xlsxBytes = new Uint8Array(await xlsxRes.arrayBuffer());
    // Must be a valid ZIP container (PK\x03\x04) containing xl/worksheets/sheet1.xml
    expect(xlsxBytes[0]).toBe(0x50); // 'P'
    expect(xlsxBytes[1]).toBe(0x4b); // 'K'
    const rawZipAscii = Buffer.from(xlsxBytes).toString("utf8");
    expect(rawZipAscii).toContain("xl/worksheets/sheet1.xml");
    expect(rawZipAscii).toContain("<t>&apos;=CMD|");
    expect(rawZipAscii).toContain("<t>&apos;+998901234567</t>");

    // Enforce row limit via query param (e.g. limit=2 returns at most 2 data rows) and reject limit > MAX_FINANCE_EXPORT_ROWS
    expect(MAX_FINANCE_EXPORT_ROWS).toBeLessThanOrEqual(5000);
    const limitedRes = await exportFinanceRoute(
      new Request("http://localhost:3000/api/finance/export?format=csv&limit=2", {
        headers: { Authorization: `Bearer ${directorToken}` },
      })
    );
    expect(limitedRes.status).toBe(200);
    const limitedLines = (await limitedRes.text()).trim().split(/\r?\n/);
    // 1 header line + 2 data lines = 3 lines
    expect(limitedLines.length).toBe(3);

    // Direct generator throws if rows exceed MAX_FINANCE_EXPORT_ROWS
    const oversizedRows = Array.from({ length: MAX_FINANCE_EXPORT_ROWS + 1 }, (_, i) => ({
      id: `id-${i}`,
      date: "2026-10-12",
      type: "INCOME",
      amount: 1000,
      currency: "UZS",
      accountName: "Касса",
      targetAccountName: "",
      categoryName: "Оплата",
      counterparty: "Студент",
      description: "Оплата",
      branchName: "",
      groupName: "",
      isReversal: false,
    }));
    expect(() => generateFinanceCsv(oversizedRows)).toThrow(/row limit/i);
    expect(() => generateFinanceXlsx(oversizedRows)).toThrow(/row limit/i);
  });
});
