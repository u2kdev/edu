import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";

describe("TRUST-3b Item 4: Audit Cascade Foreign Keys to CenterMembership", () => {
  const models = Prisma.dmmf.datamodel.models;

  it("all teacher and staff relations to CenterMembership are strictly Restrict or SetNull, never Cascade", () => {
    const teacherFieldRelations: { model: string; field: string; onDelete?: string }[] = [];

    for (const model of models) {
      for (const field of model.fields) {
        if (field.kind === "object" && field.type === "CenterMembership" && field.relationFromFields?.length) {
          const fromFieldName = field.relationFromFields[0];
          // Check if this is a teacher, creator, author, marker, or grader relation
          const isTeacherOrStaff =
            /teacher|author|creator|marker|grader|finalizer|assistant/i.test(field.name) ||
            /teacher|author|creator|marker|grader|finalizer|assistant/i.test(fromFieldName);

          if (isTeacherOrStaff) {
            teacherFieldRelations.push({
              model: model.name,
              field: field.name,
              onDelete: field.relationOnDelete,
            });
          }
        }
      }
    }

    // Must have found all key teacher/staff relations
    expect(teacherFieldRelations.length).toBeGreaterThanOrEqual(10);

    // Every single teacher/staff relation must be Restrict or SetNull
    for (const rel of teacherFieldRelations) {
      expect(
        ["Restrict", "SetNull"].includes(rel.onDelete || ""),
        `Expected ${rel.model}.${rel.field} to be Restrict or SetNull, but got ${rel.onDelete}`
      ).toBe(true);
    }
  });

  it("all remaining Cascade relations to CenterMembership are documented and restricted to student or join entities", () => {
    const cascadeRelations: { model: string; field: string }[] = [];

    for (const model of models) {
      for (const field of model.fields) {
        if (field.kind === "object" && field.type === "CenterMembership" && field.relationFromFields?.length) {
          if (field.relationOnDelete === "Cascade") {
            cascadeRelations.push({ model: model.name, field: field.name });
          }
        }
      }
    }

    const allowedCascadeModels = [
      "ParentLink",
      "Enrollment",
      "HomeworkSubmission",
      "TestAttempt",
      "PerformanceSnapshot",
      "ActivityLog",
    ];

    for (const rel of cascadeRelations) {
      expect(
        allowedCascadeModels.includes(rel.model),
        `Unexpected Cascade relation found on model ${rel.model}.${rel.field}`
      ).toBe(true);
    }
  });

  it("CenterPayment, Grade, and Attendance student relations are strictly Restrict", () => {
    const studentRestrictModels = ["CenterPayment", "Grade", "Attendance"];
    for (const modelName of studentRestrictModels) {
      const model = models.find((m) => m.name === modelName);
      const studentField = model?.fields.find((f) => f.name === "student");
      expect(studentField?.relationOnDelete).toBe("Restrict");
    }
  });
});
