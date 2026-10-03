"use client";

import { useState } from "react";
import Link from "next/link";
import { Users, Briefcase, Landmark, ShieldCheck, ArrowRight, UserPlus, KeyRound } from "lucide-react";
import { EmployeeRegisterForm } from "../auth/EmployeeRegisterForm";
import { ForgotPasswordModal } from "../auth/ForgotPasswordModal";

export function PortalMainSection() {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [showForgotModal, setShowForgotModal] = useState(false);

  return (
    <div className="space-y-4">
      {/* Mode Switcher Tabs */}
      <div
        role="tablist"
        className="flex bg-[var(--color-surface-2)] p-1.5 rounded-2xl border border-[var(--color-border)] gap-1 shadow-xs"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "login"}
          onClick={() => setActiveTab("login")}
          className={`flex-1 py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${activeTab === "login"
            ? "bg-[var(--color-brown)] text-amber-100 shadow-sm"
            : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
        >
          <Users size={16} />
          <span>เข้าสู่ระบบ (Login Gateways)</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "register"}
          onClick={() => setActiveTab("register")}
          className={`flex-1 py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${activeTab === "register"
            ? "bg-[var(--color-brown)] text-amber-100 shadow-sm"
            : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
        >
          <UserPlus size={16} />
          <span>ลงทะเบียนพนักงานใหม่ (Register Staff)</span>
        </button>
      </div>

      {/* Tab 1: Login Gateways (Employee, Manager, Executive) in Vertical Grid */}
      {activeTab === "login" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
            {/* 1. Floor Staff Gateway (Vertical Card) */}
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
                  สำหรับแคชเชียและพนักงานทั่วไป เข้าตรวจเช็คลิสต์ประจำกะ
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-amber-200/60 dark:border-amber-900/60">
                <span className="w-full py-2 px-3 rounded-xl bg-amber-500/15 group-hover:bg-amber-500 text-amber-900 dark:text-amber-200 group-hover:text-amber-950 font-bold text-xs transition-colors flex items-center justify-between">
                  <span>เข้าสู่ระบบพนักงาน</span>
                  <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </Link>

            {/* 2. Store Manager Gateway (Vertical Card) */}
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
                  ผู้จัดการ & ผู้ช่วยผู้จัดการ
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

            {/* 3. Executive Gateway (Vertical Card) */}
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

          {/* Quick Register Banner */}
          <div className="p-4 bg-amber-500/10 dark:bg-amber-950/30 rounded-2xl border border-amber-300/40 dark:border-amber-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <UserPlus size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <span className="text-xs font-bold text-[var(--color-text)] block">
                  พนักงานใหม่ยังไม่มีบัญชีในระบบ?
                </span>
                <span className="text-[11px] text-[var(--color-text-muted)]">
                  สามารถลงทะเบียนบัญชีสำหรับพนักงานสาขาได้ทันที
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("register")}
              className="text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-200/60 dark:bg-amber-900/60 hover:bg-amber-300 dark:hover:bg-amber-800 px-3 py-1.5 rounded-xl transition-colors cursor-pointer shrink-0 self-start sm:self-center"
            >
              ลงทะเบียนพนักงานใหม่ →
            </button>
          </div>

          {/* Bottom Utility Row: Forgot Password & Central Admin */}
          <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-2 text-xs text-[var(--color-text-muted)]">
            <button
              type="button"
              onClick={() => setShowForgotModal(true)}
              className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400 hover:underline font-semibold cursor-pointer py-1"
            >
              <KeyRound size={13} />
              <span>ลืมรหัสผ่าน? (Forgot Password)</span>
            </button>

            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 hover:text-amber-950 dark:hover:text-amber-200 font-semibold py-1"
            >
              <ShieldCheck size={14} className="text-amber-700" />
              <span>เข้าสู่ระบบผู้ดูแลระบบส่วนกลาง (Central Admin) →</span>
            </Link>
          </div>
        </div>
      )}

      {/* Tab 2: Employee Registration Form on Main Page */}
      {activeTab === "register" && (
        <div className="p-5 sm:p-7 bg-[var(--color-surface)] rounded-2xl border-2 border-amber-300 dark:border-amber-700/60 shadow-md animate-in fade-in duration-150">
          <EmployeeRegisterForm isMainPage={true} />

          <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-text-muted)]">
            <span>มีบัญชีอยู่แล้ว?</span>
            <button
              type="button"
              onClick={() => setActiveTab("login")}
              className="font-bold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
            >
              ← กลับไปหน้าเลือกช่องทางเข้าสู่ระบบ
            </button>
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
      />
    </div>
  );
}
