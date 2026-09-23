"use client";

import React from "react";
import { useLoading } from "../../context/LoadingContext";
import { BrandLogo } from "./BrandLogo";

export function GlobalLoadingOverlay() {
  const { isLoading, loadingMessage, isPageTransition } = useLoading();

  if (!isLoading) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-[9998] flex items-center justify-center pointer-events-auto select-none bg-[var(--color-background)]/80 backdrop-blur-md transition-all duration-200"
    >
      {/* Ambient warm glow backdrop */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-amber-500/15 dark:bg-amber-500/10 rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      {/* Center tactile card */}
      <div className="relative z-10 flex flex-col items-center gap-4 p-6 sm:p-7 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl max-w-xs mx-4 text-center animate-in fade-in zoom-in-95 duration-150">
        {/* Animated Brand Emblem */}
        <div className="relative">
          <div className="absolute -inset-2 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
          <BrandLogo size={44} showText={false} />
        </div>

        {/* Status Text & Indicator */}
        <div className="flex flex-col items-center gap-1.5 mt-1">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-500 border-t-transparent shrink-0" />
            <p className="text-sm sm:text-base font-bold text-[var(--color-text)] tracking-tight">
              {loadingMessage}
            </p>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] font-medium">
            {isPageTransition
              ? "กำลังเตรียมเนื้อหาหน้าถัดไป..."
              : "กรุณารอสักครู่ ระบบกำลังประมวลผลข้อมูล"}
          </p>
        </div>

        {/* Visual Dots Indicator */}
        <div className="flex items-center gap-1.5 mt-1" aria-hidden="true">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce [animation-delay:-0.3s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce [animation-delay:-0.15s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" />
        </div>
      </div>
    </div>
  );
}
