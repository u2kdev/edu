// ============================================================
// Centralized RBAC + Granular Permissions System
// Security principle: Backend is the ONLY source of truth.
// UI visibility is UX only — real protection is here.
// ============================================================

export const SENSITIVE_ACTIONS = [
  "settings.manage",
  "payments.manage",
  "payments.refund",
  "users.block",
  "password.change"
];

export type PlatformRole =
  | "NONE"
  | "DEVELOPER"       // Technical Super Admin — full system access
  | "SUPERADMIN"      // Platform Owner — commercial management
  | "PLATFORM_ADMIN"  // Platform Admin — operational management
  | "FULL_ACCESS"     // Internal full access (legacy)
  | "PLATFORM_SUPPORT"
  | "SEO_ADMIN";

export type CenterRole =
  | "DIRECTOR"           // Tenant Owner — sees business whole
  | "CENTER_ADMIN"       // Admin of the center
  | "TEACHER"            // Teacher — manages own groups
  | "TEACHER_ASSISTANT"  // Limited teacher rights
  | "CENTER_SUPPORT"     // Support staff within center
  | "STUDENT"
  | "PARENT";

// Granular permissions for fine-grained access control
export type Permission =
  // Students
  | "students.read"
  | "students.create"
  | "students.update"
  | "students.delete"
  // Grades
  | "grades.read"
  | "grades.create"
  | "grades.update"
  | "grades.finalize"
  | "grades.delete"
  // Attendance
  | "attendance.read"
  | "attendance.mark"
  | "attendance.update"
  // Homework / Assignments
  | "assignments.read"
  | "assignments.create"
  | "assignments.review"
  | "assignments.grade"
  // Groups
  | "groups.read"
  | "groups.create"
  | "groups.manage"
  // Courses
  | "courses.read"
  | "courses.create"
  | "courses.manage"
  // Schedule
  | "schedule.read"
  | "schedule.create"
  | "schedule.manage"
  // Payments
  | "payments.read"
  | "payments.manage"
  | "payments.refund"
  // Reports
  | "reports.read"
  | "reports.export"
  // Users / Staff
  | "users.read"
  | "users.create"
  | "users.manage"
  | "users.block"
  // Announcements
  | "announcements.read"
  | "announcements.create"
  | "announcements.manage"
  // Materials
  | "materials.read"
  | "materials.upload"
  | "materials.manage"
  // Branches
  | "branches.read"
  | "branches.manage"
  // Settings
  | "settings.read"
  | "settings.manage"
  // Audit
  | "audit.read"
  // Invites
  | "invites.read"
  | "invites.create"
  | "invites.manage"
  // Support
  | "support.read"
  | "support.create"
  // Platform-level
  | "platform.dashboard"
  | "platform.tenants.read"
  | "platform.tenants.manage"
  | "platform.plans.manage"
  | "platform.billing.read"
  | "platform.billing.manage"
  | "platform.impersonation"
  | "platform.support"
  | "platform.infrastructure"   // DEVELOPER only
  | "platform.database"         // DEVELOPER only
  | "platform.logs"             // DEVELOPER only
  | "platform.feature_flags"    // DEVELOPER only
  | "platform.security";        // DEVELOPER only

// -----------------------------------------------------------------------
// Platform-level role permissions
// -----------------------------------------------------------------------
const PLATFORM_ROLE_PERMISSIONS: Record<PlatformRole, Permission[]> = {
  DEVELOPER: [
    // Full access to everything — including infrastructure
    "platform.dashboard",
    "platform.tenants.read",
    "platform.tenants.manage",
    "platform.plans.manage",
    "platform.billing.read",
    "platform.billing.manage",
    "platform.impersonation",
    "platform.support",
    "platform.infrastructure",
    "platform.database",
    "platform.logs",
    "platform.feature_flags",
    "platform.security",
    // All center permissions too (via impersonation)
    "students.read", "students.create", "students.update", "students.delete",
    "grades.read", "grades.create", "grades.update", "grades.finalize", "grades.delete",
    "attendance.read", "attendance.mark", "attendance.update",
    "assignments.read", "assignments.create", "assignments.review", "assignments.grade",
    "groups.read", "groups.create", "groups.manage",
    "courses.read", "courses.create", "courses.manage",
    "schedule.read", "schedule.create", "schedule.manage",
    "payments.read", "payments.manage", "payments.refund",
    "reports.read", "reports.export",
    "users.read", "users.create", "users.manage", "users.block",
    "announcements.read", "announcements.create", "announcements.manage",
    "materials.read", "materials.upload", "materials.manage",
    "branches.read", "branches.manage",
    "settings.read", "settings.manage",
    "audit.read",
    "invites.read", "invites.create", "invites.manage",
    "support.read", "support.create",
  ],
  SUPERADMIN: [
    // Platform Owner — commercial side only (NOT infrastructure/database/server)
    "platform.dashboard",
    "platform.tenants.read",
    "platform.tenants.manage",
    "platform.plans.manage",
    "platform.billing.read",
    "platform.billing.manage",
    "platform.impersonation",
    "platform.support",
    "audit.read",
    "support.read",
    "support.create",
  ],
  PLATFORM_ADMIN: [
    "platform.dashboard",
    "platform.tenants.read",
    "platform.plans.manage",
    "platform.billing.read",
    "platform.support",
    "audit.read",
    "support.read",
    "support.create",
  ],
  FULL_ACCESS: [
    "platform.dashboard",
    "platform.tenants.read",
    "platform.support",
    "audit.read",
    "support.read",
    "support.create",
  ],
  PLATFORM_SUPPORT: [
    "platform.dashboard",
    "platform.tenants.read",
    "platform.impersonation",
    "platform.support",
    "support.read",
    "support.create",
  ],
  SEO_ADMIN: [],
  NONE: [],
};

// -----------------------------------------------------------------------
// Center-level role permissions
// -----------------------------------------------------------------------
const CENTER_ROLE_PERMISSIONS: Record<CenterRole, Permission[]> = {
  DIRECTOR: [
    // Director = Center Owner: full business visibility
    "students.read", "students.create", "students.update", "students.delete",
    "grades.read", "grades.create", "grades.update", "grades.finalize", "grades.delete",
    "attendance.read", "attendance.mark", "attendance.update",
    "assignments.read", "assignments.create", "assignments.review", "assignments.grade",
    "groups.read", "groups.create", "groups.manage",
    "courses.read", "courses.create", "courses.manage",
    "schedule.read", "schedule.create", "schedule.manage",
    "payments.read", "payments.manage", "payments.refund",
    "reports.read", "reports.export",
    "users.read", "users.create", "users.manage", "users.block",
    "announcements.read", "announcements.create", "announcements.manage",
    "materials.read", "materials.upload", "materials.manage",
    "branches.read", "branches.manage",
    "settings.read", "settings.manage",
    "audit.read",
    "invites.read", "invites.create", "invites.manage",
    "support.read", "support.create",
  ],
  CENTER_ADMIN: [
    // Admin: same as director but cannot change critical billing/security settings
    "students.read", "students.create", "students.update",
    "grades.read", "grades.create", "grades.update",
    "attendance.read", "attendance.mark", "attendance.update",
    "assignments.read", "assignments.create", "assignments.review", "assignments.grade",
    "groups.read", "groups.create", "groups.manage",
    "courses.read", "courses.create", "courses.manage",
    "schedule.read", "schedule.create", "schedule.manage",
    "payments.read", "payments.manage",
    "reports.read", "reports.export",
    "users.read", "users.create", "users.manage",
    "announcements.read", "announcements.create", "announcements.manage",
    "materials.read", "materials.upload", "materials.manage",
    "branches.read",
    "settings.read",
    "invites.read", "invites.create", "invites.manage",
    "support.read", "support.create",
  ],
  TEACHER: [
    // Teacher: only own groups, can create/grade assignments, mark attendance
    "students.read",     // only own groups — enforced at query level
    "grades.read", "grades.create", "grades.update",  // own groups only
    "attendance.read", "attendance.mark", "attendance.update",  // own groups only
    "assignments.read", "assignments.create", "assignments.review", "assignments.grade",
    "groups.read",       // only assigned groups
    "courses.read",
    "schedule.read",
    "materials.read", "materials.upload",
    "announcements.read", "announcements.create",  // own groups only
    "reports.read",      // own groups only
    "support.read", "support.create",
  ],
  TEACHER_ASSISTANT: [
    // Limited teacher rights — cannot finalize grades, cannot manage groups
    "students.read",     // own groups only
    "grades.read",       // can see but not create/finalize
    "attendance.read", "attendance.mark",  // if explicitly permitted
    "assignments.read", "assignments.review",  // can review but not grade
    "groups.read",       // own groups only
    "courses.read",
    "schedule.read",
    "materials.read", "materials.upload",
    "announcements.read",
    "support.read", "support.create",
  ],
  CENTER_SUPPORT: [
    "students.read",
    "schedule.read",
    "announcements.read",
    "support.read", "support.create",
  ],
  STUDENT: [
    "grades.read",         // own only — enforced at query level
    "attendance.read",     // own only
    "assignments.read",
    "courses.read",
    "schedule.read",
    "materials.read",
    "announcements.read",
    "support.read", "support.create",
  ],
  PARENT: [
    "grades.read",         // children only
    "attendance.read",     // children only
    "assignments.read",    // children only
    "schedule.read",       // children only
    "payments.read",       // own payments
    "announcements.read",
    "reports.read",        // children only
    "support.read", "support.create",
  ],
};

// -----------------------------------------------------------------------
// Main permission check function
// -----------------------------------------------------------------------
export function hasPermission(
  permission: Permission,
  platformRole: PlatformRole | string = "NONE",
  centerRole?: CenterRole | string,
  membershipPermissions?: string | null  // JSON override from DB
): boolean {
  // DEVELOPER always has full access
  if (platformRole === "DEVELOPER") return true;

  // SUPERADMIN has full platform access (not infrastructure)
  if (platformRole === "SUPERADMIN") {
    const platformPerms = PLATFORM_ROLE_PERMISSIONS["SUPERADMIN"];
    if (platformPerms.includes(permission as Permission)) return true;
    // SUPERADMIN gets center permissions too (for impersonation management)
    return true; // SUPERADMIN is effectively full access at center level
  }

  // Check platform role permissions
  const platformPerms = PLATFORM_ROLE_PERMISSIONS[platformRole as PlatformRole] || [];
  if (platformPerms.includes(permission as Permission)) return true;

  // Check center role permissions
  if (centerRole) {
    // Check for granular membership-level overrides
    if (membershipPermissions) {
      try {
        const overrides: { granted?: Permission[]; denied?: Permission[] } = JSON.parse(membershipPermissions);
        if (overrides.denied?.includes(permission as Permission)) return false;
        if (overrides.granted?.includes(permission as Permission)) return true;
      } catch { /* ignore malformed JSON */ }
    }

    const centerPerms = CENTER_ROLE_PERMISSIONS[centerRole as CenterRole] || [];
    if (centerPerms.includes(permission as Permission)) return true;
  }

  return false;
}

// -----------------------------------------------------------------------
// Legacy resource-based check (backward compatibility)
// -----------------------------------------------------------------------
export type Resource =
  | "PLATFORM_DASHBOARD"
  | "PLATFORM_SETTINGS"
  | "PLATFORM_PLANS"
  | "PLATFORM_IMPERSONATION"
  | "TENANT_SETTINGS"
  | "TENANT_BILLING"
  | "TENANT_INVITES"
  | "COURSES_MANAGE"
  | "GROUPS_MANAGE"
  | "LESSONS_MANAGE"
  | "GRADES_MANAGE"
  | "ATTENDANCE_MANAGE"
  | "STUDENT_PAYMENTS_MANAGE"
  | "SUPPORT_TICKETS";

export type Action = "CREATE" | "READ" | "UPDATE" | "DELETE" | "MANAGE";

// Map legacy resources to new permissions for backward compatibility
const RESOURCE_PERMISSION_MAP: Record<Resource, Permission> = {
  PLATFORM_DASHBOARD: "platform.dashboard",
  PLATFORM_SETTINGS: "platform.security",
  PLATFORM_PLANS: "platform.plans.manage",
  PLATFORM_IMPERSONATION: "platform.impersonation",
  TENANT_SETTINGS: "settings.manage",
  TENANT_BILLING: "payments.manage",
  TENANT_INVITES: "invites.manage",
  COURSES_MANAGE: "courses.manage",
  GROUPS_MANAGE: "groups.manage",
  LESSONS_MANAGE: "schedule.manage",
  GRADES_MANAGE: "grades.create",
  ATTENDANCE_MANAGE: "attendance.mark",
  STUDENT_PAYMENTS_MANAGE: "payments.manage",
  SUPPORT_TICKETS: "support.create",
};

/** @deprecated Use hasPermission() with granular Permission type */
export function hasResourcePermission(
  resource: Resource,
  platformRole: PlatformRole | string = "NONE",
  centerRole?: CenterRole | string
): boolean {
  const mappedPermission = RESOURCE_PERMISSION_MAP[resource];
  if (!mappedPermission) return false;
  return hasPermission(mappedPermission, platformRole, centerRole);
}

