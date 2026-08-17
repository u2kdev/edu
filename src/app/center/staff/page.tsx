import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import StaffManager from "@/components/StaffManager";

export default async function StaffPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const activeRole = session.activeCenterRole || "";
  const locale = session.user.preferredLanguage;

  // Only Director and Center Admin can access staff management
  if (activeRole !== "DIRECTOR" && activeRole !== "CENTER_ADMIN") {
    redirect("/center");
  }

  return <StaffManager locale={locale} currentRole={activeRole} />;
}
