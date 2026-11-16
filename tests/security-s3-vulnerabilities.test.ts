import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GET as downloadMaterial } from "../src/app/api/materials/[id]/download/route";
import { POST as uploadFile } from "../src/app/api/upload/route";
import { db } from "../src/lib/db";
import { hashPassword, signJWT, hashJti } from "../src/lib/auth";
import { validateFileUpload, deleteStoredFile } from "../src/lib/storage";
import { sanitizeCsvCell, generateCsv } from "../src/lib/csv";
import { renderEmailTemplate } from "../src/lib/email";
import crypto from "crypto";

describe("Stage S3 Vulnerability Reproduction Test Suite (Must Fail on Old Code)", () => {
  let directorId: string = "";
  let directorToken: string = "";
  let centerId: string = "";
  let materialTraversalId: string = "";

  beforeAll(async () => {
    // 1. Create test user & center
    const directorUser = await db.platformUser.create({
      data: {
        email: `s3-director-${Date.now()}@test.com`,
        passwordHash: await hashPassword("StrongDirectorPass123!"),
        fullName: "S3 Director",
        platformRole: "NONE",
        emailVerified: new Date(),
        isActive: true,
      },
    });
    directorId = directorUser.id;

    const center = await db.learningCenter.create({
      data: {
        name: `S3 Storage Center ${Date.now()}`,
        slug: `s3-center-${Date.now()}`,
        ownerId: directorId,
        status: "ACTIVE",
      },
    });
    centerId = center.id;

    const membership = await db.centerMembership.create({
      data: {
        userId: directorId,
        centerId: center.id,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
    });

    const jti = crypto.randomUUID();
    directorToken = signJWT(
      {
        userId: directorId,
        email: directorUser.email,
        platformRole: "NONE",
        activeCenterId: center.id,
        activeCenterRole: "DIRECTOR",
      },
      "1h",
      jti
    );

    await db.userSession.create({
      data: {
        userId: directorId,
        jtiHash: hashJti(jti),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });

    // 2. Create Material pointing to package.json via path traversal
    const mat = await db.material.create({
      data: {
        centerId: center.id,
        title: "Malicious Traversal Material",
        fileUrl: "/uploads/../../package.json",
        isPrivate: false,
      },
    });
    materialTraversalId = mat.id;
  });

  afterAll(async () => {
    if (materialTraversalId) {
      await db.material.deleteMany({ where: { id: materialTraversalId } }).catch(() => {});
    }
    if (centerId) {
      await db.centerMembership.deleteMany({ where: { centerId } }).catch(() => {});
      await db.learningCenter.deleteMany({ where: { id: centerId } }).catch(() => {});
    }
    if (directorId) {
      await db.userSession.deleteMany({ where: { userId: directorId } }).catch(() => {});
      await db.platformUser.deleteMany({ where: { id: directorId } }).catch(() => {});
    }
  });

  // =========================================================================
  // S3.1 Path Traversal in /api/materials/[id]/download
  // =========================================================================
  it("S3.1: /api/materials/[id]/download MUST NOT read or return files outside storage directory", async () => {
    const req = new Request(`http://localhost/api/materials/${materialTraversalId}/download`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${directorToken}`,
        "x-tenant-id": centerId,
      },
    });

    const res = await downloadMaterial(req, { params: { id: materialTraversalId } });

    // On old vulnerable code: res.status is 200, and returns package.json contents!
    // On fixed secure code: traversal is detected and blocked with 400 or 403 or 404
    expect(res.status).not.toBe(200);
  });

  // =========================================================================
  // S3.1 Path Traversal in deleteStoredFile
  // =========================================================================
  it("S3.1: deleteStoredFile MUST safely reject path traversal attempts", async () => {
    // Attempting to delete a file outside storage root
    const deleted = await deleteStoredFile("/uploads/../../package.json");
    expect(deleted).toBe(false);
  });

  // =========================================================================
  // S3.3 SVG / HTML Stored XSS Prevention
  // =========================================================================
  it("S3.3: validateFileUpload MUST reject SVG files to prevent Stored XSS", () => {
    // On old code: CATEGORY_LIMITS.MATERIAL.allowedTypes includes "image/svg+xml"
    // On fixed code: SVG is rejected
    expect(() =>
      validateFileUpload({
        fileName: "malicious.svg",
        contentType: "image/svg+xml",
        sizeBytes: 1024,
        category: "MATERIAL",
      })
    ).toThrow();
  });

  // =========================================================================
  // S3.7 CSV Formula Injection Sanitization
  // =========================================================================
  it("S3.7: sanitizeCsvCell prefixes dangerous formula characters with single quote", () => {
    expect(sanitizeCsvCell("=1+1")).toBe("'=1+1");
    expect(sanitizeCsvCell("  =1+1")).toBe("'  =1+1");
    expect(sanitizeCsvCell("+cmd")).toBe("'+cmd");
    expect(sanitizeCsvCell("-5")).toBe("'-5");
    expect(sanitizeCsvCell("@SUM(A1:A10)")).toBe("'@SUM(A1:A10)");
    expect(sanitizeCsvCell("Normal Text")).toBe("Normal Text");

    const csv = generateCsv(["Header"], [["=1+1"], ["Normal Text"]]);
    expect(csv).toContain("'=1+1");
  });

  // =========================================================================
  // S3.8 HTML Injection in Email Templates
  // =========================================================================
  it("S3.8: renderEmailTemplate escapes HTML in user-provided names", () => {
    const rendered = renderEmailTemplate("EMAIL_CONFIRMATION", {
      fullName: "<script>alert('xss')</script>",
      url: "http://localhost:3000/confirm",
      lang: "ru",
    });

    // On old code: html contains raw "<script>alert('xss')</script>"
    // On fixed code: script tag MUST be escaped as &lt;script&gt;
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).toContain("&lt;script&gt;");
  });
});
