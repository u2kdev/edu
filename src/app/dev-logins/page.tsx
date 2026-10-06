// Reason: Exception: Dev logins are global
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { DevLoginButton } from "./DevLoginButton";

export const dynamic = 'force-dynamic';

export default async function DevLoginsPage() {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_DEV_LOGINS !== "true") {
    return <div className="p-10 text-red-500">Forbidden in production.</div>;
  }

  // Fetch all users
  const users = await db.platformUser.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      centerMemberships: {
        include: {
          center: true,
        }
      }
    }
  });

  // Group by roles
  const superadmins = users.filter(u => ["SUPERADMIN", "DEVELOPER", "PLATFORM_ADMIN"].includes(u.platformRole));
  const centerOwners = users.filter(u => u.centerMemberships.some(m => m.role === "DIRECTOR"));
  const teachers = users.filter(u => u.centerMemberships.some(m => m.role === "TEACHER"));
  const students = users.filter(u => u.centerMemberships.some(m => m.role === "STUDENT"));
  const parents = users.filter(u => u.centerMemberships.some(m => m.role === "PARENT"));

  const renderUserGroup = (title: string, group: typeof users) => (
    <div className="mb-8">
      <h2 className="text-xl font-bold mb-4 border-b pb-2">{title} ({group.length})</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {group.map(u => (
          <div key={u.id} className="border p-4 rounded bg-white shadow-sm flex flex-col gap-2">
            <div className="font-semibold">{u.fullName}</div>
            <div className="text-sm text-gray-500">{u.email}</div>
            <div className="text-xs text-gray-400">Role: {u.platformRole}</div>
            {u.centerMemberships.map(m => (
              <div key={m.id} className="text-xs bg-gray-100 p-1 rounded">
                {m.center.name} - {m.role}
              </div>
            ))}
            <div className="mt-2">
              <DevLoginButton userId={u.id} userName={u.fullName} role={u.platformRole} />
            </div>
          </div>
        ))}
      </div>
      {group.length === 0 && <p className="text-gray-400 italic">Нет пользователей</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-black font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900">🚀 Dev Входы</h1>
          <div className="text-sm bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full">
            Только для разработки
          </div>
        </div>

        {renderUserGroup("👨‍💻 Платформенные администраторы", superadmins)}
        {renderUserGroup("🏢 Владельцы центров (DIRECTOR)", centerOwners)}
        {renderUserGroup("👨‍🏫 Преподаватели (TEACHER)", teachers)}
        {renderUserGroup("🎓 Студенты (STUDENT)", students)}
        {renderUserGroup("👪 Родители (PARENT)", parents)}
      </div>
    </div>
  );
}
