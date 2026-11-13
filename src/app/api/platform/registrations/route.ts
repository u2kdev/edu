import { NextResponse } from "next/server";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requirePlatformPermission, handlePlatformError } from "@/lib/platformAuth";
import type { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  try {
    await requirePlatformPermission("platform.users.read", req);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const type = searchParams.get("type")?.trim() || "ALL"; // ALL, USERS, CENTERS
    const emailVerified = searchParams.get("emailVerified")?.trim() || "ALL"; // ALL, VERIFIED, UNVERIFIED
    const dateFrom = searchParams.get("dateFrom")?.trim() || "";
    const dateTo = searchParams.get("dateTo")?.trim() || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      dateFilter.lte = to;
    }

    interface RegistrationItem {
      id: string;
      kind: "USER" | "CENTER";
      name: string;
      email: string | null;
      phone: string | null;
      role?: string;
      centerName?: string;
      centerSlug?: string;
      emailVerified: boolean;
      createdAt: string;
    }

    let items: RegistrationItem[] = [];
    let totalCount = 0;

    if (type === "CENTERS" || type === "CENTER") {
      const where: Prisma.LearningCenterWhereInput = {};
      if (dateFrom || dateTo) where.createdAt = dateFilter;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { slug: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ];
      }

      const [centers, count] = await Promise.all([
        db.learningCenter.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          include: {
            owner: { select: { fullName: true, email: true, phone: true, emailVerified: true } },
          },
        }),
        db.learningCenter.count({ where }),
      ]);

      totalCount = count;
      items = centers.map((c) => ({
        id: c.id,
        kind: "CENTER",
        name: c.name,
        email: c.email || c.owner.email,
        phone: c.phone || c.owner.phone,
        centerName: c.name,
        centerSlug: c.slug,
        emailVerified: !!c.owner.emailVerified,
        createdAt: c.createdAt.toISOString(),
      }));
    } else if (type === "USERS" || type === "USER") {
      const where: Prisma.PlatformUserWhereInput = { deletedAt: null };
      if (dateFrom || dateTo) where.createdAt = dateFilter;
      if (emailVerified === "VERIFIED") where.emailVerified = { not: null };
      if (emailVerified === "UNVERIFIED") where.emailVerified = null;
      if (search) {
        where.OR = [
          { fullName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ];
      }

      const [users, count] = await Promise.all([
        db.platformUser.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          include: {
            memberships: {
              where: { status: "ACTIVE" },
              include: { center: { select: { name: true, slug: true } } },
              take: 1,
            },
          },
        }),
        db.platformUser.count({ where }),
      ]);

      totalCount = count;
      items = users.map((u) => {
        const mem = u.memberships[0];
        return {
          id: u.id,
          kind: "USER",
          name: u.fullName,
          email: u.email,
          phone: u.phone,
          role: u.platformRole !== "NONE" ? u.platformRole : mem?.role || "USER",
          centerName: mem?.center.name,
          centerSlug: mem?.center.slug,
          emailVerified: !!u.emailVerified,
          createdAt: u.createdAt.toISOString(),
        };
      });
    } else {
      // ALL: combined query
      const userWhere: Prisma.PlatformUserWhereInput = { deletedAt: null };
      const centerWhere: Prisma.LearningCenterWhereInput = {};
      if (dateFrom || dateTo) {
        userWhere.createdAt = dateFilter;
        centerWhere.createdAt = dateFilter;
      }
      if (emailVerified === "VERIFIED") userWhere.emailVerified = { not: null };
      if (emailVerified === "UNVERIFIED") userWhere.emailVerified = null;
      if (search) {
        userWhere.OR = [
          { fullName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ];
        centerWhere.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { slug: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ];
      }

      const [users, centers, usersCount, centersCount] = await Promise.all([
        db.platformUser.findMany({
          where: userWhere,
          orderBy: { createdAt: "desc" },
          take: limit,
          include: {
            memberships: {
              where: { status: "ACTIVE" },
              include: { center: { select: { name: true, slug: true } } },
              take: 1,
            },
          },
        }),
        db.learningCenter.findMany({
          where: centerWhere,
          orderBy: { createdAt: "desc" },
          take: limit,
          include: {
            owner: { select: { fullName: true, email: true, phone: true, emailVerified: true } },
          },
        }),
        db.platformUser.count({ where: userWhere }),
        db.learningCenter.count({ where: centerWhere }),
      ]);

      const userItems: RegistrationItem[] = users.map((u) => {
        const mem = u.memberships[0];
        return {
          id: u.id,
          kind: "USER",
          name: u.fullName,
          email: u.email,
          phone: u.phone,
          role: u.platformRole !== "NONE" ? u.platformRole : mem?.role || "USER",
          centerName: mem?.center.name,
          centerSlug: mem?.center.slug,
          emailVerified: !!u.emailVerified,
          createdAt: u.createdAt.toISOString(),
        };
      });

      const centerItems: RegistrationItem[] = centers.map((c) => ({
        id: c.id,
        kind: "CENTER",
        name: c.name,
        email: c.email || c.owner.email,
        phone: c.phone || c.owner.phone,
        centerName: c.name,
        centerSlug: c.slug,
        emailVerified: !!c.owner.emailVerified,
        createdAt: c.createdAt.toISOString(),
      }));

      const combined = [...userItems, ...centerItems].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      items = combined.slice(0, limit);
      totalCount = usersCount + centersCount;
    }

    return NextResponse.json({
      success: true,
      registrations: items,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (err) {
    return handlePlatformError(err);
  }
}
