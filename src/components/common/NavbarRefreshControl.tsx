"use client";

import React, { useState, useRef, useEffect } from "react";
import { RefreshCw, Database, ChevronDown, Zap, Check } from "lucide-react";

export interface NavbarRefreshControlProps {
  onRefresh: () => Promise<void> | void;
  onRefreshFromDb: () => Promise<void> | void;
  isLoading?: boolean;
  isDbLoading?: boolean;
  lastRefreshedAt?: Date | null;
  lastRefreshType?: "cache" | "db" | null;
  className?: string;
  label?: string;
}

export function NavbarRefreshControl({
  onRefresh,
  onRefreshFromDb,
  isLoading = false,
  isDbLoading = false,
  lastRefreshedAt,
  lastRefreshType = "cache",
  className = "",
  label = "รีเฟรช",
}: NavbarRefreshControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isBusy = isLoading || isDbLoading;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleQuickRefresh = async () => {
    if (isBusy) return;
    setIsOpen(false);
    await onRefresh();
  };

  const handleDbRefresh = async () => {
    if (isBusy) return;
    setIsOpen(false);
    await onRefreshFromDb();
  };

  const formatLastTime = (date?: Date | null) => {
    if (!date) return null;
    return new Intl.DateTimeFormat("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  };

  const lastTimeString = formatLastTime(lastRefreshedAt);

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className || ""}`}>
      {/* Split Button Container */}
      <div className="inline-flex items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] shadow-2xs hover:border-amber-500/50 transition-colors overflow-hidden">
        {/* Primary Action Button: 1-click Quick Refresh */}
        <button
          type="button"
          onClick={handleQuickRefresh}
          disabled={isBusy}
          title="รีเฟรชข้อมูล (ตรวจสอบตามรอบแคช)"
          aria-label="รีเฟรชข้อมูล"
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:text-amber-900 dark:hover:text-amber-200 hover:bg-amber-500/10 transition-colors disabled:opacity-50 cursor-pointer min-h-[34px]"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${
              isBusy ? "animate-spin text-amber-500" : "text-[var(--color-text-muted)]"
            }`}
          />
          <span className="hidden sm:inline">
            {isDbLoading ? "กำลังดึงจาก DB..." : isLoading ? "กำลังรีเฟรช..." : label}
          </span>
        </button>

        {/* Vertical Divider */}
        <div className="w-px h-4 bg-[var(--color-border)]" aria-hidden="true" />

        {/* Dropdown Caret Trigger */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          disabled={isBusy}
          aria-haspopup="true"
          aria-expanded={isOpen}
          title="ตัวเลือกการรีเฟรช (Refresh Options)"
          aria-label="เปิดตัวเลือกการรีเฟรช"
          className="px-2 py-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-amber-500/10 transition-colors cursor-pointer min-h-[34px] flex items-center justify-center"
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-amber-500" : ""
            }`}
          />
        </button>
      </div>

      {/* Popover Menu & Backdrop */}
      {isOpen && (
        <>
          {/* Backdrop to catch clicks outside and close popover cleanly */}
          <div
            className="fixed inset-0 z-40 bg-black/10 sm:bg-transparent"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Menu Card: explicitly positioned 8px below trigger button */}
          <div
            style={{ position: "absolute", top: "calc(100% + 8px)", right: 0 }}
            className="w-80 max-w-[calc(100vw-1.5rem)] z-50 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl p-2.5 space-y-1.5 backdrop-blur-xl"
          >
            {/* Header & Status Indicator */}
            <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-[var(--color-border)] pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                การซิงค์ข้อมูล (Data Sync)
              </span>
              {lastTimeString ? (
                <span className="text-[10px] font-mono font-medium text-[var(--color-text-muted)] bg-[var(--color-surface-2)] px-2 py-0.5 rounded-full border border-[var(--color-border)]">
                  ล่าสุด {lastTimeString} น.
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  ออนไลน์
                </span>
              )}
            </div>

            {/* Option 1: Smart Cache Refresh */}
            <button
              type="button"
              onClick={handleQuickRefresh}
              disabled={isBusy}
              className={`w-full text-left p-2.5 rounded-xl transition-all cursor-pointer flex items-start gap-2.5 ${
                lastRefreshType === "cache" && !isBusy
                  ? "bg-amber-500/10 border border-amber-500/25"
                  : "hover:bg-[var(--color-surface-2)] border border-transparent"
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5 border border-amber-500/20">
                <Zap size={15} className={isLoading ? "animate-pulse" : ""} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-bold text-[var(--color-text)] whitespace-nowrap">
                      รีเฟรชด่วน (Smart Sync)
                    </span>
                    <span className="whitespace-nowrap text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                      แนะนำ
                    </span>
                  </div>
                  {lastRefreshType === "cache" && (
                    <Check size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed mt-0.5">
                  ตรวจสอบและอัปเดตตามรอบแคช รวดเร็วและลดโหลดฐานข้อมูล
                </p>
              </div>
            </button>

            {/* Option 2: Force Refresh from DB */}
            <button
              type="button"
              onClick={handleDbRefresh}
              disabled={isBusy}
              className={`w-full text-left p-2.5 rounded-xl transition-all cursor-pointer flex items-start gap-2.5 ${
                lastRefreshType === "db" && !isBusy
                  ? "bg-indigo-500/10 border border-indigo-500/25"
                  : "hover:bg-[var(--color-surface-2)] border border-transparent"
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-500 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 border border-indigo-500/20">
                <Database size={15} className={isDbLoading ? "animate-spin" : ""} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-bold text-[var(--color-text)] whitespace-nowrap">
                      รีเฟรชจากฐานข้อมูล
                    </span>
                    <span className="whitespace-nowrap text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25 shrink-0">
                      Force DB
                    </span>
                  </div>
                  {lastRefreshType === "db" && (
                    <Check size={13} className="text-indigo-500 dark:text-indigo-400 shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed mt-0.5">
                  ล้างแคชและดึงข้อมูลสดจาก Supabase ทันที (Bypass Cache)
                </p>
              </div>
            </button>

            {/* Footer Status Hint */}
            <div className="pt-1.5 px-2.5 pb-0.5 text-[10px] text-[var(--color-text-muted)] flex items-center justify-between border-t border-[var(--color-border)]/60">
              <span>โหมด: {lastRefreshType === "db" ? "สดจากฐานข้อมูล" : "ตามระบบแคช"}</span>
              <span className="text-[9px] font-mono opacity-60">ESC เพื่อปิด</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
