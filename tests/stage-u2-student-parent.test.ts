import { describe, it, expect, vi, beforeAll } from "vitest";
import { db } from "../src/lib/db";
import { getTenantDb } from "../src/lib/db-tenant";
import { GET as getMyBalanceHandler } from "../src/app/api/my/balance/route";
import {
  GET as getMaterialsHandler,
  POST as postMaterialHandler,
} from "../src/app/api/materials/route";
import { GET as getMaterialByIdHandler } from "../src/app/api/materials/[id]/route";
import { GET as downloadMaterialHandler } from "../src/app/api/materials/[id]/download/route";
import { POST as uploadHandler } from "../src/app/api/upload/route";
import {
  GET as getHomeworkHandler,
  PATCH as patchHomeworkHandler,
} from "../src/app/api/homework/route";
import {
  GET as getTestsHandler,
  POST as postTestsHandler,
} from "../src/app/api/tests/route";
import {
  GET as getTestByIdHandler,
  POST as submitTestAttemptHandler,
} from "../src/app/api/tests/[id]/route";
import { POST as postAttendanceHandler } from "../src/app/api/attendance/route";
import { POST as postBulkAttendanceHandler } from "../src/app/api/attendance/bulk/route";
import {
  GET as getNotificationPrefsHandler,
  PATCH as patchNotificationPrefsHandler,
} from "../src/app/api/account/notification-preferences/route";
import {
  GET as getProfileHandler,
  PATCH as patchProfileHandler,
} from "../src/app/api/account/profile/route";
import {
  GET as getTicketsHandler,
  POST as postTicketHandler,
} from "../src/app/api/tickets/route";
import type {
  LearningCenter,
  PlatformUser,
  CenterMembership,
  Group,
  Course,
  Lesson,
} from "@prisma/client";

interface MockTenantContext {
  center: LearningCenter;
  role: string;
  membership: CenterMembership;
  session: {
    user: PlatformUser;
    activeCenterId?: string;
    activeCenterRole?: string;
  };
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
        getTenantDb:
          mockContext.getTenantDb ||
          (() => getTenantDb(mockContext!.center.id)),
      };
    }),
  };
});

describe("Stage U2: Student & Parent (Balance, Materials, Homework Files, Tests, Idempotent Attendance Notifications, Notification Prefs, Profile)", () => {
  const suffix = Date.now().toString();

  let center1: LearningCenter;
  let center2: LearningCenter;

  let directorUser: PlatformUser;
  let teacherUser: PlatformUser;
  let student1User: PlatformUser;
  let student2User: PlatformUser;
  let studentUnconfirmedUser: PlatformUser;
  let parentUser: PlatformUser;
  let foreignUser: PlatformUser;

  let directorMem: CenterMembership;
  let teacherMem: CenterMembership;
  let student1Mem: CenterMembership;
  let student2Mem: CenterMembership;
  let studentUnconfirmedMem: CenterMembership;
  let parentMem: CenterMembership;
  let foreignStudentMem: CenterMembership;

  let courseA: Course;
  let courseB: Course;
  let groupA: Group;
  let groupB: Group;
  let lessonA1: Lesson;
  let lessonB1: Lesson;

  let materialGroupAId: string;
  let materialCourseAId: string;
  let materialGroupBId: string;
  let materialForeignCenterId: string;

  let homeworkAId: string;
  let homeworkBId: string;

  let testAId: string;
  let testAQuestion1Id: string;
  let testAQuestion2Id: string;
  let testBId: string;

  function setActor(
    center: LearningCenter,
    user: PlatformUser,
    membership: CenterMembership
  ) {
    mockContext = {
      center,
      role: membership.role,
      membership,
      session: {
        user,
        activeCenterId: center.id,
        activeCenterRole: membership.role,
      },
      isPlatformStaff: false,
      isImpersonating: false,
      isReadOnly: false,
      getTenantDb: () => getTenantDb(center.id),
    };
  }

  beforeAll(async () => {
    directorUser = await db.platformUser.create({
      data: {
        email: `u2-dir-${suffix}@test.local`,
        passwordHash: "hash",
        fullName: "U2 Director",
        phone: "+998901112201",
      },
    });
    teacherUser = await db.platformUser.create({
      data: {
        email: `u2-t1-${suffix}@test.local`,
        passwordHash: "hash",
        fullName: "U2 Teacher",
        phone: "+998901112202",
      },
    });
    student1User = await db.platformUser.create({
      data: {
        email: `u2-s1-${suffix}@test.local`,
        passwordHash: "hash",
        fullName: "U2 Student 1 (Confirmed Child)",
        phone: "+998901112203",
      },
    });
    student2User = await db.platformUser.create({
      data: {
        email: `u2-s2-${suffix}@test.local`,
        passwordHash: "hash",
        fullName: "U2 Student 2 (Other Group)",
        phone: "+998901112204",
      },
    });
    studentUnconfirmedUser = await db.platformUser.create({
      data: {
        email: `u2-s3-${suffix}@test.local`,
        passwordHash: "hash",
        fullName: "U2 Student 3 (Pending Child)",
        phone: "+998901112205",
      },
    });
    parentUser = await db.platformUser.create({
      data: {
        email: `u2-p1-${suffix}@test.local`,
        passwordHash: "hash",
        fullName: "U2 Parent",
        phone: "+998901112206",
      },
    });
    foreignUser = await db.platformUser.create({
      data: {
        email: `u2-for-${suffix}@test.local`,
        passwordHash: "hash",
        fullName: "U2 Foreign Student",
        phone: "+998901112207",
      },
    });

    center1 = await db.learningCenter.create({
      data: {
        name: `U2 Center 1 ${suffix}`,
        slug: `u2-c1-${suffix}`,
        status: "ACTIVE",
        ownerId: directorUser.id,
        smsEnabled: true,
        smsDailyLimit: 1,
      },
    });

    center2 = await db.learningCenter.create({
      data: {
        name: `U2 Center 2 ${suffix}`,
        slug: `u2-c2-${suffix}`,
        status: "ACTIVE",
        ownerId: foreignUser.id,
      },
    });

    directorMem = await db.centerMembership.create({
      data: {
        userId: directorUser.id,
        centerId: center1.id,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
    });
    teacherMem = await db.centerMembership.create({
      data: {
        userId: teacherUser.id,
        centerId: center1.id,
        role: "TEACHER",
        status: "ACTIVE",
      },
    });
    student1Mem = await db.centerMembership.create({
      data: {
        userId: student1User.id,
        centerId: center1.id,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });
    student2Mem = await db.centerMembership.create({
      data: {
        userId: student2User.id,
        centerId: center1.id,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });
    studentUnconfirmedMem = await db.centerMembership.create({
      data: {
        userId: studentUnconfirmedUser.id,
        centerId: center1.id,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });
    parentMem = await db.centerMembership.create({
      data: {
        userId: parentUser.id,
        centerId: center1.id,
        role: "PARENT",
        status: "ACTIVE",
      },
    });
    foreignStudentMem = await db.centerMembership.create({
      data: {
        userId: foreignUser.id,
        centerId: center2.id,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });

    // Parent links: student1 is CONFIRMED, studentUnconfirmed is PENDING
    await db.parentLink.create({
      data: {
        parentMembershipId: parentMem.id,
        studentMembershipId: student1Mem.id,
        status: "CONFIRMED",
        initiatedBy: "ADMIN",
      },
    });
    await db.parentLink.create({
      data: {
        parentMembershipId: parentMem.id,
        studentMembershipId: studentUnconfirmedMem.id,
        status: "PENDING",
        initiatedBy: "PARENT",
      },
    });

    // Courses & Groups
    courseA = await db.course.create({
      data: {
        centerId: center1.id,
        title: "Course A (Math)",
        priceMonthly: 600000,
        createdByMembershipId: directorMem.id,
      },
    });
    courseB = await db.course.create({
      data: {
        centerId: center1.id,
        title: "Course B (Physics)",
        priceMonthly: 700000,
        createdByMembershipId: directorMem.id,
      },
    });

    groupA = await db.group.create({
      data: {
        centerId: center1.id,
        courseId: courseA.id,
        name: "Group A",
        teacherMembershipId: teacherMem.id,
      },
    });
    groupB = await db.group.create({
      data: {
        centerId: center1.id,
        courseId: courseB.id,
        name: "Group B",
        teacherMembershipId: teacherMem.id,
      },
    });

    // Enroll student1 in Group A, student2 in Group B
    await db.enrollment.create({
      data: {
        centerId: center1.id,
        groupId: groupA.id,
        studentMembershipId: student1Mem.id,
        status: "ACTIVE",
      },
    });
    await db.enrollment.create({
      data: {
        centerId: center1.id,
        groupId: groupB.id,
        studentMembershipId: student2Mem.id,
        status: "ACTIVE",
      },
    });

    // Modules & Lessons
    const modA = await db.courseModule.create({
      data: {
        centerId: center1.id,
        courseId: courseA.id,
        title: "Mod A",
        orderIndex: 1,
      },
    });
    const modB = await db.courseModule.create({
      data: {
        centerId: center1.id,
        courseId: courseB.id,
        title: "Mod B",
        orderIndex: 1,
      },
    });

    lessonA1 = await db.lesson.create({
      data: {
        centerId: center1.id,
        moduleId: modA.id,
        title: "Lesson A1",
        orderIndex: 1,
        scheduledAt: new Date(),
      },
    });
    lessonB1 = await db.lesson.create({
      data: {
        centerId: center1.id,
        moduleId: modB.id,
        title: "Lesson B1",
        orderIndex: 1,
        scheduledAt: new Date(),
      },
    });

    // Payments for student1: 250,000 PAID out of 600,000 monthly tuition -> 350,000 debt
    await db.centerPayment.create({
      data: {
        centerId: center1.id,
        studentMembershipId: student1Mem.id,
        groupId: groupA.id,
        amount: 250000,
        originalAmount: 250000,
        currency: "UZS",
        status: "PAID",
        paymentMethod: "CASH",
        paidAt: new Date(),
      },
    });

    // Materials: Group A, Course A, Group B, and Foreign Center 2
    const matA = await db.material.create({
      data: {
        centerId: center1.id,
        courseId: courseA.id,
        groupId: groupA.id,
        title: "Material for Group A",
        materialType: "LECTURE",
        fileUrl: "https://example.com/group-a.pdf",
      },
    });
    materialGroupAId = matA.id;

    const matCourseA = await db.material.create({
      data: {
        centerId: center1.id,
        courseId: courseA.id,
        groupId: null,
        title: "Material for Entire Course A",
        materialType: "BOOK",
        fileUrl: "https://example.com/course-a.pdf",
      },
    });
    materialCourseAId = matCourseA.id;

    const matB = await db.material.create({
      data: {
        centerId: center1.id,
        courseId: courseB.id,
        groupId: groupB.id,
        title: "Secret Material for Group B",
        materialType: "LECTURE",
        fileUrl: "https://example.com/group-b.pdf",
      },
    });
    materialGroupBId = matB.id;

    const matForeign = await db.material.create({
      data: {
        centerId: center2.id,
        title: "Foreign Center Material",
        materialType: "LECTURE",
        fileUrl: "https://example.com/foreign.pdf",
      },
    });
    materialForeignCenterId = matForeign.id;

    // Homeworks for Lesson A1 and Lesson B1
    const hwA = await db.homework.create({
      data: {
        centerId: center1.id,
        lessonId: lessonA1.id,
        title: "Homework A1",
        description: "Solve equations",
      },
    });
    homeworkAId = hwA.id;

    const hwB = await db.homework.create({
      data: {
        centerId: center1.id,
        lessonId: lessonB1.id,
        title: "Homework B1",
        description: "Physics lab",
      },
    });
    homeworkBId = hwB.id;
  });

  // =========================================================================
  // 1. БАЛАНС УЧЕНИКА (/api/my/balance)
  // =========================================================================
  describe("1. Student & Parent Balance (/api/my/balance)", () => {
    it("allows STUDENT to view own balance, debt, next payment, and receipts without finance.read", async () => {
      setActor(center1, student1User, student1Mem);
      const req = new Request("http://localhost:3000/api/my/balance");
      const res = await getMyBalanceHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.role).toBe("STUDENT");
      expect(data.balance).toBeDefined();
      expect(data.balance.studentMembershipId).toBe(student1Mem.id);
      expect(data.balance.monthlyTuition).toBe(600000);
      expect(data.balance.totalPaid).toBe(250000);
      expect(data.balance.debtAmount).toBe(350000);
      expect(data.balance.nextPayment).not.toBeNull();
      expect(data.balance.payments.length).toBeGreaterThanOrEqual(1);
      expect(data.balance.payments[0].receiptNumber).toMatch(/^INV-/);
    });

    it("rejects STUDENT trying to view another student's balance with 403", async () => {
      setActor(center1, student1User, student1Mem);
      const req = new Request(
        `http://localhost:3000/api/my/balance?childId=${student2Mem.id}`
      );
      const res = await getMyBalanceHandler(req);
      expect(res.status).toBe(403);
    });

    it("allows PARENT to view confirmed child's balance and rejects unconfirmed/foreign child with 403", async () => {
      setActor(center1, parentUser, parentMem);
      const reqOk = new Request(
        `http://localhost:3000/api/my/balance?childId=${student1Mem.id}`
      );
      const resOk = await getMyBalanceHandler(reqOk);
      expect(resOk.status).toBe(200);
      const dataOk = await resOk.json();
      expect(dataOk.students).toHaveLength(1);
      expect(dataOk.students[0].studentMembershipId).toBe(student1Mem.id);
      expect(dataOk.students[0].debtAmount).toBe(350000);

      // Unconfirmed child (PENDING link) -> 403
      const reqPending = new Request(
        `http://localhost:3000/api/my/balance?childId=${studentUnconfirmedMem.id}`
      );
      const resPending = await getMyBalanceHandler(reqPending);
      expect(resPending.status).toBe(403);

      // Unlinked student -> 403
      const reqForeign = new Request(
        `http://localhost:3000/api/my/balance?childId=${student2Mem.id}`
      );
      const resForeign = await getMyBalanceHandler(reqForeign);
      expect(resForeign.status).toBe(403);
    });

    it("rejects TEACHER from accessing /api/my/balance with 403", async () => {
      setActor(center1, teacherUser, teacherMem);
      const req = new Request("http://localhost:3000/api/my/balance");
      const res = await getMyBalanceHandler(req);
      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // 2. МАТЕРИАЛЫ (/api/materials, /api/materials/[id], /api/materials/[id]/download)
  // =========================================================================
  describe("2. Materials Access Control & Download Verification", () => {
    it("shows STUDENT only materials of their active groups and courses", async () => {
      setActor(center1, student1User, student1Mem);
      const req = new Request("http://localhost:3000/api/materials");
      const res = await getMaterialsHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      const ids = data.materials.map((m: { id: string }) => m.id);

      expect(ids).toContain(materialGroupAId);
      expect(ids).toContain(materialCourseAId);
      expect(ids).not.toContain(materialGroupBId);
      expect(ids).not.toContain(materialForeignCenterId);
    });

    it("shows PARENT only materials of confirmed children's groups and courses", async () => {
      setActor(center1, parentUser, parentMem);
      const req = new Request("http://localhost:3000/api/materials");
      const res = await getMaterialsHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      const ids = data.materials.map((m: { id: string }) => m.id);

      expect(ids).toContain(materialGroupAId);
      expect(ids).toContain(materialCourseAId);
      expect(ids).not.toContain(materialGroupBId);
    });

    it("enforces server-side access on GET /api/materials/[id] and /download", async () => {
      setActor(center1, student1User, student1Mem);

      // Allowed material
      const resAllowed = await getMaterialByIdHandler(
        new Request(`http://localhost:3000/api/materials/${materialGroupAId}`),
        { params: { id: materialGroupAId } }
      );
      expect(resAllowed.status).toBe(200);

      const resDownloadAllowed = await downloadMaterialHandler(
        new Request(
          `http://localhost:3000/api/materials/${materialGroupAId}/download?format=json`
        ),
        { params: { id: materialGroupAId } }
      );
      expect(resDownloadAllowed.status).toBe(200);

      // Forbidden material (Group B)
      const resForbidden = await getMaterialByIdHandler(
        new Request(`http://localhost:3000/api/materials/${materialGroupBId}`),
        { params: { id: materialGroupBId } }
      );
      expect(resForbidden.status).toBe(403);

      const resDownloadForbidden = await downloadMaterialHandler(
        new Request(
          `http://localhost:3000/api/materials/${materialGroupBId}/download?format=json`
        ),
        { params: { id: materialGroupBId } }
      );
      expect(resDownloadForbidden.status).toBe(403);

      // Foreign center material -> 404
      const resForeign = await getMaterialByIdHandler(
        new Request(
          `http://localhost:3000/api/materials/${materialForeignCenterId}`
        ),
        { params: { id: materialForeignCenterId } }
      );
      expect(resForeign.status).toBe(404);
    });
  });

  // =========================================================================
  // 3. ДЗ С ФАЙЛАМИ (/api/upload & /api/homework)
  // =========================================================================
  describe("3. Homework Submissions with File Attachments", () => {
    it("allows STUDENT to upload homework files and rejects dangerous extensions or MATERIAL category", async () => {
      setActor(center1, student1User, student1Mem);

      // 1. Valid PDF upload for HOMEWORK
      const validForm = new FormData();
      validForm.append(
        "file",
        new File([Buffer.from("%PDF-1.4 sample homework")], "solution.pdf", {
          type: "application/pdf",
        })
      );
      validForm.append("category", "HOMEWORK");

      const resOk = await uploadHandler(
        new Request("http://localhost:3000/api/upload", {
          method: "POST",
          body: validForm,
        })
      );
      expect(resOk.status).toBe(200);
      const uploadData = await resOk.json();
      expect(uploadData.fileUrl).toContain("/uploads/");

      // 2. Dangerous .exe file -> 400
      const badForm = new FormData();
      badForm.append(
        "file",
        new File([Buffer.from("MZ")], "malware.exe", {
          type: "application/octet-stream",
        })
      );
      badForm.append("category", "HOMEWORK");

      const resBad = await uploadHandler(
        new Request("http://localhost:3000/api/upload", {
          method: "POST",
          body: badForm,
        })
      );
      expect(resBad.status).toBe(400);

      // 3. Student trying to upload category=MATERIAL -> 403
      const matForm = new FormData();
      matForm.append(
        "file",
        new File([Buffer.from("pdf")], "lecture.pdf", {
          type: "application/pdf",
        })
      );
      matForm.append("category", "MATERIAL");

      const resMat = await uploadHandler(
        new Request("http://localhost:3000/api/upload", {
          method: "POST",
          body: matForm,
        })
      );
      expect(resMat.status).toBe(403);
    });

    it("supports attaching & replacing files before acceptance, and blocks replacement after ACCEPTED", async () => {
      setActor(center1, student1User, student1Mem);

      // Initial submit with 1 attachment
      const sub1Res = await patchHomeworkHandler(
        new Request("http://localhost:3000/api/homework", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "SUBMIT",
            homeworkId: homeworkAId,
            submissionText: "Initial draft v1",
            attachments: [
              {
                fileUrl: "/uploads/c1/homework/draft1.pdf",
                fileName: "draft1.pdf",
                sizeBytes: 1024,
              },
            ],
          }),
        })
      );
      expect(sub1Res.status).toBe(200);

      // Replace attachments before acceptance -> allowed
      const sub2Res = await patchHomeworkHandler(
        new Request("http://localhost:3000/api/homework", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "SUBMIT",
            homeworkId: homeworkAId,
            submissionText: "Updated solution v2",
            attachments: [
              {
                fileUrl: "/uploads/c1/homework/final1.pdf",
                fileName: "final1.pdf",
                sizeBytes: 2048,
              },
              {
                fileUrl: "/uploads/c1/homework/photo.jpg",
                fileName: "photo.jpg",
                sizeBytes: 4096,
              },
            ],
          }),
        })
      );
      expect(sub2Res.status).toBe(200);
      const sub2Data = await sub2Res.json();
      const parsedFiles = JSON.parse(sub2Data.submission.filesJson);
      expect(parsedFiles).toHaveLength(2);

      // Teacher sees attachments and accepts the homework
      setActor(center1, teacherUser, teacherMem);
      const gradeRes = await patchHomeworkHandler(
        new Request("http://localhost:3000/api/homework", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "GRADE",
            homeworkId: homeworkAId,
            studentMembershipId: student1Mem.id,
            status: "ACCEPTED",
            grade: 95,
            feedback: "Great work!",
          }),
        })
      );
      expect(gradeRes.status).toBe(200);

      // Student attempts to replace after ACCEPTED -> 400
      setActor(center1, student1User, student1Mem);
      const subAfterAccepted = await patchHomeworkHandler(
        new Request("http://localhost:3000/api/homework", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "SUBMIT",
            homeworkId: homeworkAId,
            submissionText: "Trying to overwrite accepted work",
          }),
        })
      );
      expect(subAfterAccepted.status).toBe(400);
    });

    it("rejects STUDENT submitting homework for a course they are not enrolled in (403) and isolates submissions", async () => {
      setActor(center1, student1User, student1Mem);
      const resForeignHw = await patchHomeworkHandler(
        new Request("http://localhost:3000/api/homework", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "SUBMIT",
            homeworkId: homeworkBId,
            submissionText: "Not my group",
          }),
        })
      );
      expect(resForeignHw.status).toBe(403);

      // Parent sees only confirmed child's homework and submission
      setActor(center1, parentUser, parentMem);
      const parentHwRes = await getHomeworkHandler(
        new Request("http://localhost:3000/api/homework")
      );
      expect(parentHwRes.status).toBe(200);
      const parentHwData = await parentHwRes.json();
      const hwIds = parentHwData.homeworks.map((h: { id: string }) => h.id);
      expect(hwIds).toContain(homeworkAId);
      expect(hwIds).not.toContain(homeworkBId);
    });
  });

  // =========================================================================
  // 4. ТЕСТЫ (/api/tests, /api/tests/[id])
  // =========================================================================
  describe("4. Tests: Answer Stripping, Mistake Review, MaxAttempts, and Parent View", () => {
    beforeAll(async () => {
      setActor(center1, teacherUser, teacherMem);
      const createRes = await postTestsHandler(
        new Request("http://localhost:3000/api/tests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Algebra Quiz A",
            courseId: courseA.id,
            groupId: groupA.id,
            maxAttempts: 1,
            passingScorePercent: 50,
            questions: [
              {
                questionText: "2 + 2 = ?",
                questionType: "SINGLE_CHOICE",
                points: 5,
                options: [
                  { id: "opt1", text: "4", isCorrect: true },
                  { id: "opt2", text: "5", isCorrect: false },
                ],
              },
              {
                questionText: "3 * 3 = ?",
                questionType: "TEXT",
                points: 5,
                correctAnswer: "9",
              },
            ],
          }),
        })
      );
      const createData = await createRes.json();
      testAId = createData.testId;
      testAQuestion1Id = createData.test.questions[0].id;
      testAQuestion2Id = createData.test.questions[1].id;

      // Also create a test in Group B
      const createResB = await postTestsHandler(
        new Request("http://localhost:3000/api/tests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Physics Quiz B",
            courseId: courseB.id,
            groupId: groupB.id,
            maxAttempts: 2,
            passingScorePercent: 60,
            questions: [
              {
                questionText: "F = m * ?",
                questionType: "TEXT",
                points: 10,
                correctAnswer: "a",
              },
            ],
          }),
        })
      );
      const createDataB = await createResB.json();
      testBId = createDataB.testId;
    });

    it("hides correctAnswer and isCorrect from STUDENT before completion, and blocks foreign group tests", async () => {
      setActor(center1, student1User, student1Mem);
      const resList = await getTestsHandler(
        new Request("http://localhost:3000/api/tests")
      );
      expect(resList.status).toBe(200);
      const listData = await resList.json();
      const testIds = listData.tests.map((t: { id: string }) => t.id);
      expect(testIds).toContain(testAId);
      expect(testIds).not.toContain(testBId);

      const quizA = listData.tests.find((t: { id: string }) => t.id === testAId);
      expect(quizA.questions[0].correctAnswer).toBeUndefined();
      expect(quizA.questions[1].correctAnswer).toBeUndefined();
      const opts = JSON.parse(quizA.questions[0].optionsJson);
      expect(opts[0].isCorrect).toBeUndefined();

      // Foreign group test -> 403
      const resForeignTest = await getTestByIdHandler(
        new Request(`http://localhost:3000/api/tests/${testBId}`),
        { params: { id: testBId } }
      );
      expect(resForeignTest.status).toBe(403);
    });

    it("returns mistake review after completion and enforces maxAttempts limit", async () => {
      setActor(center1, student1User, student1Mem);

      // Submit 1st attempt: Q1 correct ("opt1"), Q2 wrong ("8")
      const subRes = await submitTestAttemptHandler(
        new Request(`http://localhost:3000/api/tests/${testAId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answers: {
              [testAQuestion1Id]: "opt1",
              [testAQuestion2Id]: "8",
            },
          }),
        }),
        { params: { id: testAId } }
      );
      expect(subRes.status).toBe(200);
      const subData = await subRes.json();
      expect(subData.attempt.scorePoints).toBe(5);
      expect(subData.attempt.maxPoints).toBe(10);
      expect(subData.attempt.scorePercent).toBe(50);
      expect(subData.attempt.review).toHaveLength(2);
      expect(subData.attempt.review[0].isCorrect).toBe(true);
      expect(subData.attempt.review[1].isCorrect).toBe(false);
      expect(subData.attempt.review[1].correctAnswer).toBe("9");

      // 2nd attempt when maxAttempts = 1 -> 400
      const subRes2 = await submitTestAttemptHandler(
        new Request(`http://localhost:3000/api/tests/${testAId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answers: {
              [testAQuestion1Id]: "opt1",
              [testAQuestion2Id]: "9",
            },
          }),
        }),
        { params: { id: testAId } }
      );
      expect(subRes2.status).toBe(400);
    });

    it("allows PARENT to view confirmed child's test attempts & review, and blocks PARENT from taking test", async () => {
      setActor(center1, parentUser, parentMem);
      const resGet = await getTestByIdHandler(
        new Request(`http://localhost:3000/api/tests/${testAId}`),
        { params: { id: testAId } }
      );
      expect(resGet.status).toBe(200);
      const data = await resGet.json();
      expect(data.test.attempts).toHaveLength(1);
      expect(data.test.attempts[0].studentMembershipId).toBe(student1Mem.id);
      expect(data.test.attempts[0].review).toHaveLength(2);

      // Parent cannot submit attempt -> 403
      const resAttempt = await submitTestAttemptHandler(
        new Request(`http://localhost:3000/api/tests/${testAId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: {} }),
        }),
        { params: { id: testAId } }
      );
      expect(resAttempt.status).toBe(403);
    });
  });

  // =========================================================================
  // 5. УВЕДОМЛЕНИЯ ОБ ОТСУТСТВИИ (Идемпотентность + SMS лимит)
  // =========================================================================
  describe("5. Idempotent Attendance Notifications & Center SMS Daily Limit", () => {
    it("creates strictly ONE notification per (lesson, student, parent) and updates it on re-marking", async () => {
      setActor(center1, teacherUser, teacherMem);

      // 1st mark: ABSENT via POST /api/attendance
      const res1 = await postAttendanceHandler(
        new Request("http://localhost:3000/api/attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lessonId: lessonA1.id,
            records: [
              {
                studentMembershipId: student1Mem.id,
                groupId: groupA.id,
                status: "ABSENT",
                note: "Missed class",
              },
            ],
          }),
        })
      );
      expect(res1.status).toBe(200);

      const dedupeKey = `attendance:${lessonA1.id}:${student1Mem.id}:${parentUser.id}`;
      const notifsAfter1 = await db.notification.findMany({
        where: { dedupeKey },
      });
      expect(notifsAfter1).toHaveLength(1);
      expect(notifsAfter1[0].type).toBe("ATTENDANCE_ABSENT");

      // 2nd mark on same lesson: LATE via POST /api/attendance -> updates existing, NO duplicate!
      const res2 = await postAttendanceHandler(
        new Request("http://localhost:3000/api/attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lessonId: lessonA1.id,
            records: [
              {
                studentMembershipId: student1Mem.id,
                groupId: groupA.id,
                status: "LATE",
                note: "Arrived 15m late",
              },
            ],
          }),
        })
      );
      expect(res2.status).toBe(200);

      const notifsAfter2 = await db.notification.findMany({
        where: { dedupeKey },
      });
      expect(notifsAfter2).toHaveLength(1);
      expect(notifsAfter2[0].id).toBe(notifsAfter1[0].id);
      expect(notifsAfter2[0].type).toBe("ATTENDANCE_LATE");

      // 3rd mark on same lesson via POST /api/attendance/bulk -> still strictly 1 notification!
      const res3 = await postBulkAttendanceHandler(
        new Request("http://localhost:3000/api/attendance/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lessonId: lessonA1.id,
            groupId: groupA.id,
            studentStatusMap: {
              [student1Mem.id]: "ABSENT",
            },
          }),
        })
      );
      expect(res3.status).toBe(200);

      const notifsAfter3 = await db.notification.findMany({
        where: { dedupeKey },
      });
      expect(notifsAfter3).toHaveLength(1);
      expect(notifsAfter3[0].type).toBe("ATTENDANCE_ABSENT");

      // Respects center smsDailyLimit = 1 (even after multiple status changes, SMS sent count <= 1)
      const smsLogs = await db.auditLog.count({
        where: {
          centerId: center1.id,
          action: "SMS_ATTENDANCE_SENT",
        },
      });
      expect(smsLogs).toBeLessThanOrEqual(1);
    });
  });

  // =========================================================================
  // 6. НАСТРОЙКИ УВЕДОМЛЕНИЙ (/api/account/notification-preferences)
  // =========================================================================
  describe("6. User & Center Notification Preferences", () => {
    it("allows PARENT/STUDENT to update own channel preferences, and blocks them from changing center SMS settings", async () => {
      setActor(center1, parentUser, parentMem);

      const resPatch = await patchNotificationPrefsHandler(
        new Request(
          "http://localhost:3000/api/account/notification-preferences",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              preferences: {
                attendance: ["IN_APP", "SMS"],
                grades: ["IN_APP"],
                homework: ["IN_APP", "PUSH"],
                payments: ["IN_APP", "EMAIL"],
                announcements: ["IN_APP"],
              },
            }),
          }
        )
      );
      expect(resPatch.status).toBe(200);
      const data = await resPatch.json();
      expect(data.preferences.attendance).toEqual(["IN_APP", "SMS"]);
      expect(data.preferences.grades).toEqual(["IN_APP"]);

      // Parent attempting to change center smsDailyLimit -> 403
      const resForbidden = await patchNotificationPrefsHandler(
        new Request(
          "http://localhost:3000/api/account/notification-preferences",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              smsEnabled: false,
              smsDailyLimit: 500,
            }),
          }
        )
      );
      expect(resForbidden.status).toBe(403);

      // Director can update center smsEnabled & smsDailyLimit
      setActor(center1, directorUser, directorMem);
      const resDir = await patchNotificationPrefsHandler(
        new Request(
          "http://localhost:3000/api/account/notification-preferences",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              smsEnabled: true,
              smsDailyLimit: 250,
            }),
          }
        )
      );
      expect(resDir.status).toBe(200);
      const dirData = await resDir.json();
      expect(dirData.centerSettings.smsDailyLimit).toBe(250);
    });
  });

  // =========================================================================
  // 7 & 8. ПРОФИЛЬ И ОБРАЩЕНИЯ РОДИТЕЛЯ (/api/account/profile, /api/tickets)
  // =========================================================================
  describe("7 & 8. Profile Restrictions (fullName admin-only) & Parent Support Tickets", () => {
    it("allows STUDENT and PARENT to update avatar, language, and phone, but rejects changing fullName with 403", async () => {
      setActor(center1, student1User, student1Mem);

      // Update avatarUrl, language, phone -> 200
      const resOk = await patchProfileHandler(
        new Request("http://localhost:3000/api/account/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            avatarUrl: "/uploads/c1/avatar/student1.png",
            preferredLanguage: "uz-Latn",
            phone: "998909998877",
          }),
        })
      );
      expect(resOk.status).toBe(200);
      const okData = await resOk.json();
      expect(okData.profile.avatarUrl).toBe("/uploads/c1/avatar/student1.png");
      expect(okData.profile.preferredLanguage).toBe("uz-Latn");
      expect(okData.profile.phone).toBe("+998909998877");
      expect(okData.profile.canEditFullName).toBe(false);

      // Student attempting to change fullName -> 403
      const resNameChange = await patchProfileHandler(
        new Request("http://localhost:3000/api/account/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: "Hacked Student Name",
          }),
        })
      );
      expect(resNameChange.status).toBe(403);

      // Parent attempting to change fullName -> 403
      setActor(center1, parentUser, parentMem);
      const resParentNameChange = await patchProfileHandler(
        new Request("http://localhost:3000/api/account/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: "Hacked Parent Name",
          }),
        })
      );
      expect(resParentNameChange.status).toBe(403);

      // Director CAN change fullName -> 200
      setActor(center1, directorUser, directorMem);
      const resDirName = await patchProfileHandler(
        new Request("http://localhost:3000/api/account/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: "U2 Director Updated",
          }),
        })
      );
      expect(resDirName.status).toBe(200);
    });

    it("allows PARENT to create support ticket in center and see only own tickets", async () => {
      setActor(center1, parentUser, parentMem);
      const createTicketRes = await postTicketHandler(
        new Request("http://localhost:3000/api/tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: "Вопрос по расписанию ребёнка",
            message: "Можно ли перенести занятие в четверг?",
            priority: "MEDIUM",
          }),
        })
      );
      expect(createTicketRes.status).toBe(200);

      const listRes = await getTicketsHandler(
        new Request("http://localhost:3000/api/tickets")
      );
      expect(listRes.status).toBe(200);
      const listData = await listRes.json();
      expect(listData.tickets.length).toBeGreaterThanOrEqual(1);
      expect(
        listData.tickets.every(
          (t: { creatorUserId: string }) =>
            t.creatorUserId === parentUser.id
        )
      ).toBe(true);
    });
  });
});
