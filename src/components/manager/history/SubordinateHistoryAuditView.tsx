"use client";

import React, { useMemo, useState } from "react";
import { ShiftSession, ShiftType, ChecklistItem } from "../../../types";
import { fmtDate, fmtTime } from "../../../data/storage";
import { getShiftBadge } from "../../common/Badge";
import {
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Search,
  Sparkles,
  ShieldCheck,
  ListChecks,
  AlertTriangle,
  History,
  Layers,
  FileText,
} from "lucide-react";
import { UserAvatar } from "../../common/UserAvatar";

export interface SubordinateHistoryAuditViewProps {
  sessions: ShiftSession[];
  approvals: Record<string, { assistantApproved?: boolean; managerApproved?: boolean }>;
  onSelectSession: (sess: ShiftSession) => void;
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
  todayIso: string;
  yesterdayIso: string;
  isLoading: boolean;
  isManager: boolean;
  isAssistant: boolean;
  currentUserId?: string;
  branchName?: string;
}

interface SubordinateSummary {
  userId: string;
  userName: string;
  userPosition: string;
  userRole?: string;
  userProfileId?: string | null;
  totalShifts: number;
  completedShifts: number;
  totalTasksDone: number;
  totalTasksCount: number;
  overallCompletionPct: number;
  approvedCount: number;
  pendingCount: number;
  lateTasksCount: number;
  incompleteCasesCount: number;
  latestShift: ShiftSession;
  sessions: ShiftSession[];
}

export function SubordinateHistoryAuditView({
  sessions,
  approvals,
  onSelectSession,
  selectedDate,
  onSelectDate,
  todayIso,
  yesterdayIso,
  isLoading,
  isManager,
  isAssistant,
  currentUserId,
  branchName,
}: SubordinateHistoryAuditViewProps) {
  // Search and Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "assistant" | "employee" | "me">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "issues">("all");
  const [shiftFilter, setShiftFilter] = useState<"all" | ShiftType>("all");
  const [viewMode, setViewMode] = useState<"dossier" | "timeline">("dossier");
  const [expandedUserIds, setExpandedUserIds] = useState<Set<string>>(new Set());

  // 1. Separate subordinates from current manager
  // Managers primarily audit Assistant Managers and Staff under them!
  const { subordinateSessions, myOwnSessions } = useMemo(() => {
    const subs: ShiftSession[] = [];
    const mine: ShiftSession[] = [];

    sessions.forEach((s) => {
      const isMine = currentUserId && s.userId === currentUserId;
      if (isMine) {
        mine.push(s);
      } else {
        subs.push(s);
      }
    });

    return { subordinateSessions: subs, myOwnSessions: mine };
  }, [sessions, currentUserId]);

  // Active pool based on roleFilter
  const activePool = useMemo(() => {
    if (roleFilter === "me") return myOwnSessions;
    return subordinateSessions;
  }, [roleFilter, myOwnSessions, subordinateSessions]);

  // 2. Aggregate metrics per person
  const personSummaries = useMemo<SubordinateSummary[]>(() => {
    const map = new Map<string, ShiftSession[]>();

    activePool.forEach((s) => {
      const existing = map.get(s.userId) || [];
      existing.push(s);
      map.set(s.userId, existing);
    });

    const summaries: SubordinateSummary[] = [];

    map.forEach((userSessions, userId) => {
      // Sort user sessions descending by startedAt
      const sorted = [...userSessions].sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );
      const latest = sorted[0];

      let totalTasksDone = 0;
      let totalTasksCount = 0;
      let approvedCount = 0;
      let pendingCount = 0;
      let lateTasksCount = 0;
      let incompleteCasesCount = 0;
      let completedShifts = 0;

      sorted.forEach((sess) => {
        if (sess.completedAt) completedShifts++;
        if (sess.incompleteStatus && sess.incompleteStatus !== "none") {
          incompleteCasesCount++;
        }

        const app = approvals[sess.id] || {};
        if (app.managerApproved) {
          approvedCount++;
        } else {
          pendingCount++;
        }

        sess.items.forEach((it) => {
          totalTasksCount++;
          if (it.completedAt) totalTasksDone++;
          if (it.isLate) lateTasksCount++;
        });
      });

      const overallCompletionPct =
        totalTasksCount > 0 ? Math.round((totalTasksDone / totalTasksCount) * 100) : 0;

      summaries.push({
        userId,
        userName: latest.userName,
        userPosition: latest.userPosition || "พนักงานประจำสาขา",
        userRole: latest.userRole,
        userProfileId: latest.userProfileId,
        totalShifts: sorted.length,
        completedShifts,
        totalTasksDone,
        totalTasksCount,
        overallCompletionPct,
        approvedCount,
        pendingCount,
        lateTasksCount,
        incompleteCasesCount,
        latestShift: latest,
        sessions: sorted,
      });
    });

    // Default sort: Personnel with pending approvals first, then by total shifts descending
    return summaries.sort((a, b) => {
      if (b.pendingCount !== a.pendingCount) return b.pendingCount - a.pendingCount;
      return b.totalShifts - a.totalShifts;
    });
  }, [activePool, approvals]);

  // 3. Filtered Summaries for Dossier View
  const filteredSummaries = useMemo(() => {
    return personSummaries.filter((p) => {
      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.userName.toLowerCase().includes(q);
        const matchPos = p.userPosition.toLowerCase().includes(q);
        if (!matchName && !matchPos) return false;
      }

      // Role filter
      if (roleFilter === "assistant") {
        const isAssistantRole =
          p.userRole === "manager_assistant" ||
          p.userPosition.includes("ผู้ช่วยผู้จัดการ") ||
          p.latestShift.taskRole === "manager_assistant";
        if (!isAssistantRole) return false;
      } else if (roleFilter === "employee") {
        const isAssistantRole =
          p.userRole === "manager_assistant" ||
          p.userPosition.includes("ผู้ช่วยผู้จัดการ") ||
          p.latestShift.taskRole === "manager_assistant";
        if (isAssistantRole) return false;
      }

      // Status filter
      if (statusFilter === "pending" && p.pendingCount === 0) return false;
      if (statusFilter === "approved" && p.pendingCount > 0) return false;
      if (statusFilter === "issues" && p.lateTasksCount === 0 && p.incompleteCasesCount === 0) return false;

      // Shift filter: check if person has any session matching shift
      if (shiftFilter !== "all") {
        const hasShift = p.sessions.some((s) => s.shift === shiftFilter);
        if (!hasShift) return false;
      }

      return true;
    });
  }, [personSummaries, searchQuery, roleFilter, statusFilter, shiftFilter]);

  // 4. Filtered Sessions for Timeline View
  const filteredTimelineSessions = useMemo(() => {
    return activePool.filter((sess) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = sess.userName.toLowerCase().includes(q);
        const matchPos = (sess.userPosition || "").toLowerCase().includes(q);
        if (!matchName && !matchPos) return false;
      }

      // Role filter
      if (roleFilter === "assistant") {
        const isAsst =
          sess.userRole === "manager_assistant" ||
          (sess.userPosition || "").includes("ผู้ช่วยผู้จัดการ") ||
          sess.taskRole === "manager_assistant";
        if (!isAsst) return false;
      } else if (roleFilter === "employee") {
        const isAsst =
          sess.userRole === "manager_assistant" ||
          (sess.userPosition || "").includes("ผู้ช่วยผู้จัดการ") ||
          sess.taskRole === "manager_assistant";
        if (isAsst) return false;
      }

      // Shift filter
      if (shiftFilter !== "all" && sess.shift !== shiftFilter) return false;

      // Status filter
      const app = approvals[sess.id] || {};
      const isPending = !app.managerApproved;
      if (statusFilter === "pending" && !isPending) return false;
      if (statusFilter === "approved" && isPending) return false;
      if (statusFilter === "issues") {
        const hasLates = sess.items.some((i) => i.isLate);
        const hasIncomplete = sess.incompleteStatus && sess.incompleteStatus !== "none";
        if (!hasLates && !hasIncomplete) return false;
      }

      return true;
    });
  }, [activePool, searchQuery, roleFilter, shiftFilter, statusFilter, approvals]);

  // Overall statistics for top KPI strip
  const topStats = useMemo(() => {
    const totalPeople = personSummaries.length;
    const totalShifts = activePool.length;
    let totalDone = 0;
    let totalItems = 0;
    let pendingCount = 0;
    let lateCount = 0;
    let incompleteCount = 0;

    activePool.forEach((s) => {
      const app = approvals[s.id] || {};
      if (!app.managerApproved) pendingCount++;
      if (s.incompleteStatus && s.incompleteStatus !== "none") incompleteCount++;
      s.items.forEach((it) => {
        totalItems++;
        if (it.completedAt) totalDone++;
        if (it.isLate) lateCount++;
      });
    });

    const completionRate = totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 0;

    return {
      totalPeople,
      totalShifts,
      completionRate,
      pendingCount,
      lateCount,
      incompleteCount,
    };
  }, [personSummaries, activePool, approvals]);

  // Accordion toggle helpers
  const toggleExpand = (userId: string) => {
    setExpandedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedUserIds(new Set(filteredSummaries.map((p) => p.userId)));
  };

  const collapseAll = () => {
    setExpandedUserIds(new Set());
  };

  // Helper for position pill color
  const getPositionBadge = (pos?: string, role?: string) => {
    const isAsst =
      role === "manager_assistant" ||
      (pos && pos.includes("ผู้ช่วยผู้จัดการ"));
    if (isAsst) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
          <ShieldCheck size={12} className="text-indigo-600 dark:text-indigo-400" />
          <span>ผู้ช่วยผู้จัดการร้าน</span>
        </span>
      );
    }
    if (pos && pos.includes("แคชเชียร์")) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
          แคชเชียร์
        </span>
      );
    }
    if (pos && (pos.includes("สต็อก") || pos.includes("จัดเรียง"))) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
          พนักงานสต็อก/จัดเรียง
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border border-[var(--color-border)]">
        {pos || "พนักงานประจำสาขา"}
      </span>
    );
  };

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-6 shadow-sm space-y-5 animate-fade-in">
      {/* ─── 1. Header Toolbar ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)] flex items-center gap-2">
              <History size={20} className="text-amber-600 shrink-0" />
              <span>ประวัติและรายงานผลงานทีมงาน (Team Audit Dossier)</span>
            </h2>
            {branchName && (
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20">
                {branchName}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-1 flex flex-wrap items-center gap-1.5">
            {selectedDate ? (
              <span className="text-amber-800 dark:text-amber-300 font-bold">
                📅 ข้อมูลประจำวันที่: {fmtDate(selectedDate)} ({activePool.length} กะที่ปฏิบัติงาน)
              </span>
            ) : (
              <span>
                บันทึกการปฏิบัติงานย้อนหลัง 14 วัน • รวมผู้ช่วยผู้จัดการร้านและพนักงานประจำสาขา
              </span>
            )}
          </p>
        </div>

        {/* View Mode Toggle & Fast Count */}
        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <div className="bg-[var(--color-surface-2)] p-1 rounded-xl border border-[var(--color-border)] inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => setViewMode("dossier")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                viewMode === "dossier"
                  ? "bg-[var(--color-brown)] text-amber-100 shadow-2xs"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              <Users size={14} />
              <span>สรุปรายบุคคล</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("timeline")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                viewMode === "timeline"
                  ? "bg-[var(--color-brown)] text-amber-100 shadow-2xs"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              <Layers size={14} />
              <span>ประวัติรายกะ ({activePool.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── 2. High-Density Executive KPI Strip ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <div className="bg-[var(--color-surface-2)]/70 border border-[var(--color-border)] p-3 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] text-[var(--color-text-muted)] block font-medium">ทีมงานที่ทำงาน</span>
            <span className="text-lg font-black text-[var(--color-text)]">{topStats.totalPeople} <span className="text-xs font-normal text-[var(--color-text-muted)]">คน</span></span>
          </div>
          <Users size={22} className="text-indigo-500 shrink-0 opacity-80" />
        </div>

        <div className="bg-[var(--color-surface-2)]/70 border border-[var(--color-border)] p-3 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] text-[var(--color-text-muted)] block font-medium">กะงานทั้งหมด</span>
            <span className="text-lg font-black text-[var(--color-text)]">{topStats.totalShifts} <span className="text-xs font-normal text-[var(--color-text-muted)]">กะ</span></span>
          </div>
          <FileText size={22} className="text-amber-500 shrink-0 opacity-80" />
        </div>

        <div className="bg-[var(--color-surface-2)]/70 border border-[var(--color-border)] p-3 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] text-[var(--color-text-muted)] block font-medium">ความสำเร็จเฉลี่ย</span>
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
              {topStats.completionRate}%
            </span>
          </div>
          <Sparkles size={22} className="text-emerald-500 shrink-0 opacity-80" />
        </div>

        <div className={`border p-3 rounded-xl flex items-center justify-between ${
          topStats.pendingCount > 0
            ? "bg-amber-500/10 border-amber-300 dark:border-amber-800"
            : "bg-[var(--color-surface-2)]/70 border-[var(--color-border)]"
        }`}>
          <div>
            <span className="text-[11px] text-[var(--color-text-muted)] block font-medium">รอผู้จัดการรับรอง</span>
            <span className={`text-lg font-black ${topStats.pendingCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-[var(--color-text)]"}`}>
              {topStats.pendingCount} <span className="text-xs font-normal text-[var(--color-text-muted)]">กะ</span>
            </span>
          </div>
          <Clock size={22} className={topStats.pendingCount > 0 ? "text-amber-600 shrink-0 animate-pulse" : "text-[var(--color-text-muted)] shrink-0"} />
        </div>

        <div className={`col-span-2 sm:col-span-1 border p-3 rounded-xl flex items-center justify-between ${
          topStats.lateCount > 0 || topStats.incompleteCount > 0
            ? "bg-rose-500/10 border-rose-300 dark:border-rose-800"
            : "bg-[var(--color-surface-2)]/70 border-[var(--color-border)]"
        }`}>
          <div>
            <span className="text-[11px] text-[var(--color-text-muted)] block font-medium">ส่งงานสาย / เคสขาด</span>
            <span className={`text-lg font-black ${topStats.lateCount > 0 || topStats.incompleteCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-[var(--color-text)]"}`}>
              {topStats.lateCount} <span className="text-xs font-normal text-[var(--color-text-muted)]">สาย</span> • {topStats.incompleteCount} <span className="text-xs font-normal text-[var(--color-text-muted)]">เคส</span>
            </span>
          </div>
          <AlertTriangle size={22} className={topStats.lateCount > 0 ? "text-rose-600 shrink-0" : "text-[var(--color-text-muted)] shrink-0"} />
        </div>
      </div>

      {/* ─── 3. Filter Controls ─── */}
      <div className="space-y-3 bg-[var(--color-surface-2)]/40 p-3 sm:p-4 rounded-xl border border-[var(--color-border)]">
        {/* Row 1: Role Pills & Status Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Target Role Selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 lg:pb-0">
            <span className="text-xs font-bold text-[var(--color-text-muted)] mr-1 shrink-0">บุคลากร:</span>
            {[
              { id: "all", label: "ทีมงานทั้งหมด", count: subordinateSessions.length },
              { id: "assistant", label: "ผู้ช่วยผู้จัดการ", count: subordinateSessions.filter(s => s.userRole === "manager_assistant" || s.taskRole === "manager_assistant").length },
              { id: "employee", label: "พนักงานประจำสาขา", count: subordinateSessions.filter(s => s.userRole !== "manager_assistant" && s.taskRole !== "manager_assistant").length },
              ...(myOwnSessions.length > 0 ? [{ id: "me", label: "กะของฉันเอง", count: myOwnSessions.length }] : []),
            ].map((rf) => (
              <button
                key={rf.id}
                type="button"
                onClick={() => setRoleFilter(rf.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 shrink-0 ${
                  roleFilter === rf.id
                    ? "bg-[var(--color-brown)] text-amber-100 shadow-2xs font-extrabold"
                    : "bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)]"
                }`}
              >
                <span>{rf.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  roleFilter === rf.id ? "bg-amber-950/80 text-amber-200" : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                }`}>
                  {rf.count}
                </span>
              </button>
            ))}
          </div>

          {/* Shift Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 lg:pb-0">
            <span className="text-xs font-bold text-[var(--color-text-muted)] mr-1 shrink-0">กะ:</span>
            {(["all", "morning", "afternoon", "night"] as const).map((sh) => (
              <button
                key={sh}
                type="button"
                onClick={() => setShiftFilter(sh)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer shrink-0 ${
                  shiftFilter === sh
                    ? "bg-[var(--color-text)] text-[var(--color-surface)] shadow-2xs font-bold"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] bg-[var(--color-surface)] border border-[var(--color-border)]"
                }`}
              >
                {sh === "all" ? "ทุกกะ" : sh === "morning" ? "กะเช้า" : sh === "afternoon" ? "กะบ่าย" : "กะดึก"}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Status Tabs, Search, and Date Picker */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-[var(--color-border)]/70">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap ${
                statusFilter === "all"
                  ? "bg-amber-500 text-amber-950 font-bold"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]"
              }`}
            >
              สถานะทั้งหมด
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("pending")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap inline-flex items-center gap-1 ${
                statusFilter === "pending"
                  ? "bg-amber-400 text-amber-950 font-bold"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]"
              }`}
            >
              <span>รอตรวจ</span>
              {topStats.pendingCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("approved")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap ${
                statusFilter === "approved"
                  ? "bg-amber-500 text-amber-950 font-bold"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]"
              }`}
            >
              อนุมัติแล้ว
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("issues")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap ${
                statusFilter === "issues"
                  ? "bg-rose-500 text-white font-bold"
                  : "text-[var(--color-text-muted)] hover:text-rose-600 hover:bg-[var(--color-surface)]"
              }`}
            >
              มีปัญหา/ส่งสาย
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text"
              placeholder="ค้นหาชื่อหรือตำแหน่งทีมงาน..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Row 3: Date Controls & Shortcuts */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--color-border)]/60">
          <div className="flex items-center gap-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-2.5 py-1">
            <Calendar size={14} className="text-amber-600 shrink-0" />
            <span className="text-xs text-[var(--color-text-muted)] font-medium">ระบุวันที่:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onSelectDate(e.target.value)}
              className="bg-transparent text-xs text-[var(--color-text)] focus:outline-none cursor-pointer"
            />
            {selectedDate && (
              <button
                type="button"
                onClick={() => onSelectDate("")}
                className="text-xs text-rose-500 hover:text-rose-700 font-bold px-1.5 py-0.5 rounded cursor-pointer"
                title="ล้างวันที่เฉพาะเจาะจงและกลับไปแสดงย้อนหลัง 14 วัน"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => onSelectDate(todayIso)}
            className={`px-2.5 py-1 text-xs rounded-xl font-semibold border transition-all cursor-pointer ${
              selectedDate === todayIso
                ? "bg-amber-400 text-amber-950 border-amber-500 font-bold"
                : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            วันนี้
          </button>

          <button
            type="button"
            onClick={() => onSelectDate(yesterdayIso)}
            className={`px-2.5 py-1 text-xs rounded-xl font-semibold border transition-all cursor-pointer ${
              selectedDate === yesterdayIso
                ? "bg-amber-400 text-amber-950 border-amber-500 font-bold"
                : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            เมื่อวาน
          </button>

          {selectedDate && (
            <button
              type="button"
              onClick={() => onSelectDate("")}
              className="px-2.5 py-1 text-xs rounded-xl font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 transition-all cursor-pointer"
            >
              ย้อนหลัง 14 วันล่าสุด
            </button>
          )}

          {viewMode === "dossier" && filteredSummaries.length > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={expandAll}
                className="text-xs text-[var(--color-text-muted)] hover:text-amber-700 dark:hover:text-amber-300 cursor-pointer"
              >
                ขยายทั้งหมด
              </button>
              <span className="text-[var(--color-border)]">•</span>
              <button
                type="button"
                onClick={collapseAll}
                className="text-xs text-[var(--color-text-muted)] hover:text-amber-700 dark:hover:text-amber-300 cursor-pointer"
              >
                ย่อทั้งหมด
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── 4. Main Content: Dossier View vs Timeline View ─── */}
      {isLoading && personSummaries.length === 0 ? (
        <div className="py-20 text-center text-[var(--color-text-muted)] text-xs flex flex-col items-center justify-center gap-3">
          <div className="w-7 h-7 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="font-medium">กำลังรวบรวมข้อมูลประวัติทีมงาน...</span>
        </div>
      ) : viewMode === "dossier" ? (
        // ─── DOSSIER VIEW (Concise, Info-Packed per Employee) ───
        filteredSummaries.length === 0 ? (
          <div className="py-14 text-center text-[var(--color-text-muted)] text-xs border border-dashed border-[var(--color-border)] rounded-2xl bg-[var(--color-surface-2)]/30 p-6 space-y-1">
            <p className="font-bold text-[var(--color-text)]">ไม่พบบันทึกการปฏิบัติงานของทีมงานตามเงื่อนไขที่เลือก</p>
            <p className="text-[var(--color-text-muted)]">ลองปรับเปลี่ยนคำค้นหา หรือเลือกตัวกรองเป็น &quot;ทีมงานทั้งหมด&quot;</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSummaries.map((person) => {
              const isExpanded = expandedUserIds.has(person.userId);
              const isAssistantUser =
                person.userRole === "manager_assistant" ||
                person.userPosition.includes("ผู้ช่วยผู้จัดการ") ||
                person.latestShift.taskRole === "manager_assistant";

              return (
                <div
                  key={person.userId}
                  className={`border rounded-2xl transition-all duration-200 overflow-hidden shadow-2xs ${
                    isExpanded
                      ? "bg-[var(--color-surface)] border-amber-400 dark:border-amber-700 ring-1 ring-amber-400/20"
                      : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-amber-300 dark:hover:border-amber-700"
                  }`}
                >
                  {/* Employee Dossier Header / Summary Row */}
                  <div
                    onClick={() => toggleExpand(person.userId)}
                    className="p-3.5 sm:p-4 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 select-none"
                  >
                    {/* Left: Avatar & Profile */}
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar
                        name={person.userName}
                        profile_id={person.userProfileId}
                        role={person.userRole as any}
                        size="md"
                        className="shrink-0 shadow-xs"
                      />

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-[var(--color-text)] truncate">
                            {person.userName}
                          </span>
                          {getPositionBadge(person.userPosition, person.userRole)}

                          {/* Approval Status Badges */}
                          {person.pendingCount > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-950 bg-amber-400 px-2 py-0.5 rounded-full shadow-2xs">
                              <AlertCircle size={12} className="shrink-0" />
                              <span>รอผู้จัดการรับรอง {person.pendingCount} กะ</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                              <CheckCircle2 size={12} className="text-emerald-600" />
                              <span>อนุมัติครบแล้ว</span>
                            </span>
                          )}

                          {person.incompleteCasesCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded-full">
                              <span>มีเคสขาด {person.incompleteCasesCount}</span>
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-2 flex-wrap">
                          <span>
                            กะล่าสุด: {fmtDate(person.latestShift.startedAt)} เวลา {fmtTime(person.latestShift.startedAt)} น.
                          </span>
                          <span className="text-[var(--color-border)]">•</span>
                          <span>{getShiftBadge(person.latestShift.shift)}</span>
                        </p>
                      </div>
                    </div>

                    {/* Right: High-Density KPIs & Chevron */}
                    <div className="flex items-center justify-between md:justify-end gap-3 sm:gap-5 pt-2 md:pt-0 border-t md:border-t-0 border-[var(--color-border)]/60">
                      {/* Metric 1: Total Shifts */}
                      <div className="text-left md:text-right">
                        <span className="text-[10px] text-[var(--color-text-muted)] block font-medium">กะงาน</span>
                        <span className="text-xs sm:text-sm font-bold text-[var(--color-text)]">
                          {person.totalShifts} กะ
                        </span>
                      </div>

                      {/* Metric 2: Completion Progress */}
                      <div className="text-left md:text-right min-w-[90px]">
                        <div className="flex items-center justify-between md:justify-end gap-1.5 text-xs font-mono">
                          <span className="text-[10px] text-[var(--color-text-muted)] block md:hidden">สำเร็จ</span>
                          <span className="font-bold text-[var(--color-text)]">
                            {person.overallCompletionPct}%
                          </span>
                        </div>
                        <div className="w-full bg-[var(--color-border)] h-1.5 rounded-full overflow-hidden mt-1">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              person.overallCompletionPct === 100
                                ? "bg-emerald-500"
                                : person.overallCompletionPct >= 80
                                ? "bg-amber-400"
                                : "bg-rose-500"
                            }`}
                            style={{ width: `${person.overallCompletionPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Metric 3: Punctuality */}
                      <div className="text-left md:text-right hidden sm:block">
                        <span className="text-[10px] text-[var(--color-text-muted)] block font-medium">ความตรงต่อเวลา</span>
                        <span className={`text-xs font-bold ${
                          person.lateTasksCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"
                        }`}>
                          {person.lateTasksCount > 0 ? `ส่งสาย ${person.lateTasksCount} รายการ` : "ตรงเวลา 100%"}
                        </span>
                      </div>

                      {/* Expand / Collapse Chevron */}
                      <div className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300 font-bold pl-1">
                        <span className="hidden sm:inline">{isExpanded ? "ซ่อนกะ" : "ดูกะงาน"}</span>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                  </div>

                  {/* Accordion Content: Detailed Shift List */}
                  {isExpanded && (
                    <div className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-3 sm:p-4 space-y-2.5">
                      <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] font-bold px-1">
                        <span>รายการกะที่ปฏิบัติงาน ({person.sessions.length} กะ)</span>
                        <span>คลิกเพื่อดูและตรวจรับรองรายข้อ</span>
                      </div>

                      <div className="space-y-2">
                        {person.sessions.map((sess) => {
                          const app = approvals[sess.id] || {};
                          const isFullyApproved = Boolean(app.managerApproved);
                          const isAssistantApproved = Boolean(app.assistantApproved);
                          const doneCount = sess.items.filter((i) => i.completedAt).length;
                          const pct = Math.round((doneCount / (sess.items.length || 1)) * 100);
                          const hasLate = sess.items.some((i) => i.isLate);

                          return (
                            <div
                              key={sess.id}
                              onClick={() => onSelectSession(sess)}
                              className="w-full text-left p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] hover:border-amber-400 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs"
                            >
                              <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                                <div className="text-xs font-bold text-[var(--color-text)]">
                                  {fmtDate(sess.startedAt)}
                                </div>
                                {getShiftBadge(sess.shift)}
                                <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
                                  เริ่ม {fmtTime(sess.startedAt)} น. {sess.completedAt ? `→ เสร็จ ${fmtTime(sess.completedAt)} น.` : ""}
                                </span>

                                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] font-semibold">
                                  {doneCount}/{sess.items.length} ข้อ ({pct}%)
                                </span>

                                {hasLate && (
                                  <span className="text-[10px] font-bold text-rose-700 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 px-1.5 py-0.5 rounded">
                                    มีส่งสาย
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                {/* Approval Badge */}
                                {isFullyApproved ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-md">
                                    <CheckCircle2 size={12} className="text-emerald-600" />
                                    <span>อนุมัติแล้ว</span>
                                  </span>
                                ) : isAssistantApproved ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 px-2 py-0.5 rounded-md animate-pulse">
                                    <AlertCircle size={12} className="text-amber-600" />
                                    <span>รอผู้จัดการรับรอง</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-text-muted)] bg-[var(--color-surface-2)] border border-[var(--color-border)] px-2 py-0.5 rounded-md">
                                    <span>รอดำเนินการรับรอง</span>
                                  </span>
                                )}

                                <span className="text-xs text-amber-700 dark:text-amber-300 font-bold inline-flex items-center gap-1">
                                  <span>เปิดตรวจ</span>
                                  <ChevronRight size={14} />
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        // ─── TIMELINE VIEW (Chronological Shift Feed) ───
        filteredTimelineSessions.length === 0 ? (
          <div className="py-14 text-center text-[var(--color-text-muted)] text-xs border border-dashed border-[var(--color-border)] rounded-2xl bg-[var(--color-surface-2)]/30 p-6 space-y-1">
            <p className="font-bold text-[var(--color-text)]">ไม่พบประวัติกะงานตามเงื่อนไขที่เลือก</p>
            <p className="text-[var(--color-text-muted)]">ลองปรับเปลี่ยนตัวกรอง หรือล้างวันที่ที่ระบุ</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredTimelineSessions.map((sess) => {
              const app = approvals[sess.id] || {};
              const isFullyApproved = Boolean(app.managerApproved);
              const isAssistantApproved = Boolean(app.assistantApproved);
              const doneCount = sess.items.filter((i) => i.completedAt).length;
              const pct = Math.round((doneCount / (sess.items.length || 1)) * 100);

              return (
                <button
                  key={sess.id}
                  type="button"
                  onClick={() => onSelectSession(sess)}
                  className="w-full text-left p-3.5 sm:p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)]/60 hover:border-amber-400 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar
                      name={sess.userName}
                      profile_id={sess.userProfileId}
                      role={sess.userRole as any}
                      size="sm"
                      className="shrink-0 shadow-xs"
                    />
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-[var(--color-text)]">{sess.userName}</span>
                      {getPositionBadge(sess.userPosition, sess.userRole)}
                      {getShiftBadge(sess.shift)}
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] font-semibold text-[var(--color-text)]">
                        {doneCount}/{sess.items.length} รายการ ({pct}%)
                      </span>

                      {/* Approval Badge */}
                      {isFullyApproved ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-md">
                          <CheckCircle2 size={12} className="text-emerald-600" />
                          <span>อนุมัติแล้ว</span>
                        </span>
                      ) : isAssistantApproved ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 px-2 py-0.5 rounded-md animate-pulse">
                          <AlertCircle size={12} className="text-amber-600" />
                          <span>รอผู้จัดการรับรอง</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-text-muted)] bg-[var(--color-surface-2)] border border-[var(--color-border)] px-2 py-0.5 rounded-md">
                          <span>รอดำเนินการรับรอง</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-[var(--color-text-muted)]">
                      {fmtDate(sess.startedAt)} • เริ่ม {fmtTime(sess.startedAt)} น. {sess.completedAt ? `→ เสร็จ ${fmtTime(sess.completedAt)} น.` : ""}
                    </p>
                  </div>
                </div>

                <span className="text-xs text-amber-700 dark:text-amber-300 font-bold flex items-center gap-1 shrink-0">
                    <span>เปิดตรวจ</span>
                    <ChevronRight size={14} />
                  </span>
                </button>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
