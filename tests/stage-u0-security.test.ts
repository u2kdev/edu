import { describe, it, expect, vi, beforeAll } from "vitest";
import { db } from "../src/lib/db";
import { GET as getGroupsHandler } from "../src/app/api/groups/route";
import { GET as getGroupByIdHandler } from "../src/app/api/groups/[id]/route";
import { GET as getStudentsHandler } from "../src/app/api/students/route";
import { POST as postBulkAttendanceHandler } from "../src/app/api/attendance/bulk/route";
import { PATCH as patchGradesHandler } from "../src/app/api/grades/route";
import { POST as postTestAttemptHandler } from "../src/app/api/tests/attempt/route";
import { GET as getParentDashboardMobile } from "../src/app/api/mobile/parent/dashboard/route";
import { GET as getTeacherDashboardMobile } from "../src/app/api/mobile/teacher/dashboard/route";
import { migrateTestGradeAuthors } from "../src/lib/migrations/fix-test-grade-authors";
import type { LearningCenter, PlatformUser, CenterMembership, Group, Course, Lesson, Grade } from "@prisma/client";
import { getTenantDb } from "../src/lib/db-tenant";

interface MockTenantContext {
  center: LearningCenter;
  role: string;
  membership: CenterMembership;
  session: { user: PlatformUser };
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

describe("Stage U0 Security & Data Isolation Tests", () => {
  let center: LearningCenter;
  let foreignCenter: LearningCenter;
  let ownerUser: PlatformUser;
  let teacherUser: PlatformUser;
  let foreignTeacherUser: PlatformUser;
  let assistantUser: PlatformUser;
  let studentUser: PlatformUser;
  let otherStudentUser: PlatformUser;
  let parentUser: PlatformUser;

  let memberTeacher: CenterMembership;
  let memberForeignTeacher: CenterMembership;
  let memberAssistant: CenterMembership;
  let memberStudent: CenterMembership;
  let memberOtherStudent: CenterMembership;
  let memberParent: CenterMembership;

  let course: Course;
  let groupTaught: Group;
  let groupForeign: Group;
  let lessonTaught: Lesson;
  let gradeDraft: Grade;

  beforeAll(async () => {
    const ts = Date.now();

    ownerUser = await db.platformUser.create({
      data: { email: `owner_u0_${ts}@test.com`, passwordHash: "h", fullName: "Center Owner" },
    });
    teacherUser = await db.platformUser.create({
      data: { email: `teacher_u0_${ts}@test.com`, passwordHash: "h", fullName: "Main Teacher", phone: "+998901111111" },
    });
    foreignTeacherUser = await db.platformUser.create({
      data: { email: `fteach_u0_${ts}@test.com`, passwordHash: "h", fullName: "Foreign Teacher", phone: "+998902222222" },
    });
    assistantUser = await db.platformUser.create({
      data: { email: `assist_u0_${ts}@test.com`, passwordHash: "h", fullName: "Assistant Teacher", phone: "+998903333333" },
    });
    studentUser = await db.platformUser.create({
      data: { email: `student_u0_${ts}@test.com`, passwordHash: "h", fullName: "Enrolled Student", phone: "+998904444444" },
    });
    otherStudentUser = await db.platformUser.create({
      data: { email: `other_student_u0_${ts}@test.com`, passwordHash: "h", fullName: "Unenrolled Student", phone: "+998905555555" },
    });
    parentUser = await db.platformUser.create({
      data: { email: `parent_u0_${ts}@test.com`, passwordHash: "h", fullName: "Confirmed Parent", phone: "+998906666666" },
    });

    center = await db.learningCenter.create({
      data: { name: "Stage U0 Main Center", slug: `u0-main-${ts}`, ownerId: ownerUser.id },
    });

    foreignCenter = await db.learningCenter.create({
      data: { name: "Stage U0 Foreign Center", slug: `u0-foreign-${ts}`, ownerId: ownerUser.id },
    });

    memberTeacher = await db.centerMembership.create({
      data: { centerId: center.id, userId: teacherUser.id, role: "TEACHER" },
    });
    memberForeignTeacher = await db.centerMembership.create({
      data: { centerId: center.id, userId: foreignTeacherUser.id, role: "TEACHER" },
    });
    memberAssistant = await db.centerMembership.create({
      data: { centerId: center.id, userId: assistantUser.id, role: "TEACHER_ASSISTANT" },
    });
    memberStudent = await db.centerMembership.create({
      data: { centerId: center.id, userId: studentUser.id, role: "STUDENT" },
    });
    memberOtherStudent = await db.centerMembership.create({
      data: { centerId: center.id, userId: otherStudentUser.id, role: "STUDENT" },
    });
    memberParent = await db.centerMembership.create({
      data: { centerId: center.id, userId: parentUser.id, role: "PARENT" },
    });

    // Parent linked ONLY to memberStudent
    await db.parentLink.create({
      data: {
        parentMembershipId: memberParent.id,
        studentMembershipId: memberStudent.id,
        status: "CONFIRMED",
      },
    });

    course = await db.course.create({
      data: {
        center: { connect: { id: center.id } },
        creator: { connect: { id: memberTeacher.id } },
        title: "U0 Math Course",
      },
    });

    const courseModule = await db.courseModule.create({
      data: {
        center: { connect: { id: center.id } },
        course: { connect: { id: course.id } },
        title: "Module 1",
      },
    });

    lessonTaught = await db.lesson.create({
      data: {
        center: { connect: { id: center.id } },
        title: "Algebra Lesson",
        module: { connect: { id: courseModule.id } },
      },
    });

    groupTaught = await db.group.create({
      data: {
        centerId: center.id,
        courseId: course.id,
        name: "Group Alpha (Teacher + Assistant)",
        teacherMembershipId: memberTeacher.id,
        assistantMembershipId: memberAssistant.id,
      },
    });

    groupForeign = await db.group.create({
      data: {
        centerId: center.id,
        courseId: course.id,
        name: "Group Beta (Foreign Teacher)",
        teacherMembershipId: memberForeignTeacher.id,
      },
    });

    // Enroll memberStudent in groupTaught
    await db.enrollment.create({
      data: {
        centerId: center.id,
        groupId: groupTaught.id,
        studentMembershipId: memberStudent.id,
        status: "ACTIVE",
      },
    });

    // Enroll memberOtherStudent in groupForeign
    await db.enrollment.create({
      data: {
        centerId: center.id,
        groupId: groupForeign.id,
        studentMembershipId: memberOtherStudent.id,
        status: "ACTIVE",
      },
    });

    gradeDraft = await db.grade.create({
      data: {
        centerId: center.id,
        studentMembershipId: memberStudent.id,
        teacherMembershipId: memberTeacher.id,
        groupId: groupTaught.id,
        value: 85,
        maxValue: 100,
        gradeType: "HOMEWORK",
        lifecycle: "DRAFT",
      },
    });
  });

  describe("1. GET /api/groups and /api/groups/[id] DTO & Scope", () => {
    it("student only gets enrolled groups and DTO never exposes other students or phones", async () => {
      mockContext = {
        center,
        role: "STUDENT",
        membership: memberStudent,
        session: { user: studentUser },
      };

      const res = await getGroupsHandler(new Request("http://localhost/api/groups"));
      const json = await res.json();
      expect(res.status).toBe(200);

      // Must only see Group Alpha (1 group), not Group Beta
      expect(json.groups.length).toBe(1);
      expect(json.groups[0].id).toBe(groupTaught.id);

      // DTO check: enrollments array MUST be empty for students
      expect(json.groups[0].enrollments).toEqual([]);
      // Contacts must not be exposed
      expect(JSON.stringify(json.groups[0])).not.toContain(otherStudentUser.email);
      expect(JSON.stringify(json.groups[0])).not.toContain(otherStudentUser.phone);
    });

    it("parent only gets groups of their confirmed children without contacts list", async () => {
      mockContext = {
        center,
        role: "PARENT",
        membership: memberParent,
        session: { user: parentUser },
      };

      const res = await getGroupsHandler(new Request("http://localhost/api/groups"));
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.groups.length).toBe(1);
      expect(json.groups[0].id).toBe(groupTaught.id);
      expect(json.groups[0].enrollments).toEqual([]);
    });

    it("student gets 403 when trying to fetch /api/groups/[id] for unenrolled group", async () => {
      mockContext = {
        center,
        role: "STUDENT",
        membership: memberStudent,
        session: { user: studentUser },
      };

      const res = await getGroupByIdHandler(new Request("http://localhost"), {
        params: { id: groupForeign.id },
      });
      expect(res.status).toBe(403);
    });

    it("teacher gets 403 when trying to fetch /api/groups/[id] for someone else's group", async () => {
      mockContext = {
        center,
        role: "TEACHER",
        membership: memberTeacher,
        session: { user: teacherUser },
      };

      const res = await getGroupByIdHandler(new Request("http://localhost"), {
        params: { id: groupForeign.id },
      });
      expect(res.status).toBe(403);
    });

    it("assistant can fetch their assigned group but gets 403 for other groups", async () => {
      mockContext = {
        center,
        role: "TEACHER_ASSISTANT",
        membership: memberAssistant,
        session: { user: assistantUser },
      };

      // Assigned group: allowed
      const allowedRes = await getGroupByIdHandler(new Request("http://localhost"), {
        params: { id: groupTaught.id },
      });
      expect(allowedRes.status).toBe(200);

      // Unassigned group: 403 Forbidden
      const forbiddenRes = await getGroupByIdHandler(new Request("http://localhost"), {
        params: { id: groupForeign.id },
      });
      expect(forbiddenRes.status).toBe(403);
    });
  });

  describe("2. TEACHER_ASSISTANT in /api/students and /api/attendance/bulk", () => {
    it("assistant can load /api/students for their assigned groups without 403", async () => {
      mockContext = {
        center,
        role: "TEACHER_ASSISTANT",
        membership: memberAssistant,
        session: { user: assistantUser },
      };

      const res = await getStudentsHandler(new Request("http://localhost/api/students"));
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.students.length).toBeGreaterThanOrEqual(1);
      // Student in assigned group is present
      const studentIds = json.students.map((s: { id: string }) => s.id);
      expect(studentIds).toContain(memberStudent.id);
      // Other student in foreign group is NOT present
      expect(studentIds).not.toContain(memberOtherStudent.id);
    });

    it("assistant gets 403 when attempting to mark bulk attendance for an unassigned group", async () => {
      mockContext = {
        center,
        role: "TEACHER_ASSISTANT",
        membership: memberAssistant,
        session: { user: assistantUser },
      };

      const res = await postBulkAttendanceHandler(
        new Request("http://localhost/api/attendance/bulk", {
          method: "POST",
          body: JSON.stringify({
            lessonId: lessonTaught.id,
            groupId: groupForeign.id, // Not assigned to assistant!
            defaultStatus: "PRESENT",
          }),
        })
      );
      expect(res.status).toBe(403);
    });
  });

  describe("3. Grades Finalization Control", () => {
    it("teacher cannot transition grade directly to FINAL without grades.finalize permission", async () => {
      mockContext = {
        center,
        role: "TEACHER",
        membership: memberTeacher,
        session: { user: teacherUser },
      };

      const res = await patchGradesHandler(
        new Request("http://localhost/api/grades", {
          method: "PATCH",
          body: JSON.stringify({
            id: gradeDraft.id,
            lifecycle: "FINAL",
          }),
        })
      );
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain("grades.finalize");
    });
  });

  describe("4. Tests Attempt Author Resolution & Migration", () => {
    it("resolves teacher author from group rather than setting student as their own teacher", async () => {
      // Create test material
      const material = await db.material.create({
        data: {
          center: { connect: { id: center.id } },
          title: "Math Quiz",
          materialType: "TEST",
          group: { connect: { id: groupTaught.id } },
        },
      });

      const testRecord = await db.test.create({
        data: {
          center: { connect: { id: center.id } },
          material: { connect: { id: material.id } },
        },
      });

      const question = await db.testQuestion.create({
        data: {
          test: { connect: { id: testRecord.id } },
          center: { connect: { id: center.id } },
          questionText: "2 + 2 = ?",
          questionType: "SINGLE_CHOICE",
          optionsJson: JSON.stringify([
            { text: "4", isCorrect: true },
            { text: "5", isCorrect: false },
          ]),
          points: 10,
          orderIndex: 0,
        },
      });

      mockContext = {
        center,
        role: "STUDENT",
        membership: memberStudent,
        session: { user: studentUser },
      };

      const res = await postTestAttemptHandler(
        new Request("http://localhost/api/tests/attempt", {
          method: "POST",
          body: JSON.stringify({
            testId: testRecord.id,
            studentAnswers: { [question.id]: "4" },
          }),
        })
      );

      expect(res.status).toBe(200);

      // Verify that Grade was created with group's teacherMembershipId, NOT the student!
      const createdGrade = await db.grade.findFirst({
        where: {
          studentMembershipId: memberStudent.id,
          gradeType: "TEST",
        },
        orderBy: { createdAt: "desc" },
      });

      expect(createdGrade).toBeDefined();
      expect(createdGrade?.teacherMembershipId).toBe(memberTeacher.id);
      expect(createdGrade?.teacherMembershipId).not.toBe(memberStudent.id);
    });

    it("migrateTestGradeAuthors idempotently fixes records where teacher == student", async () => {
      // Create a corrupt grade where teacherMembershipId is studentMembershipId
      const corruptGrade = await db.grade.create({
        data: {
          centerId: center.id,
          studentMembershipId: memberStudent.id,
          teacherMembershipId: memberStudent.id, // Corrupt!
          groupId: groupTaught.id,
          value: 100,
          maxValue: 100,
          gradeType: "TEST",
        },
      });

      const updatedCount = await migrateTestGradeAuthors();
      expect(updatedCount).toBeGreaterThanOrEqual(1);

      const fixed = await db.grade.findUnique({
        where: { id: corruptGrade.id },
      });
      expect(fixed?.teacherMembershipId).toBe(memberTeacher.id);
    });
  });

  describe("5. Mobile Dashboard Ownership Guards", () => {
    it("parent dashboard returns 403 when requesting childId not linked to parent", async () => {
      mockContext = {
        center,
        role: "PARENT",
        membership: memberParent,
        session: { user: parentUser },
      };

      const res = await getParentDashboardMobile(
        new Request(`http://localhost/api/mobile/parent/dashboard?childId=${memberOtherStudent.id}`)
      );
      expect(res.status).toBe(403);
    });

    it("teacher dashboard returns 403 when filtering by groupId not assigned to teacher", async () => {
      mockContext = {
        center,
        role: "TEACHER",
        membership: memberTeacher,
        session: { user: teacherUser },
      };

      const res = await getTeacherDashboardMobile(
        new Request(`http://localhost/api/mobile/teacher/dashboard?groupId=${groupForeign.id}`)
      );
      expect(res.status).toBe(403);
    });
  });
});
