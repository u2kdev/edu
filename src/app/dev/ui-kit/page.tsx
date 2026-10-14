import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default function DevUiKitPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Dev UI Kit</h1>
        <p className="text-slate-400">
          Internal development component showroom. Inaccessible in production.
        </p>
      </div>
    </div>
  );
}
