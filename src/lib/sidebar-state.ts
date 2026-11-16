import { cookies } from "next/headers";
import { SIDEBAR_COLLAPSED_COOKIE, PARENT_CHILD_COOKIE } from "./sidebar-constants";

export { SIDEBAR_COLLAPSED_COOKIE, PARENT_CHILD_COOKIE };

export function getServerSidebarCollapsed(): boolean {
  try {
    return cookies().get(SIDEBAR_COLLAPSED_COOKIE)?.value === "1";
  } catch {
    return false;
  }
}
