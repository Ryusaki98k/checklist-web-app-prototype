"use client";

import React, { useEffect, useState } from "react";
import { useLoading } from "../../context/LoadingContext";
import { BrandLogo } from "./BrandLogo";
import { Sparkles, Compass, ShieldCheck, Briefcase, Landmark, Users } from "lucide-react";

export function GlobalLoadingOverlay() {
  const { isLoading, loadingMessage, isPageTransition, isNavigating } = useLoading();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isVisible = mounted && (isLoading || isPageTransition || isNavigating);
  if (!isVisible) return null;

  const isRoleSwitch =
    loadingMessage.includes("สลับบทบาท") ||
    loadingMessage.includes("เปลี่ยนบทบาท") ||
    loadingMessage.includes("บทบาท");

  const isLogout = loadingMessage.includes("ออกจากระบบ");

  // Determine role icon if role switch is detected
  const getRoleIcon = () => {
    if (loadingMessage.includes("Admin") || loadingMessage.includes("ผู้ดูแลระบบ")) {
      return <ShieldCheck size={13} className="text-purple-600 dark:text-purple-400" />;
    }
    if (loadingMessage.includes("GM") || loadingMessage.includes("กรรมการ") || loadingMessage.includes("ผู้จัดการทั่วไป")) {
      return <Landmark size={13} className="text-blue-600 dark:text-blue-400" />;
    }
    if (loadingMessage.includes("ผู้จัดการ") || loadingMessage.includes("ผู้ช่วย")) {
      return <Briefcase size={13} className="text-emerald-600 dark:text-emerald-400" />;
    }
    return <Users size={13} className="text-amber-600 dark:text-amber-400" />;
  };

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-[9998] flex items-center justify-center pointer-events-auto select-none bg-[var(--color-background)]/80 dark:bg-black/80 backdrop-blur-md transition-all duration-200 animate-in fade-in"
    >
      {/* Ambient warm glow backdrop */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 sm:w-96 sm:h-96 bg-amber-500/15 dark:bg-amber-500/20 rounded-full blur-3xl pointer-events-none animate-pulse"
        aria-hidden="true"
      />

      {/* Center tactile card */}
      <div className="relative z-10 flex flex-col items-center gap-4 p-6 sm:p-7 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-2xl max-w-xs sm:max-w-sm mx-4 text-center animate-in fade-in zoom-in-95 duration-150">
        {/* Animated Brand Emblem with dual rings */}
        <div className="relative flex items-center justify-center">
          <div className="absolute -inset-2.5 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin" />
          <div className="absolute -inset-4 rounded-full border border-amber-500/10 border-b-amber-500/30 animate-spin [animation-duration:3s] [animation-direction:reverse]" />
          <BrandLogo size={46} showText={false} />
        </div>

        {/* Status Category Badge */}
        {isRoleSwitch ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-900 dark:text-amber-200 text-xs font-bold border border-amber-500/30">
            {getRoleIcon()}
            <span>สลับบทบาทการทำงาน</span>
          </div>
        ) : isLogout ? (
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 text-[11px] font-bold border border-rose-500/20">
            <span>ออกจากระบบ</span>
          </div>
        ) : isPageTransition || isNavigating ? (
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-800 dark:text-amber-300 text-[11px] font-semibold border border-amber-500/20">
            <Compass size={12} className="text-amber-500" />
            <span>กำลังเปลี่ยนหน้า</span>
          </div>
        ) : null}

        {/* Status Text & Indicator */}
        <div className="flex flex-col items-center gap-1 mt-0.5 max-w-full">
          <div className="flex items-center justify-center gap-2 max-w-[280px]">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-500 border-t-transparent shrink-0" />
            <p className="text-sm sm:text-base font-bold text-[var(--color-text)] tracking-tight truncate">
              {loadingMessage}
            </p>
          </div>

          <p className="text-xs text-[var(--color-text-muted)] font-medium leading-relaxed mt-0.5">
            {isRoleSwitch
              ? "กำลังเตรียมสิทธิ์และปรับแดชบอร์ดตามบทบาทของคุณ..."
              : isLogout
              ? "กำลังล้างเซสชันและนำกลับสู่หน้าหลัก..."
              : isPageTransition || isNavigating
              ? "กำลังเตรียมเนื้อหาหน้าถัดไป กรุณารอสักครู่..."
              : "กรุณารอสักครู่ ระบบกำลังประมวลผลข้อมูล"}
          </p>
        </div>

        {/* Visual Dots Indicator */}
        <div className="flex items-center gap-1.5 mt-0.5" aria-hidden="true">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce [animation-delay:-0.3s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce [animation-delay:-0.15s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" />
        </div>
      </div>
    </div>
  );
}
