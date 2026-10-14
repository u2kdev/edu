import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import PlatformSidebar from "@/components/platform/PlatformSidebar";

export default async function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const locale = session.user.preferredLanguage;

  // Only platform-level roles can access this section
  const allowedPlatformRoles = [
    "SUPERADMIN",
    "PLATFORM_ADMIN",
    "FULL_ACCESS",
    "PLATFORM_SUPPORT",
    "SEO_ADMIN",
  ];

  if (!allowedPlatformRoles.includes(session.user.platformRole)) {
    redirect("/center");
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 font-sans">
      <PlatformSidebar
        user={{
          fullName: session.user.fullName,
          email: session.user.email,
          platformRole: session.user.platformRole,
        }}
        locale={locale}
      />
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
