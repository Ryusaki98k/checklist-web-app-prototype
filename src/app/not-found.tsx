import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50/70 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 text-center shadow-xs">
        <span className="inline-block text-xs font-mono font-bold text-amber-900 bg-amber-50 border border-amber-200/80 px-3 py-1 rounded-full mb-3">
          404 Not Found
        </span>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-2">ไม่พบหน้าที่คุณต้องการ</h1>
        <p className="text-xs sm:text-sm text-slate-600 mb-6">
          หน้าที่คุณพยายามเข้าถึงอาจถูกย้าย ลบ หรือ URL ไม่ถูกต้อง
        </p>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <Link
            href="/"
            className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center cursor-pointer"
          >
            ไปหน้าเข้าสู่ระบบพนักงาน
          </Link>
          <Link
            href="/admin"
            className="flex-1 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center cursor-pointer"
          >
            ไปหน้าผู้จัดการร้าน
          </Link>
        </div>
      </div>
    </div>
  );
}
