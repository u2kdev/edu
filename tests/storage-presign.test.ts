import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  validateFileUpload,
  generatePresignedUploadUrl,
  StorageValidationError,
} from "../src/lib/storage";

describe("Object Storage and Presigned URLs (Block 6.2a)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe("File Upload Validation", () => {
    it("accepts valid documents and images under size limit", () => {
      const validPdf = validateFileUpload({
        fileName: "homework-solution.pdf",
        contentType: "application/pdf",
        sizeBytes: 1024 * 1024 * 2, // 2MB
        category: "HOMEWORK",
      });
      expect(validPdf.valid).toBe(true);
      expect(validPdf.sanitizedFileName).toBe("homework-solution.pdf");

      const validJpg = validateFileUpload({
        fileName: "student-avatar.jpg",
        contentType: "image/jpeg",
        sizeBytes: 500 * 1024, // 500KB
        category: "AVATAR",
      });
      expect(validJpg.valid).toBe(true);
    });

    it("rejects dangerous executable and script files", () => {
      expect(() =>
        validateFileUpload({
          fileName: "malware.exe",
          contentType: "application/x-msdownload",
          sizeBytes: 1024,
          category: "HOMEWORK",
        })
      ).toThrow(StorageValidationError);

      expect(() =>
        validateFileUpload({
          fileName: "trojan.exe",
          contentType: "application/pdf",
          sizeBytes: 1024,
          category: "HOMEWORK",
        })
      ).toThrow(StorageValidationError);

      expect(() =>
        validateFileUpload({
          fileName: "exploit.sh",
          contentType: "application/x-sh",
          sizeBytes: 1024,
          category: "HOMEWORK",
        })
      ).toThrow(StorageValidationError);
    });

    it("rejects files exceeding category size limit", () => {
      // AVATAR limit is 2MB (2 * 1024 * 1024)
      expect(() =>
        validateFileUpload({
          fileName: "huge-avatar.png",
          contentType: "image/png",
          sizeBytes: 5 * 1024 * 1024, // 5MB
          category: "AVATAR",
        })
      ).toThrow(/File size exceeds maximum/);
    });
  });

  describe("Presigned URL Generation", () => {
    it("rejects presigned upload URL generation when FEATURE_UPLOADS is disabled (by default)", async () => {
      delete process.env.FEATURE_UPLOADS;

      await expect(
        generatePresignedUploadUrl({
          centerId: "center-123",
          category: "HOMEWORK",
          fileName: "essay.pdf",
          contentType: "application/pdf",
          sizeBytes: 1024 * 50,
        })
      ).rejects.toThrow(StorageValidationError);
    });

    it("rejects mock signatures even if FEATURE_UPLOADS=true without real S3 AWS presigner credentials", async () => {
      process.env.FEATURE_UPLOADS = "true";
      process.env.STORAGE_PROVIDER = "s3";
      process.env.STORAGE_BUCKET = "e-darschi-uploads";
      process.env.STORAGE_ENDPOINT = "https://s3.eu-central-1.amazonaws.com";

      await expect(
        generatePresignedUploadUrl({
          centerId: "center-123",
          category: "HOMEWORK",
          fileName: "essay.pdf",
          contentType: "application/pdf",
          sizeBytes: 1024 * 50,
        })
      ).rejects.toThrow(/Real S3 uploads require AWS SDK presigner and credentials/i);
    });
  });
});
