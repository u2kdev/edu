import { NextResponse } from "next/server";
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { z } from "zod";
import crypto from "crypto";

const getQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(10),
  q: z.string().optional(),
  status: z.string().optional(),
  sortBy: z.enum(["createdAt", "name"]).default("createdAt"),
});

export async function GET(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || !hasPermission("platform.centers.read", session.user.platformRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const parsedParams = getQuerySchema.safeParse(Object.fromEntries(searchParams));

    if (!parsedParams.success) {
      return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
    }

    const { page, pageSize, q, status, sortBy } = parsedParams.data;

    const where: any = {};
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { slug: { contains: q } },
        { owner: { email: { contains: q } } },
      ];
    }
    if (status) {
      where.status = status;
    }

    const [items, total] = await Promise.all([
      db.learningCenter.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortBy]: "desc" },
        include: {
          owner: { select: { id: true, email: true, fullName: true } }
        }
      }),
      db.learningCenter.count({ where }),
    ]);

    return NextResponse.json({ items, total });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 });
  }
}

const postBodySchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  contacts: z.object({
    phone: z.string().optional(),
    email: z.string().email().optional(),
  }).optional(),
  timeZone: z.string().default("Asia/Tashkent"),
  status: z.string().default("TRIAL"),
  trialEndsAt: z.string().optional(),
  directorEmail: z.string().email(),
  directorFullName: z.string().min(2),
});

const RESERVED_SLUGS = ["admin", "api", "platform", "login", "auth", "system"];

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || !hasPermission("platform.centers.write", session.user.platformRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ip = getClientIp(req);
    if (!checkRateLimit(ip, 5, 60000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const parsedBody = postBodySchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.issues }, { status: 400 });
    }

    const data = parsedBody.data;

    if (RESERVED_SLUGS.includes(data.slug.toLowerCase())) {
      return NextResponse.json({ error: "Reserved slug" }, { status: 400 });
    }

    const existingSlug = await db.learningCenter.findUnique({
      where: { slug: data.slug.toLowerCase() },
    });

    if (existingSlug) {
      return NextResponse.json({ error: "Slug already in use" }, { status: 400 });
    }

    const result = await db.$transaction(async (tx) => {
      let user = await tx.platformUser.findUnique({
        where: { email: data.directorEmail.toLowerCase().trim() },
      });

      if (!user) {
        const randomPassword = crypto.randomBytes(16).toString("hex");
        user = await tx.platformUser.create({
          data: {
            email: data.directorEmail.toLowerCase().trim(),
            fullName: data.directorFullName,
            passwordHash: randomPassword,
            emailVerified: new Date(),
          },
        });
      }

      const center = await tx.learningCenter.create({
        data: {
          name: data.name,
          slug: data.slug.toLowerCase(),
          email: data.contacts?.email,
          phone: data.contacts?.phone,
          timeZone: data.timeZone,
          status: data.status,
          ownerId: user.id,
        },
      });

      let plan = null;
      if ((body as any).planId) {
        plan = await tx.subscriptionPlan.findUnique({ where: { id: (body as any).planId } });
      } else {
        plan = await tx.subscriptionPlan.findFirst({ where: { isActive: true } });
      }

      if (plan) {
        await tx.subscription.create({
          data: {
            centerId: center.id,
            planId: plan.id,
            status: "TRIAL",
            trialEndsAt: data.trialEndsAt ? new Date(data.trialEndsAt) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            currentPeriodStartsAt: new Date(),
            currentPeriodEndsAt: data.trialEndsAt ? new Date(data.trialEndsAt) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          }
        });
      }

      const membership = await tx.centerMembership.create({
        data: {
          userId: user.id,
          centerId: center.id,
          role: "DIRECTOR",
        },
      });

      const resetToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");
      
      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashedToken,
          expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours
        },
      });

      // Mock sending email
      console.log(`Sending email to ${user.email} with reset token`);

      await tx.auditLog.create({
        data: {
          centerId: center.id,
          actorUserId: session.user.id,
          action: "PLATFORM_CREATE_LEARNING_CENTER",
          resource: "LearningCenter",
          detailsJson: JSON.stringify({ slug: center.slug }),
        },
      });

      return { center, user, membership };
    });

    return NextResponse.json({ 
      success: true, 
      center: result.center, 
      director: { id: result.user.id, email: result.user.email, fullName: result.user.fullName },
      membership: result.membership 
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
