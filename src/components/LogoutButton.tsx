"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-muted hover:bg-secondary border border-border text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <LogOut className="w-3.5 h-3.5" />
      <span>Выйти из аккаунта</span>
    </button>
  );
}
