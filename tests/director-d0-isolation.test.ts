import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../src/lib/db";
import { signJWT } from "../src/lib/auth";

// Route handlers under test
import { POST as postCourse } from "../src/app/api/courses/route";
import { POST as postGroup } from "../src/app/api/groups/route";
import { POST as postPayment } from "../src/app/api/center-payments/route";
import { DELETE as deleteStaff } from "../src/app/api/tenant/staff/route";
import { GET as getAttendance } from "../src/app/api/attendance/route";
import { GET as getGrades } from "../src/app/api/grades/route";
import { POST as postTransaction } from "../src/app/api/finance/transactions/route";
import { POST as postAccount } from "../src/app/api/finance/accounts/route";
import { PATCH as revokeInvite } from "../src/app/api/invites/[id]/route";
import { POST as generateInvite } from "../src/app/api/invites/generate/route";
import { PATCH as patchLesson } from "../src/app/api/lessons/route";

describe("Stage D0 Item 11: Director Isolation Tests across 10 Core Resources", () => {
  let centerAId: string;
  let centerBId: string;
  let dirAUserId: string;
  let dirBUserId: string;
  let studentAId: string;
  let studentBId: string;
  let teacherAId: string;
  let teacherBId: string;
  let courseAId: string;
  let courseBId: string;
  let groupAId: string;
  let groupBId: string;
  let lessonBId: string;
  let inviteBId: string;
  let accountBId: string;

  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    const ts = Date.now();

    // 1. Create Director A & Director B
    const userA = await db.platformUser.create({
      data: {
        email: `dir_iso_a_${ts}@test.uz`,
        passwordHash: "hashA",
        fullName: "Director Center A",
        emailVerified: new Date(),
      },
    });
    dirAUserId = userA.id;

    const userB = await db.platformUser.create({
      data: {
        email: `dir_iso_b_${ts}@test.uz`,
        passwordHash: "hashB",
        fullName: "Director Center B",
        emailVerified: new Date(),
      },
    });
    dirBUserId = userB.id;

    // 2. Create Subscription Plan & Centers
    const plan = (await db.subscriptionPlan.findFirst()) || (await db.subscriptionPlan.create({
      data: {
        name: "Standard Plan",
        maxStudents: 100,
        maxTeachers: 20,
        maxCourses: 50,
        maxBranches: 5,
        priceMonthly: 500000,
      },
    }));

    const centerA = await db.learningCenter.create({
      data: {
        name: `Center A ${ts}`,
        slug: `iso-a-${ts}`,
        status: "ACTIVE",
        ownerId: dirAUserId,
      },
    });
    centerAId = centerA.id;

    const centerB = await db.learningCenter.create({
      data: {
        name: `Center B ${ts}`,
        slug: `iso-b-${ts}`,
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

    // 3. Memberships
    const memA = await db.centerMembership.create({
      data: {
        centerId: centerAId,
        userId: dirAUserId,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
    });

    const memB = await db.centerMembership.create({
      data: {
        centerId: centerBId,
        userId: dirBUserId,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
    });

    // Teachers
    const teacherUserA = await db.platformUser.create({
      data: { email: `teacherA_${ts}@test.uz`, fullName: "Teacher A", passwordHash: "h" },
    });
    const teacherMemberA = await db.centerMembership.create({
      data: { centerId: centerAId, userId: teacherUserA.id, role: "TEACHER", status: "ACTIVE" },
    });
    teacherAId = teacherMemberA.id;

    const teacherUserB = await db.platformUser.create({
      data: { email: `teacherB_${ts}@test.uz`, fullName: "Teacher B", passwordHash: "h" },
    });
    const teacherMemberB = await db.centerMembership.create({
      data: { centerId: centerBId, userId: teacherUserB.id, role: "TEACHER", status: "ACTIVE" },
    });
    teacherBId = teacherMemberB.id;

    // Students
    const studentUserA = await db.platformUser.create({
      data: { email: `studentA_${ts}@test.uz`, fullName: "Student A", passwordHash: "h" },
    });
    const studentMemberA = await db.centerMembership.create({
      data: { centerId: centerAId, userId: studentUserA.id, role: "STUDENT", status: "ACTIVE" },
    });
    studentAId = studentMemberA.id;

    const studentUserB = await db.platformUser.create({
      data: { email: `studentB_${ts}@test.uz`, fullName: "Student B", passwordHash: "h" },
    });
    const studentMemberB = await db.centerMembership.create({
      data: { centerId: centerBId, userId: studentUserB.id, role: "STUDENT", status: "ACTIVE" },
    });
    studentBId = studentMemberB.id;

    // Courses
    const cA = await db.course.create({
      data: { centerId: centerAId, title: "Course In Center A", createdByMembershipId: memA.id },
    });
    courseAId = cA.id;

    const cB = await db.course.create({
      data: { centerId: centerBId, title: "Course In Center B", createdByMembershipId: memB.id },
    });
    courseBId = cB.id;

    // Groups
    const gA = await db.group.create({
      data: {
        centerId: centerAId,
        courseId: courseAId,
        teacherMembershipId: teacherAId,
        name: "Group A",
      },
    });
    groupAId = gA.id;

    const gB = await db.group.create({
      data: {
        centerId: centerBId,
        courseId: courseBId,
        teacherMembershipId: teacherBId,
        name: "Group B",
      },
    });
    groupBId = gB.id;

    // Lesson in Center B
    const moduleB = await db.courseModule.create({
      data: { centerId: centerBId, courseId: courseBId, title: "Module B", orderIndex: 1 },
    });
    const lessonB = await db.lesson.create({
      data: { centerId: centerBId, moduleId: moduleB.id, title: "Lesson In B", orderIndex: 1 },
    });
    lessonBId = lessonB.id;

    // Invite in Center B
    const invB = await db.inviteCode.create({
      data: {
        centerId: centerBId,
        createdByMembershipId: teacherMemberB.id,
        targetRole: "STUDENT",
        code: `INV_B_${ts}`,
      },
    });
    inviteBId = invB.id;

    // JWT Tokens
    tokenA = await signJWT({
      userId: dirAUserId,
      email: userA.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "DIRECTOR",
    });

    tokenB = await signJWT({
      userId: dirBUserId,
      email: userB.email,
      platformRole: "NONE",
      activeCenterId: centerBId,
      activeCenterRole: "DIRECTOR",
    });

    // Create Account in Center B via API
    const accBRes = await postAccount(
      new Request("http://localhost:3000/api/finance/accounts", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenB}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Bank Center B", type: "BANK" }),
      })
    );
    accountBId = (await accBRes.json()).account.id;
  });

  afterAll(async () => {
    await db.financeTransaction.deleteMany({ where: { centerId: { in: [centerAId, centerBId] } } });
    await db.account.deleteMany({ where: { centerId: { in: [centerAId, centerBId] } } });
    await db.inviteCode.deleteMany({ where: { centerId: { in: [centerAId, centerBId] } } });
    await db.lesson.deleteMany({ where: { centerId: { in: [centerAId, centerBId] } } });
    await db.courseModule.deleteMany({ where: { centerId: { in: [centerAId, centerBId] } } });
    await db.group.deleteMany({ where: { centerId: { in: [centerAId, centerBId] } } });
    await db.course.deleteMany({ where: { centerId: { in: [centerAId, centerBId] } } });
    await db.centerMembership.deleteMany({ where: { centerId: { in: [centerAId, centerBId] } } });
    await db.subscription.deleteMany({ where: { centerId: { in: [centerAId, centerBId] } } });
    await db.learningCenter.deleteMany({ where: { id: { in: [centerAId, centerBId] } } });
    await db.platformUser.deleteMany({ where: { id: { in: [dirAUserId, dirBUserId] } } });
  });

  // 1. COURSES: centerId in body is ignored, belongs strictly to caller's center
  it("1. Courses: POST ignores spoofed centerId and assigns to caller center A", async () => {
    const req = new Request("http://localhost/api/courses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `auth_token=${tokenA}`,
      },
      body: JSON.stringify({
        title: "Injected Course",
        centerId: centerBId, // spoofed!
      }),
    });

    const res = await postCourse(req);
    expect([200, 201]).toContain(res.status);
    const data = await res.json();
    expect(data.course.centerId).toBe(centerAId);
    expect(data.course.centerId).not.toBe(centerBId);
  });

  // 2. GROUPS: director A cannot create group referencing Center B's course
  it("2. Groups: POST fails when director A references Center B course", async () => {
    const req = new Request("http://localhost/api/groups", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `auth_token=${tokenA}`,
      },
      body: JSON.stringify({
        name: "Exploit Group",
        courseId: courseBId, // Course belongs to Center B!
        teacherMembershipId: teacherAId,
        centerId: centerBId, // spoofed!
      }),
    });

    const res = await postGroup(req);
    expect([400, 404]).toContain(res.status);
  });

  // 3. STUDENTS / STAFF: Director A cannot delete staff or student from Center B
  it("3. Staff: DELETE returns 404 when Director A targets member of Center B", async () => {
    const req = new Request(`http://localhost/api/tenant/staff?membershipId=${studentBId}`, {
      method: "DELETE",
      headers: { cookie: `auth_token=${tokenA}` },
    });

    const res = await deleteStaff(req);
    expect(res.status).toBe(404);
  });

  // 4. PAYMENTS: Director A cannot record payment for student in Center B
  it("4. Payments: POST fails with 404/400 when student belongs to Center B", async () => {
    const req = new Request("http://localhost/api/center-payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `auth_token=${tokenA}`,
      },
      body: JSON.stringify({
        studentMembershipId: studentBId, // belongs to Center B!
        amount: 500000,
        paymentMethod: "CASH",
        centerId: centerBId, // spoofed!
      }),
    });

    const res = await postPayment(req);
    expect([400, 404]).toContain(res.status);
  });

  // 5. ATTENDANCE: Director A cannot read attendance for lesson in Center B
  it("5. Attendance: GET returns 404 when lesson belongs to Center B", async () => {
    const req = new Request(`http://localhost/api/attendance?lessonId=${lessonBId}`, {
      method: "GET",
      headers: { cookie: `auth_token=${tokenA}` },
    });

    const res = await getAttendance(req);
    expect(res.status).toBe(404);
  });

  // 6. GRADES: Director A cannot read grades for group in Center B
  it("6. Grades: GET returns 404 when querying groupId from Center B", async () => {
    const req = new Request(`http://localhost/api/grades?groupId=${groupBId}`, {
      method: "GET",
      headers: { cookie: `auth_token=${tokenA}` },
    });

    const res = await getGrades(req);
    expect(res.status).toBe(404);
  });

  // 7. FINANCE: Director A cannot record transaction on Center B's account
  it("7. Finance: POST transaction fails when account belongs to Center B", async () => {
    const req = new Request("http://localhost/api/finance/transactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `auth_token=${tokenA}`,
      },
      body: JSON.stringify({
        accountId: accountBId, // belongs to Center B!
        amount: 250000,
        type: "INCOME",
        direction: "INCOME",
        description: "Spoofed transaction",
        centerId: centerBId, // spoofed!
      }),
    });

    const res = await postTransaction(req);
    expect([400, 404]).toContain(res.status);
  });

  // 8. INVITES: Director A cannot revoke invite code from Center B
  it("8. Invites: PATCH returns 404 when revoking invite code of Center B", async () => {
    const req = new Request(`http://localhost/api/invites/${inviteBId}`, {
      method: "PATCH",
      headers: { cookie: `auth_token=${tokenA}` },
    });

    const res = await revokeInvite(req, { params: { id: inviteBId } });
    expect(res.status).toBe(404);
  });

  // 9. SCHEDULE / LESSONS: Director A cannot modify lesson from Center B
  it("9. Lessons: PATCH returns 404 when Director A tries to edit lesson from Center B", async () => {
    const req = new Request("http://localhost/api/lessons", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: `auth_token=${tokenA}`,
      },
      body: JSON.stringify({
        lessonId: lessonBId, // belongs to Center B!
        title: "Malicious Edit",
      }),
    });

    const res = await patchLesson(req);
    expect(res.status).toBe(404);
  });

  // 10. INVITE GENERATION: POST ignores spoofed centerId in request body
  it("10. Invites Generate: POST ignores spoofed centerId and creates invite in Center A", async () => {
    const req = new Request("http://localhost/api/invites/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `auth_token=${tokenA}`,
      },
      body: JSON.stringify({
        role: "STUDENT",
        centerId: centerBId, // spoofed!
      }),
    });

    const res = await generateInvite(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.invite.centerId).toBe(centerAId);
    expect(data.invite.centerId).not.toBe(centerBId);
  });
});
