import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { POST as confirmPost } from "../src/app/api/auth/confirm-email/route";
import { db } from "../src/lib/db";
import crypto from "crypto";

describe("Email Confirmation API", () => {
  let validToken: string;
  let expiredToken: string;
  let testUserId: string;

  beforeAll(async () => {
    validToken = crypto.randomBytes(32).toString("hex");
    const validHash = crypto.createHash("sha256").update(validToken).digest("hex");
    
    expiredToken = crypto.randomBytes(32).toString("hex");
    const expiredHash = crypto.createHash("sha256").update(expiredToken).digest("hex");

    const user = await db.platformUser.create({
      data: {
        email: `confirm-${Date.now()}@test.com`,
        passwordHash: "x",
        fullName: "Confirm Tester",
        emailConfirmToken: validHash,
        emailConfirmExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }
    });
    testUserId = user.id;

    await db.platformUser.create({
      data: {
        email: `expired-${Date.now()}@test.com`,
        passwordHash: "x",
        fullName: "Expired Tester",
        emailConfirmToken: expiredHash,
        emailConfirmExpires: new Date(Date.now() - 10000),
      }
    });
  });

  afterAll(async () => {
    await db.platformUser.deleteMany({ where: { email: { startsWith: "confirm-" } } });
    await db.platformUser.deleteMany({ where: { email: { startsWith: "expired-" } } });
  });

  const mockReq = (body: any) =>
    new Request(`http://localhost/api/auth/confirm-email`, {
      method: "POST",
      headers: { "x-forwarded-for": "1.1.1.1" },
      body: JSON.stringify(body),
    });

  it("Valid token confirms email and resets token fields", async () => {
    const res = await confirmPost(mockReq({ token: validToken }));
    const data = await res.json();
    
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);

    const check = await db.platformUser.findUnique({ where: { id: testUserId } });
    expect(check?.emailVerified).not.toBeNull();
    expect(check?.emailConfirmToken).toBeNull();
  });

  it("One-time use: Reusing token gives error", async () => {
    const res = await confirmPost(mockReq({ token: validToken }));
    const data = await res.json();
    
    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid or expired token");
  });

  it("Expired token gives error", async () => {
    const res = await confirmPost(mockReq({ token: expiredToken }));
    const data = await res.json();
    
    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid or expired token");
  });
});
