import { describe, it, expect, vi, beforeAll } from "vitest";
import { db } from "../src/lib/db";
import { PUT as putGroupHandler } from "../src/app/api/groups/[id]/route";
import { GET as getGroupByIdHandler } from "../src/app/api/groups/[id]/route";
import { GET as getSubstitutionsHandler, POST as postSubstitutionsHandler } from "../src/app/api/substitutions/route";
import { PATCH as patchSubstitutionHandler } from "../src/app/api/substitutions/[id]/route";
import { GET as getTeacherHoursHandler } from "../src/app/api/tenant/teacher-hours/route";
import { GET as getMySalaryHandler } from "../src/app/api/tenant/my-salary/route";
import { POST as postAnnouncementsHandler } from "../src/app/api/tenant/announcements/route";
import { GET as getTicketsHandler } from "../src/app/api/tickets/route";
import type { LearningCenter, PlatformUser, CenterMembership, Group, Course, CourseModule, Lesson } from "@prisma/client";
import { getTenantDb } from "../src/lib/db-tenant";

interface MockTenantContext {
  center: LearningCenter;
  role: string;
  membership: CenterMembership;
  session: { user: PlatformUser; activeCenterId?: string; activeCenterRole?: string };
  isPlatformStaff?: boolean;
  isImpersonating?: boolean;
  isReadOnly?: boolean;
  getTenantDb?: () => ReturnType<typeof getTenantDb>;
}

let mockContext: MockTenantContext | null = null;

vi.mock("@/lib/auth", () => ({
  getAuthSession: vi.fn(async () => {
    return mockContext ? mockContext.session : null;
  }),
}));

vi.mock("@/lib/tenant", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    requireTenantAccess: vi.fn(async () => {
      if (!mockContext) throw new Error("Unauthorized");
      return {
        ...mockContext,
        getTenantDb: mockContext.getTenantDb || (() => getTenantDb(mockContext!.center.id)),
      };
    }),
  };
});

describe("Stage U1 Teacher, Assistant, Substitutions & Salary Tests", () => {
  let center: LearningCenter;
  let ownerUser: PlatformUser;
  let teacher1User: PlatformUser;
  let teacher2User: PlatformUser;
  let assistantUser: PlatformUser;
  let studentUser: PlatformUser;

  let memberDirector: CenterMembership;
  let memberTeacher1: CenterMembership;
  let memberTeacher2: CenterMembership;
  let memberAssistant: CenterMembership;
  let memberStudent: CenterMembership;

  let course: Course;
  let moduleRecord: CourseModule;
  let group1: Group;
  let group2: Group;
  let lesson1: Lesson;
  let lesson2: Lesson;

  beforeAll(async () => {
    // 1. Create unique users
    const timestamp = Date.now();
    ownerUser = await db.platformUser.create({
      data: {
        email: `u1_owner_${timestamp}@edarschi.uz`,
        passwordHash: "hash",
        fullName: "Director Owner",
        phone: `+99890111${timestamp.toString().slice(-4)}`,
        preferredLanguage: "ru",
      },
    });

    teacher1User = await db.platformUser.create({
      data: {
        email: `u1_teacher1_${timestamp}@edarschi.uz`,
        passwordHash: "hash",
        fullName: "Primary Teacher One",
        phone: `+99890222${timestamp.toString().slice(-4)}`,
        preferredLanguage: "ru",
      },
    });

    teacher2User = await db.platformUser.create({
      data: {
        email: `u1_teacher2_${timestamp}@edarschi.uz`,
        passwordHash: "hash",
        fullName: "Substitute Teacher Two",
        phone: `+99890333${timestamp.toString().slice(-4)}`,
        preferredLanguage: "ru",
      },
    });

    assistantUser = await db.platformUser.create({
      data: {
        email: `u1_assistant_${timestamp}@edarschi.uz`,
        passwordHash: "hash",
        fullName: "Teacher Assistant",
        phone: `+99890444${timestamp.toString().slice(-4)}`,
        preferredLanguage: "ru",
      },
    });

    studentUser = await db.platformUser.create({
      data: {
        email: `u1_student_${timestamp}@edarschi.uz`,
        passwordHash: "hash",
        fullName: "Enrolled Student",
        phone: `+99890555${timestamp.toString().slice(-4)}`,
        preferredLanguage: "ru",
      },
    });

    // 2. Center
    center = await db.learningCenter.create({
      data: {
        name: `U1 Test Center ${timestamp}`,
        slug: `u1-test-center-${timestamp}`,
        ownerId: ownerUser.id,
        status: "ACTIVE",
      },
    });

    // 3. Memberships
    memberDirector = await db.centerMembership.create({
      data: {
        centerId: center.id,
        userId: ownerUser.id,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
    });

    memberTeacher1 = await db.centerMembership.create({
      data: {
        centerId: center.id,
        userId: teacher1User.id,
        role: "TEACHER",
        status: "ACTIVE",
      },
    });

    memberTeacher2 = await db.centerMembership.create({
      data: {
        centerId: center.id,
        userId: teacher2User.id,
        role: "TEACHER",
        status: "ACTIVE",
      },
    });

    memberAssistant = await db.centerMembership.create({
      data: {
        centerId: center.id,
        userId: assistantUser.id,
        role: "TEACHER_ASSISTANT",
        status: "ACTIVE",
      },
    });

    memberStudent = await db.centerMembership.create({
      data: {
        centerId: center.id,
        userId: studentUser.id,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });

    // 4. Course, Module & Groups
    course = await db.course.create({
      data: {
        center: { connect: { id: center.id } },
        creator: { connect: { id: memberDirector.id } },
        title: "Mathematics & Physics",
      },
    });

    moduleRecord = await db.courseModule.create({
      data: {
        center: { connect: { id: center.id } },
        course: { connect: { id: course.id } },
        title: "Module 1: Algebra",
        orderIndex: 0,
      },
    });

    group1 = await db.group.create({
      data: {
        centerId: center.id,
        courseId: course.id,
        name: "Math Group A",
        teacherMembershipId: memberTeacher1.id,
        assistantMembershipId: null, // to be assigned by director
        maxStudents: 25,
      },
    });

    group2 = await db.group.create({
      data: {
        centerId: center.id,
        courseId: course.id,
        name: "Math Group B",
        teacherMembershipId: memberTeacher2.id,
        maxStudents: 20,
      },
    });

    // Student enrolled in group1
    await db.enrollment.create({
      data: {
        center: { connect: { id: center.id } },
        group: { connect: { id: group1.id } },
        student: { connect: { id: memberStudent.id } },
        status: "ACTIVE",
      },
    });

    // 5. Lessons
    const scheduledTime1 = new Date(Date.now() + 24 * 60 * 60 * 1000); // tomorrow at 10:00
    scheduledTime1.setHours(10, 0, 0, 0);

    lesson1 = await db.lesson.create({
      data: {
        center: { connect: { id: center.id } },
        module: { connect: { id: moduleRecord.id } },
        title: "Linear Equations",
        scheduledAt: scheduledTime1,
        durationMinutes: 60,
        status: "ACTIVE",
      },
    });

    const scheduledTime2 = new Date(scheduledTime1.getTime()); // same time tomorrow
    lesson2 = await db.lesson.create({
      data: {
        center: { connect: { id: center.id } },
        module: { connect: { id: moduleRecord.id } },
        title: "Quadratic Equations",
        scheduledAt: scheduledTime2,
        durationMinutes: 60,
        status: "ACTIVE",
      },
    });
  });

  describe("1. Group Assistant Assignment & AuditLog", () => {
    it("director assigns assistant to group, recording GROUP_ASSISTANT_ASSIGN audit log", async () => {
      mockContext = {
        center,
        role: "DIRECTOR",
        membership: memberDirector,
        session: { user: ownerUser, activeCenterId: center.id, activeCenterRole: "DIRECTOR" },
      };

      const res = await putGroupHandler(
        new Request(`http://localhost/api/groups/${group1.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assistantMembershipId: memberAssistant.id,
          }),
        }),
        { params: { id: group1.id } }
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.group.assistantMembershipId).toBe(memberAssistant.id);

      // Verify audit log
      const audit = await db.auditLog.findFirst({
        where: {
          centerId: center.id,
          action: "GROUP_ASSISTANT_ASSIGN",
          resourceId: group1.id,
        },
      });
      expect(audit).not.toBeNull();
    });

    it("director removes assistant from group, recording GROUP_ASSISTANT_REMOVE audit log", async () => {
      mockContext = {
        center,
        role: "DIRECTOR",
        membership: memberDirector,
        session: { user: ownerUser, activeCenterId: center.id, activeCenterRole: "DIRECTOR" },
      };

      const res = await putGroupHandler(
        new Request(`http://localhost/api/groups/${group1.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assistantMembershipId: null,
          }),
        }),
        { params: { id: group1.id } }
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.group.assistantMembershipId).toBeNull();

      const audit = await db.auditLog.findFirst({
        where: {
          centerId: center.id,
          action: "GROUP_ASSISTANT_REMOVE",
          resourceId: group1.id,
        },
      });
      expect(audit).not.toBeNull();
    });
  });

  describe("2. Substitutions Workflow & Schedule Conflict Detection", () => {
    let subRequestId: string;

    it("teacher 1 creates substitution request for their lesson", async () => {
      mockContext = {
        center,
        role: "TEACHER",
        membership: memberTeacher1,
        session: { user: teacher1User, activeCenterId: center.id, activeCenterRole: "TEACHER" },
      };

      const res = await postSubstitutionsHandler(
        new Request("http://localhost/api/substitutions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lessonId: lesson1.id,
            reason: "Medical appointment, doctor visit",
            proposedSubstituteMembershipId: memberTeacher2.id,
          }),
        })
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.substitutionRequest.id).toBeDefined();
      expect(json.substitutionRequest.status).toBe("REQUESTED");
      subRequestId = json.substitutionRequest.id;
    });

    it("teacher 2 receives 403 when trying to approve a substitution (Director only)", async () => {
      mockContext = {
        center,
        role: "TEACHER",
        membership: memberTeacher2,
        session: { user: teacher2User, activeCenterId: center.id, activeCenterRole: "TEACHER" },
      };

      const res = await patchSubstitutionHandler(
        new Request(`http://localhost/api/substitutions/${subRequestId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "APPROVE",
            substituteTeacherMembershipId: memberTeacher2.id,
          }),
        }),
        { params: { id: subRequestId } }
      );

      expect(res.status).toBe(403);
    });

    it("approval detects schedule conflict when substitute teacher has an overlapping lesson", async () => {
      // Assign teacher 2 to lesson 2 at the EXACT SAME time as lesson 1
      await db.lesson.update({
        where: { id: lesson2.id },
        data: {
          substituteTeacherMembershipId: memberTeacher2.id,
        },
      });

      mockContext = {
        center,
        role: "DIRECTOR",
        membership: memberDirector,
        session: { user: ownerUser, activeCenterId: center.id, activeCenterRole: "DIRECTOR" },
      };

      const res = await patchSubstitutionHandler(
        new Request(`http://localhost/api/substitutions/${subRequestId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "APPROVE",
            substituteTeacherMembershipId: memberTeacher2.id,
          }),
        }),
        { params: { id: subRequestId } }
      );

      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toContain("Schedule conflict");
    });

    it("approval succeeds when no conflict exists and assigns substitute to Lesson", async () => {
      // Free teacher 2 from lesson 2 conflict
      await db.lesson.update({
        where: { id: lesson2.id },
        data: {
          substituteTeacherMembershipId: null,
        },
      });

      mockContext = {
        center,
        role: "DIRECTOR",
        membership: memberDirector,
        session: { user: ownerUser, activeCenterId: center.id, activeCenterRole: "DIRECTOR" },
      };

      const res = await patchSubstitutionHandler(
        new Request(`http://localhost/api/substitutions/${subRequestId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "APPROVE",
            substituteTeacherMembershipId: memberTeacher2.id,
            resolverComment: "Approved by director",
          }),
        }),
        { params: { id: subRequestId } }
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.substitutionRequest.status).toBe("APPROVED");

      // Verify that Lesson.substituteTeacherMembershipId is updated
      const updatedLesson = await db.lesson.findUnique({
        where: { id: lesson1.id },
      });
      expect(updatedLesson?.substituteTeacherMembershipId).toBe(memberTeacher2.id);
    });
  });

  describe("3. Teacher Hours & Salary Calculation", () => {
    beforeAll(async () => {
      // Set hourly salary rate for Teacher 2
      await db.teacherSalaryRate.create({
        data: {
          centerId: center.id,
          teacherMembershipId: memberTeacher2.id,
          rateType: "HOURLY",
          amount: 150000, // 150,000 UZS/hr
          isActive: true,
        },
      });

      // Mark attendance for lesson 1 (1 hour)
      await db.attendance.create({
        data: {
          lessonId: lesson1.id,
          studentMembershipId: memberStudent.id,
          markedByMembershipId: memberTeacher2.id,
          status: "PRESENT",
        },
      });
    });

    it("hours report credits substitute teacher (Teacher 2) rather than regular teacher", async () => {
      mockContext = {
        center,
        role: "DIRECTOR",
        membership: memberDirector,
        session: { user: ownerUser, activeCenterId: center.id, activeCenterRole: "DIRECTOR" },
      };

      const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const to = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

      const res = await getTeacherHoursHandler(
        new Request(`http://localhost/api/tenant/teacher-hours?from=${from}&to=${to}`)
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      const t1 = json.teacherReport.find((t: { teacherId: string }) => t.teacherId === memberTeacher1.id);
      const t2 = json.teacherReport.find((t: { teacherId: string }) => t.teacherId === memberTeacher2.id);

      // Teacher 1 had their lesson substituted, so they get 0 hours for lesson 1
      expect(t1.totalAcademicHours).toBe(0);

      // Teacher 2 substituted lesson 1, so they get 1 hour and calculated pay
      expect(t2.totalAcademicHours).toBe(1);
      expect(t2.substituteLessonsCount).toBe(1);
      expect(t2.calculatedSalary).toBe(150000);
    });

    it("self-service /api/tenant/my-salary returns own hours and rate to teacher", async () => {
      mockContext = {
        center,
        role: "TEACHER",
        membership: memberTeacher2,
        session: { user: teacher2User, activeCenterId: center.id, activeCenterRole: "TEACHER" },
      };

      const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const to = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

      const res = await getMySalaryHandler(
        new Request(`http://localhost/api/tenant/my-salary?from=${from}&to=${to}`)
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.totalAcademicHours).toBe(1);
      expect(json.calculatedSalary).toBe(150000);
      expect(json.salaryRate.rateType).toBe("HOURLY");
      expect(json.lessons.length).toBe(1);
      expect(json.lessons[0].isSubstitute).toBe(true);
    });
  });

  describe("4. Announcements & Support Scoping", () => {
    it("teacher gets 403 when trying to broadcast announcement without a group", async () => {
      mockContext = {
        center,
        role: "TEACHER",
        membership: memberTeacher1,
        session: { user: teacher1User, activeCenterId: center.id, activeCenterRole: "TEACHER" },
      };

      const res = await postAnnouncementsHandler(
        new Request("http://localhost/api/tenant/announcements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Center-wide notice",
            body: "This should fail because teachers must target specific groups",
          }),
        })
      );

      expect(res.status).toBe(403);
    });

    it("teacher gets 403 when trying to post announcement to someone else's group", async () => {
      mockContext = {
        center,
        role: "TEACHER",
        membership: memberTeacher1,
        session: { user: teacher1User, activeCenterId: center.id, activeCenterRole: "TEACHER" },
      };

      const res = await postAnnouncementsHandler(
        new Request("http://localhost/api/tenant/announcements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Math B update",
            body: "Trying to post to group 2",
            groupId: group2.id,
          }),
        })
      );

      expect(res.status).toBe(403);
    });

    it("teacher successfully posts announcement to their own group", async () => {
      mockContext = {
        center,
        role: "TEACHER",
        membership: memberTeacher1,
        session: { user: teacher1User, activeCenterId: center.id, activeCenterRole: "TEACHER" },
      };

      const res = await postAnnouncementsHandler(
        new Request("http://localhost/api/tenant/announcements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Homework reminder",
            body: "Don't forget to submit assignment 1",
            groupId: group1.id,
          }),
        })
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.announcement.groupId).toBe(group1.id);
    });

    it("support tickets query scopes non-admin users strictly to their own tickets", async () => {
      // Create ticket by teacher 1
      await db.supportTicket.create({
        data: {
          centerId: center.id,
          creatorUserId: teacher1User.id,
          subject: "Projector broken in Room 3",
          priority: "HIGH",
          scope: "TENANT",
          messages: {
            create: {
              senderUserId: teacher1User.id,
              message: "HDMI port is faulty",
            },
          },
        },
      });

      // Create ticket by teacher 2
      await db.supportTicket.create({
        data: {
          centerId: center.id,
          creatorUserId: teacher2User.id,
          subject: "Markers request",
          priority: "LOW",
          scope: "TENANT",
          messages: {
            create: {
              senderUserId: teacher2User.id,
              message: "Need whiteboard markers",
            },
          },
        },
      });

      // Teacher 1 queries /api/tickets
      mockContext = {
        center,
        role: "TEACHER",
        membership: memberTeacher1,
        session: { user: teacher1User, activeCenterId: center.id, activeCenterRole: "TEACHER" },
      };

      const res = await getTicketsHandler(new Request("http://localhost/api/tickets"));
      expect(res.status).toBe(200);
      const json = await res.json();

      // Teacher 1 only sees their own ticket, NOT teacher 2's ticket
      const subjects = json.tickets.map((t: { subject: string }) => t.subject);
      expect(subjects).toContain("Projector broken in Room 3");
      expect(subjects).not.toContain("Markers request");
    });
  });
});
