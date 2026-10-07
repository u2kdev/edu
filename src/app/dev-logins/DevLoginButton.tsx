"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DevLoginButton({ userId, userName, role }: { userId: string, userName: string, role: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        // Redirect logic based on role
        if (role === "SUPERADMIN" || role === "DEVELOPER") {
          router.push("/developer");
        } else if (role === "PLATFORM_ADMIN") {
          router.push("/platform");
        } else {
          router.push("/dashboard");
        }
      } else {
        alert("Login failed");
      }
    } catch (e) {
      alert("Error: " + e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogin}
      disabled={loading}
      className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50"
    >
      {loading ? "Вход..." : `Войти как ${userName}`}
    </button>
  );
}
