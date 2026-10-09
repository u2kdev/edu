import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "../src/lib/db";
import { signJWT } from "../src/lib/auth";
import { GET as getAttendance, POST as postAttendance } from "../src/app/api/attendance/route";
import { GET as getHomework } from "../src/app/api/homework/route";
import { GET as getGrades, PATCH as patchGrades } from "../src/app/api/grades/route";
import { GET as getCourses, POST as postCourses } from "../src/app/api/courses/route";
import { GET as getGroups } from "../src/app/api/groups/route";
import { GET as getSchedule } from "../src/app/api/tenant/schedule/route";

// Mock next/headers
let mockToken: string = "";
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => {
      if (name === "auth_token") return { value: mockToken };
      return undefined;
    },
  }),
}));

describe("Phase C & E: IDOR / Privilege Escalation Tests", () => {
  let tenantA: string;
  let tenantB: string;

  // Users in A
  let directorA: string;
  let teacherA: string;
  let studentA: string;
  let teacherAMemId: string;
  let studentAMemId: string;

  // Users in B
  let directorB: string;
  let studentB: string;
  let studentBMemId: string;

  // Shared resources
  let courseA: string;
  let moduleA: string;
  let lessonA: string;
  let groupA: string;

  let courseB: string;
  let moduleB: string;
  let lessonB: string;
  let groupB: string;

  beforeAll(async () => {
    // 1. Create Tenants & Users
    const uDirA = await db.platformUser.create({ data: { email: `dira-${Date.now()}@test.com`, passwordHash: "x", fullName: "Dir A" } });
    const cA = await db.learningCenter.create({ data: { name: "Center A", slug: `center-a-${Date.now()}`, ownerId: uDirA.id, status: "ACTIVE" } });
    tenantA = cA.id;
    directorA = uDirA.id;
    const mDirA = await db.centerMembership.create({ data: { userId: uDirA.id, centerId: tenantA, role: "DIRECTOR" } });

    const uDirB = await db.platformUser.create({ data: { email: `dirb-${Date.now()}@test.com`, passwordHash: "x", fullName: "Dir B" } });
    const cB = await db.learningCenter.create({ data: { name: "Center B", slug: `center-b-${Date.now()}`, ownerId: uDirB.id, status: "ACTIVE" } });
    tenantB = cB.id;
    directorB = uDirB.id;
    const mDirB = await db.centerMembership.create({ data: { userId: uDirB.id, centerId: tenantB, role: "DIRECTOR" } });

    // 2. Create roles for A
    const uTeachA = await db.platformUser.create({ data: { email: `teacha-${Date.now()}@test.com`, passwordHash: "x", fullName: "Teacher A" } });
    const mTeachA = await db.centerMembership.create({ data: { userId: uTeachA.id, centerId: tenantA, role: "TEACHER" } });
    teacherA = uTeachA.id;
    teacherAMemId = mTeachA.id;

    const uStudA = await db.platformUser.create({ data: { email: `studa-${Date.now()}@test.com`, passwordHash: "x", fullName: "Student A" } });
    const mStudA = await db.centerMembership.create({ data: { userId: uStudA.id, centerId: tenantA, role: "STUDENT" } });
    studentA = uStudA.id;
    studentAMemId = mStudA.id;

    // 3. Create roles for B
    const uStudB = await db.platformUser.create({ data: { email: `studb-${Date.now()}@test.com`, passwordHash: "x", fullName: "Student B" } });
    const mStudB = await db.centerMembership.create({ data: { userId: uStudB.id, centerId: tenantB, role: "STUDENT" } });
    studentB = uStudB.id;
    studentBMemId = mStudB.id;

    // 4. Create resources in A
    const course = await db.course.create({ data: { centerId: tenantA, title: "Course A", createdByMembershipId: mDirA.id } });
    courseA = course.id;
    const mod = await db.courseModule.create({ data: { centerId: tenantA, courseId: courseA, title: "Module A", orderIndex: 1 } });
    moduleA = mod.id;
    const lesson = await db.lesson.create({ data: { centerId: tenantA, moduleId: moduleA, title: "Lesson A", orderIndex: 1 } });
    lessonA = lesson.id;

    const group = await db.group.create({ data: { centerId: tenantA, courseId: courseA, name: "Group A", teacherMembershipId: teacherAMemId } });
    groupA = group.id;

    await db.enrollment.create({ data: { centerId: tenantA, studentMembershipId: studentAMemId, groupId: groupA } });

    // 5. Create some grades & attendance
    await db.attendance.create({ data: { lessonId: lessonA, studentMembershipId: studentAMemId, status: "PRESENT", markedByMembershipId: teacherAMemId } });
    await db.grade.create({ data: { centerId: tenantA, studentMembershipId: studentAMemId, groupId: groupA, teacherMembershipId: teacherAMemId, gradeType: "HOMEWORK", value: 90, maxValue: 100 } });

    // 6. Create resources in B
    const courseObjB = await db.course.create({ data: { centerId: tenantB, title: "Course B", createdByMembershipId: mDirB.id } });
    courseB = courseObjB.id;
    const modObjB = await db.courseModule.create({ data: { centerId: tenantB, courseId: courseB, title: "Module B", orderIndex: 1 } });
    moduleB = modObjB.id;
    const lessonObjB = await db.lesson.create({ data: { centerId: tenantB, moduleId: moduleB, title: "Lesson B", orderIndex: 1 } });
    lessonB = lessonObjB.id;
    const groupObjB = await db.group.create({ data: { centerId: tenantB, courseId: courseB, name: "Group B", teacherMembershipId: mDirB.id } });
    groupB = groupObjB.id;
  });

  afterAll(async () => {
    // Cleanup
    await db.learningCenter.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
    await db.platformUser.deleteMany({ where: { id: { in: [directorA, directorB, teacherA, studentA, studentB] } } });
  });

  const setAuth = (userId: string, centerId: string, role: string) => {
    mockToken = signJWT({ userId, email: "test@test.com", platformRole: "NONE", activeCenterId: centerId, activeCenterRole: role });
  };

  const mockRequest = (url: string) => {
    return new Request(`http://localhost${url}`);
  };

  it("CRITICAL: Tenant A user tries to read Tenant B student (IDOR)", async () => {
    // User A acts as Director of Center B (forging the activeCenterId cookie)
    setAuth(directorA, tenantB, "DIRECTOR"); // But DirectorA is NOT in tenantB's memberships!

    // They try to read lessonB which belongs to Tenant B
    const req = mockRequest(`/api/attendance?lessonId=${lessonB}`);
    const res = await getAttendance(req);
    // Since getAuthSession falls back to tenantA for directorA, lessonB is not found in tenantA!
    expect(res.status).toBe(404); // Or 403, depending on how attendance handles missing lessons in tenant scope
  });

  it("CRITICAL: Student tries to access another student's grades (IDOR)", async () => {
    setAuth(studentA, tenantA, "STUDENT");
    // Attempt to fetch grades, API scopes it to current user automatically.
    // If student passes another student's ID, API should reject it or ignore it.
    const req = mockRequest(`/api/grades?studentMembershipId=${studentBMemId}`);
    const res = await getGrades(req);
    
    // For grades GET with studentId, it either returns 404/403 or silently ignores and scopes to self
    // Let's check response
    if (res.status === 200) {
      const data = (await res.json()) as { grades: { studentMembershipId: string }[] };
      // If it succeeds, it MUST ONLY contain grades for Student A, not B
      expect(data.grades.every((g: { studentMembershipId: string }) => g.studentMembershipId === studentAMemId)).toBe(true);
    } else {
      expect(res.status).toBe(404); // "Student not found" or "Forbidden"
    }
  });

  it("CRITICAL: Student B (Tenant B) tries to read Tenant A lesson attendance (Tenant Escape)", async () => {
    setAuth(studentB, tenantB, "STUDENT");
    const req = mockRequest(`/api/attendance?lessonId=${lessonA}`);
    const res = await getAttendance(req);
    // Should fail because lessonA belongs to Tenant A
    expect(res.status).toBe(404); // "Lesson not found or access denied"
  });

  it("CRITICAL: Privilege Escalation - Teacher A tries to act as DIRECTOR in cookie", async () => {
    // Teacher sets their activeCenterRole to DIRECTOR maliciously in JWT
    setAuth(teacherA, tenantA, "DIRECTOR");
    // requireTenantAccess() fetches the real DB role and overrides the cookie
    // So the endpoint will evaluate them as TEACHER.
    
    // Let's try to fetch all grades globally (only DIRECTOR can do this without scoping)
    const req = mockRequest(`/api/grades`);
    const res = await getGrades(req);
    const data = (await res.json()) as { grades: { teacherMembershipId: string }[] };
    
    // Since they are evaluated as TEACHER, the query is scoped to their groups
    // If the privilege escalation succeeded, they would see all grades.
    expect(res.status).toBe(200);
    expect(data.grades.every((g: { teacherMembershipId: string }) => g.teacherMembershipId === teacherAMemId)).toBe(true);
  });

  it("CRITICAL: Tenant A user tries to read Tenant B courses", async () => {
    setAuth(directorA, tenantA, "DIRECTOR");
    const req = mockRequest(`/api/courses?id=${courseB}`);
    const res = await getCourses(req);
    const data = (await res.json()) as { courses: { id: string }[] };
    expect(res.status).toBe(200);
    expect(data.courses.some((c: { id: string }) => c.id === courseB)).toBe(false);
  });

  it("CRITICAL: Tenant A user tries to read Tenant B groups", async () => {
    setAuth(directorA, tenantA, "DIRECTOR");
    const req = mockRequest(`/api/groups`);
    const res = await getGroups(req);
    const data = (await res.json()) as { groups: { id: string }[] };
    // Should not include group B
    expect(data.groups.some((g: { id: string }) => g.id === groupB)).toBe(false);
  });

  it("CRITICAL: Tenant A user tries to read Tenant B homework", async () => {
    setAuth(studentA, tenantA, "STUDENT");
    const req = mockRequest(`/api/homework?lessonId=${lessonB}`);
    const res = await getHomework(req);
    expect(res.status).toBe(404);
  });

  it("CRITICAL: Tenant A user tries to read Tenant B schedule", async () => {
    setAuth(directorA, tenantA, "DIRECTOR");
    const req = mockRequest(`/api/tenant/schedule?groupId=${groupB}`);
    const res = await getSchedule(req);
    expect(res.status).toBe(404);
  });

  // Mutating IDOR Tests
  it("CRITICAL: Tenant A user tries to mark attendance for Tenant B lesson (Mutation IDOR)", async () => {
    setAuth(teacherA, tenantA, "TEACHER");
    const req = new Request(`http://localhost/api/attendance`, {
      method: "POST",
      body: JSON.stringify({ lessonId: lessonB, records: [{ studentMembershipId: studentBMemId, status: "PRESENT" }] })
    });
    const res = await postAttendance(req);
    expect(res.status).toBe(404);
  });

  it("CRITICAL: Tenant A user tries to modify Tenant B grade (Mutation IDOR)", async () => {
    // We need to create a grade in B first
    const dirBMem = await db.centerMembership.findFirst({ where: { userId: directorB } });
    const gradeObjB = await db.grade.create({ data: { centerId: tenantB, studentMembershipId: studentBMemId, groupId: groupB, teacherMembershipId: dirBMem!.id, gradeType: "HOMEWORK", value: 50, maxValue: 100 } });
    
    setAuth(directorA, tenantA, "DIRECTOR");
    const req = new Request(`http://localhost/api/grades`, {
      method: "PATCH",
      body: JSON.stringify({ id: gradeObjB.id, value: 100 })
    });
    const res = await patchGrades(req);
    expect(res.status).toBe(404);

    // Verify DB wasn't changed
    const check = await db.grade.findUnique({ where: { id: gradeObjB.id } });
    expect(check?.value).toBe(50);
  });
});
