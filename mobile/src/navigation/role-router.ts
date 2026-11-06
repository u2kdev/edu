export type UserRole =
  | "STUDENT"
  | "PARENT"
  | "TEACHER"
  | "TEACHER_ASSISTANT"
  | "DIRECTOR"
  | "CENTER_ADMIN"
  | "SUPERADMIN"
  | "PLATFORM_ADMIN"
  | "DEVELOPER"
  | "PLATFORM_SUPPORT"
  | "NONE";

export function resolveRoleRoute(role: string | null | undefined): string {
  if (!role) return "/(auth)/login";

  switch (role) {
    case "STUDENT":
      return "/(student)";
    case "PARENT":
      return "/(parent)";
    case "TEACHER":
    case "TEACHER_ASSISTANT":
      return "/(teacher)";
    case "DIRECTOR":
    case "CENTER_ADMIN":
      return "/(director)";
    case "SUPERADMIN":
    case "PLATFORM_ADMIN":
    case "DEVELOPER":
    case "PLATFORM_SUPPORT":
      return "/(platform)";
    default:
      return "/(auth)/login";
  }
}
