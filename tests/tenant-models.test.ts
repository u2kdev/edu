import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { TENANT_MODELS } from "../src/lib/db-tenant";

describe("TRUST-2 Item 2: Prisma DMMF TENANT_MODELS completeness", () => {
  it("every model with a centerId field must be included in TENANT_MODELS", () => {
    const modelsWithCenterId = Prisma.dmmf.datamodel.models
      .filter((model) => model.fields.some((field) => field.name === "centerId"))
      .map((model) => model.name);

    const missingModels = modelsWithCenterId.filter(
      (modelName) => !TENANT_MODELS.includes(modelName)
    );

    expect(
      missingModels,
      `Models with centerId missing from TENANT_MODELS: ${missingModels.join(", ")}`
    ).toEqual([]);
  });

  it("every model in TENANT_MODELS must have a centerId field in Prisma DMMF (bi-directional check)", () => {
    const modelsWithCenterId = Prisma.dmmf.datamodel.models
      .filter((model) => model.fields.some((field) => field.name === "centerId"))
      .map((model) => model.name);

    const excessModels = TENANT_MODELS.filter(
      (modelName) => !modelsWithCenterId.includes(modelName)
    );

    expect(
      excessModels,
      `Models in TENANT_MODELS that lack centerId in schema: ${excessModels.join(", ")}`
    ).toEqual([]);
  });

  it("identifies nullable centerId models and verifies their scoping rationale", () => {
    const nullableCenterIdModels = Prisma.dmmf.datamodel.models
      .filter((model) => {
        const centerIdField = model.fields.find((f) => f.name === "centerId");
        return centerIdField && !centerIdField.isRequired;
      })
      .map((m) => m.name);

    // Notification (global vs tenant), SupportTicket (platform vs tenant), AuditLog (platform vs tenant)
    expect(nullableCenterIdModels.sort()).toEqual(["AuditLog", "Notification", "SupportTicket"].sort());
  });
});
