import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/tenant";
import { checkSubscriptionLimit } from "@/lib/limits";
import { hashPassword } from "@/lib/auth";
import crypto from "crypto";

interface CsvRow {
  rowNumber: number;
  fullName: string;
  email: string;
  phone?: string;
  groupId?: string;
  error?: string;
}

function sanitizeCsvValue(val: string): string {
  const trimmed = val.trim();
  if (/^[=+\-@\t\r]/.test(trimmed)) {
    return `'${trimmed}`;
  }
  return trimmed;
}

export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();

    if (
      tenantCtx.role !== "DIRECTOR" &&
      tenantCtx.role !== "CENTER_ADMIN" &&
      !tenantCtx.isPlatformStaff
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { csvContent, mode } = await req.json(); // mode: "preview" | "execute"

    if (!csvContent || typeof csvContent !== "string") {
      return NextResponse.json(
        { error: "CSV-контент пуст или не передан" },
        { status: 400 }
      );
    }

    if (csvContent.length > 1_000_000) {
      return NextResponse.json(
        { error: "Размер CSV файла превышает допустимый предел (1 МБ)" },
        { status: 400 }
      );
    }

    // Split rows by newline
    const lines = csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      return NextResponse.json({ error: "CSV файл пуст" }, { status: 400 });
    }

    // Parse header and rows
    const firstLine = lines[0].toLowerCase();
    const hasHeader =
      firstLine.includes("email") ||
      firstLine.includes("имя") ||
      firstLine.includes("name");
    const dataLines = hasHeader ? lines.slice(1) : lines;

    if (dataLines.length > 500) {
      return NextResponse.json(
        {
          error: "Превышено максимальное число строк для импорта (максимум 500)",
        },
        { status: 400 }
      );
    }

    // Cache valid group IDs for this center
    const centerGroups = await tenantDb.group.findMany({
      where: { centerId: tenantCtx.center.id },
      select: { id: true, name: true, maxStudents: true },
    });
    const groupMap = new Map(centerGroups.map((g) => [g.id, g]));

    const parsedRows: CsvRow[] = [];
    const validRows: CsvRow[] = [];
    const errors: { row: number; error: string; raw: string }[] = [];

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    dataLines.forEach((line, index) => {
      const rowNumber = index + (hasHeader ? 2 : 1);
      // Support comma or semicolon delimited CSV
      const parts = line.includes(";")
        ? line.split(";").map((p) => p.trim())
        : line.split(",").map((p) => p.trim());

      const rawFullName = parts[0] || "";
      const email = parts[1] || "";
      const rawPhone = parts[2] || undefined;
      const groupId = parts[3] || undefined;

      if (!rawFullName) {
        errors.push({
          row: rowNumber,
          error: "Не указано ФИО",
          raw: line,
        });
        return;
      }

      const fullName = sanitizeCsvValue(rawFullName);
      const phone = rawPhone ? sanitizeCsvValue(rawPhone) : undefined;

      if (!email || !emailRegex.test(email)) {
        errors.push({
          row: rowNumber,
          error: "Некорректный email",
          raw: line,
        });
        return;
      }

      if (groupId && !groupMap.has(groupId)) {
        errors.push({
          row: rowNumber,
          error: `Группа с ID ${groupId} не найдена в этом центре`,
          raw: line,
        });
        return;
      }

      const validRow: CsvRow = {
        rowNumber,
        fullName,
        email: email.toLowerCase(),
        phone,
        groupId,
      };

      parsedRows.push(validRow);
      validRows.push(validRow);
    });

    if (mode === "preview") {
      return NextResponse.json({
        totalParsed: dataLines.length,
        validCount: validRows.length,
        errorCount: errors.length,
        validPreview: validRows.slice(0, 10),
        errors,
      });
    }

    // Execute import
    const canAddAll = await checkSubscriptionLimit(
      tenantCtx.center.id,
      "students",
      validRows.length
    );
    if (!canAddAll) {
      return NextResponse.json(
        {
          error: `Превышен лимит студентов по тарифу подписки. Нельзя импортировать ${validRows.length} студентов.`,
        },
        { status: 400 }
      );
    }

    let createdCount = 0;
    const executionErrors: { row: number; error: string }[] = [...errors];

    for (const row of validRows) {
      try {
        let user = await tenantDb.platformUser.findUnique({
          where: { email: row.email },
        });

        if (!user) {
          const tempPassword = crypto.randomBytes(16).toString("hex");
          const passwordHash = await hashPassword(tempPassword);
          user = await tenantDb.platformUser.create({
            data: {
              email: row.email,
              fullName: row.fullName,
              phone: row.phone || null,
              passwordHash,
              emailVerified: new Date(),
            },
          });
        }

        let membership = await tenantDb.centerMembership.findFirst({
          where: {
            userId: user.id,
            centerId: tenantCtx.center.id,
            role: "STUDENT",
          },
        });

        if (!membership) {
          membership = await tenantDb.centerMembership.create({
            data: {
              userId: user.id,
              centerId: tenantCtx.center.id,
              role: "STUDENT",
              status: "ACTIVE",
            },
          });
        } else if (membership.status === "ARCHIVED") {
          await tenantDb.centerMembership.update({
            where: { id: membership.id },
            data: { status: "ACTIVE" },
          });
        }

        if (row.groupId && membership) {
          await tenantDb.enrollment.upsert({
            where: {
              studentMembershipId_groupId: {
                studentMembershipId: membership.id,
                groupId: row.groupId,
              },
            },
            create: {
              centerId: tenantCtx.center.id,
              studentMembershipId: membership.id,
              groupId: row.groupId,
              status: "ACTIVE",
            },
            update: {
              status: "ACTIVE",
            },
          });
        }

        createdCount++;
      } catch (err: unknown) {
        const error = err as { message?: string };
        executionErrors.push({
          row: row.rowNumber,
          error: error.message || "Ошибка создания записи",
        });
      }
    }

    return NextResponse.json({
      success: true,
      createdCount,
      errors: executionErrors,
    });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error.message || "Ошибка импорта CSV" },
      { status: error.status || 400 }
    );
  }
}
