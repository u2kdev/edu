import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST as presignRoute } from "../src/app/api/upload/presign/route";
import { generatePresignedUploadUrl, StorageValidationError, isUploadsEnabled } from "../src/lib/storage";
import { signJWT } from "../src/lib/auth";

let mockToken: string = "";

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => {
      if (name === "auth_token") return { value: mockToken };
      return undefined;
    },
    set: vi.fn(),
  }),
}));

const mockRequest = (body?: unknown) =>
  new Request("http://localhost/api/upload/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

describe("Storage Feature Flag (FEATURE_UPLOADS=false by default)", () => {
  const originalFeatureUploads = process.env.FEATURE_UPLOADS;

  beforeEach(() => {
    delete process.env.FEATURE_UPLOADS;
    delete process.env.NEXT_PUBLIC_FEATURE_UPLOADS;
  });

  afterEach(() => {
    if (originalFeatureUploads !== undefined) {
      process.env.FEATURE_UPLOADS = originalFeatureUploads;
    } else {
      delete process.env.FEATURE_UPLOADS;
    }
  });

  it("1. isUploadsEnabled returns false by default when env is unset or false", () => {
    delete process.env.FEATURE_UPLOADS;
    expect(isUploadsEnabled()).toBe(false);

    process.env.FEATURE_UPLOADS = "false";
    expect(isUploadsEnabled()).toBe(false);
  });

  it("2. POST /api/upload/presign returns 403 or 404 when FEATURE_UPLOADS is false", async () => {
    process.env.FEATURE_UPLOADS = "false";
    mockToken = signJWT({
      userId: "u-test-1",
      email: "test@test.com",
      platformRole: "SUPERADMIN",
    });

    const res = await presignRoute(
      mockRequest({
        fileName: "doc.pdf",
        contentType: "application/pdf",
        sizeBytes: 1024,
        category: "HOMEWORK",
      })
    );

    expect([403, 404]).toContain(res.status);
    const body = await res.json();
    expect(body.error).toMatch(/disabled/i);
  });

  it("3. generatePresignedUploadUrl throws error when FEATURE_UPLOADS is false and never contains mock-presigned-sig", async () => {
    process.env.FEATURE_UPLOADS = "false";
    await expect(
      generatePresignedUploadUrl({
        centerId: "center-1",
        category: "HOMEWORK",
        fileName: "doc.pdf",
        contentType: "application/pdf",
        sizeBytes: 1024,
      })
    ).rejects.toThrow(StorageValidationError);
  });
});
