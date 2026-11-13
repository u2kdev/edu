import { NextResponse } from "next/server";
import { z } from "zod";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requirePlatformPermission, handlePlatformError } from "@/lib/platformAuth";

const defaultCategories = [
  { name: "Хостинг и сервера", code: "HOSTING", description: "Сервера, базы данных, CDN, облачные сервисы" },
  { name: "SMS-шлюзы", code: "SMS", description: "Оплата отправки SMS через шлюзы (Eskiz и др.)" },
  { name: "Домены и SSL", code: "DOMAINS", description: "Регистрация и продление доменных имен, SSL-сертификаты" },
  { name: "Зарплаты команды", code: "SALARIES", description: "Выплаты разработчикам, поддержке и менеджменту" },
  { name: "Маркетинг и реклама", code: "MARKETING", description: "Реклама, продвижение, баннеры, SMM" },
  { name: "Программное обеспечение", code: "SOFTWARE", description: "Подписки на SaaS, API, аналитику, инструменты" },
  { name: "Прочее", code: "OTHER", description: "Прочие операционные расходы платформы" },
];

export async function GET(req: Request) {
  try {
    await requirePlatformPermission("platform.billing.read", req);

    let categories = await db.platformExpenseCategory.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { expenses: true },
        },
      },
    });

    if (categories.length === 0) {
      for (const cat of defaultCategories) {
        await db.platformExpenseCategory.upsert({
          where: { name: cat.name },
          update: {},
          create: cat,
        });
      }
      categories = await db.platformExpenseCategory.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        include: {
          _count: {
            select: { expenses: true },
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      categories,
    });
  } catch (err) {
    return handlePlatformError(err);
  }
}

const createCategorySchema = z.object({
  name: z.string().min(2, "Название категории обязательно"),
  code: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  try {
    await requirePlatformPermission("platform.expenses.manage", req);
    const body = await req.json();
    const validated = createCategorySchema.parse(body);

    const existing = await db.platformExpenseCategory.findUnique({
      where: { name: validated.name },
    });
    if (existing) {
      return NextResponse.json({ success: false, error: "Категория с таким именем уже существует" }, { status: 400 });
    }

    const category = await db.platformExpenseCategory.create({
      data: {
        name: validated.name,
        code: validated.code || null,
        description: validated.description || null,
      },
    });

    return NextResponse.json({
      success: true,
      category,
    });
  } catch (err) {
    return handlePlatformError(err);
  }
}
