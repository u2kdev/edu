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
});
