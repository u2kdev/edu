import { describe, it, expect, beforeAll } from "vitest";
// Reason: Exception: Test setup and verification requires raw db access for multi-tenant fixtures.
// eslint-disable-next-line no-restricted-imports
import { db } from "../src/lib/db";
import { signJWT, hashPassword } from "../src/lib/auth";

// Route handlers under test
import { GET as getCourse, PATCH as patchCourse, DELETE as deleteCourse } from "../src/app/api/courses/[id]/route";
import { POST as reorderModules } from "../src/app/api/modules/reorder/route";
import { POST as postLesson } from "../src/app/api/lessons/route";
import { POST as postAcademicTerm, GET as getAcademicTerms } from "../src/app/api/tenant/academic-terms/route";
import { POST as postHoliday, GET as getHolidays } from "../src/app/api/tenant/holidays/route";
import { POST as postMaterial, GET as getMaterials } from "../src/app/api/materials/route";
import { DELETE as deleteMaterial } from "../src/app/api/materials/[id]/route";
import { POST as postTest, GET as getTests } from "../src/app/api/tests/route";
import { GET as getTest, DELETE as deleteTest } from "../src/app/api/tests/[id]/route";
import { POST as postTestStart } from "../src/app/api/tests/start/route";
import { POST as postTestAttempt } from "../src/app/api/tests/attempt/route";
import { GET as getTranscript } from "../src/app/api/tenant/students/[id]/transcript/route";

describe("Stage D2: Curriculum, Course Builder, Storage Quota, Tests & Transcripts", () => {
  let centerAId: string;
  let centerBId: string;
  let dirAUserId: string;
  let dirBUserId: string;
  let studentAUserId: string;
  let studentAMembershipId: string;

  let tokenDirA: string;
  let tokenDirB: string;
  let tokenStudentA: string;

  let courseAId: string;
  let moduleA1Id: string;
  let moduleA2Id: string;
  let groupAId: string;

  beforeAll(async () => {
    const ts = Date.now();

    // 1. Users
    const userDirA = await db.platformUser.create({
      data: {
        email: `dir_d2_a_${ts}@test.uz`,
        passwordHash: await hashPassword("ValidPass123!"),
        fullName: "Director D2 A",
        emailVerified: new Date(),
      },
    });
    dirAUserId = userDirA.id;

    const userDirB = await db.platformUser.create({
      data: {
        email: `dir_d2_b_${ts}@test.uz`,
        passwordHash: await hashPassword("ValidPass123!"),
        fullName: "Director D2 B",
        emailVerified: new Date(),
      },
    });
    dirBUserId = userDirB.id;

    const userStudentA = await db.platformUser.create({
      data: {
        email: `student_d2_a_${ts}@test.uz`,
        passwordHash: await hashPassword("ValidPass123!"),
        fullName: "Student D2 A",
        emailVerified: new Date(),
      },
    });
    studentAUserId = userStudentA.id;

    // 2. Subscription Plan
    const plan = (await db.subscriptionPlan.findFirst()) || (await db.subscriptionPlan.create({
      data: {
        name: "Standard Plan",
        priceMonthly: 500000,
        maxStudents: 500,
        maxTeachers: 20,
        maxCourses: 50,
        maxStorage: 2048, // 2GB
      },
    }));

    // 3. Learning Centers
    const centerA = await db.learningCenter.create({
      data: {
        name: `Center A D2 ${ts}`,
        slug: `d2-a-${ts}`,
        status: "ACTIVE",
        ownerId: dirAUserId,
      },
    });
    centerAId = centerA.id;

    const centerB = await db.learningCenter.create({
      data: {
        name: `Center B D2 ${ts}`,
        slug: `d2-b-${ts}`,
        status: "ACTIVE",
        ownerId: dirBUserId,
      },
    });
    centerBId = centerB.id;

    // Subscriptions
    await db.subscription.create({
      data: {
        centerId: centerAId,
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodEndsAt: new Date(Date.now() + 30 * 86400000),
      },
    });
    await db.subscription.create({
      data: {
        centerId: centerBId,
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodEndsAt: new Date(Date.now() + 30 * 86400000),
      },
    });

    let dirAMembershipId: string;

    // Memberships
    const dirAMem = await db.centerMembership.create({
      data: {
        centerId: centerAId,
        userId: dirAUserId,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
    });
    dirAMembershipId = dirAMem.id;
    await db.centerMembership.create({
      data: {
        centerId: centerBId,
        userId: dirBUserId,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
    });
    const studentMem = await db.centerMembership.create({
      data: {
        centerId: centerAId,
        userId: studentAUserId,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });
    studentAMembershipId = studentMem.id;

    // JWT Tokens
    tokenDirA = await signJWT({
      userId: dirAUserId,
      email: userDirA.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "DIRECTOR",
    });

    tokenDirB = await signJWT({
      userId: dirBUserId,
      email: userDirB.email,
      platformRole: "NONE",
      activeCenterId: centerBId,
      activeCenterRole: "DIRECTOR",
    });

    tokenStudentA = await signJWT({
      userId: studentAUserId,
      email: userStudentA.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "STUDENT",
    });

    // Seed base course & modules & group in Center A
    const courseA = await db.course.create({
      data: {
        centerId: centerAId,
        title: "Frontend Mastery",
        description: "Course on modern web development",
        priceMonthly: 800000,
        isPublished: false,
        createdByMembershipId: dirAMembershipId,
      },
    });
    courseAId = courseA.id;

    const mod1 = await db.courseModule.create({
      data: {
        centerId: centerAId,
        courseId: courseAId,
        title: "Module 1: HTML & CSS",
        orderIndex: 0,
      },
    });
    moduleA1Id = mod1.id;

    const mod2 = await db.courseModule.create({
      data: {
        centerId: centerAId,
        courseId: courseAId,
        title: "Module 2: TypeScript & React",
        orderIndex: 1,
      },
    });
    moduleA2Id = mod2.id;

    const grp = await db.group.create({
      data: {
        centerId: centerAId,
        courseId: courseAId,
        name: "FE-2026",
      },
    });
    groupAId = grp.id;

    // Enroll student in group
    await db.enrollment.create({
      data: {
        centerId: centerAId,
        groupId: groupAId,
        studentMembershipId: studentAMembershipId,
        status: "ACTIVE",
      },
    });
  });

  describe("1. Course Builder & Curriculum Reordering", () => {
    it("fetches course details with modules and lessons", async () => {
      const req = new Request(`http://localhost/api/courses/${courseAId}`, {
        headers: { Authorization: `Bearer ${tokenDirA}` },
      });
      const res = await getCourse(req, { params: { id: courseAId } });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.course.id).toBe(courseAId);
      expect(data.course.modules.length).toBe(2);
    });

    it("reorders modules via batch reorder API", async () => {
      const req = new Request("http://localhost/api/modules/reorder", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenDirA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [
            { id: moduleA2Id, orderIndex: 0 },
            { id: moduleA1Id, orderIndex: 1 },
          ],
        }),
      });

      const res = await reorderModules(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);

      const updatedMod2 = await db.courseModule.findUnique({ where: { id: moduleA2Id } });
      expect(updatedMod2?.orderIndex).toBe(0);
    });

    it("toggles course publication status", async () => {
      const req = new Request(`http://localhost/api/courses/${courseAId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${tokenDirA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isPublished: true }),
      });

      const res = await patchCourse(req, { params: { id: courseAId } });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.course.isPublished).toBe(true);
    });

    it("requires at least 5 chars reason for course archiving (DELETE)", async () => {
      const req = new Request(`http://localhost/api/courses/${courseAId}?reason=bad`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokenDirA}` },
      });

      const res = await deleteCourse(req, { params: { id: courseAId } });
      expect(res.status).toBe(400);

      // Successful archive
      const reqValid = new Request(
        `http://localhost/api/courses/${courseAId}?reason=Course%20replaced%20by%20new%20edition`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${tokenDirA}` },
        }
      );
      const resValid = await deleteCourse(reqValid, { params: { id: courseAId } });
      expect(resValid.status).toBe(200);

      const archivedCourse = await db.course.findUnique({ where: { id: courseAId } });
      expect(archivedCourse?.deletedAt).not.toBeNull();

      // Un-archive for subsequent tests
      await db.course.update({
        where: { id: courseAId },
        data: { deletedAt: null },
      });
    });
  });

  describe("2. Academic Calendar, Uzbekistan Holidays & Collision Guard", () => {
    it("creates an academic term", async () => {
      const req = new Request("http://localhost/api/tenant/academic-terms", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenDirA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Осенний семестр 2026",
          startDate: "2026-09-01T00:00:00.000Z",
          endDate: "2026-12-31T23:59:59.000Z",
          isCurrent: true,
        }),
      });

      const res = await postAcademicTerm(req);
      const data = await res.json();
      expect(res.status).toBe(201);
      expect(data.term.name).toBe("Осенний семестр 2026");
    });

    it("imports official Uzbekistan national holidays", async () => {
      const req = new Request("http://localhost/api/tenant/holidays", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenDirA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "IMPORT_UZ_HOLIDAYS",
          year: 2026,
        }),
      });

      const res = await postHoliday(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.createdCount).toBeGreaterThan(5);

      // Verify Independence Day holiday exists
      const indHoliday = await db.holiday.findFirst({
        where: { centerId: centerAId, name: { contains: "независимости", mode: "insensitive" } },
      });
      expect(indHoliday).not.toBeNull();
    });

    it("blocks scheduling a lesson on a holiday date (collision guard)", async () => {
      // 2026-09-01 is Independence Day in Uzbekistan
      const req = new Request("http://localhost/api/lessons", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenDirA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          moduleId: moduleA1Id,
          title: "Вводный урок",
          scheduledAt: "2026-09-01T10:00:00.000Z",
          durationMinutes: 90,
        }),
      });

      const res = await postLesson(req);
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toContain("праздничный день");
    });
  });

  describe("3. Storage Quota & Materials Library", () => {
    let createdMaterialId: string;

    it("creates a new material linked to course and group", async () => {
      const req = new Request("http://localhost/api/materials", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenDirA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Справочник по React Hooks",
          materialType: "LINK",
          externalUrl: "https://react.dev/reference/react",
          courseId: courseAId,
          groupId: groupAId,
          fileSizeBytes: 1024 * 500, // 500KB
        }),
      });

      const res = await postMaterial(req);
      const data = await res.json();
      expect(res.status).toBe(201);
      expect(data.material.title).toBe("Справочник по React Hooks");
      createdMaterialId = data.material.id;
    });

    it("lists materials with storage quota information", async () => {
      const req = new Request("http://localhost/api/materials", {
        headers: { Authorization: `Bearer ${tokenDirA}` },
      });

      const res = await getMaterials(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.materials.length).toBeGreaterThan(0);
      expect(data.quota).toBeDefined();
      expect(data.quota.maxMb).toBeGreaterThan(0);
      expect(data.quota.usedBytes).toBeGreaterThanOrEqual(1024 * 500);
    });

    it("deletes a material", async () => {
      const req = new Request(`http://localhost/api/materials/${createdMaterialId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokenDirA}` },
      });

      const res = await deleteMaterial(req, { params: { id: createdMaterialId } });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);

      const check = await db.material.findUnique({ where: { id: createdMaterialId } });
      expect(check?.deletedAt).not.toBeNull();
    });
  });

  describe("4. Online Tests, Attempts & Auto-Grading", () => {
    let testId: string;
    let question1Id: string;
    let question2Id: string;

    it("creates a test with questions and auto-grade rules", async () => {
      const req = new Request("http://localhost/api/tests", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenDirA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Проверочный тест по TypeScript",
          courseId: courseAId,
          groupId: groupAId,
          timeLimitMinutes: 15,
          passingScorePercent: 75,
          maxAttempts: 3,
          questions: [
            {
              questionText: "Что такое TypeScript?",
              questionType: "SINGLE_CHOICE",
              points: 10,
              options: [
                { text: "Типизированный надмножество JS", isCorrect: true },
                { text: "База данных", isCorrect: false },
              ],
            },
            {
              questionText: "TypeScript компилируется в JavaScript?",
              questionType: "TRUE_FALSE",
              points: 10,
              correctAnswer: "true",
            },
          ],
        }),
      });

      const res = await postTest(req);
      const data = await res.json();
      expect(res.status).toBe(201);
      expect(data.test.title).toBe("Проверочный тест по TypeScript");
      expect(data.test.questions.length).toBe(2);

      testId = data.test.id;
      question1Id = data.test.questions[0].id;
      question2Id = data.test.questions[1].id;
    });

    it("allows student to start a test attempt", async () => {
      const req = new Request("http://localhost/api/tests/start", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenStudentA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ testId }),
      });

      const res = await postTestStart(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.attemptId).toBeDefined();
    });

    it("auto-grades submitted answers and saves Grade entry", async () => {
      const answers: Record<string, unknown> = {
        [question1Id]: "Типизированный надмножество JS", // correct (+10)
        [question2Id]: "true",                           // correct (+10)
      };

      const req = new Request("http://localhost/api/tests/attempt", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenStudentA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          testId,
          studentAnswers: answers,
        }),
      });

      const res = await postTestAttempt(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.passed).toBe(true);
      expect(data.attempt.scorePercent).toBe(100);
      expect(data.attempt.scorePoints).toBe(20);

      // Verify Grade record was created
      const grade = await db.grade.findFirst({
        where: {
          centerId: centerAId,
          studentMembershipId: studentAMembershipId,
          gradeType: "TEST",
        },
      });
      expect(grade).not.toBeNull();
      expect(grade?.value).toBe(100);
    });
  });

  describe("5. Student Performance Transcript & CSV Export", () => {
    it("generates student performance transcript summary", async () => {
      const req = new Request(`http://localhost/api/tenant/students/${studentAMembershipId}/transcript`, {
        headers: { Authorization: `Bearer ${tokenDirA}` },
      });

      const res = await getTranscript(req, { params: { id: studentAMembershipId } });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.student.id).toBe(studentAMembershipId);
      expect(data.summary).toBeDefined();
      expect(data.summary.averageGrade).toBe(100);
      expect(data.summary.completedTestsCount).toBeGreaterThanOrEqual(1);
    });

    it("exports student transcript as CSV attachment", async () => {
      const req = new Request(
        `http://localhost/api/tenant/students/${studentAMembershipId}/transcript?format=csv`,
        { headers: { Authorization: `Bearer ${tokenDirA}` } }
      );

      const res = await getTranscript(req, { params: { id: studentAMembershipId } });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/csv");
      expect(res.headers.get("content-disposition")).toContain("attachment; filename=");

      const csvText = await res.text();
      expect(csvText).toContain("ТАБЕЛЬ УСПЕВАЕМОСТИ");
      expect(csvText).toContain("Проверочный тест по TypeScript");
    });
  });

  describe("6. Cross-Tenant Isolation for Curriculum", () => {
    it("Director B cannot access or modify Director A course", async () => {
      const req = new Request(`http://localhost/api/courses/${courseAId}`, {
        headers: { Authorization: `Bearer ${tokenDirB}` },
      });

      const res = await getCourse(req, { params: { id: courseAId } });
      expect(res.status).toBe(404);
    });

    it("Director B cannot view or take Director A tests", async () => {
      const req = new Request("http://localhost/api/tests", {
        headers: { Authorization: `Bearer ${tokenDirB}` },
      });

      const res = await getTests(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      const hasA = (data.tests || []).some((t: { courseId?: string | null }) => t.courseId === courseAId);
      expect(hasA).toBe(false);
    });
  });
});
