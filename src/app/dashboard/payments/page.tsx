import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import PaymentsManager from "@/components/PaymentsManager";

export default async function PaymentsPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const activeCenterId = session.activeCenterId;
  const activeRole = session.activeCenterRole;

  if (!activeCenterId) {
    return (
      <div className="glass-panel p-8 rounded-2xl border border-slate-800 text-center">
        <p className="text-slate-400">Выберите учебный центр для управления платежами.</p>
      </div>
    );
  }

  const payments = await db.centerPayment.findMany({
    where: { centerId: activeCenterId },
    include: {
      student: { include: { user: { select: { fullName: true, email: true } } } },
      group: { select: { name: true, course: { select: { title: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const students = await db.centerMembership.findMany({
    where: { centerId: activeCenterId, role: "STUDENT" },
    include: { user: { select: { fullName: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Оплаты Курсов Учениками</h1>
        <p className="text-sm text-slate-400 mt-1">
          Модуль приема платежей учебного центра. Деньги поступают напрямую вам (0% комиссия платформы).
        </p>
      </div>

      <PaymentsManager
        initialPayments={payments}
        students={students}
        role={activeRole}
      />
    </div>
  );
}
