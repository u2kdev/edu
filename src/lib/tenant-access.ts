import { requireTenantAccess, TenantAccessError } from "./tenant";
import { hasPermission, Permission, CenterRole } from "./permissions";
import { Prisma } from "@prisma/client";

export { TenantAccessError } from "./tenant";

export type TenantContext = Awaited<ReturnType<typeof requireTenantAccess>> & {
  isImpersonating?: boolean;
};

export function isActorImpersonating(ctx: TenantContext): boolean {
  return Boolean(ctx.isImpersonating || ctx.session?.impersonatorUserId);
}

/**
 * Enforces that the current tenant actor has a specific CenterPermission.
 * During impersonation, RBAC is NOT bypassed: the impersonated role's permissions apply.
 */
export function requireCenterPermission(
  ctx: TenantContext,
  permission: Permission
): void {
  if (ctx.isPlatformStaff && !isActorImpersonating(ctx)) {
    return;
  }

  const role = ctx.role;
  const platformRole = isActorImpersonating(ctx) ? "NONE" : ctx.session.user.platformRole;

  if (!hasPermission(permission, platformRole, role)) {
    throw new TenantAccessError(
      `Forbidden: Required permission '${permission}' not granted for role '${role}'`,
      "FORBIDDEN",
      403
    );
  }
}

export type GroupAccessMode = "read" | "write" | "attendance" | "grade" | "review";

/**
 * Asserts that the actor in TenantContext has permission to access the specified groupId
 * under the requested mode ("read", "write", "attendance", "grade", "review").
 * Throws TenantAccessError(403) or (404) if access is denied.
 */
export async function assertGroupAccess(
  ctx: TenantContext,
  groupId: string,
  mode: GroupAccessMode = "read"
): Promise<{
  id: string;
  name: string;
  courseId: string;
  teacherMembershipId: string | null;
  assistantMembershipId: string | null;
}> {
  if (!groupId) {
    throw new TenantAccessError("Group ID is required", "BAD_REQUEST", 400);
  }

  const tenantDb = ctx.getTenantDb();
  const group = await tenantDb.group.findFirst({
    where: {
      id: groupId,
      ...(ctx.center?.id ? { centerId: ctx.center.id } : {}),
    },
    select: {
      id: true,
      name: true,
      courseId: true,
      teacherMembershipId: true,
      assistantMembershipId: true,
    },
  });

  if (!group) {
    throw new TenantAccessError("Group not found in this center", "GROUP_NOT_FOUND", 404);
  }

  // Superadmins, Platform staff (when not impersonating a scoped role), Director, and Center Admin have full access
  if (
    (ctx.isPlatformStaff && !isActorImpersonating(ctx)) ||
    ctx.role === "DIRECTOR" ||
    ctx.role === "CENTER_ADMIN"
  ) {
    return group;
  }

  const membershipId = ctx.membership?.id;
  if (!membershipId) {
    throw new TenantAccessError("Active center membership required", "FORBIDDEN", 403);
  }

  // Accountant: read-only access for financial auditing
  if (ctx.role === "ACCOUNTANT") {
    if (mode === "read") return group;
    throw new TenantAccessError("Accountants only have read access to groups", "FORBIDDEN", 403);
  }

  // Teacher: must be assigned as the main teacher of the group
  if (ctx.role === "TEACHER") {
    if (group.teacherMembershipId === membershipId) {
      return group;
    }
    throw new TenantAccessError(
      "Forbidden: You are not assigned to this group",
      "FORBIDDEN_NOT_GROUP_TEACHER",
      403
    );
  }

  // Teacher Assistant: must be assigned as the assistant of the group
  if (ctx.role === "TEACHER_ASSISTANT") {
    if (group.assistantMembershipId !== membershipId) {
      throw new TenantAccessError(
        "Forbidden: You are not assigned as assistant to this group",
        "FORBIDDEN_NOT_GROUP_ASSISTANT",
        403
      );
    }

    // Assistants can read, mark attendance, and review assignments, but NOT grade or write/edit groups
    if (mode === "grade" || mode === "write") {
      throw new TenantAccessError(
        "Forbidden: Assistants cannot modify group configuration or finalize grades",
        "FORBIDDEN_ASSISTANT_RESTRICTED",
        403
      );
    }

    return group;
  }

  // Student: can only read their enrolled groups
  if (ctx.role === "STUDENT") {
    if (mode !== "read") {
      throw new TenantAccessError("Students only have read access to groups", "FORBIDDEN", 403);
    }

    const enrollment = await tenantDb.enrollment.findFirst({
      where: {
        groupId,
        studentMembershipId: membershipId,
        status: "ACTIVE",
      },
    });

    if (!enrollment) {
      throw new TenantAccessError(
        "Forbidden: You are not actively enrolled in this group",
        "FORBIDDEN_NOT_ENROLLED",
        403
      );
    }

    return group;
  }

  // Parent: can only read groups where their confirmed children are enrolled
  if (ctx.role === "PARENT") {
    if (mode !== "read") {
      throw new TenantAccessError("Parents only have read access to groups", "FORBIDDEN", 403);
    }

    const parentLinks = await tenantDb.parentLink.findMany({
      where: {
        parentMembershipId: membershipId,
        status: "CONFIRMED",
      },
      select: { studentMembershipId: true },
    });

    const childIds = parentLinks.map((l: { studentMembershipId: string }) => l.studentMembershipId);
    if (childIds.length === 0) {
      throw new TenantAccessError("Forbidden: No confirmed children linked", "FORBIDDEN", 403);
    }

    const childEnrollment = await tenantDb.enrollment.findFirst({
      where: {
        groupId,
        studentMembershipId: { in: childIds },
        status: "ACTIVE",
      },
    });

    if (!childEnrollment) {
      throw new TenantAccessError(
        "Forbidden: None of your children are enrolled in this group",
        "FORBIDDEN_CHILD_NOT_ENROLLED",
        403
      );
    }

    return group;
  }

  throw new TenantAccessError("Forbidden: Unsupported role for group access", "FORBIDDEN", 403);
}

/**
 * Builds Prisma Prisma.GroupWhereInput scoped to actor's role.
 */
export async function getScopedGroupWhere(
  ctx: TenantContext
): Promise<Prisma.GroupWhereInput> {
  const centerId = ctx.center?.id || (ctx as { centerId?: string }).centerId;
  const baseWhere: Prisma.GroupWhereInput = {
    ...(centerId ? { centerId } : {}),
  };

  if (
    (ctx.isPlatformStaff && !isActorImpersonating(ctx)) ||
    ctx.role === "DIRECTOR" ||
    ctx.role === "CENTER_ADMIN" ||
    ctx.role === "ACCOUNTANT"
  ) {
    return baseWhere;
  }

  const membershipId = ctx.membership?.id;
  if (!membershipId) {
    return { ...baseWhere, id: "00000000-0000-0000-0000-000000000000" };
  }

  if (ctx.role === "TEACHER") {
    return {
      ...baseWhere,
      teacherMembershipId: membershipId,
    };
  }

  if (ctx.role === "TEACHER_ASSISTANT") {
    return {
      ...baseWhere,
      assistantMembershipId: membershipId,
    };
  }

  if (ctx.role === "STUDENT") {
    return {
      ...baseWhere,
      enrollments: {
        some: {
          studentMembershipId: membershipId,
          status: "ACTIVE",
        },
      },
    };
  }

  if (ctx.role === "PARENT") {
    const tenantDb = ctx.getTenantDb();
    const parentLinks = await tenantDb.parentLink.findMany({
      where: {
        parentMembershipId: membershipId,
        status: "CONFIRMED",
      },
      select: { studentMembershipId: true },
    });

    const childStudentIds = parentLinks.map((l: { studentMembershipId: string }) => l.studentMembershipId);
    if (childStudentIds.length === 0) {
      return { ...baseWhere, id: "00000000-0000-0000-0000-000000000000" };
    }

    return {
      ...baseWhere,
      enrollments: {
        some: {
          studentMembershipId: { in: childStudentIds },
          status: "ACTIVE",
        },
      },
    };
  }

  return { ...baseWhere, id: "00000000-0000-0000-0000-000000000000" };
}

export interface GroupDTOInput {
  id: string;
  name: string;
  courseId: string;
  course?: { id: string; title: string } | null;
  teacher?: { id: string; user?: { fullName: string; email?: string | null } | null } | null;
  assistant?: { id: string; user?: { fullName: string; email?: string | null } | null } | null;
  maxStudents?: number | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  createdAt?: Date | string;
  enrollments?: Array<{
    id: string;
    status: string;
    enrolledAt?: Date | string;
    student?: {
      id: string;
      status?: string;
      user?: {
        id?: string;
        fullName?: string;
        email?: string | null;
        phone?: string | null;
      } | null;
    } | null;
  }>;
  [key: string]: unknown;
}

/**
 * Serializes Group object according to the caller's role (DTO).
 * Rules:
 * - DIRECTOR, CENTER_ADMIN, ACCOUNTANT, TEACHER, TEACHER_ASSISTANT get student list for their groups.
 * - Contacts (phone, email) are only provided to DIRECTOR, CENTER_ADMIN, ACCOUNTANT, and TEACHER of their own groups.
 * - STUDENT and PARENT only receive teacher full name and group meta; enrollments roster with contacts is NEVER returned.
 */
export function serializeGroupDTO(
  group: GroupDTOInput,
  role: CenterRole | string,
  isStaffOrOwner: boolean
) {
  const isPrivileged =
    isStaffOrOwner ||
    role === "DIRECTOR" ||
    role === "CENTER_ADMIN" ||
    role === "ACCOUNTANT" ||
    role === "TEACHER";

  const isAssistant = role === "TEACHER_ASSISTANT";
  const isStudentOrParent = role === "STUDENT" || role === "PARENT";

  const serialized: Record<string, unknown> = {
    id: group.id,
    name: group.name,
    courseId: group.courseId,
    course: group.course
      ? {
          id: group.course.id,
          title: group.course.title,
        }
      : null,
    teacher: group.teacher?.user
      ? {
          id: group.teacher.id,
          user: {
            fullName: group.teacher.user.fullName,
            // Only staff and teachers see teacher email
            email: isPrivileged ? group.teacher.user.email : undefined,
          },
        }
      : null,
    assistant: group.assistant?.user
      ? {
          id: group.assistant.id,
          user: {
            fullName: group.assistant.user.fullName,
            email: isPrivileged ? group.assistant.user.email : undefined,
          },
        }
      : null,
    maxStudents: group.maxStudents,
    startDate: group.startDate,
    endDate: group.endDate,
    createdAt: group.createdAt,
  };

  // Student and Parent: Do NOT expose student enrollments list or contacts of other students!
  if (isStudentOrParent) {
    serialized.enrollments = [];
    serialized.studentsCount = Array.isArray(group.enrollments) ? group.enrollments.length : 0;
    return serialized;
  }

  // Teacher / Assistant / Staff: serialize enrollments
  if (Array.isArray(group.enrollments)) {
    serialized.enrollments = group.enrollments.map((en) => ({
      id: en.id,
      status: en.status,
      enrolledAt: en.enrolledAt,
      student: en.student
        ? {
            id: en.student.id,
            status: en.student.status,
            user: {
              id: en.student.user?.id,
              fullName: en.student.user?.fullName,
              // Phone and email only for staff, accountant and teacher
              email: isPrivileged || isAssistant ? en.student.user?.email : undefined,
              phone: isPrivileged || isAssistant ? en.student.user?.phone : undefined,
            },
          }
        : null,
    }));
  }

  return serialized;
}

export interface ActorAcademicScope {
  isUnrestricted: boolean;
  groupIds: string[];
  courseIds: string[];
  studentMembershipIds: string[];
}

/**
 * Returns the active groupIds, courseIds, and studentMembershipIds accessible to the current actor.
 * - STUDENT: active enrollments of the student
 * - PARENT: active enrollments of CONFIRMED children
 * - TEACHER / TEACHER_ASSISTANT: assigned groups and their courses
 * - DIRECTOR / CENTER_ADMIN / ACCOUNTANT / Platform Staff: isUnrestricted = true
 */
export async function getActorAcademicScope(
  ctx: TenantContext
): Promise<ActorAcademicScope> {
  if (
    (ctx.isPlatformStaff && !isActorImpersonating(ctx)) ||
    ctx.role === "DIRECTOR" ||
    ctx.role === "CENTER_ADMIN"
  ) {
    return {
      isUnrestricted: true,
      groupIds: [],
      courseIds: [],
      studentMembershipIds: [],
    };
  }

  const membershipId = ctx.membership?.id;
  if (!membershipId) {
    return {
      isUnrestricted: false,
      groupIds: [],
      courseIds: [],
      studentMembershipIds: [],
    };
  }

  const tenantDb = ctx.getTenantDb();

  if (ctx.role === "TEACHER" || ctx.role === "TEACHER_ASSISTANT") {
    const groups = await tenantDb.group.findMany({
      where: {
        centerId: ctx.center.id,
        ...(ctx.role === "TEACHER"
          ? { teacherMembershipId: membershipId }
          : { assistantMembershipId: membershipId }),
      },
      select: { id: true, courseId: true },
    });
    const groupIds = groups.map((g: { id: string }) => g.id);
    const courseIds = Array.from(
      new Set(groups.map((g: { courseId: string }) => g.courseId).filter(Boolean))
    ) as string[];
    return {
      isUnrestricted: false,
      groupIds,
      courseIds,
      studentMembershipIds: [],
    };
  }

  if (ctx.role === "STUDENT") {
    const enrollments = await tenantDb.enrollment.findMany({
      where: {
        centerId: ctx.center.id,
        studentMembershipId: membershipId,
        status: "ACTIVE",
      },
      include: {
        group: {
          select: { id: true, courseId: true },
        },
      },
    });
    const groupIds = enrollments.map((e: { groupId: string }) => e.groupId);
    const courseIds = Array.from(
      new Set(
        enrollments
          .map((e: { group?: { courseId: string } | null }) => e.group?.courseId)
          .filter(Boolean)
      )
    ) as string[];
    return {
      isUnrestricted: false,
      groupIds,
      courseIds,
      studentMembershipIds: [membershipId],
    };
  }

  if (ctx.role === "PARENT") {
    const parentLinks = await tenantDb.parentLink.findMany({
      where: {
        parentMembershipId: membershipId,
        status: "CONFIRMED",
      },
      select: { studentMembershipId: true },
    });
    const childIds = parentLinks.map((l: { studentMembershipId: string }) => l.studentMembershipId);
    if (childIds.length === 0) {
      return {
        isUnrestricted: false,
        groupIds: [],
        courseIds: [],
        studentMembershipIds: [],
      };
    }

    const enrollments = await tenantDb.enrollment.findMany({
      where: {
        centerId: ctx.center.id,
        studentMembershipId: { in: childIds },
        status: "ACTIVE",
      },
      include: {
        group: {
          select: { id: true, courseId: true },
        },
      },
    });
    const groupIds = Array.from(
      new Set(enrollments.map((e: { groupId: string }) => e.groupId))
    ) as string[];
    const courseIds = Array.from(
      new Set(
        enrollments
          .map((e: { group?: { courseId: string } | null }) => e.group?.courseId)
          .filter(Boolean)
      )
    ) as string[];
    return {
      isUnrestricted: false,
      groupIds,
      courseIds,
      studentMembershipIds: childIds,
    };
  }

  return {
    isUnrestricted: false,
    groupIds: [],
    courseIds: [],
    studentMembershipIds: [],
  };
}

/**
 * Builds Prisma.MaterialWhereInput scoped to the actor's role and active groups/courses.
 */
export async function getScopedMaterialWhere(
  ctx: TenantContext
): Promise<Prisma.MaterialWhereInput> {
  const scope = await getActorAcademicScope(ctx);
  if (scope.isUnrestricted) {
    return { centerId: ctx.center.id, deletedAt: null };
  }

  const orConditions: Prisma.MaterialWhereInput[] = [];
  if (scope.groupIds.length > 0) {
    orConditions.push({ groupId: { in: scope.groupIds } });
  }
  if (scope.courseIds.length > 0) {
    orConditions.push({ groupId: null, courseId: { in: scope.courseIds } });
  }
  if (ctx.role === "TEACHER" || ctx.role === "TEACHER_ASSISTANT") {
    orConditions.push({ groupId: null, courseId: null });
  }

  if (orConditions.length === 0) {
    return {
      centerId: ctx.center.id,
      deletedAt: null,
      id: "00000000-0000-0000-0000-000000000000",
    };
  }

  return {
    centerId: ctx.center.id,
    deletedAt: null,
    OR: orConditions,
  };
}

/**
 * Asserts that the current actor has permission to view/download the given materialId.
 */
export async function assertMaterialAccess(
  ctx: TenantContext,
  materialId: string
) {
  const tenantDb = ctx.getTenantDb();
  const material = await tenantDb.material.findFirst({
    where: {
      id: materialId,
      centerId: ctx.center.id,
      deletedAt: null,
    },
    include: {
      course: { select: { id: true, title: true } },
      group: { select: { id: true, name: true } },
      lesson: { select: { id: true, title: true } },
    },
  });

  if (!material) {
    throw new TenantAccessError("Material not found", "NOT_FOUND", 404);
  }

  const scope = await getActorAcademicScope(ctx);
  if (scope.isUnrestricted) {
    return material;
  }

  if (material.groupId) {
    if (!scope.groupIds.includes(material.groupId)) {
      throw new TenantAccessError(
        "Forbidden: You do not have access to materials of this group",
        "FORBIDDEN_MATERIAL_GROUP",
        403
      );
    }
    return material;
  }

  if (material.courseId) {
    if (!scope.courseIds.includes(material.courseId)) {
      throw new TenantAccessError(
        "Forbidden: You do not have access to materials of this course",
        "FORBIDDEN_MATERIAL_COURSE",
        403
      );
    }
    return material;
  }

  // Material without group or course: accessible to teachers/assistants, or students/parents with active groups
  if (
    ctx.role !== "TEACHER" &&
    ctx.role !== "TEACHER_ASSISTANT" &&
    scope.groupIds.length === 0 &&
    scope.courseIds.length === 0
  ) {
    throw new TenantAccessError(
      "Forbidden: You do not have active group enrollments to access materials",
      "FORBIDDEN_MATERIAL",
      403
    );
  }

  return material;
}

