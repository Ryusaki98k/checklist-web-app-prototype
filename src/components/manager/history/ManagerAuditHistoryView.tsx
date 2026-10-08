"use client";

import React, { useMemo, useState } from "react";
import { ShiftSession, ShiftType } from "../../../types";
import { fmtDate, fmtTime } from "../../../data/storage";
import { getShiftBadge } from "../../common/Badge";
import {
  Building2,
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
  Award,
  Layers,
  History,
  FileCheck2,
  AlertTriangle,
  UserCheck,
} from "lucide-react";
import { UserAvatar } from "../../common/UserAvatar";

export interface ManagerAuditHistoryViewProps {
  sessions: ShiftSession[];
  approvals: Record<string, { assistantApproved?: boolean; managerApproved?: boolean }>;
  onSelectSession: (sess: ShiftSession) => void;
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
  todayIso: string;
  yesterdayIso: string;
  isLoading: boolean;
  branches?: Array<{ id: string; name: string }>;
  managers?: Array<{ id: string; name: string; branchId?: string; branchName?: string }>;
}

interface ManagerSummary {
  managerId: string;
  managerName: string;
  branchId?: string;
  branchName: string;
  managerShiftsCount: number;
  managerCompletionPct: number;
  managerSessions: ShiftSession[];
  branchSubordinateSessions: ShiftSession[];
  branchTotalSubordinateShifts: number;
  branchApprovedSubordinateShifts: number;
  branchPendingSubordinateShifts: number;
  branchApprovalCompliancePct: number;
  branchAvgSubordinateCompletionPct: number;
  branchIncompleteCases: number;
  branchLateItems: number;
  latestActivityAt?: string | null;
}

export function ManagerAuditHistoryView({
  sessions,
  approvals,
  onSelectSession,
  selectedDate,
  onSelectDate,
  todayIso,
  yesterdayIso,
  isLoading,
  branches: initialBranches,
  managers: initialManagers,
}: ManagerAuditHistoryViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "compliant" | "issues">("all");
  const [shiftFilter, setShiftFilter] = useState<"all" | ShiftType>("all");
  const [viewMode, setViewMode] = useState<"managers" | "timeline">("managers");
  const [expandedManagerIds, setExpandedManagerIds] = useState<Set<string>>(new Set());
  const [managerDetailSubTab, setManagerDetailSubTab] = useState<Record<string, "manager_shifts" | "branch_staff">>({});

  // 1. Identify distinct branches and manager records
  const allBranches = useMemo(() => {
    if (initialBranches && initialBranches.length > 0) return initialBranches;
    const branchMap = new Map<string, string>();
    sessions.forEach((s) => {
      if (s.branchName) {
        branchMap.set(s.branchId || s.branchName, s.branchName);
      }
    });
    return Array.from(branchMap.entries()).map(([id, name]) => ({ id, name }));
  }, [initialBranches, sessions]);

  // 2. Aggregate Data per Store Manager across branches
  const managerSummaries = useMemo<ManagerSummary[]>(() => {
    // Collect all candidate managers
    // We check: initialManagers prop, sessions where userRole === 'manager', or userPosition === 'ผู้จัดการร้าน'
    const candidateManagersMap = new Map<string, { id: string; name: string; branchId?: string; branchName?: string }>();

    (initialManagers || []).forEach((m) => {
      candidateManagersMap.set(m.id, m);
    });

    sessions.forEach((s) => {
      const isMgr =
        s.userRole === "manager" ||
        (s.userPosition && s.userPosition.includes("ผู้จัดการร้าน") && !s.userPosition.includes("ผู้ช่วย"));
      if (isMgr) {
        if (!candidateManagersMap.has(s.userId)) {
          candidateManagersMap.set(s.userId, {
            id: s.userId,
            name: s.userName,
            branchId: s.branchId,
            branchName: s.branchName,
          });
        }
      }
    });

    // Fallback: If no managers were found in DB yet, group sessions by branch to show Branch Managers
    if (candidateManagersMap.size === 0 && allBranches.length > 0) {
      allBranches.forEach((b) => {
        candidateManagersMap.set(`branch-mgr-${b.id}`, {
          id: `branch-mgr-${b.id}`,
          name: `ผู้จัดการประจำ ${b.name}`,
          branchId: b.id,
          branchName: b.name,
        });
      });
    }

    const summaries: ManagerSummary[] = [];

    candidateManagersMap.forEach((mgr, managerId) => {
      // Find manager's branch
      const branchId = mgr.branchId;
      const branchName =
        mgr.branchName ||
        allBranches.find((b) => b.id === branchId)?.name ||
        "สาขาหลัก";

      // Manager's own shift sessions
      const managerSessions = sessions.filter(
        (s) => s.userId === managerId || (s.userRole === "manager" && s.userName === mgr.name)
      ).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

      let managerTasksDone = 0;
      let managerTasksTotal = 0;
      managerSessions.forEach((s) => {
        s.items.forEach((it) => {
          managerTasksTotal++;
          if (it.completedAt) managerTasksDone++;
        });
      });
      const managerCompletionPct =
        managerTasksTotal > 0 ? Math.round((managerTasksDone / managerTasksTotal) * 100) : 100;

      // Subordinate sessions belonging to this manager's branch
      const branchSubordinateSessions = sessions.filter((s) => {
        const isNotThisMgr = s.userId !== managerId;
        const matchesBranch =
          (branchId && s.branchId === branchId) ||
          (s.branchName && s.branchName === branchName);
        return isNotThisMgr && matchesBranch;
      }).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

      let approvedSubordinateShifts = 0;
      let pendingSubordinateShifts = 0;
      let subDoneTasks = 0;
      let subTotalTasks = 0;
      let branchIncompleteCases = 0;
      let branchLateItems = 0;

      branchSubordinateSessions.forEach((sess) => {
        const app = approvals[sess.id] || {};
        if (app.managerApproved) {
          approvedSubordinateShifts++;
        } else {
          pendingSubordinateShifts++;
        }

        if (sess.incompleteStatus && sess.incompleteStatus !== "none") {
          branchIncompleteCases++;
        }

        sess.items.forEach((it) => {
          subTotalTasks++;
          if (it.completedAt) subDoneTasks++;
          if (it.isLate) branchLateItems++;
        });
      });

      const totalSubShifts = branchSubordinateSessions.length;
      const branchApprovalCompliancePct =
        totalSubShifts > 0 ? Math.round((approvedSubordinateShifts / totalSubShifts) * 100) : 100;

      const branchAvgSubordinateCompletionPct =
        subTotalTasks > 0 ? Math.round((subDoneTasks / subTotalTasks) * 100) : 100;

      // Latest activity
      const latestManagerShift = managerSessions[0]?.startedAt;
      const latestSubShift = branchSubordinateSessions[0]?.startedAt;
      let latestActivityAt: string | null = null;
      if (latestManagerShift && latestSubShift) {
        latestActivityAt = new Date(latestManagerShift) > new Date(latestSubShift) ? latestManagerShift : latestSubShift;
      } else {
        latestActivityAt = latestManagerShift || latestSubShift || null;
      }

      summaries.push({
        managerId,
        managerName: mgr.name,
        branchId,
        branchName,
        managerShiftsCount: managerSessions.length,
        managerCompletionPct,
        managerSessions,
        branchSubordinateSessions,
        branchTotalSubordinateShifts: totalSubShifts,
        branchApprovedSubordinateShifts: approvedSubordinateShifts,
        branchPendingSubordinateShifts: pendingSubordinateShifts,
        branchApprovalCompliancePct,
        branchAvgSubordinateCompletionPct,
        branchIncompleteCases,
        branchLateItems,
        latestActivityAt,
      });
    });

    // Default sort: Managers with pending approvals first, then by total branch activity
    return summaries.sort((a, b) => {
      if (b.branchPendingSubordinateShifts !== a.branchPendingSubordinateShifts) {
        return b.branchPendingSubordinateShifts - a.branchPendingSubordinateShifts;
      }
      return b.branchTotalSubordinateShifts - a.branchTotalSubordinateShifts;
    });
  }, [initialManagers, sessions, allBranches, approvals]);

  // 3. Filtered Summaries
  const filteredSummaries = useMemo(() => {
    return managerSummaries.filter((m) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = m.managerName.toLowerCase().includes(q);
        const matchBranch = m.branchName.toLowerCase().includes(q);
        if (!matchName && !matchBranch) return false;
      }

      // Branch filter
      if (selectedBranchFilter !== "all") {
        const matchId = m.branchId === selectedBranchFilter;
        const matchName = m.branchName === selectedBranchFilter;
        if (!matchId && !matchName) return false;
      }

      // Status filter
      if (statusFilter === "pending" && m.branchPendingSubordinateShifts === 0) return false;
      if (statusFilter === "compliant" && m.branchPendingSubordinateShifts > 0) return false;
      if (statusFilter === "issues" && m.branchIncompleteCases === 0 && m.branchLateItems === 0) return false;

      // Shift filter
      if (shiftFilter !== "all") {
        const hasShiftInMgr = m.managerSessions.some((s) => s.shift === shiftFilter);
        const hasShiftInBranch = m.branchSubordinateSessions.some((s) => s.shift === shiftFilter);
        if (!hasShiftInMgr && !hasShiftInBranch) return false;
      }

      return true;
    });
  }, [managerSummaries, searchQuery, selectedBranchFilter, statusFilter, shiftFilter]);

  // 4. Filtered Timeline Sessions (All Sessions Feed)
  const filteredTimelineSessions = useMemo(() => {
    return sessions.filter((sess) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = sess.userName.toLowerCase().includes(q);
        const matchBranch = (sess.branchName || "").toLowerCase().includes(q);
        const matchPos = (sess.userPosition || "").toLowerCase().includes(q);
        if (!matchName && !matchBranch && !matchPos) return false;
      }

      // Branch filter
      if (selectedBranchFilter !== "all") {
        const matchId = sess.branchId === selectedBranchFilter;
        const matchName = sess.branchName === selectedBranchFilter;
        if (!matchId && !matchName) return false;
      }

      // Shift filter
      if (shiftFilter !== "all" && sess.shift !== shiftFilter) return false;

      // Status filter
      const app = approvals[sess.id] || {};
      const isPending = !app.managerApproved;
      if (statusFilter === "pending" && !isPending) return false;
      if (statusFilter === "compliant" && isPending) return false;
      if (statusFilter === "issues") {
        const hasLates = sess.items.some((i) => i.isLate);
        const hasIncomplete = sess.incompleteStatus && sess.incompleteStatus !== "none";
        if (!hasLates && !hasIncomplete) return false;
      }

      return true;
    });
  }, [sessions, searchQuery, selectedBranchFilter, shiftFilter, statusFilter, approvals]);

  // Overall statistics for Executive Top KPI Strip
  const executiveStats = useMemo(() => {
    const totalManagers = managerSummaries.length;
    const totalBranchesCount = allBranches.length || managerSummaries.length;
    let totalManagerShifts = 0;
    let totalBranchSubShifts = 0;
    let totalApprovedSubShifts = 0;
    let totalPendingSubShifts = 0;
    let totalIncompletes = 0;

    managerSummaries.forEach((m) => {
      totalManagerShifts += m.managerShiftsCount;
      totalBranchSubShifts += m.branchTotalSubordinateShifts;
      totalApprovedSubShifts += m.branchApprovedSubordinateShifts;
      totalPendingSubShifts += m.branchPendingSubordinateShifts;
      totalIncompletes += m.branchIncompleteCases;
    });

    const companyApprovalRate =
      totalBranchSubShifts > 0 ? Math.round((totalApprovedSubShifts / totalBranchSubShifts) * 100) : 100;

    return {
      totalManagers,
      totalBranchesCount,
      totalManagerShifts,
      totalBranchSubShifts,
      totalPendingSubShifts,
      companyApprovalRate,
      totalIncompletes,
    };
  }, [managerSummaries, allBranches]);

  // Accordion toggling
  const toggleExpand = (id: string) => {
    setExpandedManagerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedManagerIds(new Set(filteredSummaries.map((m) => m.managerId)));
  };

  const collapseAll = () => {
    setExpandedManagerIds(new Set());
  };

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-6 shadow-sm space-y-5 animate-fade-in">
      {/* ─── 1. Header Toolbar ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)] flex items-center gap-2">
            <History size={20} className="text-amber-700 shrink-0" />
            <span>ประวัติและการกำกับดูแลผู้จัดการร้าน (Store Managers Governance Dossier)</span>
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-1 flex flex-wrap items-center gap-1.5">
            {selectedDate ? (
              <span className="text-amber-800 dark:text-amber-300 font-bold">
                📅 กำลังแสดงข้อมูลประจำวันที่: {fmtDate(selectedDate)} ({sessions.length} กะรวมทั่วประเทศ)
              </span>
            ) : (
              <span>
                รายงานและประวัติย้อนหลัง 14 วัน • ติดตามผลการทำงานของผู้จัดการร้านและการตรวจรับรองงานสาขา
              </span>
            )}
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <div className="bg-[var(--color-surface-2)] p-1 rounded-xl border border-[var(--color-border)] inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => setViewMode("managers")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                viewMode === "managers"
                  ? "bg-[var(--color-brown)] text-amber-100 shadow-2xs"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              <UserCheck size={14} />
              <span>สรุปผู้จัดการร้าน ({filteredSummaries.length})</span>
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
              <span>ประวัติกะทั้งหมด ({sessions.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── 2. Executive KPI Strip ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <div className="bg-[var(--color-surface-2)]/70 border border-[var(--color-border)] p-3 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] text-[var(--color-text-muted)] block font-medium">ผู้จัดการร้าน</span>
            <span className="text-lg font-black text-[var(--color-text)]">
              {executiveStats.totalManagers} <span className="text-xs font-normal text-[var(--color-text-muted)]">ท่าน</span>
            </span>
          </div>
          <Award size={22} className="text-amber-600 shrink-0 opacity-80" />
        </div>

        <div className="bg-[var(--color-surface-2)]/70 border border-[var(--color-border)] p-3 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] text-[var(--color-text-muted)] block font-medium">สาขาที่กำกับดูแล</span>
            <span className="text-lg font-black text-[var(--color-text)]">
              {executiveStats.totalBranchesCount} <span className="text-xs font-normal text-[var(--color-text-muted)]">สาขา</span>
            </span>
          </div>
          <Building2 size={22} className="text-teal-600 shrink-0 opacity-80" />
        </div>

        <div className="bg-[var(--color-surface-2)]/70 border border-[var(--color-border)] p-3 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] text-[var(--color-text-muted)] block font-medium">อัตราการตรวจรับรองสาขา</span>
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
              {executiveStats.companyApprovalRate}%
            </span>
          </div>
          <ShieldCheck size={22} className="text-emerald-500 shrink-0 opacity-80" />
        </div>

        <div className={`border p-3 rounded-xl flex items-center justify-between ${
          executiveStats.totalPendingSubShifts > 0
            ? "bg-amber-500/10 border-amber-300 dark:border-amber-800"
            : "bg-[var(--color-surface-2)]/70 border-[var(--color-border)]"
        }`}>
          <div>
            <span className="text-[11px] text-[var(--color-text-muted)] block font-medium">ค้างตรวจรับรองลูกทีม</span>
            <span className={`text-lg font-black ${executiveStats.totalPendingSubShifts > 0 ? "text-amber-600 dark:text-amber-400" : "text-[var(--color-text)]"}`}>
              {executiveStats.totalPendingSubShifts} <span className="text-xs font-normal text-[var(--color-text-muted)]">กะ</span>
            </span>
          </div>
          <Clock size={22} className={executiveStats.totalPendingSubShifts > 0 ? "text-amber-600 shrink-0 animate-pulse" : "text-[var(--color-text-muted)] shrink-0"} />
        </div>

        <div className="col-span-2 sm:col-span-1 bg-[var(--color-surface-2)]/70 border border-[var(--color-border)] p-3 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] text-[var(--color-text-muted)] block font-medium">กะผู้จัดการ/ปิดร้าน</span>
            <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
              {executiveStats.totalManagerShifts} <span className="text-xs font-normal text-[var(--color-text-muted)]">กะ</span>
            </span>
          </div>
          <FileCheck2 size={22} className="text-indigo-500 shrink-0 opacity-80" />
        </div>
      </div>

      {/* ─── 3. Filter Controls ─── */}
      <div className="space-y-3 bg-[var(--color-surface-2)]/40 p-3 sm:p-4 rounded-xl border border-[var(--color-border)]">
        {/* Row 1: Branch Filter Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            <span className="text-xs font-bold text-[var(--color-text-muted)] mr-1 shrink-0">สาขา:</span>
            <button
              type="button"
              onClick={() => setSelectedBranchFilter("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedBranchFilter === "all"
                  ? "bg-[var(--color-brown)] text-amber-100 shadow-2xs font-extrabold"
                  : "bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)]"
              }`}
            >
              ทุกสาขา ({allBranches.length})
            </button>
            {allBranches.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedBranchFilter(b.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  selectedBranchFilter === b.id
                    ? "bg-[var(--color-brown)] text-amber-100 shadow-2xs font-extrabold"
                    : "bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)]"
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>

          {/* Shift Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
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

        {/* Row 2: Status & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-[var(--color-border)]/70">
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
              ทั้งหมด
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
              <span>มีงานค้างรับรอง</span>
              {executiveStats.totalPendingSubShifts > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("compliant")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap ${
                statusFilter === "compliant"
                  ? "bg-amber-500 text-amber-950 font-bold"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]"
              }`}
            >
              รับรองครบถ้วน 100%
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
              มีเคสขาด/ส่งสาย
            </button>
          </div>

          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text"
              placeholder="ค้นหาชื่อผู้จัดการ หรือชื่อสาขา..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Row 3: Date Controls */}
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

          {viewMode === "managers" && filteredSummaries.length > 0 && (
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

      {/* ─── 4. Main Content: Store Managers Dossier vs Timeline Feed ─── */}
      {isLoading ? (
        <div className="py-20 text-center text-[var(--color-text-muted)] text-xs flex flex-col items-center justify-center gap-3">
          <div className="w-7 h-7 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="font-medium">กำลังรวบรวมข้อมูลผู้จัดการร้านและสถิติสาขา...</span>
        </div>
      ) : viewMode === "managers" ? (
        filteredSummaries.length === 0 ? (
          <div className="py-14 text-center text-[var(--color-text-muted)] text-xs border border-dashed border-[var(--color-border)] rounded-2xl bg-[var(--color-surface-2)]/30 p-6 space-y-1">
            <p className="font-bold text-[var(--color-text)]">ไม่พบข้อมูลผู้จัดการร้านตามเงื่อนไขที่เลือก</p>
            <p className="text-[var(--color-text-muted)]">ลองเลือกตัวกรองเป็น &quot;ทุกสาขา&quot; หรือปรับคำค้นหา</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredSummaries.map((m) => {
              const isExpanded = expandedManagerIds.has(m.managerId);
              const activeSubTab = managerDetailSubTab[m.managerId] || "manager_shifts";

              return (
                <div
                  key={m.managerId}
                  className={`border rounded-2xl transition-all duration-200 overflow-hidden shadow-2xs ${
                    isExpanded
                      ? "bg-[var(--color-surface)] border-amber-400 dark:border-amber-700 ring-1 ring-amber-400/20"
                      : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-amber-300 dark:hover:border-amber-700"
                  }`}
                >
                  {/* Store Manager Dossier Header */}
                  <div
                    onClick={() => toggleExpand(m.managerId)}
                    className="p-4 cursor-pointer flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 select-none"
                  >
                    {/* Left: Manager Identity */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <UserAvatar
                        name={m.managerName}
                        role="manager"
                        size="md"
                        className="shrink-0 shadow-xs"
                      />

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-sm sm:text-base text-[var(--color-text)] truncate">
                            {m.managerName}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-500/30">
                            <Award size={12} className="text-amber-600" />
                            <span>ผู้จัดการร้าน</span>
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-800">
                            <Building2 size={12} className="text-teal-600" />
                            <span>{m.branchName}</span>
                          </span>

                          {/* Compliance Status Badge */}
                          {m.branchPendingSubordinateShifts > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-950 bg-amber-400 px-2 py-0.5 rounded-full shadow-2xs">
                              <AlertCircle size={12} className="shrink-0" />
                              <span>ค้างรับรองลูกทีม {m.branchPendingSubordinateShifts} กะ</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                              <CheckCircle2 size={12} className="text-emerald-600" />
                              <span>รับรองงานสาขาครบถ้วน</span>
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-2 flex-wrap">
                          {m.latestActivityAt ? (
                            <span>ความเคลื่อนไหวล่าสุด: {fmtDate(m.latestActivityAt)} เวลา {fmtTime(m.latestActivityAt)} น.</span>
                          ) : (
                            <span>ยังไม่มีความเคลื่อนไหวในรอบวันที่เลือก</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Right: Executive KPIs Strip */}
                    <div className="flex items-center justify-between lg:justify-end gap-3 sm:gap-6 pt-2 lg:pt-0 border-t lg:border-t-0 border-[var(--color-border)]/60">
                      {/* Metric 1: Manager Personal Checklists */}
                      <div className="text-left lg:text-right">
                        <span className="text-[10px] text-[var(--color-text-muted)] block font-medium">กะผู้จัดการ</span>
                        <span className="text-xs sm:text-sm font-bold text-[var(--color-text)]">
                          {m.managerShiftsCount} กะ
                        </span>
                      </div>

                      {/* Metric 2: Branch Approval Compliance */}
                      <div className="text-left lg:text-right min-w-[95px]">
                        <div className="flex items-center justify-between lg:justify-end gap-1.5 text-xs font-mono">
                          <span className="text-[10px] text-[var(--color-text-muted)] block lg:hidden">การรับรองสาขา</span>
                          <span className="font-bold text-[var(--color-text)]">
                            {m.branchApprovedSubordinateShifts}/{m.branchTotalSubordinateShifts} กะ ({m.branchApprovalCompliancePct}%)
                          </span>
                        </div>
                        <div className="w-full bg-[var(--color-border)] h-1.5 rounded-full overflow-hidden mt-1">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              m.branchApprovalCompliancePct === 100
                                ? "bg-emerald-500"
                                : m.branchApprovalCompliancePct >= 80
                                ? "bg-amber-400"
                                : "bg-rose-500"
                            }`}
                            style={{ width: `${m.branchApprovalCompliancePct}%` }}
                          />
                        </div>
                      </div>

                      {/* Metric 3: Branch Team Quality */}
                      <div className="text-left lg:text-right hidden sm:block">
                        <span className="text-[10px] text-[var(--color-text-muted)] block font-medium">คุณภาพงานสาขา</span>
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          {m.branchAvgSubordinateCompletionPct}% สำเร็จ
                        </span>
                      </div>

                      {/* Expand Toggle */}
                      <div className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300 font-bold pl-1">
                        <span className="hidden sm:inline">{isExpanded ? "ย่อรายละเอียด" : "ดูผลงานสาขา"}</span>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                  </div>

                  {/* Accordion Detail: Manager Checklists vs Branch Team Audits */}
                  {isExpanded && (
                    <div className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-4 space-y-3">
                      {/* Sub-tabs inside accordion */}
                      <div className="flex items-center gap-2 border-b border-[var(--color-border)] pb-2.5">
                        <button
                          type="button"
                          onClick={() => setManagerDetailSubTab((prev) => ({ ...prev, [m.managerId]: "manager_shifts" }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                            activeSubTab === "manager_shifts"
                              ? "bg-[var(--color-brown)] text-amber-100 shadow-2xs"
                              : "bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)]"
                          }`}
                        >
                          <FileCheck2 size={13} />
                          <span>เช็คลิสต์ของผู้จัดการ ({m.managerSessions.length})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setManagerDetailSubTab((prev) => ({ ...prev, [m.managerId]: "branch_staff" }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                            activeSubTab === "branch_staff"
                              ? "bg-[var(--color-brown)] text-amber-100 shadow-2xs"
                              : "bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)]"
                          }`}
                        >
                          <Building2 size={13} />
                          <span>งานลูกทีมในสาขาที่กำกับดูแล ({m.branchSubordinateSessions.length})</span>
                          {m.branchPendingSubordinateShifts > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400 text-amber-950 font-black">
                              รอตรวจ {m.branchPendingSubordinateShifts}
                            </span>
                          )}
                        </button>
                      </div>

                      {/* Sub-tab 1: Manager Personal Checklists */}
                      {activeSubTab === "manager_shifts" && (
                        m.managerSessions.length === 0 ? (
                          <div className="py-6 text-center text-xs text-[var(--color-text-muted)]">
                            ผู้จัดการยังไม่มีรายการเช็คลิสต์ตรวจปิดร้าน/ตรวจความปลอดภัยที่บันทึกในรอบเวลานี้
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {m.managerSessions.map((sess) => {
                              const doneCount = sess.items.filter((i) => i.completedAt).length;
                              const pct = Math.round((doneCount / (sess.items.length || 1)) * 100);

                              return (
                                <div
                                  key={sess.id}
                                  onClick={() => onSelectSession(sess)}
                                  className="w-full text-left p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] hover:border-amber-400 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs"
                                >
                                  <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                                    <span className="text-xs font-bold text-[var(--color-text)]">
                                      {fmtDate(sess.startedAt)}
                                    </span>
                                    {getShiftBadge(sess.shift)}
                                    <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
                                      {fmtTime(sess.startedAt)} น. {sess.completedAt ? `→ เสร็จ ${fmtTime(sess.completedAt)} น.` : ""}
                                    </span>
                                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] font-semibold text-[var(--color-text)]">
                                      {doneCount}/{sess.items.length} ข้อ ({pct}%)
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-3 shrink-0">
                                    <span className="text-xs text-amber-700 dark:text-amber-300 font-bold inline-flex items-center gap-1">
                                      <span>เปิดตรวจข้อตรวจ</span>
                                      <ChevronRight size={14} />
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )
                      )}

                      {/* Sub-tab 2: Subordinate Shifts in Branch */}
                      {activeSubTab === "branch_staff" && (
                        m.branchSubordinateSessions.length === 0 ? (
                          <div className="py-6 text-center text-xs text-[var(--color-text-muted)]">
                            ไม่มีบันทึกกะงานของลูกทีมในสาขานี้ในช่วงเวลาที่เลือก
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {m.branchSubordinateSessions.map((sess) => {
                              const app = approvals[sess.id] || {};
                              const isApproved = Boolean(app.managerApproved);
                              const doneCount = sess.items.filter((i) => i.completedAt).length;
                              const pct = Math.round((doneCount / (sess.items.length || 1)) * 100);

                              return (
                                <div
                                  key={sess.id}
                                  onClick={() => onSelectSession(sess)}
                                  className="w-full text-left p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] hover:border-amber-400 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs"
                                >
                                  <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                                    <span className="font-bold text-xs text-[var(--color-text)]">
                                      {sess.userName}
                                    </span>
                                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border border-[var(--color-border)]">
                                      {sess.userPosition || "พนักงาน"}
                                    </span>
                                    {getShiftBadge(sess.shift)}
                                    <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
                                      {fmtDate(sess.startedAt)} {fmtTime(sess.startedAt)} น.
                                    </span>
                                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] font-semibold text-[var(--color-text)]">
                                      {doneCount}/{sess.items.length} ข้อ ({pct}%)
                                    </span>
                                  </div>

                                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                    {isApproved ? (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-md">
                                      <CheckCircle2 size={12} className="text-emerald-600" />
                                      <span>ผู้จัดการรับรองแล้ว</span>
                                    </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-950 bg-amber-400 px-2 py-0.5 rounded-md animate-pulse">
                                        <AlertCircle size={12} />
                                        <span>รอผู้จัดการรับรอง</span>
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
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        // ─── TIMELINE FEED (All Sessions Chronological) ───
        filteredTimelineSessions.length === 0 ? (
          <div className="py-14 text-center text-[var(--color-text-muted)] text-xs border border-dashed border-[var(--color-border)] rounded-2xl bg-[var(--color-surface-2)]/30 p-6 space-y-1">
            <p className="font-bold text-[var(--color-text)]">ไม่พบประวัติกะตามเงื่อนไขที่เลือก</p>
            <p className="text-[var(--color-text-muted)]">ลองปรับเปลี่ยนตัวกรอง หรือเลือกดูวันที่อื่น</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredTimelineSessions.map((sess) => {
              const app = approvals[sess.id] || {};
              const isApproved = Boolean(app.managerApproved);
              const doneCount = sess.items.filter((i) => i.completedAt).length;
              const pct = Math.round((doneCount / (sess.items.length || 1)) * 100);

              return (
                <button
                  key={sess.id}
                  type="button"
                  onClick={() => onSelectSession(sess)}
                  className="w-full text-left p-3.5 sm:p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)]/60 hover:border-amber-400 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-[var(--color-text)]">{sess.userName}</span>
                      {sess.branchName && (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-800">
                          {sess.branchName}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border border-[var(--color-border)]">
                        {sess.userPosition || "พนักงาน"}
                      </span>
                      {getShiftBadge(sess.shift)}
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] font-semibold text-[var(--color-text)]">
                        {doneCount}/{sess.items.length} รายการ ({pct}%)
                      </span>

                      {isApproved ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-md">
                          <CheckCircle2 size={12} className="text-emerald-600" />
                          <span>อนุมัติสมบูรณ์</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-950 bg-amber-400 px-2 py-0.5 rounded-md">
                          <AlertCircle size={12} />
                          <span>รอตรวจรับรอง</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-[var(--color-text-muted)]">
                      {fmtDate(sess.startedAt)} • เริ่ม {fmtTime(sess.startedAt)} น. {sess.completedAt ? `→ เสร็จ ${fmtTime(sess.completedAt)} น.` : ""}
                    </p>
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
