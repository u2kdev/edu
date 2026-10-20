import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST as registerPost } from "../src/app/api/auth/register/route";
import { db } from "../src/lib/db";
import { processEmailOutbox } from "../src/lib/email";

function mockReq(body: Record<string, unknown>, ip = "127.0.0.1") {
  return new Request("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

describe("Email Outbox and Synchronous Resend Fallback (Item 7)", () => {
  let centerId: string;
  let inviteCode: string;

  beforeEach(async () => {
    // Setup center and invite code
    const owner = await db.platformUser.create({
      data: {
        email: `owner-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`,
        passwordHash: "hash",
        fullName: "Owner",
      },
    });

    const center = await db.learningCenter.create({
      data: {
        name: `Center-Email-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        slug: `email-slug-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        ownerId: owner.id,
        status: "ACTIVE",
      },
    });
    centerId = center.id;

    const ownerMembership = await db.centerMembership.create({
      data: {
        userId: owner.id,
        centerId,
        role: "DIRECTOR",
      },
    });

    const invite = await db.inviteCode.create({
      data: {
        centerId,
        code: `OUTBOX-${Date.now()}-${Math.random().toString(36).substring(7)}`.toUpperCase(),
        targetRole: "STUDENT",
        maxUses: 10,
        createdByMembershipId: ownerMembership.id,
      },
    });
    inviteCode = invite.code;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Client response does not change when email driver fails, and email is recorded in EmailOutbox queue", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_mock_test_key";

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: "Resend API 500: Internal server error" }),
      text: async () => "Resend API 500: Internal server error",
    });
    vi.stubGlobal("fetch", mockFetch);

    const testEmail = `failing-driver-${Date.now()}@test.com`;
    const res = await registerPost(
      mockReq(
        {
          email: testEmail,
          password: "password123",
          fullName: "Failing Driver User",
          inviteCode,
        },
        "10.0.0.1"
      )
    );

    const data = await res.json();
    if (res.status !== 200) {
      console.log("REGISTER_ERROR_DETAILS:", JSON.stringify(data));
    }

    // 1. Response status and message must NOT change despite email driver failure
    expect(res.status).toBe(200);
    expect(data.message).toBe(
      "Registration successful. Please check your email to confirm."
    );

    // 2. Email must be recorded in EmailOutbox table
    const outboxRecord = await db.emailOutbox.findFirst({
      where: { to: testEmail },
      orderBy: { createdAt: "desc" },
    });

    expect(outboxRecord).not.toBeNull();
    expect(outboxRecord!.to).toBe(testEmail);
    expect(outboxRecord!.status).toBe("PENDING");
    expect(outboxRecord!.attempts).toBeGreaterThanOrEqual(1);
    expect(outboxRecord!.lastError).toContain("Resend");
  });

  it("Scheduled retry processes queued outbox emails and marks them SENT on driver recovery", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_mock_test_key";

    const targetEmail = `retry-success-${Date.now()}@test.com`;

    // Manually enqueue a failed email into EmailOutbox
    const queued = await db.emailOutbox.create({
      data: {
        to: targetEmail,
        subject: "Verify Account",
        body: "Please confirm your registration link: /auth/confirm",
        status: "PENDING",
        attempts: 1,
        lastError: "Previous network timeout",
        nextRetryAt: new Date(Date.now() - 5000), // due for retry
      },
    });

    // Mock fetch to succeed on retry
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "resend_msg_recovery_123" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await processEmailOutbox({ batchSize: 10 });
    expect(result.processed).toBeGreaterThanOrEqual(1);
    expect(result.succeeded).toBeGreaterThanOrEqual(1);

    const updated = await db.emailOutbox.findUnique({
      where: { id: queued.id },
    });
    expect(updated!.status).toBe("SENT");
    expect(updated!.sentAt).not.toBeNull();
  });

  it("Scheduled retry increments attempts and sets nextRetryAt when driver continues to fail", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_mock_test_key";

    const targetEmail = `retry-fail-${Date.now()}@test.com`;

    const queued = await db.emailOutbox.create({
      data: {
        to: targetEmail,
        subject: "Verify Account",
        body: "Please confirm your registration",
        status: "PENDING",
        attempts: 1,
        maxAttempts: 3,
        lastError: "Initial error",
        nextRetryAt: new Date(Date.now() - 5000),
      },
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ message: "Resend still down" }),
      text: async () => "Resend still down",
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await processEmailOutbox({ batchSize: 10 });
    expect(result.processed).toBeGreaterThanOrEqual(1);
    expect(result.failed).toBeGreaterThanOrEqual(1);

    const updated = await db.emailOutbox.findUnique({
      where: { id: queued.id },
    });
    expect(updated!.status).toBe("PENDING");
    expect(updated!.attempts).toBe(2);
    expect(updated!.lastError).toContain("Resend");
    expect(new Date(updated!.nextRetryAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("Marks email as FAILED when maxAttempts is exceeded", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_mock_test_key";

    const targetEmail = `max-attempts-${Date.now()}@test.com`;

    const queued = await db.emailOutbox.create({
      data: {
        to: targetEmail,
        subject: "Verify Account",
        body: "Please confirm your registration",
        status: "PENDING",
        attempts: 2,
        maxAttempts: 3,
        lastError: "Attempt 2 failed",
        nextRetryAt: new Date(Date.now() - 5000),
      },
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: "Resend permanent error" }),
      text: async () => "Resend permanent error",
    });
    vi.stubGlobal("fetch", mockFetch);

    await processEmailOutbox({ batchSize: 10 });

    const updated = await db.emailOutbox.findUnique({
      where: { id: queued.id },
    });
    expect(updated!.status).toBe("FAILED");
    expect(updated!.attempts).toBe(3);
  });
});
