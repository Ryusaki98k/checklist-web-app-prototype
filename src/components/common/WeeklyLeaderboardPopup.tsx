"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Trophy,
  Flame,
  Award,
  Sparkles,
  X,
  Store,
  Globe,
  PartyPopper,
  Crown,
  ChevronRight,
  RefreshCw,
  Zap,
} from "lucide-react";
import confetti from "canvas-confetti";
import { LeaderboardEntry } from "../../types";
import { getLeaderboardAction } from "../../actions/points";
import { useApp } from "../../context/AppContext";

interface WeekInfo {
  weekKey: string;
  weekNumber: number;
  year: number;
  startDateStr: string;
  endDateStr: string;
  isStartOfWeek: boolean;
}

function getWeekInfo(d: Date = new Date()): WeekInfo {
  // Compute week based on Asia/Bangkok timezone
  const tzDate = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const date = new Date(Date.UTC(tzDate.getFullYear(), tzDate.getMonth(), tzDate.getDate()));
  const dayNum = date.getUTCDay() || 7; // 1 = Mon, 7 = Sun
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const year = date.getUTCFullYear();
  const weekKey = `${year}-W${String(weekNo).padStart(2, "0")}`;

  // Calculate Monday and Sunday of this week
  const monday = new Date(tzDate);
  const diffToMonday = (tzDate.getDay() + 6) % 7;
  monday.setDate(tzDate.getDate() - diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const formatOpts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
  };
  const startDateStr = monday.toLocaleDateString("th-TH", formatOpts);
  const endDateStr = sunday.toLocaleDateString("th-TH", { ...formatOpts, year: "numeric" });

  // Mon (1) or Tue (2) is start of the week
  const isStartOfWeek = dayNum === 1 || dayNum === 2;

  return {
    weekKey,
    weekNumber: weekNo,
    year,
    startDateStr,
    endDateStr,
    isStartOfWeek,
  };
}

export function fireWeeklyConfetti() {
  if (typeof window === "undefined") return;

  try {
    // Center big burst
    confetti({
      particleCount: 75,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#f59e0b", "#fbbf24", "#10b981", "#6366f1", "#ec4899", "#8b5cf6"],
      zIndex: 10001,
    });

    // Left cannon
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0.05, y: 0.7 },
        colors: ["#f59e0b", "#e11d48", "#3b82f6", "#10b981"],
        zIndex: 10001,
      });
    }, 200);

    // Right cannon
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 0.95, y: 0.7 },
        colors: ["#fbbf24", "#8b5cf6", "#06b6d4", "#f43f5e"],
        zIndex: 10001,
      });
    }, 350);

    // Golden stars sprinkle
    setTimeout(() => {
      confetti({
        particleCount: 35,
        spread: 100,
        origin: { y: 0.35 },
        shapes: ["circle"],
        scalar: 1.2,
        colors: ["#ffd700", "#ffae19", "#ffffff", "#4ade80"],
        zIndex: 10001,
      });
    }, 550);
  } catch (err) {
    console.warn("Confetti effect failed:", err);
  }
}

export function WeeklyLeaderboardPopup() {
  const { currentUser, isReady } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scope, setScope] = useState<"branch" | "all">("branch");
  const [weekInfo, setWeekInfo] = useState<WeekInfo | null>(null);
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    setWeekInfo(getWeekInfo());
  }, []);

  const fetchLeaderboard = useCallback(
    async (targetScope: "branch" | "all" = scope) => {
      if (!currentUser) return;
      setIsLoading(true);
      try {
        const branchId = targetScope === "branch" ? currentUser.branchId : undefined;
        const res = await getLeaderboardAction(branchId);
        if (res.success && res.leaderboard) {
          setLeaderboard(res.leaderboard);
        }
      } catch (err) {
        console.error("Failed to load weekly leaderboard:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [currentUser, scope]
  );

  // Trigger popup after login at beginning of week (or first login of week)
  useEffect(() => {
    if (!isReady || !currentUser || !weekInfo || hasTriggeredRef.current) return;

    const storageKey = `weekly_leaderboard_seen_${weekInfo.weekKey}_${currentUser.id}`;
    const alreadySeen = localStorage.getItem(storageKey);

    // If user hasn't seen it for this week, pop up with celebratory confetti!
    if (!alreadySeen) {
      hasTriggeredRef.current = true;
      // Slight delay so the page finishes landing smoothly
      const timer = setTimeout(() => {
        setIsOpen(true);
        fetchLeaderboard(scope);
        fireWeeklyConfetti();
      }, 700);

      return () => clearTimeout(timer);
    }
  }, [currentUser, isReady, weekInfo, fetchLeaderboard, scope]);

  // Support manual open via event
  useEffect(() => {
    function handleOpenEvent() {
      setIsOpen(true);
      fetchLeaderboard(scope);
      fireWeeklyConfetti();
    }

    window.addEventListener("open-weekly-leaderboard", handleOpenEvent);
    return () => {
      window.removeEventListener("open-weekly-leaderboard", handleOpenEvent);
    };
  }, [fetchLeaderboard, scope]);

  function handleClose() {
    setIsOpen(false);
    if (currentUser && weekInfo) {
      const storageKey = `weekly_leaderboard_seen_${weekInfo.weekKey}_${currentUser.id}`;
      localStorage.setItem(storageKey, "true");
    }
  }

  function handleScopeChange(newScope: "branch" | "all") {
    setScope(newScope);
    fetchLeaderboard(newScope);
  }

  function handleResetSeenForTest() {
    if (currentUser && weekInfo) {
      const storageKey = `weekly_leaderboard_seen_${weekInfo.weekKey}_${currentUser.id}`;
      localStorage.removeItem(storageKey);
      fireWeeklyConfetti();
    }
  }

  if (!mounted || !isOpen || !currentUser || !weekInfo) return null;

  // Podium sorting: 1st, 2nd, 3rd place
  const top1 = leaderboard[0];
  const top2 = leaderboard[1];
  const top3 = leaderboard[2];

  // User's own rank
  const myRankIndex = leaderboard.findIndex((u) => u.userId === currentUser.id);
  const myRank = myRankIndex >= 0 ? myRankIndex + 1 : null;
  const myEntry = myRankIndex >= 0 ? leaderboard[myRankIndex] : null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="weekly-leaderboard-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md animate-fade-in"
    >
      <div className="relative w-full max-w-lg bg-[var(--color-surface)] border border-amber-400/40 dark:border-amber-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-in">
        {/* Decorative Top Celebration Glow */}
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-amber-500/25 via-amber-500/5 to-transparent pointer-events-none" />

        {/* ─── Header Strip ─────────────────────────────────────────────── */}
        <div className="relative p-5 sm:p-6 pb-4 text-center border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/50">
          {/* Close button */}
          <button
            type="button"
            onClick={handleClose}
            aria-label="ปิดหน้าต่างสรุปอันดับ"
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)] flex items-center justify-center transition-colors cursor-pointer shadow-xs"
          >
            <X size={16} />
          </button>

          {/* Golden Trophy Icon Badge */}
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-300 via-amber-500 to-amber-600 text-amber-950 shadow-lg shadow-amber-500/30 mb-2.5 animate-bounce-subtle">
            <Trophy size={28} className="drop-shadow-xs" />
          </div>

          {/* Week Pill */}
          <div className="flex items-center justify-center gap-1.5 mb-1.5">
            <span className="text-[11px] font-bold px-3 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex items-center gap-1">
              <Sparkles size={11} className="text-amber-500" />
              <span>สรุปอันดับต้นสัปดาห์ • สัปดาห์ที่ {weekInfo.weekNumber}</span>
            </span>
          </div>

          <h2
            id="weekly-leaderboard-title"
            className="text-lg sm:text-xl font-extrabold text-[var(--color-text)] tracking-tight"
          >
            🎉 ยินดีต้อนรับสู่สัปดาห์ใหม่!
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-1 max-w-sm mx-auto leading-relaxed">
            รอบคะแนนประจำวันที่ {weekInfo.startDateStr} – {weekInfo.endDateStr} ร่วมสะสมแต้มกะเพื่อไต่อันดับผู้นำสัปดาห์นี้
          </p>

          {/* Scope Selector Tabs */}
          <div className="flex items-center justify-center gap-1 mt-4">
            <div className="inline-flex p-1 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-2xs">
              <button
                type="button"
                onClick={() => handleScopeChange("branch")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  scope === "branch"
                    ? "bg-[var(--color-brown)] text-amber-200 dark:bg-amber-400 dark:text-amber-950 shadow-xs"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                <Store size={12} />
                <span>สาขาของฉัน</span>
              </button>
              <button
                type="button"
                onClick={() => handleScopeChange("all")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  scope === "all"
                    ? "bg-[var(--color-brown)] text-amber-200 dark:bg-amber-400 dark:text-amber-950 shadow-xs"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                <Globe size={12} />
                <span>ทุกสาขา</span>
              </button>
            </div>
          </div>
        </div>

        {/* ─── Scrollable Content ───────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-[var(--color-text-muted)] flex flex-col items-center gap-2">
              <RefreshCw size={20} className="animate-spin text-amber-500" />
              <span>กำลังโหลดข้อมูลอันดับสัปดาห์นี้...</span>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="py-10 text-center text-xs text-[var(--color-text-muted)] space-y-2 bg-[var(--color-surface-2)]/30 rounded-2xl border border-[var(--color-border)] p-6">
              <PartyPopper size={32} className="mx-auto text-amber-500/50" />
              <p className="font-bold text-[var(--color-text)]">ยังไม่มีคะแนนสะสมในสัปดาห์นี้</p>
              <p className="text-[11px] text-[var(--color-text-subtle)] max-w-xs mx-auto">
                เป็นคนแรกที่ส่งมอบงานเช็คลิสต์ตรงเวลา เพื่อขึ้นเป็นอันดับ 1 ของสัปดาห์นี้เลย!
              </p>
            </div>
          ) : (
            <>
              {/* ─── Top 3 Podium (แท่นเกียรติยศ) ────────────────────── */}
              <div className="pt-2 pb-1">
                <div className="text-center mb-3">
                  <span className="text-[11px] font-extrabold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center justify-center gap-1">
                    <Crown size={13} className="text-amber-500" />
                    <span>ผู้นำผลงานยอดเยี่ยมประจำสัปดาห์</span>
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 items-end pt-3">
                  {/* Rank 2 (Silver) */}
                  <div className="flex flex-col items-center">
                    {top2 ? (
                      <div className="w-full text-center space-y-1.5 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-300 dark:border-slate-700 shadow-xs relative">
                        <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-800 font-black text-xs flex items-center justify-center mx-auto -mt-5 border-2 border-white dark:border-slate-800 shadow-xs">
                          2
                        </div>
                        <div className="w-10 h-10 rounded-full bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-extrabold text-sm flex items-center justify-center mx-auto shadow-2xs">
                          {top2.name.charAt(0)}
                        </div>
                        <p className="text-xs font-bold text-[var(--color-text)] truncate max-w-full" title={top2.name}>
                          {top2.name}
                        </p>
                        <p className="text-[10px] text-[var(--color-text-muted)] truncate max-w-full">
                          {top2.branchName || top2.position || "-"}
                        </p>
                        <div className="text-[11px] font-mono font-extrabold text-slate-700 dark:text-slate-300 bg-slate-200/80 dark:bg-slate-800 rounded-md py-0.5">
                          {top2.point} แต้ม
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-24 rounded-2xl border border-dashed border-[var(--color-border)] flex items-center justify-center text-[10px] text-[var(--color-text-subtle)]">
                        ว่าง
                      </div>
                    )}
                  </div>

                  {/* Rank 1 (Gold - Center & Elevated) */}
                  <div className="flex flex-col items-center -translate-y-2">
                    {top1 ? (
                      <div className="w-full text-center space-y-1.5 p-3 rounded-2xl bg-gradient-to-b from-amber-100 to-amber-50 dark:from-amber-950/80 dark:to-amber-900/40 border-2 border-amber-400 dark:border-amber-500 shadow-md shadow-amber-500/20 relative">
                        {/* Crown icon on top */}
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-amber-500 animate-pulse">
                          <Crown size={22} className="fill-amber-400 text-amber-600 drop-shadow-xs" />
                        </div>
                        <div className="w-7 h-7 rounded-full bg-amber-400 text-amber-950 font-black text-xs flex items-center justify-center mx-auto -mt-5 border-2 border-white dark:border-amber-900 shadow-xs">
                          1
                        </div>
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 font-extrabold text-base flex items-center justify-center mx-auto shadow-sm ring-2 ring-amber-400/50">
                          {top1.name.charAt(0)}
                        </div>
                        <p className="text-xs font-extrabold text-[var(--color-text)] truncate max-w-full" title={top1.name}>
                          {top1.name}
                        </p>
                        <p className="text-[10px] text-amber-800 dark:text-amber-300 font-medium truncate max-w-full">
                          {top1.branchName || top1.position || "ผู้นำอันดับ 1"}
                        </p>
                        <div className="text-xs font-mono font-black text-amber-900 dark:text-amber-200 bg-amber-200/90 dark:bg-amber-950 rounded-md py-0.5 shadow-2xs">
                          {top1.point} แต้ม
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-28 rounded-2xl border border-dashed border-[var(--color-border)] flex items-center justify-center text-[10px] text-[var(--color-text-subtle)]">
                        ว่าง
                      </div>
                    )}
                  </div>

                  {/* Rank 3 (Bronze) */}
                  <div className="flex flex-col items-center">
                    {top3 ? (
                      <div className="w-full text-center space-y-1.5 p-2.5 rounded-2xl bg-orange-50/80 dark:bg-orange-950/40 border border-orange-300 dark:border-orange-800 shadow-xs relative">
                        <div className="w-6 h-6 rounded-full bg-amber-700 text-amber-100 font-black text-xs flex items-center justify-center mx-auto -mt-5 border-2 border-white dark:border-orange-900 shadow-xs">
                          3
                        </div>
                        <div className="w-10 h-10 rounded-full bg-amber-700/80 text-amber-100 font-extrabold text-sm flex items-center justify-center mx-auto shadow-2xs">
                          {top3.name.charAt(0)}
                        </div>
                        <p className="text-xs font-bold text-[var(--color-text)] truncate max-w-full" title={top3.name}>
                          {top3.name}
                        </p>
                        <p className="text-[10px] text-[var(--color-text-muted)] truncate max-w-full">
                          {top3.branchName || top3.position || "-"}
                        </p>
                        <div className="text-[11px] font-mono font-extrabold text-orange-800 dark:text-orange-300 bg-orange-200/70 dark:bg-orange-950 rounded-md py-0.5">
                          {top3.point} แต้ม
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-24 rounded-2xl border border-dashed border-[var(--color-border)] flex items-center justify-center text-[10px] text-[var(--color-text-subtle)]">
                        ว่าง
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ─── Current User's Personal Standing ──────────────── */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-[var(--color-surface-2)] to-orange-500/10 border-2 border-amber-500/40 shadow-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-amber-950 font-black flex items-center justify-center text-sm shadow-xs shrink-0">
                    {myRank ? `#${myRank}` : "-"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-[var(--color-text)] truncate">
                      {myRank === 1
                        ? "👑 คุณอยู่อันดับ 1 ผู้นำสัปดาห์นี้!"
                        : myRank && myRank <= 3
                        ? "🌟 คุณติด Top 3 สัปดาห์นี้!"
                        : myRank
                        ? `อันดับของคุณในสัปดาห์นี้: #${myRank}`
                        : "ยังไม่ติดอันดับสัปดาห์นี้"}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                      {myEntry ? `${myEntry.name} (${myEntry.position || myEntry.role})` : currentUser.name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {currentUser.pointStreak && currentUser.pointStreak > 0 ? (
                    <div className="flex items-center gap-1 text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-500/15 border border-orange-500/30 px-2 py-1 rounded-lg">
                      <Flame size={13} className="fill-orange-500" />
                      <span>{currentUser.pointStreak}</span>
                    </div>
                  ) : null}
                  <div className="text-xs font-extrabold font-mono text-amber-900 dark:text-amber-200 bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 rounded-lg">
                    {currentUser.point || 0} แต้ม
                  </div>
                </div>
              </div>

              {/* ─── Rankings List (Ranks 4-10) ──────────────────────── */}
              {leaderboard.length > 3 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-bold text-[var(--color-text-muted)] block px-1">
                    อันดับอื่นๆ ในตาราง:
                  </span>
                  <div className="divide-y divide-[var(--color-border)] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
                    {leaderboard.slice(3, 10).map((user, idx) => {
                      const rank = idx + 4;
                      const isMe = user.userId === currentUser.id;
                      return (
                        <div
                          key={user.userId}
                          className={`px-3 py-2 flex items-center justify-between gap-3 text-xs transition-colors ${
                            isMe ? "bg-amber-500/15 font-bold" : "hover:bg-[var(--color-surface-2)]/60"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-5 text-center font-mono font-bold text-[var(--color-text-muted)] text-[11px]">
                              #{rank}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-[var(--color-text)] truncate flex items-center gap-1.5">
                                <span>{user.name}</span>
                                {isMe && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-amber-500 text-amber-950 font-extrabold">
                                    คุณ
                                  </span>
                                )}
                              </p>
                              <p className="text-[10px] text-[var(--color-text-subtle)] truncate">
                                {user.branchName || user.position || user.role}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {user.pointStreak > 0 && (
                              <span className="flex items-center gap-0.5 text-[11px] font-bold text-orange-600 dark:text-orange-400">
                                <Flame size={12} className="fill-orange-500" />
                                {user.pointStreak}
                              </span>
                            )}
                            <span className="font-mono font-bold text-amber-800 dark:text-amber-300">
                              {user.point} แต้ม
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ─── Footer Action Bar ────────────────────────────────────────── */}
        <div className="p-4 sm:p-5 pt-3 bg-[var(--color-surface-2)]/60 border-t border-[var(--color-border)] flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={fireWeeklyConfetti}
            className="w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-bold border border-[var(--color-border)] hover:bg-[var(--color-surface)] text-[var(--color-text)] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            title="จุดพลุฉลองสัปดาห์ใหม่"
          >
            <PartyPopper size={14} className="text-amber-500" />
            <span>🎉 จุดพลุฉลองอีกครั้ง</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleClose}
              className="w-full sm:w-auto flex-1 px-5 py-2.5 bg-[var(--color-brown)] hover:bg-[var(--color-primary-dim)] text-amber-200 dark:bg-amber-400 dark:text-amber-950 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5"
            >
              <span>🚀 เริ่มลุยงานสัปดาห์นี้เลย!</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
