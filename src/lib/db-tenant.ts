import { PrismaClient } from "@prisma/client";
import { db } from "./db";

export const TENANT_MODELS = [
  "Course",
  "CourseModule",
  "Lesson",
  "ScheduleSlot",
  "Group",
  "Enrollment",
  "Homework",
  "HomeworkSubmission",
  "Grade",
  "CenterPayment",
  "CenterMembership",
  "Branch",
  "Subject",
  "InviteCode",
  "Material",
  "Test",
  "TestAttempt",
  "AcademicTerm",
  "Holiday",
  "Announcement",
];

export function getTenantDb(centerId: string) {
  return db.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: any) {
          if (TENANT_MODELS.includes(model)) {
            if (
              [
                "findFirst",
                "findMany",
                "count",
                "updateMany",
                "deleteMany",
                "aggregate",
                "groupBy",
              ].includes(operation)
            ) {
              args.where = { ...args.where, centerId };
            }

            if (operation === "upsert") {
              const delegate = (db as unknown as Record<string, {
                findFirst: (a: unknown) => Promise<{ centerId?: string } | null>;
              }>)[model];
              const target = await delegate.findFirst({ where: args.where });
              if (target && target.centerId !== centerId) {
                throw new Error("Record not found or access denied");
              }
              args.create = { ...args.create, centerId };
            }

            if (operation === "findUnique" || operation === "update" || operation === "delete") {
              // Prisma requires findUnique/update/delete to only use unique fields.
              // To safely scope them, we intercept and convert to findFirst/updateMany/deleteMany, 
              // or just rely on the fact that if we know the unique ID, it's globally unique.
              // BUT to prevent IDOR, we MUST verify centerId.
              // We'll add centerId to where. If Prisma complains about invalid fields for findUnique,
              // we can rewrite findUnique to findFirst.
              
              const delegate = (db as unknown as Record<string, {
                findFirst: (a: unknown) => Promise<unknown>;
                updateMany: (a: unknown) => Promise<{ count: number }>;
                deleteMany: (a: unknown) => Promise<{ count: number }>;
              }>)[model];

              if (operation === "findUnique") {
                operation = "findFirst";
                args.where = { ...args.where, centerId };
                return delegate.findFirst(args);
              }
              
              if (operation === "update") {
                operation = "updateMany";
                args.where = { ...args.where, centerId };
                const res = await delegate.updateMany(args);
                if (res.count === 0) throw new Error("Record not found or access denied");
                return delegate.findFirst({ where: args.where });
              }

              if (operation === "delete") {
                operation = "deleteMany";
                args.where = { ...args.where, centerId };
                const res = await delegate.deleteMany(args);
                if (res.count === 0) throw new Error("Record not found or access denied");
                return { ...args.where, _deleted: true };
              }
            }

            if (operation === "create") {
              args.data = { ...args.data, centerId };
            }

            if (operation === "createMany") {
              if (Array.isArray(args.data)) {
                args.data = args.data.map((d: any) => ({ ...d, centerId }));
              } else {
                args.data = { ...args.data, centerId };
              }
            }
          }
          return query(args);
        },
      },
    },
  });
}
