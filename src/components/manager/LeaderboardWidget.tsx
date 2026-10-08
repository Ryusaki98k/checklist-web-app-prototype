"use client";

import { useState, useEffect, useCallback } from "react";
import { Trophy, Flame, Award, Users } from "lucide-react";
import { LeaderboardEntry } from "../../types";
import { getLeaderboardAction } from "../../actions/points";
import { UserAvatar } from "../common/UserAvatar";

export function LeaderboardWidget({ branchId }: { branchId?: string }) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(() => {
    getLeaderboardAction(branchId)
      .then((res) => {
        if (res.success && res.leaderboard) {
          setLeaderboard(res.leaderboard);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [branchId]);

  useEffect(() => {
    fetchLeaderboard();

    const handleScoreUpdate = () => {
      fetchLeaderboard();
    };

    window.addEventListener("app:scores-updated", handleScoreUpdate);

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        bc = new BroadcastChannel("app_scores_sync");
        bc.onmessage = (msgEvent) => {
          if (msgEvent.data?.type === "SCORES_UPDATED") {
            fetchLeaderboard();
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
  }, [fetchLeaderboard]);

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--color-text)]">ตารางอันดับและผลงาน (Leaderboard)</h3>
            <p className="text-xs text-[var(--color-text-muted)]">คะแนนสะสมและสตรีคการปฏิบัติงานของทีมงาน</p>
          </div>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text)] font-bold border border-[var(--color-border)]">
          {leaderboard.length} คน
        </span>
      </div>

      {loading ? (
        <div className="p-6 text-center text-xs text-[var(--color-text-muted)] animate-pulse">
          กำลังโหลดอันดับผลงาน...
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="p-6 text-center text-xs text-[var(--color-text-muted)] flex flex-col items-center gap-1.5">
          <Users className="w-6 h-6 opacity-30" />
          <p className="font-bold text-[var(--color-text)]">ยังไม่มีข้อมูลคะแนนสะสมในสาขานี้</p>
          <p className="text-xs text-[var(--color-text-subtle)] max-w-xs">เมื่อพนักงานบันทึกและส่งมอบงานเช็คลิสต์ประจำวันเสร็จสมบูรณ์ คะแนนและสถิติสตรีคจะแสดงที่นี่</p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--color-border)] max-h-72 overflow-y-auto">
          {leaderboard.slice(0, 10).map((user, idx) => (
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
                    profileId: user.profileId,
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
                  <div className="flex items-center gap-0.5 text-xs font-bold text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800 px-2 py-0.5 rounded-lg">
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
      )}
    </div>
  );
}
