import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaMiddlewareAdded?: boolean;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (!globalForPrisma.prismaMiddlewareAdded) {
  db.$use(async (params, next) => {
    if (params.model === "RateLimitRecord" && (params.action === "deleteMany" || params.action === "delete")) {
      const key = params.args?.where?.key;
      const g = globalThis as unknown as {
        __onRateLimitCleared?: () => void;
        __onRateLimitDeleted?: (k: string) => void;
      };
      if (typeof key === "string" && typeof g.__onRateLimitDeleted === "function") {
        g.__onRateLimitDeleted(key);
      } else if (typeof g.__onRateLimitCleared === "function") {
        g.__onRateLimitCleared();
      }
    }

    if (
      params.model === "InviteCode" &&
      (params.action === "findUnique" || params.action === "findFirst")
    ) {
      const code = params.args?.where?.code;
      if (typeof code === "string" && code.startsWith("PARENT-")) {
        const res = await next(params);
        if (res) return res;
        const hash = crypto.createHash("sha256").update(code.toUpperCase().trim()).digest("hex");
        params.args = {
          ...params.args,
          where: {
            ...params.args.where,
            code: hash,
          },
        };
        return next(params);
      }
    }
    return next(params);
  });
  globalForPrisma.prismaMiddlewareAdded = true;
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
