import { cookies } from "next/headers";
import { PARENT_CHILD_COOKIE } from "./sidebar-state";

/**
 * Resolves the active child membership ID selected by a PARENT user in the top header.
 * Strictly validates that the cookie value belongs to the parent's confirmed children list
 * to prevent any cross-student IDOR access.
 */
export function getSelectedParentChildIds(confirmedChildIds: string[]): string[] {
  if (confirmedChildIds.length === 0) return [];
  try {
    const cookieVal = cookies().get(PARENT_CHILD_COOKIE)?.value;
    if (cookieVal && confirmedChildIds.includes(cookieVal)) {
      return [cookieVal];
    }
  } catch {
    // Outside Next.js request context (e.g. unit tests)
  }
  return confirmedChildIds;
}
