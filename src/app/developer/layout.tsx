import { ReactNode } from "react";
import Link from "next/link";
import { Server, Activity, FileKey, Terminal, Users, Database } from "lucide-react";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DeveloperLayout({ children }: { children: ReactNode }) {
  const session = await getAuthSession();
  if (!session) {
    redirect("/login");
  }

  const role = session.user.platformRole;
  const isDeveloper = ["SUPERADMIN", "DEVELOPER"].includes(role);

  if (!isDeveloper) {
    redirect("/platform"); // Redirect regular platform owners back to their dashboard
  }

  return (
    <div className="min-h-screen bg-black flex text-slate-200 font-mono">
      {/* Dev Sidebar */}
      <aside className="w-64 bg-zinc-950 border-r border-zinc-900 flex flex-col hidden md:flex shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-zinc-900">
          <Link href="/developer" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center">
              <Terminal className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="font-bold text-sm text-zinc-100 tracking-wider">DEV_PANEL</span>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <Link href="/developer" className="flex items-center gap-3 px-3 py-2 text-sm rounded hover:bg-zinc-900 text-zinc-400 hover:text-emerald-400 transition-colors">
            <Activity className="w-4 h-4" />
            System Health
          </Link>
          <Link href="/developer/audit" className="flex items-center gap-3 px-3 py-2 text-sm rounded hover:bg-zinc-900 text-zinc-400 hover:text-emerald-400 transition-colors">
            <Database className="w-4 h-4" />
            Global Audit Logs
          </Link>
          <Link href="/developer/owners" className="flex items-center gap-3 px-3 py-2 text-sm rounded hover:bg-zinc-900 text-zinc-400 hover:text-emerald-400 transition-colors">
            <Users className="w-4 h-4" />
            Platform Admins
          </Link>
          
          <div className="pt-4 mt-4 border-t border-zinc-900">
            <Link href="/platform" className="flex items-center gap-3 px-3 py-2 text-sm rounded hover:bg-zinc-900 text-brand-400 transition-colors">
              <Server className="w-4 h-4" />
              Return to Platform UI
            </Link>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-black">
        <header className="h-16 flex items-center justify-between px-8 border-b border-zinc-900 bg-zinc-950/50 backdrop-blur-xl sticky top-0 z-20">
          <h2 className="text-sm font-semibold text-zinc-400">~/developer/control-panel</h2>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs text-emerald-500 font-bold tracking-wider">SYS_ONLINE</span>
          </div>
        </header>
        <div className="flex-1 p-8 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
