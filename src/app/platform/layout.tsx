import { ReactNode } from "react";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import PlatformSidebar from "@/components/platform/PlatformSidebar";

export default async function PlatformAdminLayout({ children }: { children: ReactNode }) {
  const session = await getAuthSession();
  if (!session) {
    redirect("/login");
  }

  const role = session.user.platformRole;
  const isPlatformOwner = ["PLATFORM_ADMIN", "SUPERADMIN", "DEVELOPER", "FULL_ACCESS"].includes(role);

  if (!isPlatformOwner) {
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
        locale={session.user.preferredLanguage}
      />
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
