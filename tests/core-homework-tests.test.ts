import { describe, it, expect, beforeAll, vi } from "vitest";
import { db } from "../src/lib/db";
import { signJWT, hashPassword } from "../src/lib/auth";
import { GET as getHomework, POST as createHomework, PATCH as patchHomework } from "../src/app/api/homework/route";
import { POST as startTestAttempt } from "../src/app/api/tests/start/route";
import { POST as submitTestAttempt } from "../src/app/api/tests/attempt/route";

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

const mockRequest = (
  url: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  body?: unknown
) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

describe("CORE-4 Homework Lifecycle & Testing System", () => {
  let centerAId: string;
  let centerBId: string;

  let directorAMembershipId: string;
  let teacherA1MembershipId: string;
  let teacherA2MembershipId: string;

  let studentA1MembershipId: string;
  let studentA2MembershipId: string;

  let groupA1Id: string;
  let groupA2Id: string;
  let lessonA1Id: string;

  let homework1Id: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword("Password123!");
    const now = new Date();
    let plan = await db.subscriptionPlan.findFirst();
    if (!plan) {
      plan = await db.subscriptionPlan.create({
        data: {
          name: "Homework Test Plan",
          maxStudents: 50,
          maxTeachers: 5,
          maxCourses: 5,
          maxBranches: 1,
          priceMonthly: 0,
        },
      });
    }
    const planId = plan.id;

    // Center A
    const dirA = await db.platformUser.create({
      data: {
        email: `hw-dir-a-${Date.now()}@test.com`,
        fullName: "HW Director A",
        passwordHash,
        emailVerified: now,
      },
    });

    const centerA = await db.learningCenter.create({
      data: {
        name: "HW Center A",
        slug: `hw-center-a-${Date.now()}`,
        status: "ACTIVE",
        ownerId: dirA.id,
        subscriptions: {
          create: {
            planId,
            status: "ACTIVE",
            currentPeriodStartsAt: now,
            currentPeriodEndsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
    });
    centerAId = centerA.id;

    const dirAMem = await db.centerMembership.create({
      data: { userId: dirA.id, centerId: centerAId, role: "DIRECTOR", status: "ACTIVE" },
    });
    directorAMembershipId = dirAMem.id;

    // Teachers
    const teachA1User = await db.platformUser.create({
      data: {
        email: `hw-teach-1-${Date.now()}@test.com`,
        fullName: "HW Teacher 1",
        passwordHash,
        emailVerified: now,
      },
    });
    const teachA1Mem = await db.centerMembership.create({
      data: { userId: teachA1User.id, centerId: centerAId, role: "TEACHER", status: "ACTIVE" },
    });
    teacherA1MembershipId = teachA1Mem.id;

    const teachA2User = await db.platformUser.create({
      data: {
        email: `hw-teach-2-${Date.now()}@test.com`,
        fullName: "HW Teacher 2",
        passwordHash,
        emailVerified: now,
      },
    });
    const teachA2Mem = await db.centerMembership.create({
      data: { userId: teachA2User.id, centerId: centerAId, role: "TEACHER", status: "ACTIVE" },
    });
    teacherA2MembershipId = teachA2Mem.id;

    // Students
    const studA1User = await db.platformUser.create({
      data: {
        email: `hw-stud-1-${Date.now()}@test.com`,
        fullName: "HW Student 1",
        passwordHash,
        emailVerified: now,
      },
    });
    const studA1Mem = await db.centerMembership.create({
      data: { userId: studA1User.id, centerId: centerAId, role: "STUDENT", status: "ACTIVE" },
    });
    studentA1MembershipId = studA1Mem.id;

    const studA2User = await db.platformUser.create({
      data: {
        email: `hw-stud-2-${Date.now()}@test.com`,
        fullName: "HW Student 2",
        passwordHash,
        emailVerified: now,
      },
    });
    const studA2Mem = await db.centerMembership.create({
      data: { userId: studA2User.id, centerId: centerAId, role: "STUDENT", status: "ACTIVE" },
    });
    studentA2MembershipId = studA2Mem.id;

    // Course & Groups
    const courseA = await db.course.create({
      data: {
        centerId: centerAId,
        title: "Course HW A",
        createdByMembershipId: directorAMembershipId,
      },
    });

    const moduleA = await db.courseModule.create({
      data: {
        centerId: centerAId,
        courseId: courseA.id,
        title: "Module HW A",
      },
    });

    const groupA1 = await db.group.create({
      data: {
        centerId: centerAId,
        courseId: courseA.id,
        name: "Group HW 1",
        teacherMembershipId: teacherA1MembershipId,
      },
    });
    groupA1Id = groupA1.id;

    const groupA2 = await db.group.create({
      data: {
        centerId: centerAId,
        courseId: courseA.id,
        name: "Group HW 2",
        teacherMembershipId: teacherA2MembershipId,
      },
    });
    groupA2Id = groupA2.id;

    // Enrollments
    await db.enrollment.create({
      data: {
        centerId: centerAId,
        studentMembershipId: studentA1MembershipId,
        groupId: groupA1Id,
        status: "ACTIVE",
      },
    });

    await db.enrollment.create({
      data: {
        centerId: centerAId,
        studentMembershipId: studentA2MembershipId,
        groupId: groupA2Id,
        status: "ACTIVE",
      },
    });

    // Lesson
    const lessonA1 = await db.lesson.create({
      data: {
        centerId: centerAId,
        moduleId: moduleA.id,
        title: "Lesson HW 1",
        scheduledAt: now,
      },
    });
    lessonA1Id = lessonA1.id;

    // Center B for tenant isolation
    const dirB = await db.platformUser.create({
      data: {
        email: `hw-dir-b-${Date.now()}@test.com`,
        fullName: "HW Director B",
        passwordHash,
        emailVerified: now,
      },
    });
    const centerB = await db.learningCenter.create({
      data: {
        name: "HW Center B",
        slug: `hw-center-b-${Date.now()}`,
        status: "ACTIVE",
        ownerId: dirB.id,
        subscriptions: {
          create: {
            planId,
            status: "ACTIVE",
            currentPeriodStartsAt: now,
            currentPeriodEndsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
    });
    centerBId = centerB.id;
    await db.centerMembership.create({
      data: { userId: dirB.id, centerId: centerBId, role: "DIRECTOR", status: "ACTIVE" },
    });
  });

  it("1. Tenant isolation: Center B cannot access or create homework in Center A", async () => {
    const dirBMem = await db.centerMembership.findFirst({
      where: { centerId: centerBId, role: "DIRECTOR" },
      include: { user: true },
    });
    mockToken = signJWT({
      userId: dirBMem!.userId,
      email: dirBMem!.user.email,
      platformRole: "NONE",
      activeCenterId: centerBId,
      activeCenterRole: "DIRECTOR",
    });

    // Attempt to create homework for Center A's lesson
    const resForbiddenCreate = await createHomework(
      mockRequest("/api/homework", "POST", {
        lessonId: lessonA1Id,
        title: "Cross-tenant HW",
      })
    );
    expect([403, 404]).toContain(resForbiddenCreate.status);

    // Attempt to view Center A's lesson homework
    const resForbiddenView = await getHomework(
      mockRequest(`/api/homework?lessonId=${lessonA1Id}`, "GET")
    );
    expect([403, 404]).toContain(resForbiddenView.status);
  });

  it("2. Homework Submission: Student submits text and external links, setting status SUBMITTED", async () => {
    // Teacher A1 creates homework
    const teachA1 = await db.centerMembership.findUnique({
      where: { id: teacherA1MembershipId },
      include: { user: true },
    });
    mockToken = signJWT({
      userId: teachA1!.userId,
      email: teachA1!.user.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "TEACHER",
    });

    const createRes = await createHomework(
      mockRequest("/api/homework", "POST", {
        lessonId: lessonA1Id,
        title: "Homework 1: Algorithm Complexity",
        description: "Solve tasks 1-5 and attach your repository link",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
    );
    expect(createRes.status).toBe(200);
    const createData = await createRes.json();
    homework1Id = createData.homework.id;

    // Student A1 submits homework
    const studA1 = await db.centerMembership.findUnique({
      where: { id: studentA1MembershipId },
      include: { user: true },
    });
    mockToken = signJWT({
      userId: studA1!.userId,
      email: studA1!.user.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "STUDENT",
    });

    const subRes = await patchHomework(
      mockRequest("/api/homework", "PATCH", {
        action: "SUBMIT",
        homeworkId: homework1Id,
        submissionText: "Completed all 5 algorithmic tasks with O(n log n) efficiency.",
        filesJson: {
          links: [{ title: "GitHub Repo", url: "https://github.com/student/algo-hw1" }],
        },
      })
    );
    expect(subRes.status).toBe(200);
    const subData = await subRes.json();
    expect(subData.submission.status).toBe("SUBMITTED");
  });

  it("3. Teacher Grading: Grades submission, leaves feedback, sets status and syncs Grade record", async () => {
    const teachA1 = await db.centerMembership.findUnique({
      where: { id: teacherA1MembershipId },
      include: { user: true },
    });
    mockToken = signJWT({
      userId: teachA1!.userId,
      email: teachA1!.user.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "TEACHER",
    });

    const gradeRes = await patchHomework(
      mockRequest("/api/homework", "PATCH", {
        action: "GRADE",
        homeworkId: homework1Id,
        studentMembershipId: studentA1MembershipId,
        grade: 95,
        status: "ACCEPTED",
        feedback: "Excellent solution, well-optimized memory usage!",
      })
    );
    expect(gradeRes.status).toBe(200);
    const gradeData = await gradeRes.json();
    expect(gradeData.submission.status).toBe("ACCEPTED");
    expect(gradeData.submission.grade).toBe(95);

    // Verify Grade record was synchronized
    const gradeRecord = await db.grade.findFirst({
      where: {
        centerId: centerAId,
        studentMembershipId: studentA1MembershipId,
        gradeType: "HOMEWORK",
      },
    });
    expect(gradeRecord).toBeDefined();
    expect(gradeRecord?.value).toBe(95);
  });

  it("4. Revision Workflow & Resubmission: Teacher returns for revision and student resubmits", async () => {
    const teachA1 = await db.centerMembership.findUnique({
      where: { id: teacherA1MembershipId },
      include: { user: true },
    });
    mockToken = signJWT({
      userId: teachA1!.userId,
      email: teachA1!.user.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "TEACHER",
    });

    // Request revision
    const revRes = await patchHomework(
      mockRequest("/api/homework", "PATCH", {
        action: "GRADE",
        homeworkId: homework1Id,
        studentMembershipId: studentA1MembershipId,
        status: "REVISION_REQUESTED",
        feedback: "Please add unit tests for edge cases.",
      })
    );
    expect(revRes.status).toBe(200);
    const revData = await revRes.json();
    expect(revData.submission.status).toBe("REVISION_REQUESTED");

    // Student resubmits
    const studA1 = await db.centerMembership.findUnique({
      where: { id: studentA1MembershipId },
      include: { user: true },
    });
    mockToken = signJWT({
      userId: studA1!.userId,
      email: studA1!.user.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "STUDENT",
    });

    const reSubRes = await patchHomework(
      mockRequest("/api/homework", "PATCH", {
        action: "SUBMIT",
        homeworkId: homework1Id,
        submissionText: "Added 12 unit tests covering all edge cases.",
      })
    );
    expect(reSubRes.status).toBe(200);
    const reSubData = await reSubRes.json();
    expect(reSubData.submission.status).toBe("SUBMITTED");
  });

  it("5. Teacher Role Scoping: Teacher 2 cannot grade students from Teacher 1's group", async () => {
    const teachA2 = await db.centerMembership.findUnique({
      where: { id: teacherA2MembershipId },
      include: { user: true },
    });
    mockToken = signJWT({
      userId: teachA2!.userId,
      email: teachA2!.user.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "TEACHER",
    });

    const forbiddenGrade = await patchHomework(
      mockRequest("/api/homework", "PATCH", {
        action: "GRADE",
        homeworkId: homework1Id,
        studentMembershipId: studentA1MembershipId,
        grade: 50,
      })
    );
    expect(forbiddenGrade.status).toBe(403);
  });

  let test1Id: string;
  let q1Id: string;
  let q2Id: string;
  let q3Id: string;
  let q4Id: string;

  it("6. Online Testing: Auto-grades SINGLE_CHOICE, MULTIPLE_CHOICE, TRUE_FALSE, TEXT with review breakdown", async () => {
    // Director creates Material and Test with 4 question types
    const material = await db.material.create({
      data: {
        centerId: centerAId,
        title: "Algorithms Final Test",
        materialType: "TEST",
      },
    });

    const testRecord = await db.test.create({
      data: {
        centerId: centerAId,
        materialId: material.id,
        timeLimitMinutes: 10,
        maxAttempts: 2,
        passingScorePercent: 75,
      },
    });
    test1Id = testRecord.id;

    // Q1: SINGLE_CHOICE
    const q1 = await db.testQuestion.create({
      data: {
        centerId: centerAId,
        testId: test1Id,
        questionText: "What is the time complexity of binary search?",
        questionType: "SINGLE_CHOICE",
        optionsJson: JSON.stringify([
          { text: "O(1)", isCorrect: false },
          { text: "O(log n)", isCorrect: true },
          { text: "O(n)", isCorrect: false },
        ]),
        points: 2,
        orderIndex: 1,
      },
    });
    q1Id = q1.id;

    // Q2: MULTIPLE_CHOICE
    const q2 = await db.testQuestion.create({
      data: {
        centerId: centerAId,
        testId: test1Id,
        questionText: "Which of the following are non-linear data structures?",
        questionType: "MULTIPLE_CHOICE",
        optionsJson: JSON.stringify([
          { text: "Tree", isCorrect: true },
          { text: "Graph", isCorrect: true },
          { text: "Array", isCorrect: false },
        ]),
        points: 2,
        orderIndex: 2,
      },
    });
    q2Id = q2.id;

    // Q3: TRUE_FALSE
    const q3 = await db.testQuestion.create({
      data: {
        centerId: centerAId,
        testId: test1Id,
        questionText: "HTTP is a stateful protocol.",
        questionType: "TRUE_FALSE",
        correctAnswer: "false",
        points: 1,
        orderIndex: 3,
      },
    });
    q3Id = q3.id;

    // Q4: TEXT
    const q4 = await db.testQuestion.create({
      data: {
        centerId: centerAId,
        testId: test1Id,
        questionText: "Which protocol secures web traffic?",
        questionType: "TEXT",
        correctAnswer: "https",
        points: 1,
        orderIndex: 4,
      },
    });
    q4Id = q4.id;

    // Student A1 starts attempt
    const studA1 = await db.centerMembership.findUnique({
      where: { id: studentA1MembershipId },
      include: { user: true },
    });
    mockToken = signJWT({
      userId: studA1!.userId,
      email: studA1!.user.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "STUDENT",
    });

    const startRes = await startTestAttempt(
      mockRequest("/api/tests/start", "POST", { testId: test1Id })
    );
    expect(startRes.status).toBe(200);
    const startData = await startRes.json();
    expect(startData.attemptId).toBeDefined();
    expect(startData.timeLimitMinutes).toBe(10);

    // Student A1 submits answers
    const submitRes = await submitTestAttempt(
      mockRequest("/api/tests/attempt", "POST", {
        attemptId: startData.attemptId,
        testId: test1Id,
        studentAnswers: {
          [q1Id]: "O(log n)",
          [q2Id]: ["Tree", "Graph"],
          [q3Id]: "false",
          [q4Id]: "HTTPS ",
        },
      })
    );
    expect(submitRes.status).toBe(200);
    const submitData = await submitRes.json();
    expect(submitData.passed).toBe(true);
    expect(submitData.attempt.scorePoints).toBe(6);
    expect(submitData.attempt.maxPoints).toBe(6);
    expect(submitData.attempt.scorePercent).toBe(100);
    expect(submitData.review).toHaveLength(4);
    expect(submitData.review.every((r: { isCorrect: boolean }) => r.isCorrect)).toBe(true);
  });

  it("7. Attempts Limit: Rejects attempts beyond maxAttempts", async () => {
    const studA1 = await db.centerMembership.findUnique({
      where: { id: studentA1MembershipId },
      include: { user: true },
    });
    mockToken = signJWT({
      userId: studA1!.userId,
      email: studA1!.user.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "STUDENT",
    });

    // Start & submit attempt #2
    const start2Res = await startTestAttempt(
      mockRequest("/api/tests/start", "POST", { testId: test1Id })
    );
    expect(start2Res.status).toBe(200);
    const start2Data = await start2Res.json();

    await submitTestAttempt(
      mockRequest("/api/tests/attempt", "POST", {
        attemptId: start2Data.attemptId,
        testId: test1Id,
        studentAnswers: {},
      })
    );

    // Attempt #3 (should be rejected since maxAttempts = 2)
    const start3Res = await startTestAttempt(
      mockRequest("/api/tests/start", "POST", { testId: test1Id })
    );
    expect(start3Res.status).toBe(400);
    const errData = await start3Res.json();
    expect(errData.error).toMatch(/maximum allowed attempts/i);
  });

  it("8. Server-side Timer: Rejects or penalizes test submission when time limit is exceeded", async () => {
    const studA2 = await db.centerMembership.findUnique({
      where: { id: studentA2MembershipId },
      include: { user: true },
    });
    mockToken = signJWT({
      userId: studA2!.userId,
      email: studA2!.user.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "STUDENT",
    });

    // Student A2 starts attempt
    const startRes = await startTestAttempt(
      mockRequest("/api/tests/start", "POST", { testId: test1Id })
    );
    expect(startRes.status).toBe(200);
    const startData = await startRes.json();

    // Backdate startedAt in DB by 15 minutes (exceeding 10-minute limit)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    await db.testAttempt.update({
      where: { id: startData.attemptId },
      data: { startedAt: fifteenMinutesAgo },
    });

    const submitRes = await submitTestAttempt(
      mockRequest("/api/tests/attempt", "POST", {
        attemptId: startData.attemptId,
        testId: test1Id,
        studentAnswers: {
          [q1Id]: "O(log n)",
        },
      })
    );
    expect([400, 200]).toContain(submitRes.status);
    const submitData = await submitRes.json();
    if (submitRes.status === 400) {
      expect(submitData.error).toMatch(/time limit exceeded/i);
    } else {
      expect(submitData.isTimeExceeded).toBe(true);
    }
  });
});

