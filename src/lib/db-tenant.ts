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
  "TestQuestion",
  "TestAttempt",
  "AcademicTerm",
  "Holiday",
  "Announcement",
  "Subscription",
  "SupportTicket",
  "AuditLog",
  "ActivityLog",
  "Notification",
];

type DelegateMethods = {
  findFirst: (a: unknown) => Promise<{ id?: string; centerId?: string } | null>;
  findFirstOrThrow: (a: unknown) => Promise<unknown>;
  updateMany: (a: unknown) => Promise<{ count: number }>;
  deleteMany: (a: unknown) => Promise<{ count: number }>;
};

type DynamicDb = PrismaClient & Record<string, DelegateMethods>;

const RELATION_FOREIGN_KEYS: Record<string, string> = {
  groupId: "group",
  courseId: "course",
  moduleId: "courseModule",
  lessonId: "lesson",
  studentMembershipId: "centerMembership",
  teacherMembershipId: "centerMembership",
  creatorMembershipId: "centerMembership",
  branchId: "branch",
  subjectId: "subject",
  homeworkId: "homework",
  homeworkSubmissionId: "homeworkSubmission",
  testId: "test",
};

async function validateForeignRelations(data: Record<string, unknown>, centerId: string) {
  for (const [key, modelProp] of Object.entries(RELATION_FOREIGN_KEYS)) {
    const foreignId = data[key];
    if (typeof foreignId === "string" && foreignId.length > 0) {
      const dynamicDb = db as DynamicDb;
      const delegate = dynamicDb[modelProp];
      if (delegate && typeof delegate.findFirst === "function") {
        const found = await delegate.findFirst({
          where: { id: foreignId, centerId },
        });
        if (!found) {
          throw new Error(
            `Cross-tenant relation violation: ${key} (${foreignId}) does not belong to this center`
          );
        }
      }
    }
  }
}

export function getTenantDb(rawCenterId?: string | null) {
  if (!rawCenterId || typeof rawCenterId !== "string" || rawCenterId.trim() === "") {
    throw new Error("Invalid or empty centerId provided to getTenantDb");
  }
  const centerId = rawCenterId.trim();

  return db.$extends({
    query: {
      $allModels: {
        async $allOperations({
          model,
          operation,
          args,
          query,
        }: {
          model: string;
          operation: string;
          args: Record<string, unknown>;
          query: (args: unknown) => Promise<unknown>;
        }) {
          if (TENANT_MODELS.includes(model)) {
            if (
              [
                "findFirst",
                "findFirstOrThrow",
                "findMany",
                "count",
                "updateMany",
                "updateManyAndReturn",
                "deleteMany",
                "aggregate",
                "groupBy",
              ].includes(operation)
            ) {
              args.where = { ...((args.where as Record<string, unknown> | null | undefined) || {}), centerId };
            }

            if (
              [
                "update",
                "updateMany",
                "updateManyAndReturn",
              ].includes(operation)
            ) {
              if (args.data && typeof args.data === "object") {
                const dataObj = args.data as Record<string, unknown>;
                if ("centerId" in dataObj && dataObj.centerId !== undefined) {
                  if (dataObj.centerId !== centerId) {
                    throw new Error("Changing centerId is not allowed");
                  }
                  delete dataObj.centerId;
                }
                await validateForeignRelations(dataObj, centerId);
              }
            }

            if (operation === "upsert") {
              if (args.update && typeof args.update === "object") {
                const updateObj = args.update as Record<string, unknown>;
                if ("centerId" in updateObj && updateObj.centerId !== undefined) {
                  if (updateObj.centerId !== centerId) {
                    throw new Error("Changing centerId is not allowed");
                  }
                  delete updateObj.centerId;
                }
                await validateForeignRelations(updateObj, centerId);
              }
              if (args.create && typeof args.create === "object") {
                await validateForeignRelations(args.create as Record<string, unknown>, centerId);
              }
              const modelProp = model.charAt(0).toLowerCase() + model.slice(1);
              const dynamicDb = db as DynamicDb;
              const delegate = dynamicDb[modelProp] || dynamicDb[model];
              const target = await delegate.findFirst({ where: args.where });
              if (target && target.centerId !== centerId) {
                throw new Error("Record not found or access denied");
              }
              args.create = { ...((args.create as Record<string, unknown> | null | undefined) || {}), centerId };
            }

            if (
              operation === "findUnique" ||
              operation === "findUniqueOrThrow" ||
              operation === "update" ||
              operation === "delete"
            ) {
              const modelProp = model.charAt(0).toLowerCase() + model.slice(1);
              const dynamicDb = db as DynamicDb;
              const delegate = dynamicDb[modelProp] || dynamicDb[model];

              if (operation === "findUnique" || operation === "findUniqueOrThrow") {
                args.where = { ...((args.where as Record<string, unknown> | null | undefined) || {}), centerId };
                return operation === "findUniqueOrThrow"
                  ? delegate.findFirstOrThrow(args)
                  : delegate.findFirst(args);
              }
              
              if (operation === "update") {
                operation = "updateMany";
                args.where = { ...((args.where as Record<string, unknown> | null | undefined) || {}), centerId };
                const res = await delegate.updateMany(args);
                if (res.count === 0) throw new Error("Record not found or access denied");
                return delegate.findFirst({ where: args.where });
              }

              if (operation === "delete") {
                operation = "deleteMany";
                args.where = { ...((args.where as Record<string, unknown> | null | undefined) || {}), centerId };
                const res = await delegate.deleteMany(args);
                if (res.count === 0) throw new Error("Record not found or access denied");
                return { ...((args.where as Record<string, unknown> | null | undefined) || {}), _deleted: true };
              }
            }

            if (operation === "create") {
              if (args.data && typeof args.data === "object") {
                await validateForeignRelations(args.data as Record<string, unknown>, centerId);
              }
              args.data = { ...((args.data as Record<string, unknown> | null | undefined) || {}), centerId };
            }

            if (operation === "createMany" || operation === "createManyAndReturn") {
              if (Array.isArray(args.data)) {
                for (const item of args.data) {
                  if (item && typeof item === "object") {
                    await validateForeignRelations(item as Record<string, unknown>, centerId);
                  }
                }
                args.data = (args.data as Record<string, unknown>[]).map((d) => ({ ...d, centerId }));
              } else {
                if (args.data && typeof args.data === "object") {
                  await validateForeignRelations(args.data as Record<string, unknown>, centerId);
                }
                args.data = { ...((args.data as Record<string, unknown> | null | undefined) || {}), centerId };
              }
            }
          }
          return query(args);
        },
      },
    },
  });
}
