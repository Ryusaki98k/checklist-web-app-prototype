import { BrandLogo } from "../../../components/common/BrandLogo";
import { ThemeToggle } from "../../../components/common/ThemeToggle";
import Link from "next/link";
import { Users, Briefcase, Landmark, ShieldCheck, ArrowRight, UserPlus } from "lucide-react";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] flex flex-col justify-between px-4 py-6 sm:py-10 font-sans relative">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col justify-center">
        {/* Header */}
        <header className="mb-6 sm:mb-8 text-center flex flex-col items-center">
          <BrandLogo size={52} showText={true} isDark={false} subtitle="ระบบตรวจเช็คลิสต์และมาตรฐานการปฏิบัติงานสาขา" />
          <h1 className="text-xl sm:text-2xl font-bold mt-4 tracking-tight">
            เข้าสู่ระบบ Eater Egg Fresh Mart
          </h1>
          <p className="mt-2 text-[var(--color-text-muted)] text-xs sm:text-sm font-normal max-w-md">
            กรุณาเลือกช่องทางเข้าสู่ระบบตามบทบาทและหน้าที่รับผิดชอบ
          </p>
        </header>

        {/* 3 Main Gateways: Employee, Manager, Executive (Vertical in Grid) */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
            {/* 1. Employee Login (Vertical Card) */}
            <Link
              href="/login/employee"
              className="group flex flex-col justify-between p-5 bg-[var(--color-surface)] rounded-2xl border-2 border-amber-300 dark:border-amber-700/60 hover:border-amber-500 shadow-xs hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer text-left"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500 text-amber-950 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                    <Users size={24} strokeWidth={2.4} />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-[#2b1413]">
                    หน้าร้าน
                  </span>
                </div>

                <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)] tracking-tight">
                  พนักงานสาขา
                </h2>
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 block mb-2">
                  Floor Staff
                </span>

                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                  สำหรับแคชเชียร์และพนักงานทั่วไป เข้าตรวจเช็คลิสต์ประจำกะ
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-amber-200/60 dark:border-amber-900/60">
                <span className="w-full py-2 px-3 rounded-xl bg-amber-500/15 group-hover:bg-amber-500 text-amber-900 dark:text-amber-200 group-hover:text-amber-950 font-bold text-xs transition-colors flex items-center justify-between">
                  <span>เข้าสู่ระบบพนักงาน</span>
                  <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </Link>

            {/* 2. Manager Login (Store Management - Vertical Card) */}
            <Link
              href="/login/manager"
              className="group flex flex-col justify-between p-5 bg-[var(--color-surface)] rounded-2xl border-2 border-emerald-300 dark:border-emerald-700/60 hover:border-emerald-500 shadow-xs hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer text-left"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                    <Briefcase size={24} strokeWidth={2.2} />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                    ระดับสาขา
                  </span>
                </div>

                <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)] tracking-tight">
                  ผู้จัดการรร้าน & ผู้ช่วยผู้จัดการร้าน
                </h2>
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 block mb-2">
                  Store Management
                </span>

                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                  สำหรับผู้จัดการร้าน และผู้ช่วยผู้จัดการร้าน ตรวจรับรองกะและดูแลสาขา
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-emerald-200/60 dark:border-emerald-900/60">
                <span className="w-full py-2 px-3 rounded-xl bg-emerald-500/15 group-hover:bg-emerald-600 text-emerald-900 dark:text-emerald-200 group-hover:text-white font-bold text-xs transition-colors flex items-center justify-between">
                  <span>เข้าสู่ระบบผู้จัดการ</span>
                  <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </Link>

            {/* 3. Executive Login (Executive & GM - Vertical Card) */}
            <Link
              href="/login/executive"
              className="group flex flex-col justify-between p-5 bg-[var(--color-surface)] rounded-2xl border-2 border-[var(--color-border)] hover:border-[var(--color-primary)] shadow-xs hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer text-left"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-[var(--color-primary)] text-amber-200 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                    <Landmark size={24} strokeWidth={2.2} />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--color-surface-2)] text-amber-700 dark:text-amber-300 border border-[var(--color-border)]">
                    ระดับเขต
                  </span>
                </div>

                <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)] tracking-tight">
                  ฝ่ายบริหาร & กรรมการ
                </h2>
                <span className="text-[11px] font-semibold text-[var(--color-primary)] dark:text-amber-400 block mb-2">
                  Executive & GM
                </span>

                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                  สำหรับกรรมการบริหาร (Committee) และผู้จัดการทั่วไป (GM) กำกับดูแลภาพรวม
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-[var(--color-border)]">
                <span className="w-full py-2 px-3 rounded-xl bg-[var(--color-primary)]/15 group-hover:bg-[var(--color-primary)] text-amber-900 dark:text-amber-200 group-hover:text-amber-100 font-bold text-xs transition-colors flex items-center justify-between">
                  <span>เข้าสู่ระบบฝ่ายบริหาร</span>
                  <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </Link>
          </div>

          {/* 4. Link to Employee Registration on Main Page */}
          <div className="p-4 bg-[var(--color-surface-2)] rounded-2xl border border-[var(--color-border)] flex items-center justify-between gap-3 mt-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                <UserPlus size={18} />
              </div>
              <div>
                <span className="text-xs font-bold text-[var(--color-text)] block">
                  ยังไม่มีบัญชีพนักงานประจำสาขา?
                </span>
                <span className="text-[11px] text-[var(--color-text-muted)]">
                  สามารถลงทะเบียนบัญชีพนักงานใหม่ได้ที่หน้าหลัก
                </span>
              </div>
            </div>
            <Link
              href="/#register-section"
              className="text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline shrink-0"
            >
              ไปหน้าลงทะเบียน →
            </Link>
          </div>

          {/* Tertiary Utility Row: Central Administration */}
          <div className="pt-2 flex items-center justify-between px-2 text-xs text-[var(--color-text-muted)]">
            <Link href="/" className="hover:underline">
              ← กลับสู่หน้าหลัก
            </Link>
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 hover:text-amber-950 dark:hover:text-amber-200 font-semibold"
            >
              <ShieldCheck size={14} className="text-amber-700" />
              <span>ผู้ดูแลระบบส่วนกลาง (Central Admin) →</span>
            </Link>
          </div>
        </div>
      </div>

      <footer className="mt-8 text-center text-xs text-[var(--color-text-muted)] font-medium">
        Eater Egg Fresh Mart • Operations, SOP & Audit Portal
      </footer>
    </main>
  );
}
