import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * Legacy dashboard route — redirects to the proper panel:
 * - Platform staff → /platform-admin
 * - Center members → /center
 */
export default async function DashboardRedirect() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const platformRoles = ["SUPERADMIN", "PLATFORM_ADMIN", "FULL_ACCESS", "PLATFORM_SUPPORT", "SEO_ADMIN"];

  if (platformRoles.includes(session.user.platformRole) && session.memberships.length === 0) {
    redirect("/platform-admin");
  }

  redirect("/center");
}
