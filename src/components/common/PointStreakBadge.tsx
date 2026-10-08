"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Flame, Award, History, X, Trophy, Sparkles, Users, Store, Globe, Calendar, Zap, Building2 } from "lucide-react";
import { PointTransaction, LeaderboardEntry, BranchLeaderboardEntry } from "../../types";
import { getUserPointsAction, getLeaderboardAction, getBranchLeaderboardAction } from "../../actions/points";
import { useApp } from "../../context/AppContext";

export function PointStreakBadge() {
  const { currentUser } = useApp();
  const [points, setPoints] = useState<number>(currentUser?.point || 0);
  const [streak, setStreak] = useState<number>(currentUser?.pointStreak || 0);
  const [longestStreak, setLongestStreak] = useState<number>(currentUser?.longestStreak || 0);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Tabs: "my_stats" (default) or "leaderboard"
  type PopupTab = "my_stats" | "leaderboard";
  const [activeTab, setActiveTab] = useState<PopupTab>("my_stats");

  // Leaderboard state
  type LeaderboardViewType = "weekly" | "current";
  type LeaderboardScopeType = "branch" | "all" | "branches";
  const [leaderboardView, setLeaderboardView] = useState<LeaderboardViewType>("weekly");
  const [leaderboardScope, setLeaderboardScope] = useState<LeaderboardScopeType>("branch");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [branchLeaderboard, setBranchLeaderboard] = useState<BranchLeaderboardEntry[]>([]);
  const [isSnapshot, setIsSnapshot] = useState<boolean>(false);
  const [snapshotInfo, setSnapshotInfo] = useState<{
    weekStartDate: string;
    weekEndDate: string;
    processedAt: string;
    totalParticipants?: number;
    topScore?: number;
  } | null>(null);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentUserId = currentUser?.id;
  const fetchPointDetails = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const res = await getUserPointsAction(currentUserId);
      if (res.success) {
        setPoints(res.points ?? 0);
        setStreak(res.streak ?? 0);
        setLongestStreak(res.longestStreak ?? 0);
        if (res.transactions) setTransactions(res.transactions);
      }
    } catch (err) {
      console.error("Failed to load user point details:", err);
    }
  }, [currentUserId]);

  const currentBranchId = currentUser?.branchId;
  const fetchLeaderboard = useCallback(async (
    scope: LeaderboardScopeType = leaderboardScope,
    view: LeaderboardViewType = leaderboardView
  ) => {
    setIsLoadingLeaderboard(true);
    try {
      if (scope === "branches") {
        const res = await getBranchLeaderboardAction(view);
        if (res.success && res.branchLeaderboard) {
          setBranchLeaderboard(res.branchLeaderboard);
          setIsSnapshot(Boolean(res.isSnapshot));
          if (res.snapshotInfo) {
            setSnapshotInfo({
              ...res.snapshotInfo,
              totalParticipants: res.branchLeaderboard.length,
            });
          } else {
            setSnapshotInfo(null);
          }
        }
      } else {
        const bId = scope === "branch" ? currentBranchId : undefined;
        const res = await getLeaderboardAction({ branchId: bId, view });
        if (res.success && res.leaderboard) {
          setLeaderboard(res.leaderboard);
          setIsSnapshot(Boolean(res.isSnapshot));
          setSnapshotInfo(res.snapshotInfo || null);
        }
      }
    } catch (err) {
      console.error("Failed to load leaderboard:", err);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  }, [currentBranchId, leaderboardScope, leaderboardView]);

  useEffect(() => {
    void fetchPointDetails();
  }, [fetchPointDetails]);

  // React immediately whenever currentUser points or streak in AppContext changes
  useEffect(() => {
    if (currentUser) {
      setPoints(currentUser.point ?? 0);
      setStreak(currentUser.pointStreak ?? 0);
      setLongestStreak(currentUser.longestStreak ?? 0);
    }
  }, [currentUser?.point, currentUser?.pointStreak, currentUser?.longestStreak]);

  // Listen for score updates across window and tabs to refetch immediately
  useEffect(() => {
    if (!currentUserId) return;

    const handleScoreUpdate = (event?: CustomEvent) => {
      const targetUserId = event?.detail?.userId;
      if (!targetUserId || targetUserId === currentUserId) {
        void fetchPointDetails();
        if (isModalOpen) {
          void fetchLeaderboard(leaderboardScope);
        }
      }
    };

    window.addEventListener("app:scores-updated", handleScoreUpdate as EventListener);

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        bc = new BroadcastChannel("app_scores_sync");
        bc.onmessage = (msgEvent) => {
          if (msgEvent.data?.type === "SCORES_UPDATED") {
            const targetUserId = msgEvent.data?.userId;
            if (!targetUserId || targetUserId === currentUserId) {
              void fetchPointDetails();
              if (isModalOpen) {
                void fetchLeaderboard(leaderboardScope);
              }
            }
          }
        };
      }
    } catch (e) {
      console.warn("BroadcastChannel app_scores_sync unavailable:", e);
    }

    return () => {
      window.removeEventListener("app:scores-updated", handleScoreUpdate as EventListener);
      if (bc) {
        try {
          bc.close();
        } catch (_) {}
      }
    };
  }, [currentUserId, isModalOpen, leaderboardScope, fetchLeaderboard, fetchPointDetails]);

  const handleOpenModal = () => {
    setIsModalOpen(true);
    fetchPointDetails();
    fetchLeaderboard(leaderboardScope, leaderboardView);
  };

  const handleScopeChange = (newScope: LeaderboardScopeType) => {
    setLeaderboardScope(newScope);
    fetchLeaderboard(newScope, leaderboardView);
  };

  const handleViewChange = (newView: LeaderboardViewType) => {
    setLeaderboardView(newView);
    fetchLeaderboard(leaderboardScope, newView);
  };

  const getTier = (pts: number) => {
    if (pts >= 500) return { name: "ระดับแพลตตินัม", icon: "💎", color: "text-cyan-700 bg-cyan-50 border-cyan-200 dark:text-cyan-300 dark:bg-cyan-950/50 dark:border-cyan-800" };
    if (pts >= 250) return { name: "ระดับทอง", icon: "🥇", color: "text-amber-800 bg-amber-50 border-amber-300 dark:text-amber-300 dark:bg-amber-950/50 dark:border-amber-800" };
    if (pts >= 100) return { name: "ระดับเงิน", icon: "🥈", color: "text-slate-700 bg-slate-100 border-slate-300 dark:text-slate-200 dark:bg-slate-800 dark:border-slate-700" };
    return { name: "ระดับบรอนซ์", icon: "🥉", color: "text-amber-900 bg-orange-50 border-orange-200 dark:text-amber-300 dark:bg-orange-950/50 dark:border-orange-800" };
  };

  const getRankBadge = (index: number) => {
    if (index === 0) {
      return (
        <span className="w-5 h-5 rounded-full bg-amber-400 text-amber-950 text-xs font-mono font-black flex items-center justify-center shadow-xs">
          1
        </span>
      );
    }
    if (index === 1) {
      return (
        <span className="w-5 h-5 rounded-full bg-slate-300 text-slate-800 text-xs font-mono font-black flex items-center justify-center shadow-xs">
          2
        </span>
      );
    }
    if (index === 2) {
      return (
        <span className="w-5 h-5 rounded-full bg-amber-700 text-amber-100 text-xs font-mono font-black flex items-center justify-center shadow-xs">
          3
        </span>
      );
    }
    return (
      <span className="w-5 h-5 rounded-full bg-[var(--color-surface-2)] text-xs font-mono font-bold text-[var(--color-text-muted)] border border-[var(--color-border)] flex items-center justify-center">
        {index + 1}
      </span>
    );
  };

  const tier = getTier(points);

  if (!currentUser) return null;

  return (
    <>
      <button
        type="button"
        onClick={handleOpenModal}
        className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-xl bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] shadow-xs hover:shadow-sm active:scale-95 transition-all duration-150 cursor-pointer group focus-visible:outline-none focus:ring-2 focus:ring-amber-400 shrink-0 min-h-[36px]"
        title="คลิกเพื่อดูสถิติแต้ม สตรีค และตารางอันดับ (Leaderboard)"
      >
        {/* Streak Flame */}
        <div className="flex items-center gap-1 text-xs font-extrabold text-orange-700 dark:text-orange-400">
          <Flame className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-600 fill-orange-600 transition-transform duration-200 group-hover:scale-125 ${streak > 0 ? "animate-pulse" : "opacity-75"}`} />
          <span>{streak}</span>
        </div>

        <div className="w-px h-3.5 sm:h-4 bg-[var(--color-border)]" />

        {/* Total Points */}
        <div className="flex items-center gap-1 text-xs font-extrabold text-amber-900 dark:text-amber-300">
          <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-700 dark:text-amber-400" />
          <span>{points} <span className="text-xs font-semibold text-[var(--color-text-muted)] hidden md:inline">แต้ม</span></span>
        </div>

        {/* Tier badge icon */}
        <span className="text-xs ml-0.5 hidden xl:inline">{tier.icon}</span>
      </button>

      {/* Point History, Streak & Leaderboard Modal rendered via Portal */}
      {isModalOpen && mounted && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[88vh] relative z-10">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[var(--color-border)] bg-[var(--color-surface-2)] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[var(--color-text)]">แต้มสะสมและสถิติการทำงาน</h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {currentUser.name} {currentUser.position ? `• ${currentUser.position}` : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)] flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Segmented Tabs */}
            <div className="px-4 sm:px-5 pt-3 pb-2 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
              <div className="flex items-center gap-1 p-1 bg-[var(--color-surface-2)] rounded-xl border border-[var(--color-border)]">
                <button
                  type="button"
                  onClick={() => setActiveTab("my_stats")}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === "my_stats"
                      ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-xs"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                >
                  <Award className="w-3.5 h-3.5 text-amber-600" />
                  <span>สถิติ & ประวัติของฉัน</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("leaderboard");
                    if (leaderboard.length === 0) fetchLeaderboard();
                  }}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === "leaderboard"
                      ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-xs"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  <span>ตารางอันดับ (Leaderboard)</span>
                </button>
              </div>
            </div>

            {/* ─── TAB 1: MY STATS & HISTORY ─────────────────────────────────── */}
            {activeTab === "my_stats" && (
              <div className="flex-1 overflow-y-auto flex flex-col">
                {/* Stats Summary Cards */}
                <div className="p-4 sm:p-5 grid grid-cols-3 gap-2.5 bg-[var(--color-surface-2)]/30">
                  <div className="p-3 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] text-center shadow-xs">
                    <span className="text-[11px] font-medium text-[var(--color-text-muted)] block mb-1">แต้มสะสม</span>
                    <span className="text-lg font-black text-amber-800 dark:text-amber-300">{points}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] text-center shadow-xs">
                    <span className="text-[11px] font-medium text-[var(--color-text-muted)] block mb-1">สตรีคปัจจุบัน</span>
                    <span className="text-lg font-black text-orange-600 dark:text-orange-400 flex items-center justify-center gap-1">
                      <Flame className="w-4 h-4 fill-orange-500" /> {streak}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] text-center shadow-xs">
                    <span className="text-[11px] font-medium text-[var(--color-text-muted)] block mb-1">สตรีคสูงสุด</span>
                    <span className="text-lg font-black text-indigo-700 dark:text-indigo-300">🏆 {longestStreak}</span>
                  </div>
                </div>

                {/* Tier Banner */}
                <div className="px-4 sm:px-5 pb-2">
                  <div className={`p-3 rounded-2xl border flex items-center justify-between ${tier.color}`}>
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{tier.icon}</span>
                      <div>
                        <span className="text-xs font-bold block">{tier.name}</span>
                        <span className="text-[11px] font-medium leading-tight">ปฏิบัติงานตรงเวลาเพื่อรักษาสถิติจำนวนสตรีคต่อเนื่อง!</span>
                      </div>
                    </div>
                    <Sparkles className="w-4 h-4 shrink-0" />
                  </div>
                </div>

                {/* Transaction Ledger */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 pt-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-text)] mb-3">
                    <History className="w-4 h-4 text-amber-600" />
                    <span>ประวัติการได้รับแต้มล่าสุด</span>
                  </div>

                  {transactions.length === 0 ? (
                    <div className="text-center py-8 text-xs text-[var(--color-text-muted)]">
                      ยังไม่มีประวัติการได้รับแต้ม เมื่อผู้จัดการอนุมัติงานกะ แต้มจะแสดงที่นี่
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {transactions.map((t) => (
                        <div
                          key={t.id}
                          className="p-2.5 sm:p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-between gap-3 shadow-xs"
                        >
                          <div>
                            <p className="text-xs font-semibold text-[var(--color-text)]">{t.description}</p>
                            <p className="text-[11px] text-[var(--color-text-subtle)] mt-0.5">
                              {new Date(t.createdAt).toLocaleDateString("th-TH", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <span
                            className={`text-xs font-bold px-2.5 py-1 rounded-lg shrink-0 border ${
                              t.points >= 0
                                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                : "bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                            }`}
                          >
                            {t.points > 0 ? `+${t.points}` : t.points}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── TAB 2: LEADERBOARD ────────────────────────────────────────── */}
            {activeTab === "leaderboard" && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 flex flex-col">
                {/* Mode & Scope Selectors */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                  {/* View Type Switcher (Weekly Snapshot vs Live Current) */}
                  <div className="flex items-center gap-1 bg-[var(--color-surface-2)] p-1 rounded-xl text-xs font-semibold border border-[var(--color-border)]">
                    <button
                      type="button"
                      onClick={() => handleViewChange("weekly")}
                      className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        leaderboardView === "weekly"
                          ? "bg-[var(--color-surface)] text-amber-700 dark:text-amber-300 font-extrabold shadow-xs"
                          : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                      }`}
                      title="แสดงผลตารางอันดับที่ประมวลผลเมื่อวันอาทิตย์ 23:55 น."
                    >
                      <Trophy size={13} className={leaderboardView === "weekly" ? "text-amber-500" : ""} />
                      <span>สรุปสัปดาห์ (Weekly)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleViewChange("current")}
                      className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        leaderboardView === "current"
                          ? "bg-[var(--color-surface)] text-cyan-700 dark:text-cyan-300 font-extrabold shadow-xs"
                          : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                      }`}
                      title="แสดงคะแนนที่กำลังสะสมในรอบสัปดาห์ปัจจุบัน (Live)"
                    >
                      <Zap size={13} className={leaderboardView === "current" ? "text-cyan-500" : ""} />
                      <span>รอบปัจจุบัน (Live)</span>
                    </button>
                  </div>

                  {/* Scope Selector & Count */}
                  <div className="flex items-center justify-between sm:justify-end gap-1.5 flex-wrap">
                    <div className="flex items-center gap-1 bg-[var(--color-surface-2)] p-1 rounded-xl text-xs font-semibold border border-[var(--color-border)]">
                      <button
                        type="button"
                        onClick={() => handleScopeChange("branch")}
                        className={`px-2 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                          leaderboardScope === "branch"
                            ? "bg-[var(--color-surface)] text-amber-800 dark:text-amber-300 font-bold shadow-xs border border-amber-500/30"
                            : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                        }`}
                        title="อันดับเฉพาะในสาขาของคุณ (Branch-wide)"
                      >
                        <Store size={12} />
                        <span>สาขา</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleScopeChange("all")}
                        className={`px-2 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                          leaderboardScope === "all"
                            ? "bg-[var(--color-surface)] text-blue-800 dark:text-blue-300 font-bold shadow-xs border border-blue-500/30"
                            : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                        }`}
                        title="อันดับรวมพนักงานทุกสาขา (Global-wide)"
                      >
                        <Globe size={12} />
                        <span>ทุกสาขา</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleScopeChange("branches")}
                        className={`px-2 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                          leaderboardScope === "branches"
                            ? "bg-[var(--color-surface)] text-purple-800 dark:text-purple-300 font-bold shadow-xs border border-purple-500/30"
                            : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                        }`}
                        title="อันดับคะแนนรวมของแต่ละสาขา"
                      >
                        <Building2 size={12} />
                        <span>อันดับสาขา</span>
                      </button>
                    </div>

                    <span className="text-[11px] font-mono text-[var(--color-text-muted)] px-2 py-0.5 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-border)] shrink-0">
                      {leaderboardScope === "branches" ? `${branchLeaderboard.length} สาขา` : `${leaderboard.length} คน`}
                    </span>
                  </div>
                </div>

                {/* Contextual Status Banner */}
                {leaderboardView === "weekly" ? (
                  <div className="p-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 flex items-start gap-2.5">
                    <Trophy size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 text-[11px] leading-relaxed">
                      <span className="font-bold text-amber-900 dark:text-amber-300 block">
                        {isSnapshot && snapshotInfo
                          ? `🏆 ผลสรุปประจำสัปดาห์ (${snapshotInfo.weekStartDate} ถึง ${snapshotInfo.weekEndDate})`
                          : "🏆 ผลสรุปการจัดอันดับประจำสัปดาห์ (Weekly Leaderboard)"}
                        {" • "}
                        {leaderboardScope === "branch" ? "ในสาขาของคุณ" : leaderboardScope === "all" ? "รวมทุกสาขา" : "เปรียบเทียบสาขา"}
                      </span>
                      <span className="text-amber-800/80 dark:text-amber-300/80">
                        {isSnapshot && snapshotInfo
                          ? `ประมวลผลเมื่อวันอาทิตย์ เวลา 23:55 น. • รายการที่แข่งขัน ${snapshotInfo.totalParticipants ?? (leaderboardScope === "branches" ? branchLeaderboard.length : leaderboard.length)} รายการ`
                          : "ข้อมูลรวบรวมทุกคืนวันอาทิตย์ เวลา 23:55 น. เพื่อแสดงผลตลอดสัปดาห์จันทร์ถึงเสาร์"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl border border-cyan-500/25 bg-cyan-500/10 flex items-start gap-2.5">
                    <Zap size={15} className="text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 text-[11px] leading-relaxed">
                      <span className="font-bold text-cyan-900 dark:text-cyan-300 block">
                        ⚡ คะแนนสะสมรอบสัปดาห์ปัจจุบัน (Live Progress) • {leaderboardScope === "branch" ? "ในสาขาของคุณ" : leaderboardScope === "all" ? "รวมทุกสาขา" : "เปรียบเทียบสาขา"}
                      </span>
                      <span className="text-cyan-800/80 dark:text-cyan-300/80">
                        เริ่มสะสมแต้มใหม่ตั้งแต่วันจันทร์ • จะถูกประมวลผลเป็นทำเนียบสัปดาห์และรีเซ็ตในวันอาทิตย์ 23:55 น.
                      </span>
                    </div>
                  </div>
                )}

                {/* Branch Rankings View */}
                {leaderboardScope === "branches" ? (
                  isLoadingLeaderboard ? (
                    <div className="p-8 text-center text-xs text-[var(--color-text-muted)] flex flex-col items-center gap-2.5">
                      <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                      <span>กำลังโหลดอันดับสาขา...</span>
                    </div>
                  ) : branchLeaderboard.length === 0 ? (
                    <div className="p-8 text-center text-xs text-[var(--color-text-muted)] flex flex-col items-center gap-2 bg-[var(--color-surface-2)]/30 rounded-2xl border border-[var(--color-border)]">
                      <Building2 className="w-8 h-8 opacity-30 text-[var(--color-text-muted)]" />
                      <p className="font-bold text-[var(--color-text)]">ยังไม่มีข้อมูลอันดับสาขา</p>
                      <p className="text-[11px] max-w-xs text-[var(--color-text-subtle)]">
                        คะแนนรวมของแต่ละสาขาจะแสดงที่นี่เมื่อมีการสะสมแต้ม
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[var(--color-border)] max-h-72 overflow-y-auto pr-1 space-y-1">
                      {branchLeaderboard.map((b, idx) => {
                        const isMyBranch = currentUser?.branchId && b.branchId === currentUser.branchId;
                        return (
                          <div
                            key={b.branchId}
                            className={`py-2 px-2.5 rounded-xl flex items-center justify-between gap-2.5 transition-colors ${
                              isMyBranch
                                ? "bg-amber-500/15 border-2 border-amber-400 dark:border-amber-600 shadow-xs my-1"
                                : "hover:bg-[var(--color-surface-2)]/60"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-5 flex items-center justify-center shrink-0">
                                {getRankBadge(idx)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-[var(--color-text)] truncate flex items-center gap-1.5">
                                  <span>{b.branchName}</span>
                                  {isMyBranch && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-amber-500 text-amber-950 font-extrabold shadow-xs">
                                      สาขาของคุณ
                                    </span>
                                  )}
                                </p>
                                <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                                  ทีม {b.memberCount} คน • เฉลี่ย {b.averagePoints} แต้ม/คน
                                  {b.topPerformerName && ` • ⭐ ${b.topPerformerName}`}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex items-center gap-1 text-xs font-black text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-2.5 py-0.5 rounded-lg">
                                <Award className="w-3 h-3 text-amber-500" />
                                <span>{b.totalPoints}</span>
                                <span className="text-[10px] font-normal text-amber-700 dark:text-amber-300">แต้ม</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  <>
                    {/* My Ranking Spotlight Card (Individual) */}
                    {(() => {
                      const myIndex = leaderboard.findIndex(u => u.userId === currentUser.id);
                      const myRecord = myIndex >= 0 ? leaderboard[myIndex] : null;
                      const displayScore = leaderboardView === "weekly" && myRecord ? myRecord.point : points;
                      return (
                        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-[var(--color-surface-2)] to-orange-500/10 border-2 border-amber-500/30 flex items-center justify-between text-xs shadow-xs">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-amber-500 text-amber-950 font-black flex items-center justify-center text-sm shadow-xs shrink-0">
                              {myIndex >= 0 ? `#${myIndex + 1}` : "-"}
                            </div>
                            <div>
                              <p className="font-extrabold text-[var(--color-text)]">
                                {myIndex >= 0 ? `คุณอยู่อันดับที่ #${myIndex + 1}` : "อันดับของคุณ"}
                              </p>
                              <p className="text-[11px] text-[var(--color-text-muted)]">
                                {leaderboardView === "weekly" ? "ผลสรุปสัปดาห์ที่แล้ว" : "คะแนนสะสมรอบปัจจุบัน"}
                                {" • "}
                                {leaderboardScope === "branch" ? "ในสาขาของคุณ" : "รวมทุกสาขา"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-right">
                            {streak > 0 && (
                              <span className="flex items-center gap-0.5 text-orange-600 dark:text-orange-400 font-bold bg-orange-500/10 px-2 py-0.5 rounded-lg border border-orange-500/20" title="สตรีคการปฏิบัติงานต่อเนื่อง">
                                <Flame className="w-3.5 h-3.5 fill-orange-500" /> {streak}
                              </span>
                            )}
                            <span className="font-extrabold text-amber-800 dark:text-amber-300 bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/20">
                              {displayScore} แต้ม
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Leaderboard List */}
                    {isLoadingLeaderboard ? (
                      <div className="p-8 text-center text-xs text-[var(--color-text-muted)] flex flex-col items-center gap-2.5">
                        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        <span>กำลังโหลดตารางอันดับ...</span>
                      </div>
                    ) : leaderboard.length === 0 ? (
                      <div className="p-8 text-center text-xs text-[var(--color-text-muted)] flex flex-col items-center gap-2 bg-[var(--color-surface-2)]/30 rounded-2xl border border-[var(--color-border)]">
                        <Users className="w-8 h-8 opacity-30 text-[var(--color-text-muted)]" />
                        <p className="font-bold text-[var(--color-text)]">ยังไม่มีข้อมูลคะแนนสะสม</p>
                        <p className="text-[11px] max-w-xs text-[var(--color-text-subtle)]">
                          เมื่อเริ่มส่งมอบงานเช็คลิสต์และได้รับการอนุมัติ คะแนนและสถิติจะแสดงที่นี่
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-[var(--color-border)] max-h-72 overflow-y-auto pr-1 space-y-1">
                        {leaderboard.map((user, idx) => {
                          const isMe = user.userId === currentUser.id;
                          return (
                            <div
                              key={user.userId}
                              className={`py-2 px-2.5 rounded-xl flex items-center justify-between gap-2.5 transition-colors ${
                                isMe 
                                  ? "bg-amber-500/15 border-2 border-amber-400 dark:border-amber-600 shadow-xs my-1" 
                                  : "hover:bg-[var(--color-surface-2)]/60"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-5 flex items-center justify-center shrink-0">
                                  {getRankBadge(idx)}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-[var(--color-text)] truncate flex items-center gap-1.5">
                                    <span>{user.name}</span>
                                    {isMe && (
                                      <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-amber-500 text-amber-950 font-extrabold shadow-xs">
                                        คุณ
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                                    {user.position || user.role} {user.branchName ? `• ${user.branchName}` : ""}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {user.pointStreak > 0 && (
                                  <div className="flex items-center gap-0.5 text-xs font-bold text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800 px-1.5 py-0.5 rounded-lg">
                                    <Flame className="w-3 h-3 fill-orange-500" />
                                    <span>{user.pointStreak}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-1 text-xs font-bold text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-lg">
                                  <Award className="w-3 h-3 text-amber-500" />
                                  <span>{user.point}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="p-3.5 bg-[var(--color-surface-2)] border-t border-[var(--color-border)] flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  window.dispatchEvent(new CustomEvent("open-weekly-leaderboard"));
                }}
                className="flex-1 py-2.5 px-3 bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 dark:text-amber-200 border border-amber-500/30 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                title="เปิดดูสรุปอันดับต้นสัปดาห์และเอฟเฟกต์พลุฉลอง"
              >
                <span>🏆 สรุปอันดับต้นสัปดาห์ (ดูพลุ)</span>
              </button>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2.5 bg-[var(--color-brown)] hover:bg-[var(--color-brown-light)] text-amber-100 font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-sm"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
