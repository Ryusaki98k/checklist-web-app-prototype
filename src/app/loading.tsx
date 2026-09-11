export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50/70 text-slate-900 font-sans">
      <div className="flex flex-col items-center gap-3 p-6 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-900 border-t-transparent" />
        <p className="text-xs sm:text-sm font-semibold text-slate-700">กำลังโหลด Eater Egg Fresh Mart...</p>
      </div>
    </div>
  );
}
