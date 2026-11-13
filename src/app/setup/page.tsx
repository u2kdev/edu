import { notFound } from "next/navigation";
import Link from "next/link";
// Reason: Exception: First platform owner initialization is a global platform model operation.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { verifySetupTokenValue } from "@/lib/setup-token";
import SetupForm from "./SetupForm";

export const dynamic = "force-dynamic";

interface SetupPageProps {
  searchParams?: Promise<{ token?: string }> | { token?: string };
}

export default async function SetupPage({ searchParams }: SetupPageProps) {
  const resolvedSearchParams = searchParams ? await Promise.resolve(searchParams) : undefined;
  const token = resolvedSearchParams?.token;

  // 1. Without valid setup token from URL -> 404 Not Found
  if (!verifySetupTokenValue(token)) {
    notFound();
  }

  // 2. If platform already initialized -> 404 Not Found
  const superadminCount = await db.platformUser.count({
    where: { platformRole: "SUPERADMIN" },
  });

  if (superadminCount > 0) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center px-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">Инициализация платформы</h1>
          <p className="text-sm text-slate-400 mt-2">
            Создание первой учетной записи владельца (SUPERADMIN). После создания страница будет навсегда закрыта.
          </p>
        </div>
        <SetupForm setupToken={token} />
        <div className="mt-6 text-center text-xs text-slate-500">
          Уже настроено? <Link href="/login" className="text-brand-400 hover:underline">Войти</Link>
        </div>
      </div>
    </div>
  );
}
