import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db } from "@/lib/db";
import { GET as getTicketsRoute, POST as postTicketRoute } from "@/app/api/tickets/route";
import { GET as getTicketIdRoute, PATCH as patchTicketIdRoute } from "@/app/api/tickets/[id]/route";
import { POST as postTicketMessageRoute } from "@/app/api/tickets/[id]/messages/route";
import { POST as postPlatformSupportRoute, GET as getPlatformSupportRoute } from "@/app/api/platform/support/route";
import { PATCH as patchPlatformSupportIdRoute } from "@/app/api/platform/support/[id]/route";
import {
  createTestUser,
  createTestCenter,
  createTestMembership,
  createTestSessionToken,
  cleanupTestEntities,
} from "../helpers/auth-fixtures";
import { invokeRoute } from "../helpers/e2e-client";

let activeToken: string | undefined = undefined;
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => {
      if (name === "auth_token") return activeToken ? { value: activeToken } : undefined;
      return undefined;
    },
  }),
}));

describe("Tier 1 Feature Coverage: R5 Support Ticket Isolation & Access Control", () => {
  const cleanups: {
    userIds: string[];
    centerIds: string[];
    ticketIds: string[];
  } = {
    userIds: [],
    centerIds: [],
    ticketIds: [],
  };

  const dispatch = async <T = unknown>(
    handler: unknown,
    url: string,
    options: {
      method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
      token?: string;
      body?: unknown;
    } = {},
    routeContext?: unknown
  ) => {
    activeToken = options.token;
    return invokeRoute<T>(handler, url, options, routeContext);
  };

  afterEach(async () => {
    activeToken = undefined;
    await cleanupTestEntities(cleanups);
    cleanups.userIds = [];
    cleanups.centerIds = [];
    cleanups.ticketIds = [];
  });

  /**
   * E2E-R5-01: Support ticket centerId Strict Derivation from Session
   */
  it("E2E-R5-01: Rejects or ignores foreign centerId in POST /api/platform/support", async () => {
    const owner1 = await createTestUser();
    const owner2 = await createTestUser();
    cleanups.userIds.push(owner1.id, owner2.id);

    const center1 = await createTestCenter({ ownerId: owner1.id });
    const center2 = await createTestCenter({ ownerId: owner2.id });
    cleanups.centerIds.push(center1.id, center2.id);

    const user1 = await createTestUser();
    cleanups.userIds.push(user1.id);
    await createTestMembership(user1.id, center1.id, "STUDENT");

    const token1 = await createTestSessionToken(user1, {
      activeCenterId: center1.id,
      activeCenterRole: "STUDENT",
    });

    // Caller from Center 1 attempts to create ticket bound to Center 2
    const res = await dispatch<{ success?: boolean; ticket?: { id: string; centerId: string } }>(
      postPlatformSupportRoute,
      "/api/platform/support",
      {
        method: "POST",
        token: token1,
        body: {
          subject: "Platform query",
          message: "Need help with billing invoice",
          priority: "MEDIUM",
          centerId: center2.id,
        },
      }
    );

    if (res.status === 201 && res.data.ticket) {
      cleanups.ticketIds.push(res.data.ticket.id);
      // If allowed to proceed, centerId MUST be forced to user's activeCenterId (Center 1)
      expect(res.data.ticket.centerId).toBe(center1.id);
      expect(res.data.ticket.centerId).not.toBe(center2.id);
    } else {
      // Otherwise strictly rejected with 400 Bad Request
      expect(res.status).toBe(400);
    }
  });

  /**
   * E2E-R5-02: Hidden Fields Stripping / Rejection (isInternal and assignedToId)
   */
  it("E2E-R5-02: Non-platform users cannot submit isInternal: true or assignedToId", async () => {
    const owner = await createTestUser();
    cleanups.userIds.push(owner.id);

    const center = await createTestCenter({ ownerId: owner.id });
    cleanups.centerIds.push(center.id);

    const student = await createTestUser();
    cleanups.userIds.push(student.id);
    await createTestMembership(student.id, center.id, "STUDENT");

    const studentToken = await createTestSessionToken(student, {
      activeCenterId: center.id,
      activeCenterRole: "STUDENT",
    });

    const staffUser = await createTestUser({ platformRole: "PLATFORM_SUPPORT" });
    cleanups.userIds.push(staffUser.id);

    // 1. Create ticket attempting to inject assignedToId or isInternal
    const resTicket = await dispatch<{ ticket?: { id: string } }>(
      postTicketRoute,
      "/api/tickets",
      {
        method: "POST",
        token: studentToken,
        body: {
          subject: "Glitch inquiry",
          message: "Please investigate",
          isInternal: true,
          assignedToId: staffUser.id,
        },
      }
    );

    if ((resTicket.status === 200 || resTicket.status === 201) && resTicket.data.ticket?.id) {
      const ticketId = resTicket.data.ticket.id;
      cleanups.ticketIds.push(ticketId);

      const ticketInDb = await db.supportTicket.findUnique({
        where: { id: ticketId },
      });
      // assignedToId must remain null
      expect(ticketInDb?.assignedToId).toBeNull();

      // 2. Reply message attempting isInternal: true
      const resMsg = await dispatch(
        postTicketMessageRoute,
        `/api/tickets/${ticketId}/messages`,
        {
          method: "POST",
          token: studentToken,
          body: {
            message: "Student reply attempting internal flag",
            isInternal: true,
          },
        },
        { params: { id: ticketId } }
      );

      const messages = await db.ticketMessage.findMany({
        where: { ticketId },
      });
      for (const msg of messages) {
        if (msg.senderUserId === student.id) {
          expect(msg.isInternal).toBe(false);
        }
      }
    } else {
      expect(resTicket.status).toBe(400);
    }
  });

  /**
   * E2E-R5-03: Filtering of isInternal Support Notes for Non-Platform Staff
   */
  it("E2E-R5-03: Ticket messages with isInternal: true are stripped from non-platform responses", async () => {
    const owner = await createTestUser();
    cleanups.userIds.push(owner.id);

    const center = await createTestCenter({ ownerId: owner.id });
    cleanups.centerIds.push(center.id);

    const student = await createTestUser();
    cleanups.userIds.push(student.id);
    await createTestMembership(student.id, center.id, "STUDENT");

    const studentToken = await createTestSessionToken(student, {
      activeCenterId: center.id,
      activeCenterRole: "STUDENT",
    });

    const supportUser = await createTestUser({ platformRole: "PLATFORM_SUPPORT" });
    cleanups.userIds.push(supportUser.id);
    const supportToken = await createTestSessionToken(supportUser);

    // Create ticket in DB
    const ticket = await db.supportTicket.create({
      data: {
        centerId: center.id,
        creatorUserId: student.id,
        subject: "Need course assistance",
        status: "OPEN",
        messages: {
          create: [
            {
              senderUserId: student.id,
              message: "Public initial student question",
              isInternal: false,
            },
            {
              senderUserId: supportUser.id,
              message: "CONFIDENTIAL INTERNAL NOTE: User payment failed twice",
              isInternal: true,
            },
            {
              senderUserId: supportUser.id,
              message: "Public response from support staff",
              isInternal: false,
            },
          ],
        },
      },
    });
    cleanups.ticketIds.push(ticket.id);

    // Student queries ticket
    const studentRes = await dispatch<{
      data?: { ticket?: { messages: Array<{ message: string; isInternal?: boolean }> } };
      ticket?: { messages: Array<{ message: string; isInternal?: boolean }> };
    }>(
      getTicketIdRoute,
      `/api/tickets/${ticket.id}`,
      {
        method: "GET",
        token: studentToken,
      },
      { params: { id: ticket.id } }
    );

    expect(studentRes.status).toBe(200);
    const studentTicket = studentRes.data.data?.ticket || studentRes.data.ticket;
    expect(studentTicket).toBeDefined();

    // Verify confidential note is NOT visible to student
    const messages = studentTicket?.messages || [];
    for (const msg of messages) {
      expect(msg.isInternal).not.toBe(true);
      expect(msg.message).not.toContain("CONFIDENTIAL INTERNAL NOTE");
    }

    // Support staff queries ticket
    const staffRes = await dispatch<{
      data?: { ticket?: { messages: Array<{ message: string; isInternal?: boolean }> } };
      ticket?: { messages: Array<{ message: string; isInternal?: boolean }> };
    }>(
      getTicketIdRoute,
      `/api/tickets/${ticket.id}`,
      {
        method: "GET",
        token: supportToken,
      },
      { params: { id: ticket.id } }
    );

    expect(staffRes.status).toBe(200);
    const staffTicket = staffRes.data.data?.ticket || staffRes.data.ticket;
    expect(staffTicket?.messages.some((m) => m.isInternal === true)).toBe(true);
  });

  /**
   * E2E-R5-04: Strict Tenant Isolation across Centers for Support Tickets
   */
  it("E2E-R5-04: Center B users cannot access or view tickets created by Center A", async () => {
    const ownerA = await createTestUser();
    const ownerB = await createTestUser();
    cleanups.userIds.push(ownerA.id, ownerB.id);

    const centerA = await createTestCenter({ ownerId: ownerA.id });
    const centerB = await createTestCenter({ ownerId: ownerB.id });
    cleanups.centerIds.push(centerA.id, centerB.id);

    const directorB = await createTestUser();
    cleanups.userIds.push(directorB.id);
    await createTestMembership(directorB.id, centerB.id, "DIRECTOR");

    const directorBToken = await createTestSessionToken(directorB, {
      activeCenterId: centerB.id,
      activeCenterRole: "DIRECTOR",
    });

    const ticketA = await db.supportTicket.create({
      data: {
        centerId: centerA.id,
        creatorUserId: ownerA.id,
        subject: "Center A Internal Issue",
        status: "OPEN",
      },
    });
    cleanups.ticketIds.push(ticketA.id);

    // Director B attempts to query Center A ticket -> 404
    const resGet = await dispatch(
      getTicketIdRoute,
      `/api/tickets/${ticketA.id}`,
      {
        method: "GET",
        token: directorBToken,
      },
      { params: { id: ticketA.id } }
    );
    expect(resGet.status).toBe(404);

    // Director B lists tickets -> ticketA not in list
    const resList = await dispatch<{ tickets: Array<{ id: string }> }>(
      getTicketsRoute,
      "/api/tickets",
      {
        method: "GET",
        token: directorBToken,
      }
    );
    expect(resList.status).toBe(200);
    const tickets = resList.data.tickets || [];
    expect(tickets.some((t) => t.id === ticketA.id)).toBe(false);
  });

  /**
   * E2E-R5-05: Non-Privileged User Cross-Ticket Isolation within Same Center
   */
  it("E2E-R5-05: Regular student cannot view peer student tickets in the same center", async () => {
    const owner = await createTestUser();
    cleanups.userIds.push(owner.id);

    const center = await createTestCenter({ ownerId: owner.id });
    cleanups.centerIds.push(center.id);

    const student1 = await createTestUser();
    const student2 = await createTestUser();
    cleanups.userIds.push(student1.id, student2.id);

    await createTestMembership(student1.id, center.id, "STUDENT");
    await createTestMembership(student2.id, center.id, "STUDENT");

    const tokenStudent2 = await createTestSessionToken(student2, {
      activeCenterId: center.id,
      activeCenterRole: "STUDENT",
    });

    const ticketStudent1 = await db.supportTicket.create({
      data: {
        centerId: center.id,
        creatorUserId: student1.id,
        subject: "Student 1 Private Question",
        status: "OPEN",
      },
    });
    cleanups.ticketIds.push(ticketStudent1.id);

    // Student 2 queries Student 1 ticket by ID -> 404
    const resGet = await dispatch(
      getTicketIdRoute,
      `/api/tickets/${ticketStudent1.id}`,
      {
        method: "GET",
        token: tokenStudent2,
      },
      { params: { id: ticketStudent1.id } }
    );
    expect(resGet.status).toBe(404);

    // Student 2 lists tickets -> ticketStudent1 not present
    const resList = await dispatch<{ tickets: Array<{ id: string }> }>(
      getTicketsRoute,
      "/api/tickets",
      {
        method: "GET",
        token: tokenStudent2,
      }
    );
    expect(resList.status).toBe(200);
    expect((resList.data.tickets || []).some((t) => t.id === ticketStudent1.id)).toBe(false);
  });

  /**
   * E2E-R5-06: Platform Role Inclusivity (Developer & Full Access Staff Access)
   */
  it("E2E-R5-06: DEVELOPER role has full cross-tenant access to manage support tickets", async () => {
    const owner = await createTestUser();
    cleanups.userIds.push(owner.id);

    const center = await createTestCenter({ ownerId: owner.id });
    cleanups.centerIds.push(center.id);

    const devUser = await createTestUser({ platformRole: "DEVELOPER" });
    cleanups.userIds.push(devUser.id);
    const devToken = await createTestSessionToken(devUser);

    const ticket = await db.supportTicket.create({
      data: {
        centerId: center.id,
        creatorUserId: owner.id,
        subject: "Platform Developer Check",
        status: "OPEN",
        priority: "LOW",
      },
    });
    cleanups.ticketIds.push(ticket.id);

    // Developer views tickets list
    const resList = await dispatch<{ tickets: Array<{ id: string }> }>(
      getPlatformSupportRoute,
      "/api/platform/support",
      {
        method: "GET",
        token: devToken,
      }
    );
    expect(resList.status).toBe(200);

    // Developer updates ticket status and priority
    const resPatch = await dispatch(
      patchPlatformSupportIdRoute,
      `/api/platform/support/${ticket.id}`,
      {
        method: "PATCH",
        token: devToken,
        body: {
          status: "IN_PROGRESS",
          priority: "HIGH",
        },
      },
      { params: { id: ticket.id } }
    );
    expect(resPatch.status).toBe(200);

    const updated = await db.supportTicket.findUnique({
      where: { id: ticket.id },
    });
    expect(updated?.status).toBe("IN_PROGRESS");
    expect(updated?.priority).toBe("HIGH");
  });
});
