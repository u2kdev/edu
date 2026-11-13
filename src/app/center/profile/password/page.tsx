"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CenterPasswordPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/account/change-password");
  }, [router]);

  return (
    <div className="p-8 text-center text-slate-400 text-sm">
      Перенаправление на страницу смены пароля...
    </div>
  );
}
