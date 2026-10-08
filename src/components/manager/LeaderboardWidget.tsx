"use client";

import { useState, useEffect, useCallback } from "react";
import { Trophy, Flame, Award, Users, Zap, Store, Globe, Building2, Sparkles } from "lucide-react";
import { LeaderboardEntry, BranchLeaderboardEntry } from "../../types";
import { getLeaderboardAction, getBranchLeaderboardAction } from "../../actions/points";
import { UserAvatar } from "../common/UserAvatar";

export type LeaderboardScope = "branch" | "global" | "branches";

export function LeaderboardWidget({ branchId }: { branchId?: string }) {
  const [view, setView] = useState<"weekly" | "current">("weekly");
  const [scope, setScope] = useState<LeaderboardScope>("branch");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [branchLeaderboard, setBranchLeaderboard] = useState<BranchLeaderboardEntry[]>([]);
  const [isSnapshot, setIsSnapshot] = useState(false);
  const [snapshotInfo, setSnapshotInfo] = useState<{
    weekStartDate: string;
    weekEndDate: string;
    processedAt: string;
    totalParticipants?: number;
    topScore?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(
    (targetScope = scope, targetView = view) => {
      setLoading(true);

      if (targetScope === "branches") {
        getBranchLeaderboardAction(targetView)
          .then((res) => {
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
          })
          .catch(console.error)
          .finally(() => setLoading(false));
      } else {
        const targetBranchId = targetScope === "branch" ? branchId : undefined;
        getLeaderboardAction({ branchId: targetBranchId, view: targetView })
          .then((res) => {
            if (res.success && res.leaderboard) {
              setLeaderboard(res.leaderboard);
              setIsSnapshot(Boolean(res.isSnapshot));
              setSnapshotInfo(res.snapshotInfo || null);
            }
          })
          .catch(console.error)
          .finally(() => setLoading(false));
      }
    },
    [branchId, scope, view]
  );

  useEffect(() => {
    fetchData(scope, view);

    const handleScoreUpdate = () => {
      fetchData(scope, view);
    };

    window.addEventListener("app:scores-updated", handleScoreUpdate);

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        bc = new BroadcastChannel("app_scores_sync");
        bc.onmessage = (msgEvent) => {
          if (msgEvent.data?.type === "SCORES_UPDATED") {
            fetchData(scope, view);
          }
        };
      }
    } catch (_) {}

    return () => {
      window.removeEventListener("app:scores-updated", handleScoreUpdate);
      if (bc) {
        try {
          bc.close();
        } catch (_) {}
      }
    };
  }, [fetchData, scope, view]);

  const handleViewChange = (newView: "weekly" | "current") => {
    setView(newView);
    fetchData(scope, newView);
  };

  const handleScopeChange = (newScope: LeaderboardScope) => {
    setScope(newScope);
    fetchData(newScope, view);
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

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-sm space-y-4">
      {/* Header and Controls */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text)]">ตารางอันดับและผลงาน (Leaderboard)</h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                {scope === "branches"
                  ? "การจัดอันดับการสะสมคะแนนระหว่างสาขา"
                  : scope === "branch"
                  ? "คะแนนและสถิติภายในสาขานี้ (Branch-wide)"
                  : "คะแนนและสถิติรวมทุกสาขาทั่วทั้งองค์กร (Global-wide)"}
              </p>
            </div>
          </div>

          {/* View Switcher (Weekly vs Live) */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center gap-1 bg-[var(--color-surface-2)] p-1 rounded-xl text-xs font-semibold border border-[var(--color-border)]">
              <button
                type="button"
                onClick={() => handleViewChange("weekly")}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  view === "weekly"
                    ? "bg-[var(--color-surface)] text-amber-700 dark:text-amber-300 font-extrabold shadow-xs"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }`}
                title="แสดงผลตารางอันดับที่สรุปเมื่อวันอาทิตย์ 23:55 น."
              >
                <Trophy size={12} className={view === "weekly" ? "text-amber-500" : ""} />
                <span>สรุปสัปดาห์</span>
              </button>
              <button
                type="button"
                onClick={() => handleViewChange("current")}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  view === "current"
                    ? "bg-[var(--color-surface)] text-cyan-700 dark:text-cyan-300 font-extrabold shadow-xs"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }`}
                title="แสดงคะแนนสะสมรอบปัจจุบัน (Live)"
              >
                <Zap size={12} className={view === "current" ? "text-cyan-500" : ""} />
                <span>รอบปัจจุบัน</span>
              </button>
            </div>

            <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text)] font-bold border border-[var(--color-border)] shrink-0">
              {scope === "branches" ? `${branchLeaderboard.length} สาขา` : `${leaderboard.length} คน`}
            </span>
          </div>
        </div>

        {/* Scope Selector (Branch-wide vs Global-wide vs Branch Rankings) */}
        <div className="flex items-center gap-1.5 p-1 bg-[var(--color-surface-2)] rounded-xl border border-[var(--color-border)] overflow-x-auto text-xs font-semibold">
          <button
            type="button"
            onClick={() => handleScopeChange("branch")}
            className={`flex-1 min-w-[100px] py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
              scope === "branch"
                ? "bg-[var(--color-surface)] text-amber-800 dark:text-amber-300 font-extrabold shadow-xs border border-amber-500/30"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
            title="แสดงอันดับเฉพาะพนักงานในสาขานี้ (Branch-wide)"
          >
            <Store size={13} className={scope === "branch" ? "text-amber-600" : ""} />
            <span>สาขานี้ (Branch-wide)</span>
          </button>
          <button
            type="button"
            onClick={() => handleScopeChange("global")}
            className={`flex-1 min-w-[100px] py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
              scope === "global"
                ? "bg-[var(--color-surface)] text-blue-800 dark:text-blue-300 font-extrabold shadow-xs border border-blue-500/30"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
            title="แสดงอันดับรวมพนักงานทุกสาขาทั่วประเทศ (Global-wide)"
          >
            <Globe size={13} className={scope === "global" ? "text-blue-500" : ""} />
            <span>ทุกสาขา (Global-wide)</span>
          </button>
          <button
            type="button"
            onClick={() => handleScopeChange("branches")}
            className={`flex-1 min-w-[100px] py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
              scope === "branches"
                ? "bg-[var(--color-surface)] text-purple-800 dark:text-purple-300 font-extrabold shadow-xs border border-purple-500/30"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
            title="แสดงการจัดอันดับการสะสมคะแนนรวมของแต่ละสาขา"
          >
            <Building2 size={13} className={scope === "branches" ? "text-purple-500" : ""} />
            <span>อันดับสาขา (Branches)</span>
          </button>
        </div>
      </div>

      {/* Snapshot Information Banner */}
      {view === "weekly" ? (
        <div className="p-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-300 font-medium truncate">
            <Trophy size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="truncate">
              {isSnapshot && snapshotInfo
                ? `ผลสรุปสัปดาห์ (${snapshotInfo.weekStartDate} ถึง ${snapshotInfo.weekEndDate})`
                : "ผลสรุปสัปดาห์ล่าสุด (บันทึกทุกวันอาทิตย์ 23:55 น.)"}
              {" • "}
              {scope === "branch" ? "ระดับสาขา" : scope === "global" ? "ระดับองค์กร (Global)" : "เปรียบเทียบสาขา"}
            </span>
          </div>
          <span className="text-[10px] text-amber-800/80 dark:text-amber-400/80 shrink-0 font-mono">
            {isSnapshot ? "Finalized" : "Ongoing"}
          </span>
        </div>
      ) : (
        <div className="p-2.5 rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-cyan-900 dark:text-cyan-300 font-medium truncate">
            <Zap size={13} className="text-cyan-600 dark:text-cyan-400 shrink-0" />
            <span className="truncate">
              คะแนนสะสมรอบสัปดาห์ปัจจุบัน (Live) • {scope === "branch" ? "ระดับสาขา" : scope === "global" ? "ระดับองค์กร" : "เปรียบเทียบสาขา"}
            </span>
          </div>
          <span className="text-[10px] text-cyan-800/80 dark:text-cyan-400/80 shrink-0 font-mono">
            Live
          </span>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="p-8 text-center text-xs text-[var(--color-text-muted)] animate-pulse">
          กำลังโหลดอันดับผลงาน...
        </div>
      ) : scope === "branches" ? (
        /* Branch vs Branch Leaderboard View */
        branchLeaderboard.length === 0 ? (
          <div className="p-6 text-center text-xs text-[var(--color-text-muted)] flex flex-col items-center gap-1.5">
            <Building2 className="w-6 h-6 opacity-30" />
            <p className="font-bold text-[var(--color-text)]">ยังไม่มีข้อมูลอันดับสาขา</p>
            <p className="text-xs text-[var(--color-text-subtle)] max-w-xs">
              ระบบจะแสดงคะแนนรวมและอันดับของแต่ละสาขาเมื่อมีการเริ่มสะสมแต้ม
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)] max-h-80 overflow-y-auto">
            {branchLeaderboard.map((branchItem, idx) => (
              <div
                key={branchItem.branchId}
                className={`py-3 px-2 flex items-center justify-between gap-3 hover:bg-[var(--color-surface-2)]/40 rounded-xl transition-colors ${
                  branchId && branchItem.branchId === branchId
                    ? "bg-amber-500/10 border border-amber-500/25"
                    : ""
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-6 flex items-center justify-center shrink-0">
                    {getRankBadge(idx)}
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/20 flex items-center justify-center shrink-0">
                    <Store className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-[var(--color-text)] truncate">
                        {branchItem.branchName}
                      </p>
                      {branchId && branchItem.branchId === branchId && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-800 dark:text-amber-200 font-bold shrink-0">
                          สาขาของคุณ
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-subtle)] truncate mt-0.5">
                      <span>ทีมงาน {branchItem.memberCount} คน</span>
                      <span>•</span>
                      <span>เฉลี่ย {branchItem.averagePoints} แต้ม/คน</span>
                      {branchItem.topPerformerName && (
                        <>
                          <span>•</span>
                          <span className="text-amber-700 dark:text-amber-300 flex items-center gap-0.5 truncate">
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            {branchItem.topPerformerName} ({branchItem.topPerformerPoints} แต้ม)
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1 text-xs font-black text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 px-3 py-1 rounded-xl shadow-2xs">
                    <Award className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>{branchItem.totalPoints}</span>
                    <span className="text-[10px] font-normal text-amber-800/80 dark:text-amber-300/80">แต้มรวม</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Individual Employee Leaderboard View (Branch-wide or Global-wide) */
        leaderboard.length === 0 ? (
          <div className="p-6 text-center text-xs text-[var(--color-text-muted)] flex flex-col items-center gap-1.5">
            <Users className="w-6 h-6 opacity-30" />
            <p className="font-bold text-[var(--color-text)]">
              {view === "weekly" ? "ยังไม่มีข้อมูลสรุปประจำสัปดาห์" : "ยังไม่มีคะแนนสะสมในรอบปัจจุบัน"}
            </p>
            <p className="text-xs text-[var(--color-text-subtle)] max-w-xs">
              {scope === "branch"
                ? "ยังไม่มีพนักงานในสาขานี้ที่มีคะแนนสะสม"
                : "เมื่อพนักงานปฏิบัติงานและได้รับการอนุมัติ คะแนนจะแสดงที่นี่"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)] max-h-80 overflow-y-auto">
            {leaderboard.slice(0, 15).map((user, idx) => (
              <div
                key={user.userId}
                className="py-2.5 flex items-center justify-between gap-3 hover:bg-[var(--color-surface-2)]/40 px-2 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-6 flex items-center justify-center shrink-0">
                    {getRankBadge(idx)}
                  </div>
                  <UserAvatar
                    user={{
                      name: user.name,
                      role: user.role,
                      position: user.position,
                      profile_id: user.profile_id,
                    }}
                    size="xs"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[var(--color-text)] truncate">{user.name}</p>
                    <p className="text-xs text-[var(--color-text-subtle)] truncate">
                      {user.position || user.role} {user.branchName ? `• ${user.branchName}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {user.pointStreak > 0 && (
                    <div
                      className="flex items-center gap-0.5 text-xs font-bold text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800 px-2 py-0.5 rounded-lg"
                      title="สตรีคการปฏิบัติงานต่อเนื่อง"
                    >
                      <Flame className="w-3 h-3 fill-orange-500" />
                      <span>{user.pointStreak}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-xs font-bold text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-2.5 py-0.5 rounded-lg">
                    <Award className="w-3 h-3 text-amber-500" />
                    <span>{user.point}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
