"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { User, LeaveType, Role } from "../../types";
import { 
  EmployeeLeave, 
  BranchEmployeeStatus, 
  getBranchLeavesAction, 
  markEmployeeLeaveAction, 
  cancelEmployeeLeaveAction,
  getBranchStaffStatusAction,
  approveEmployeeLeaveAction,
  rejectEmployeeLeaveAction,
} from "../../actions/manager";
import { BrandLogo } from "../common/BrandLogo";
import { ThemeToggle } from "../common/ThemeToggle";
import { 
  Users, 
  HeartPulse, 
  FileText, 
  Calendar, 
  CalendarDays, 
  ShieldCheck, 
  ShieldAlert,
  ZapOff,
  HelpCircle,
  Plus, 
  Search, 
  Filter, 
  RefreshCw, 
  ArrowLeft, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Flame, 
  Clock, 
  Store, 
  Sparkles,
  ChevronRight,
  Info,
  Coins,
  Check,
  X,
  Award,
  ChevronDown,
  UserCheck
} from "lucide-react";
import Link from "next/link";
import { isPaidLeave, isUnpaidLeave, getLeaveTypeLabel } from "../../utils/leave";
import { UserAvatar } from "../common/UserAvatar";

interface BranchLeaveManagementViewProps {
  currentUser: User;
  onBackToDashboard?: () => void;
  defaultSelectedUserId?: string;
  currentTab?: "presence" | "leaves";
  onTabChange?: (tab: "presence" | "leaves") => void;
}

export function BranchLeaveManagementView({ 
  currentUser, 
  onBackToDashboard,
  defaultSelectedUserId,
  currentTab = "leaves",
  onTabChange
}: BranchLeaveManagementViewProps) {
  const [leaves, setLeaves] = useState<EmployeeLeave[]>([]);
  const [employees, setEmployees] = useState<BranchEmployeeStatus[]>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<"all" | "pending" | "paid" | "unpaid">("all");
  const [streakFilter, setStreakFilter] = useState<"all" | "preserved" | "broken">("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "upcoming" | "past">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Approval action states
  const [isApproving, setIsApproving] = useState<string | null>(null);
  const [rejectModalLeave, setRejectModalLeave] = useState<EmployeeLeave | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [approvalLeaveTypes, setApprovalLeaveTypes] = useState<Record<string, LeaveType>>({});

  // Modal State for adding new leave
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formUserId, setFormUserId] = useState<string>("");
  const [formLeaveType, setFormLeaveType] = useState<LeaveType>("paid");
  const [formPreserveStreak, setFormPreserveStreak] = useState<boolean>(true);
  // Today string YYYY-MM-DD in Asia/Bangkok
  const thaiTodayStr = useMemo(() => {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  }, []);

  const [formStartDate, setFormStartDate] = useState<string>(thaiTodayStr);
  const [formEndDate, setFormEndDate] = useState<string>(thaiTodayStr);
  const [formReason, setFormReason] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  // Employee search state in leave modal
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);

  const filteredFormEmployees = useMemo(() => {
    if (!employeeSearchQuery.trim()) return employees;
    const q = employeeSearchQuery.toLowerCase();
    return employees.filter(e => 
      e.name.toLowerCase().includes(q) ||
      (e.username || "").toLowerCase().includes(q) ||
      (e.position || "").toLowerCase().includes(q)
    );
  }, [employees, employeeSearchQuery]);

  // Cancel confirmation state
  const [cancelTargetLeave, setCancelTargetLeave] = useState<EmployeeLeave | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Load data for selected branch
  const loadData = useCallback(async (branchId?: string, isManual = false) => {
    try {
      // 1. Fetch staff status to get candidate employees & branches list
      const staffRes = await getBranchStaffStatusAction(branchId);
      if (isManual) setIsRefreshing(true);
      setErrorMsg(null);
      let activeBranch = branchId;
      if (staffRes.success) {
        setEmployees(staffRes.employees || []);
        setBranches(staffRes.branches || []);
        if (staffRes.selectedBranchId) {
          activeBranch = staffRes.selectedBranchId;
          setSelectedBranchId(staffRes.selectedBranchId);
        }
      }

      // 2. Fetch leaves for this branch
      if (activeBranch) {
        const leavesRes = await getBranchLeavesAction({ branchId: activeBranch });
        if (leavesRes.success && leavesRes.leaves) {
          setLeaves(leavesRes.leaves);
        } else if (leavesRes.error) {
          setErrorMsg(leavesRes.error);
        }
      }
    } catch (err: unknown) {
      console.error("Error loading branch leaves:", err);
      setErrorMsg("เกิดข้อผิดพลาดในการโหลดข้อมูลการลา");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      loadData(currentUser.branchId);
    });
  }, [loadData, currentUser.branchId]);

  // If defaultSelectedUserId is provided, pre-select and open modal
  useEffect(() => {
    if (defaultSelectedUserId && employees.length > 0) {
      queueMicrotask(() => {
        setFormUserId(defaultSelectedUserId);
        setIsModalOpen(true);
      });
    }
  }, [defaultSelectedUserId, employees]);

  const handleBranchChange = (newBranchId: string) => {
    setSelectedBranchId(newBranchId);
    loadData(newBranchId, true);
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const today = thaiTodayStr;
    const todayLeaves = leaves.filter(l => l.status !== "rejected" && l.startDate <= today && l.endDate >= today);
    const pendingLeaves = leaves.filter(l => l.status === "pending");
    const paidCount = todayLeaves.filter(l => isPaidLeave(l.leaveType)).length;
    const unpaidCount = todayLeaves.filter(l => isUnpaidLeave(l.leaveType)).length;
    const streakBrokenCount = leaves.filter(l => l.preserveStreak === false).length;
    const totalRecorded = leaves.length;

    return {
      todayCount: todayLeaves.length,
      pendingCount: pendingLeaves.length,
      paidCount,
      unpaidCount,
      streakBrokenCount,
      totalRecorded,
    };
  }, [leaves, thaiTodayStr]);

  const pendingLeaves = useMemo(() => {
    return leaves.filter(l => l.status === "pending");
  }, [leaves]);

  // Filtered leaves
  const filteredLeaves = useMemo(() => {
    const today = thaiTodayStr;
    return leaves.filter(leave => {
      // Type filter
      if (typeFilter === "pending" && leave.status !== "pending") return false;
      if (typeFilter === "paid" && (!isPaidLeave(leave.leaveType) || leave.status === "pending")) return false;
      if (typeFilter === "unpaid" && (!isUnpaidLeave(leave.leaveType) || leave.status === "pending")) return false;

      // Streak status filter
      if (streakFilter === "preserved" && leave.preserveStreak === false) return false;
      if (streakFilter === "broken" && leave.preserveStreak !== false) return false;

      // Date status filter
      if (dateFilter === "today") {
        if (!(leave.startDate <= today && leave.endDate >= today)) return false;
      } else if (dateFilter === "upcoming") {
        if (leave.startDate <= today) return false;
      } else if (dateFilter === "past") {
        if (leave.endDate >= today) return false;
      }

      // Search query (name or reason)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = leave.userName?.toLowerCase().includes(q);
        const reasonMatch = leave.reason?.toLowerCase().includes(q);
        const recordedByMatch = leave.recordedByName?.toLowerCase().includes(q);
        if (!nameMatch && !reasonMatch && !recordedByMatch) return false;
      }

      return true;
    });
  }, [leaves, typeFilter, streakFilter, dateFilter, searchQuery, thaiTodayStr]);

  // Approval handlers
  const handleApprove = async (leaveId: string, leaveType?: LeaveType, preserveStreak: boolean = true) => {
    setIsApproving(leaveId);
    try {
      const res = await approveEmployeeLeaveAction({
        leaveId,
        approvedBy: currentUser.id,
        leaveType,
        preserveStreak,
      });
      if (res.success) {
        setSuccessMsg("อนุมัติคำขอลางานเรียบร้อยแล้ว");
        loadData(selectedBranchId, true);
      } else {
        setErrorMsg(res.error || "ไม่สามารถอนุมัติได้");
      }
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "เกิดข้อผิดพลาดในการอนุมัติ");
    } finally {
      setIsApproving(null);
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalLeave) return;
    setIsRejecting(true);
    try {
      const res = await rejectEmployeeLeaveAction({
        leaveId: rejectModalLeave.id,
        rejectedBy: currentUser.id,
        reason: rejectReason.trim() || undefined,
      });
      if (res.success) {
        setSuccessMsg("ปฏิเสธคำขอลางานเรียบร้อยแล้ว");
        setRejectModalLeave(null);
        setRejectReason("");
        loadData(selectedBranchId, true);
      } else {
        setErrorMsg(res.error || "ไม่สามารถปฏิเสธได้");
      }
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setIsRejecting(false);
    }
  };

  // Open modal handler
  const handleOpenAddModal = (userId?: string) => {
    const initialUser = userId 
      ? employees.find(e => e.id === userId)?.id || employees[0]?.id || ""
      : employees[0]?.id || "";
    setFormUserId(initialUser);
    setFormLeaveType("paid");
    setFormPreserveStreak(true);
    setFormStartDate(thaiTodayStr);
    setFormEndDate(thaiTodayStr);
    setFormReason("");
    setFormError(null);
    setEmployeeSearchQuery("");
    setIsEmployeeDropdownOpen(false);
    setIsModalOpen(true);
  };

  // Submit leave form
  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formUserId) {
      setFormError("กรุณาเลือกพนักงาน");
      return;
    }
    if (!formReason.trim()) {
      setFormError("กรุณาระบุเหตุผลในการลา");
      return;
    }
    if (formStartDate > formEndDate) {
      setFormError("วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await markEmployeeLeaveAction({
        userId: formUserId,
        branchId: selectedBranchId || currentUser.branchId || "",
        leaveType: formLeaveType,
        startDate: formStartDate,
        endDate: formEndDate,
        reason: formReason.trim(),
        preserveStreak: formPreserveStreak,
        recordedBy: currentUser.id,
      });

      if (res.success && res.leave) {
        const streakNotice = formPreserveStreak
          ? "(สตรีคได้รับการคุ้มครอง ไม่ขาด)"
          : "(สตรีคสะสมถูกตัดเป็น 0 ตามคำสั่ง)";
        setSuccessMsg(`บันทึกการลาของ ${res.leave.userName} เรียบร้อยแล้ว ${streakNotice}`);
        setIsModalOpen(false);
        // Refresh data
        await loadData(selectedBranchId, true);
        setTimeout(() => setSuccessMsg(null), 5000);
      } else {
        setFormError(res.error || "ไม่สามารถบันทึกการลาได้");
      }
    } catch (err: unknown) {
      console.error("Submit leave error:", err);
      setFormError("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete / cancel leave
  const handleConfirmCancelLeave = async () => {
    if (!cancelTargetLeave) return;

    try {
      setIsCancelling(true);
      const res = await cancelEmployeeLeaveAction({
        leaveId: cancelTargetLeave.id,
        cancelledBy: currentUser.id,
      });

      if (res.success) {
        setSuccessMsg(`ยกเลิกรายการลาของ ${cancelTargetLeave.userName} เรียบร้อยแล้ว`);
        setCancelTargetLeave(null);
        await loadData(selectedBranchId, true);
        setTimeout(() => setSuccessMsg(null), 5000);
      } else {
        setErrorMsg(res.error || "ไม่สามารถยกเลิกรายการลาได้");
      }
    } catch (err: unknown) {
      console.error("Cancel leave error:", err);
      setErrorMsg("เกิดข้อผิดพลาดในการยกเลิกรายการลา");
    } finally {
      setIsCancelling(false);
    }
  };

  // Format date helper (Thai format)
  const formatThaiDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);
      return new Intl.DateTimeFormat("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(dateObj);
    } catch {
      return dateStr;
    }
  };

  // Selected user info in form
  const selectedFormUser = employees.find(e => e.id === formUserId);

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-[var(--color-surface)]/95 backdrop-blur-md border-b border-[var(--color-border)] px-4 sm:px-8 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onBackToDashboard ? (
              <button
                type="button"
                onClick={onBackToDashboard}
                className="p-2 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
                title="กลับสู่แดชบอร์ดหลัก"
              >
                <ArrowLeft size={16} />
                <span className="hidden sm:inline">แดชบอร์ด</span>
              </button>
            ) : (
              <Link
                href="/manager/dashboard"
                className="p-2 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                title="กลับสู่แดชบอร์ดหลัก"
              >
                <ArrowLeft size={16} />
                <span className="hidden sm:inline">แดชบอร์ด</span>
              </Link>
            )}

            <div className="h-5 w-px bg-[var(--color-border)]" />

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-amber-950 flex items-center justify-center font-bold text-xs shadow-2xs">
                <HeartPulse size={18} />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-[var(--color-text)] leading-tight flex items-center gap-2">
                  <span>ระบบบันทึกการลาพนักงาน</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                    {stats.todayCount} ลาวันนี้
                  </span>
                </h1>
                <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                  <Store size={12} className="text-amber-600" />
                  <span>{branches.find(b => b.id === selectedBranchId)?.name || employees[0]?.branchName || "สาขาหลัก"}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Branch Selector */}
            {branches.length > 1 && (
              <select
                value={selectedBranchId}
                onChange={(e) => handleBranchChange(e.target.value)}
                className="px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)] focus:outline-2 focus:outline-amber-500 cursor-pointer"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id} className="bg-[var(--color-surface)] text-[var(--color-text)]">
                    {b.name}
                  </option>
                ))}
              </select>
            )}

            {/* Tab Switcher: Presence vs Leaves */}
            <div className="flex items-center p-0.5 sm:p-1 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl shrink-0">
              {onTabChange ? (
                <button
                  type="button"
                  onClick={() => onTabChange("presence")}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    currentTab === "presence"
                      ? "bg-amber-500 text-amber-950 shadow-xs cursor-default"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                >
                  <Users size={14} />
                  <span className="hidden sm:inline">สถานะกะพนักงาน</span>
                  <span className="sm:hidden">กะงาน</span>
                </button>
              ) : (
                <Link
                  href="/manager/staff-status"
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition-all text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer"
                >
                  <Users size={14} />
                  <span className="hidden sm:inline">สถานะกะพนักงาน</span>
                  <span className="sm:hidden">กะงาน</span>
                </Link>
              )}
              <button
                type="button"
                onClick={() => onTabChange?.("leaves")}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition-all ${
                  currentTab === "leaves"
                    ? "bg-amber-500 text-amber-950 shadow-xs cursor-default"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer"
                }`}
              >
                <HeartPulse size={14} className={currentTab === "leaves" ? "text-amber-950" : "text-rose-500"} />
                <span className="hidden sm:inline">จัดการการลา</span>
                <span className="sm:hidden">การลา</span>
              </button>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => loadData(selectedBranchId, true)}
              disabled={isRefreshing}
              className="px-3 py-1.5 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 text-[var(--color-text)] cursor-pointer"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw size={14} className={isRefreshing ? "animate-spin text-amber-600" : ""} />
              <span className="hidden sm:inline">อัปเดต</span>
            </button>

            <ThemeToggle />

            {/* Primary Action Button */}
            <button
              type="button"
              onClick={() => handleOpenAddModal()}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-amber-950 text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>บันทึกการลา</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-6 flex-1 flex flex-col gap-6">
        {/* Banner Alert Feedback */}
        {successMsg && (
          <div className="p-4 rounded-xl border-l-4 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 flex items-center justify-between text-xs sm:text-sm animate-fade-in">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMsg(null)}
              className="text-xs font-bold underline cursor-pointer"
            >
              ปิด
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-xl border-l-4 border-red-500 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200 flex items-center justify-between text-xs sm:text-sm animate-fade-in">
            <div className="flex items-center gap-2.5">
              <AlertCircle size={18} className="text-red-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-xs font-bold underline cursor-pointer"
            >
              ปิด
            </button>
          </div>
        )}

        {/* ─── GUARANTEE BADGE CARD & KPIS (5 Symmetrical Columns) ─────────────────────────────────── */}
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* Card 1: Today Leaves Count */}
          <div className={`p-4 sm:p-5 rounded-2xl bg-[var(--color-surface)] shadow-xs flex items-center justify-between ${
            stats.todayCount > 0
              ? "border-2 border-rose-400 dark:border-rose-600"
              : "border border-[var(--color-border)]"
          }`}>
            <div>
              <p className={`text-xs font-medium ${stats.todayCount > 0 ? "text-rose-800 dark:text-rose-300 font-semibold" : "text-[var(--color-text-muted)]"}`}>
                ลางานวันนี้ (On Leave)
              </p>
              <p className={`text-2xl sm:text-3xl font-extrabold mt-1 ${stats.todayCount > 0 ? "text-rose-950 dark:text-rose-200" : "text-[var(--color-text)]"}`}>
                {stats.todayCount} <span className="text-xs font-normal text-[var(--color-text-muted)]">คน</span>
              </p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 flex items-center justify-center shrink-0">
              <HeartPulse size={22} />
            </div>
          </div>

          {/* Card 2: Pending Approval Count */}
          <div className={`p-4 sm:p-5 rounded-2xl bg-[var(--color-surface)] shadow-xs flex items-center justify-between ${
            stats.pendingCount > 0
              ? "border-2 border-amber-400 dark:border-amber-600"
              : "border border-[var(--color-border)]"
          }`}>
            <div>
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                {stats.pendingCount > 0 && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
                คำขอรออนุมัติ
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-[var(--color-text)] mt-1">
                {stats.pendingCount} <span className="text-xs font-normal text-[var(--color-text-muted)]">รายการ</span>
              </p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0">
              <Clock size={22} />
            </div>
          </div>

          {/* Card 3: Paid Leave Count */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">ลาเเบบได้เงิน (Paid)</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-emerald-950 dark:text-emerald-200 mt-1">
                {stats.paidCount} <span className="text-xs font-normal text-emerald-700 dark:text-emerald-400">คน</span>
              </p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <Coins size={22} />
            </div>
          </div>

          {/* Card 4: Unpaid Leave Count */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--color-text-muted)]">ลาไม่ได้รับเงิน (Unpaid)</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-[var(--color-text)] mt-1">
                {stats.unpaidCount} <span className="text-xs font-normal text-[var(--color-text-muted)]">คน</span>
              </p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[var(--color-surface-2)] text-[var(--color-text-muted)] flex items-center justify-center shrink-0">
              <FileText size={22} />
            </div>
          </div>

          {/* Card 5: Streak Management */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--color-text-muted)]">ดุลยพินิจจัดการสตรีค</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-[var(--color-primary)] dark:text-amber-300 mt-1">
                {stats.streakBrokenCount > 0 ? `${stats.streakBrokenCount}` : "100%"} <span className="text-xs font-normal text-[var(--color-text-muted)]">{stats.streakBrokenCount > 0 ? "ตัดสตรีค" : "คุ้มครอง"}</span>
              </p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
              <ShieldCheck size={22} />
            </div>
          </div>
        </section>

        {/* ─── PENDING APPROVAL PRIORITY SECTION ────────────────────────── */}
        {pendingLeaves.length > 0 && (typeFilter === "all" || typeFilter === "pending") && (
          <section className="p-5 rounded-2xl bg-amber-500/10 border-2 border-amber-400 dark:border-amber-600 shadow-sm space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-amber-500 text-amber-950 flex items-center justify-center font-bold shrink-0">
                  <Clock size={20} />
                </span>
                <div>
                  <h3 className="text-sm font-extrabold text-[var(--color-text)]">
                    คำขอลางานรอการพิจารณาอนุมัติ ({pendingLeaves.length} รายการ)
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    พนักงานส่งคำขอลางานเข้ามา กรุณาตรวจสอบเหตุผลและพิจารณาอนุมัติ
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {pendingLeaves.map((pl) => (
                <div key={pl.id} className="p-4 rounded-xl bg-[var(--color-surface)] border border-amber-300 dark:border-amber-700/60 shadow-xs flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-sm font-extrabold text-[var(--color-text)]">{pl.userName}</span>
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200">
                        รอผู้จัดการกำหนดประเภท
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {pl.userPosition || "พนักงานประจำสาขา"} • วันที่: <strong className="text-[var(--color-text)]">{pl.startDate === pl.endDate ? formatThaiDate(pl.startDate) : `${formatThaiDate(pl.startDate)} ถึง ${formatThaiDate(pl.endDate)}`}</strong>
                    </p>
                    <div className="mt-2 p-2.5 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs text-[var(--color-text)]">
                      <span className="text-[var(--color-text-muted)] font-semibold">เหตุผล: </span>
                      <span className="italic">&ldquo;{pl.reason}&rdquo;</span>
                    </div>
                  </div>

                  {/* Manager chooses leave type */}
                  <div className="pt-2 border-t border-[var(--color-border)] space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[var(--color-text)]">กำหนดประเภทการลา:</span>
                      <span className="text-[11px] font-semibold text-[var(--color-text-muted)]">
                        {(!approvalLeaveTypes[pl.id] || isPaidLeave(approvalLeaveTypes[pl.id])) ? "หักสิทธิการลา (Paid)" : "ไม่หักสิทธิการลา (Unpaid)"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setApprovalLeaveTypes(prev => ({ ...prev, [pl.id]: "paid" }))}
                        className={`p-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${(!approvalLeaveTypes[pl.id] || isPaidLeave(approvalLeaveTypes[pl.id]))
                          ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500 font-extrabold shadow-2xs"
                          : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-[var(--color-surface)]"
                        }`}
                      >
                        <Coins size={14} className={(!approvalLeaveTypes[pl.id] || isPaidLeave(approvalLeaveTypes[pl.id])) ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--color-text-muted)]"} />
                        <span>ลาเเบบได้เงิน (รักษาสตรีค)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setApprovalLeaveTypes(prev => ({ ...prev, [pl.id]: "unpaid" }))}
                        className={`p-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${isUnpaidLeave(approvalLeaveTypes[pl.id])
                          ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500 font-extrabold shadow-2xs"
                          : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-[var(--color-surface)]"
                        }`}
                      >
                        <Clock size={14} className={isUnpaidLeave(approvalLeaveTypes[pl.id]) ? "text-amber-600 dark:text-amber-400" : "text-[var(--color-text-muted)]"} />
                        <span>ลาเเบบไม่ได้รับเงิน (ตัดสตรีค 0)</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
                    <button
                      type="button"
                      onClick={() => {
                        setRejectModalLeave(pl);
                        setRejectReason("");
                      }}
                      disabled={isApproving === pl.id}
                      className="px-3 py-1.5 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition-all cursor-pointer"
                    >
                      ปฏิเสธคำขอ
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(pl.id, approvalLeaveTypes[pl.id] || "paid", !isUnpaidLeave(approvalLeaveTypes[pl.id]))}
                      disabled={isApproving === pl.id}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-extrabold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      {isApproving === pl.id ? (
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Check size={14} />
                      )}
                      <span>อนุมัติ ({isUnpaidLeave(approvalLeaveTypes[pl.id]) ? "ไม่ได้รับเงิน • ตัดสตรีค 0" : "ได้เงิน • รักษาสตรีค"})</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─── FILTERS & SEARCH TOOLBAR ───────────────────────────────────── */}
        <section className="p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Leave Type Tabs */}
          <div className="flex items-center gap-1 p-1 bg-[var(--color-surface-2)] rounded-xl overflow-x-auto shrink-0">
            <button
              type="button"
              onClick={() => setTypeFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                typeFilter === "all"
                  ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-xs"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              ทั้งหมด ({leaves.length})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter("pending")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                typeFilter === "pending"
                  ? "bg-amber-500 text-amber-950 shadow-xs"
                  : "text-amber-800 dark:text-amber-400 hover:text-amber-950"
              }`}
            >
              <Clock size={13} />
              <span>รออนุมัติ ({stats.pendingCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter("paid")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                typeFilter === "paid"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-emerald-800 dark:text-emerald-400 hover:text-emerald-950"
              }`}
            >
              <Coins size={13} />
              <span>ลาเเบบได้เงิน ({leaves.filter(l => isPaidLeave(l.leaveType)).length})</span>
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter("unpaid")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                typeFilter === "unpaid"
                  ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-xs"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              <FileText size={13} />
              <span>ลาเเบบไม่ได้รับเงิน ({leaves.filter(l => isUnpaidLeave(l.leaveType)).length})</span>
            </button>
          </div>

          {/* Secondary Filters: Streak, Date, and Search */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={streakFilter}
              onChange={(e) => setStreakFilter(e.target.value as "all" | "preserved" | "broken")}
              className="px-2.5 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-medium text-[var(--color-text)]"
            >
              <option value="all">สตรีค: ทั้งหมด</option>
              <option value="preserved">รักษาสตรีค</option>
              <option value="broken">ตัดสตรีค</option>
            </select>

            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as "all" | "today" | "upcoming" | "past")}
              className="px-2.5 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-medium text-[var(--color-text)]"
            >
              <option value="all">ทุกช่วงเวลา</option>
              <option value="today">กำลังลาวันนี้</option>
              <option value="upcoming">การลาในอนาคต</option>
              <option value="past">ประวัติการลาที่ผ่านมา</option>
            </select>

            {/* Search Input */}
            <div className="relative flex-1 sm:w-56">
              <Search size={14} className="absolute left-2.5 top-2.5 text-[var(--color-text-muted)]" />
              <input
                type="text"
                placeholder="ค้นหาชื่อ หรือเหตุผล..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs focus:outline-2 focus:outline-amber-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ─── LEAVE RECORDS LIST ─────────────────────────────────────────── */}
        {isLoading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-3 border-amber-500 border-t-transparent animate-spin" />
            <p className="text-xs text-[var(--color-text-muted)]">กำลังโหลดรายการการลาของพนักงาน...</p>
          </div>
        ) : filteredLeaves.length === 0 ? (
          <div className="p-12 text-center bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] flex flex-col items-center justify-center gap-3 shadow-xs">
            <Calendar size={36} className="text-[var(--color-text-muted)] opacity-50" />
            <p className="text-sm font-bold text-[var(--color-text)]">ไม่พบรายการการลาที่ตรงกับเงื่อนไข</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              {leaves.length === 0 ? "ยังไม่มีการบันทึกการลาในสาขานี้" : "ลองปรับเปลี่ยนตัวกรอง หรือล้างคำค้นหา"}
            </p>
            <div className="flex items-center gap-2 mt-2">
              {(typeFilter !== "all" || streakFilter !== "all" || dateFilter !== "all" || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setTypeFilter("all");
                    setStreakFilter("all");
                    setDateFilter("all");
                    setSearchQuery("");
                  }}
                  className="px-3 py-1.5 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] font-semibold text-xs transition-colors cursor-pointer"
                >
                  ล้างตัวกรอง
                </button>
              )}
              <button
                type="button"
                onClick={() => handleOpenAddModal()}
                className="px-3 py-1.5 rounded-xl bg-amber-500 text-amber-950 font-bold text-xs hover:bg-amber-400 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={14} />
                <span>บันทึกการลา</span>
              </button>
            </div>
          </div>
        ) : (
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLeaves.map((leave) => {
              const isPaid = isPaidLeave(leave.leaveType);
              const isToday = leave.startDate <= thaiTodayStr && leave.endDate >= thaiTodayStr;
              const isUpcoming = leave.startDate > thaiTodayStr;
              const isPast = leave.endDate < thaiTodayStr;

              return (
                <div
                  key={leave.id}
                  className={`p-5 rounded-2xl bg-[var(--color-surface)] border transition-all shadow-xs flex flex-col justify-between space-y-4 ${
                    isToday
                      ? isPaid
                        ? "border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-500/20"
                        : "border-amber-400 dark:border-amber-600 ring-2 ring-amber-500/20"
                      : "border-[var(--color-border)] hover:border-amber-400/50"
                  }`}
                >
                  {/* Card Header: Employee info & Type Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                        isPaid
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                      }`}>
                        {isPaid ? <Coins size={20} /> : <FileText size={20} />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-extrabold text-[var(--color-text)]">
                            {leave.userName}
                          </h4>
                          {isToday && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 animate-pulse">
                              ลางานวันนี้
                            </span>
                          )}
                          {isUpcoming && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-300">
                              ล่วงหน้า
                            </span>
                          )}
                          {isPast && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
                              ผ่านไปแล้ว
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          {leave.userPosition || "พนักงานประจำสาขา"}
                        </p>
                      </div>
                    </div>

                    {/* Status & Type Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {leave.status === "pending" && (
                        <span className="px-2.5 py-1 rounded-xl text-xs font-extrabold bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-400 animate-pulse flex items-center gap-1">
                          <Clock size={12} />
                          <span>รออนุมัติ</span>
                        </span>
                      )}
                      {leave.status === "approved" && (
                        <span className="px-2.5 py-1 rounded-xl text-xs font-extrabold bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border border-emerald-400 flex items-center gap-1">
                          <Check size={12} />
                          <span>อนุมัติแล้ว</span>
                        </span>
                      )}
                      {leave.status === "rejected" && (
                        <span className="px-2.5 py-1 rounded-xl text-xs font-extrabold bg-rose-500/15 text-rose-800 dark:text-rose-200 border border-rose-400 flex items-center gap-1">
                          <X size={12} />
                          <span>ไม่อนุมัติ</span>
                        </span>
                      )}

                      {/* Leave Type Badge */}
                      {leave.status === "pending" ? (
                        <span className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border border-[var(--color-border)]">
                          รอผู้จัดการระบุประเภท
                        </span>
                      ) : (
                        <div className={`px-2.5 py-1 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shrink-0 ${
                          isPaid
                            ? "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800"
                            : "bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800"
                        }`}>
                          {isPaid ? (
                            <>
                              <Coins size={13} />
                              <span>ลาเเบบได้เงิน</span>
                            </>
                          ) : (
                            <>
                              <FileText size={13} />
                              <span>ลาเเบบไม่ได้รับเงิน</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Date Range & Duration */}
                  <div className="p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Calendar size={15} className="text-[var(--color-text-muted)]" />
                      <span className="font-semibold text-[var(--color-text)]">
                        {leave.startDate === leave.endDate ? (
                          formatThaiDate(leave.startDate)
                        ) : (
                          `${formatThaiDate(leave.startDate)} – ${formatThaiDate(leave.endDate)}`
                        )}
                      </span>
                    </div>

                    <span className="text-[11px] font-mono font-bold text-[var(--color-text-muted)] px-2 py-0.5 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)]">
                      {leave.startDate === leave.endDate ? "1 วัน" : "หลายวัน"}
                    </span>
                  </div>

                  {/* Reason Comment */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                      เหตุผลการลา:
                    </span>
                    <p className="text-xs text-[var(--color-text)] bg-[var(--color-surface-2)]/50 p-3 rounded-xl border-l-3 border-amber-500 leading-relaxed italic">
                      &ldquo;{leave.reason}&rdquo;
                    </p>
                  </div>

                  {/* Streak Protection & Recorder Info Footer */}
                  <div className="pt-2 border-t border-[var(--color-border)] flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    {leave.preserveStreak !== false ? (
                      <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                        <ShieldCheck size={14} className="shrink-0 text-emerald-600" />
                        <span>รักษาสตรีคสะสม (สตรีคไม่ขาด)</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-bold bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20">
                        <ZapOff size={14} className="shrink-0 text-rose-600" />
                        <span>ตัดสตรีคเป็น 0 (ไม่ผ่านเกณฑ์)</span>
                        {leave.previousStreak !== undefined && leave.previousStreak > 0 && (
                          <span className="text-[10px] font-mono text-rose-600/80">
                            (เดิม {leave.previousStreak} วัน)
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <span className="text-[var(--color-text-muted)]">
                        บันทึกโดย: <strong className="text-[var(--color-text)]">{leave.recordedByName || "ผู้จัดการ"}</strong>
                      </span>

                      {/* Cancel Leave Button */}
                      <button
                        type="button"
                        onClick={() => setCancelTargetLeave(leave)}
                        className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                        title="ยกเลิกรายการลานี้"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </main>

      {/* ─── MODAL: RECORD LEAVE FORM ───────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-2xl p-6 space-y-5 animate-scale-up max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                  <Plus size={20} />
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-[var(--color-text)]">
                    บันทึกการลาพนักงาน
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    สำหรับผู้จัดการและผู้ช่วยผู้จัดการร้าน
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] flex items-center justify-center cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Streak & Score Dynamic Notice */}
            {formPreserveStreak ? (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                <ShieldCheck size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold">ลาแบบได้เงิน (ได้รับค่าจ้าง) & รักษาสตรีคสะสมต่อเนื่อง</p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-relaxed">
                    การบันทึกการลานี้จะไม่หักคะแนน และไม่ตัดสตรีค (Streak) ของพนักงาน และระบบจะไม่แจ้งเตือนการขาดงาน
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300">
                <ZapOff size={18} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold">ลาแบบไม่ได้รับเงิน & ตัดสตรีคเป็น 0 (สตรีคขาด)</p>
                  <p className="text-[11px] text-rose-700 dark:text-rose-400 leading-relaxed">
                    การลานี้ถือเป็นลาไม่มีค่าจ้าง สตรีคสะสมของพนักงานจะถูกรีเซ็ตเป็น 0 ทันที
                  </p>
                </div>
              </div>
            )}

            {formError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0 text-rose-500" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitLeave} className="space-y-4">
              {/* Select Employee with Profile & Search */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5">
                    <Users size={14} className="text-amber-600 dark:text-amber-400" />
                    <span>เลือกพนักงานประจำสาขา <span className="text-rose-500">*</span></span>
                  </label>
                  {selectedFormUser && (
                    <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      <Flame size={12} className="fill-amber-500 text-amber-500" />
                      สตรีคปัจจุบัน: {selectedFormUser.pointStreak} วัน
                    </span>
                  )}
                </div>

                {/* Selected Employee Card Display */}
                {selectedFormUser ? (
                  <div className="p-3.5 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar
                        user={{
                          name: selectedFormUser.name,
                          profile_id: selectedFormUser.profile_id,
                          role: selectedFormUser.role,
                        }}
                        size="md"
                        className="shrink-0 shadow-xs"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs sm:text-sm font-extrabold text-[var(--color-text)] truncate">
                            {selectedFormUser.name}
                          </h4>
                          {selectedFormUser.username && (
                            <span className="text-[11px] text-[var(--color-text-muted)] font-mono">
                              @{selectedFormUser.username}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]">
                            {selectedFormUser.position || "พนักงาน"}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15">
                            <Flame size={11} className="fill-amber-500 text-amber-500" />
                            <span>{selectedFormUser.pointStreak} วัน</span>
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/60">
                            <Award size={11} className="text-amber-600" />
                            <span>{selectedFormUser.point} แต้ม</span>
                          </span>
                          {selectedFormUser.isOnDuty ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                              เข้ากะอยู่
                            </span>
                          ) : selectedFormUser.isOnLeave ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-800 dark:text-rose-300">
                              ลางานอยู่
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen)}
                      className="px-3 py-1.5 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface)] text-xs font-bold text-[var(--color-text)] transition-colors flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                    >
                      <Search size={13} className="text-amber-600" />
                      <span>{isEmployeeDropdownOpen ? "ปิดค้นหา" : "เปลี่ยนคน"}</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEmployeeDropdownOpen(true)}
                    className="w-full p-4 rounded-2xl bg-[var(--color-surface-2)] border-2 border-dashed border-amber-400 dark:border-amber-600 text-center text-xs font-bold text-amber-950 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Search size={16} />
                    <span>คลิกเพื่อค้นหาและเลือกพนักงานประจำสาขา</span>
                  </button>
                )}

                {/* Search & Selection Dropdown List */}
                {isEmployeeDropdownOpen && (
                  <div className="p-3 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-md space-y-2.5 animate-in fade-in duration-150">
                    {/* Search Input */}
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-2.5 text-[var(--color-text-muted)]" />
                      <input
                        type="text"
                        value={employeeSearchQuery}
                        onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                        placeholder="ค้นหาชื่อ นามสกุล ชื่อผู้ใช้ หรือตำแหน่ง..."
                        className="w-full pl-9 pr-8 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl text-xs font-medium text-[var(--color-text)] focus:outline-2 focus:outline-amber-500 placeholder:text-[var(--color-text-muted)]"
                        autoFocus
                      />
                      {employeeSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setEmployeeSearchQuery("")}
                          className="absolute right-2.5 top-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)] px-1">
                      <span>รายชื่อพนักงานสาขานี้:</span>
                      <span>พบ {filteredFormEmployees.length} คน</span>
                    </div>

                    {/* Scrollable Staff List */}
                    <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                      {filteredFormEmployees.length === 0 ? (
                        <div className="p-6 text-center text-xs text-[var(--color-text-muted)]">
                          ไม่พบพนักงานที่ตรงกับ &ldquo;{employeeSearchQuery}&rdquo;
                        </div>
                      ) : (
                        filteredFormEmployees.map((emp) => {
                          const isSelected = emp.id === formUserId;
                          return (
                            <button
                              key={emp.id}
                              type="button"
                              onClick={() => {
                                setFormUserId(emp.id);
                                setIsEmployeeDropdownOpen(false);
                                setEmployeeSearchQuery("");
                              }}
                              className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                                isSelected
                                  ? "bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/20 shadow-2xs"
                                  : "bg-[var(--color-surface-2)] border-[var(--color-border)] hover:bg-[var(--color-surface)] hover:border-amber-300"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <UserAvatar
                                  user={{
                                    name: emp.name,
                                    profile_id: emp.profile_id,
                                    role: emp.role,
                                  }}
                                  size="sm"
                                  className="shrink-0"
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-bold text-[var(--color-text)] truncate">
                                      {emp.name}
                                    </span>
                                    {emp.username && (
                                      <span className="text-[10px] text-[var(--color-text-muted)] font-mono">
                                        @{emp.username}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                                    {emp.position || "พนักงานสาขา"}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10">
                                  <Flame size={10} className="fill-amber-500 text-amber-500" />
                                  <span>{emp.pointStreak} วัน</span>
                                </span>
                                {isSelected ? (
                                  <span className="w-5 h-5 rounded-full bg-amber-500 text-amber-950 flex items-center justify-center font-bold">
                                    <Check size={12} className="stroke-[3]" />
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-semibold text-[var(--color-text-muted)]">
                                    เลือก
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Merged Leave Type & Streak Policy (2 Options) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[var(--color-text)] flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Sparkles size={14} className="text-amber-500" />
                    <span>ประเภทการลา & การพิจารณาสตรีคคะแนน <span className="text-rose-500">*</span></span>
                  </span>
                  {selectedFormUser && (
                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      <Flame size={12} className="fill-amber-500 text-amber-500" />
                      สตรีคเดิม: {selectedFormUser.pointStreak} วัน
                    </span>
                  )}
                </label>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  ประเมินตามดุลยพินิจของผู้จัดการ (การลาแบบได้เงินจะรักษาสตรีคสะสม ส่วนการลาแบบไม่ได้รับเงินจะตัดสตรีคเป็น 0)
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Option 1: Paid Leave + Preserve Streak */}
                  <button
                    type="button"
                    onClick={() => {
                      setFormLeaveType("paid");
                      setFormPreserveStreak(true);
                    }}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 relative ${
                      isPaidLeave(formLeaveType) && formPreserveStreak
                        ? "bg-emerald-500/15 border-emerald-500 text-emerald-950 dark:text-emerald-200 ring-2 ring-emerald-500/30 shadow-xs"
                        : "bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-emerald-400"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-emerald-600 text-white shadow-xs">
                          <Coins size={16} />
                        </span>
                        <div>
                          <span className="text-xs font-extrabold text-[var(--color-text)] block">
                            ลาแบบได้เงิน (ได้รับค่าจ้าง)
                          </span>
                          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                            <ShieldCheck size={13} />
                            <span>รักษาสตรีคคะแนน (สตรีคไม่ขาด)</span>
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 shrink-0">
                        ได้เงิน • รักษาสตรีค
                      </span>
                    </div>

                    <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                      ลาป่วยตามสิทธิ, ลาพักร้อน หรือลาได้รับค่าจ้างตามเกณฑ์ — พนักงานได้รับค่าจ้าง และสตรีคสะสมต่อเนื่อง (ไม่ถูกตัด)
                    </p>

                    {isPaidLeave(formLeaveType) && formPreserveStreak && (
                      <div className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1 pt-1 border-t border-emerald-500/20">
                        <Check size={12} className="stroke-[3]" />
                        <span>เลือกตัวเลือกนี้แล้ว</span>
                      </div>
                    )}
                  </button>

                  {/* Option 2: Unpaid Leave + Break Streak */}
                  <button
                    type="button"
                    onClick={() => {
                      setFormLeaveType("unpaid");
                      setFormPreserveStreak(false);
                    }}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 relative ${
                      isUnpaidLeave(formLeaveType) && !formPreserveStreak
                        ? "bg-rose-500/15 border-rose-500 text-rose-950 dark:text-rose-200 ring-2 ring-rose-500/30 shadow-xs"
                        : "bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-rose-400"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-rose-600 text-white shadow-xs">
                          <FileText size={16} />
                        </span>
                        <div>
                          <span className="text-xs font-extrabold text-[var(--color-text)] block">
                            ลาแบบไม่ได้รับเงิน
                          </span>
                          <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1 mt-0.5">
                            <ZapOff size={13} />
                            <span>ตัดสตรีคเป็น 0 (สตรีคขาด)</span>
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-500/30 shrink-0">
                        ไม่ได้รับเงิน • ตัดสตรีค 0
                      </span>
                    </div>

                    <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                      ลากิจส่วนตัว, ขาดงาน หรือลาไม่มีค่าจ้าง (Leave without pay) — ไม่ได้รับค่าจ้าง และสตรีคสะสมจะถูกตัดเป็น 0 ทันที
                    </p>

                    {isUnpaidLeave(formLeaveType) && !formPreserveStreak && (
                      <div className="text-[10px] font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1 pt-1 border-t border-rose-500/20">
                        <Check size={12} className="stroke-[3]" />
                        <span>เลือกตัวเลือกนี้แล้ว</span>
                      </div>
                    )}
                  </button>
                </div>
              </div>

              {/* Date Range: Start & End Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--color-text)]">
                    ตั้งแต่วันที่ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formStartDate}
                    onChange={(e) => {
                      setFormStartDate(e.target.value);
                      if (formEndDate < e.target.value) {
                        setFormEndDate(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl text-xs sm:text-sm font-semibold text-[var(--color-text)] focus:outline-2 focus:outline-amber-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--color-text)]">
                    ถึงวันที่ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    min={formStartDate}
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl text-xs sm:text-sm font-semibold text-[var(--color-text)] focus:outline-2 focus:outline-amber-500"
                  />
                </div>
              </div>

              {/* Manager Discretion Notice */}
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-950 dark:text-amber-200 flex items-start gap-2">
                <span className="text-amber-600 font-bold shrink-0">ℹ️</span>
                <span><strong>สิทธิการออกใบลาของผู้จัดการ:</strong> ผู้จัดการร้านสามารถออกบันทึกการลาให้พนักงานได้โดยไม่มีข้อจำกัด (สามารถระบุวันลาได้หลายวันต่อเนื่อง และออกใบลาเพิ่มเติมได้ตามดุลยพินิจ)</span>
              </div>

              {/* Reason / Comment Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[var(--color-text)]">
                    เหตุผลในการลา (Comment / Reason) <span className="text-rose-500">*</span>
                  </label>
                </div>
                <textarea
                  required
                  rows={3}
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="ระบุเหตุผล เช่น มีไข้สูง อาเจียน ไปพบแพทย์ที่โรงพยาบาล, มีธุระติดต่อราชการจำเป็นเร่งด่วน ฯลฯ"
                  className="w-full p-3 bg-[var(--color-surface-2)] border rounded-xl text-xs sm:text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-2 leading-relaxed resize-none border-[var(--color-border)] focus:outline-amber-500"
                />
              </div>

              {/* Form Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-amber-950 text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-amber-950 border-t-transparent rounded-full animate-spin" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>ยืนยันบันทึกการลา</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: CANCEL / DELETE LEAVE CONFIRMATION ──────────────────────── */}
      {cancelTargetLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-2xl p-6 space-y-4 animate-scale-up">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <span className="p-2 rounded-xl bg-rose-500/15">
                <Trash2 size={22} />
              </span>
              <h3 className="text-base font-extrabold text-[var(--color-text)]">
                ยืนยันยกเลิกรายการลา
              </h3>
            </div>

            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
              คุณต้องการยกเลิกรายการ{isPaidLeave(cancelTargetLeave.leaveType) ? "ลาเเบบได้เงิน" : "ลาเเบบไม่ได้รับเงิน"} ของ{" "}
              <strong className="text-[var(--color-text)]">{cancelTargetLeave.userName}</strong> ประจำวันที่{" "}
              {formatThaiDate(cancelTargetLeave.startDate)} ใช่หรือไม่?
            </p>

            <div className="p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] italic">
              &ldquo;{cancelTargetLeave.reason}&rdquo;
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setCancelTargetLeave(null)}
                disabled={isCancelling}
                className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer"
              >
                ปิด
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelLeave}
                disabled={isCancelling}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isCancelling ? "กำลังยกเลิก..." : "ยืนยันยกเลิกรายการ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: REJECT CONFIRMATION ──────────────────────────────────── */}
      {rejectModalLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-2xl p-6 space-y-4 animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <AlertCircle size={20} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[var(--color-text)]">
                  ปฏิเสธคำขอลางาน
                </h3>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {rejectModalLeave.userName} ({rejectModalLeave.startDate})
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmReject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--color-text)] mb-1.5">
                  ระบุเหตุผลในการไม่อนุมัติ (ไม่บังคับ)
                </label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="เช่น กำลังคนไม่เพียงพอในกะ, แจ้งกระชั้นชิด ฯลฯ"
                  className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl p-3 text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-rose-400 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModalLeave(null)}
                  disabled={isRejecting}
                  className="px-4 py-2 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] text-xs font-bold text-[var(--color-text)] transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isRejecting}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {isRejecting ? (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : null}
                  <span>ยืนยันปฏิเสธคำขอ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


    </div>
  );
}
