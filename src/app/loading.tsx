export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div
        role="status"
        aria-label="Загрузка"
        className="h-10 w-10 rounded-full border-2 border-slate-700 border-t-brand-500 animate-spin"
      />
    </div>
  );
}
