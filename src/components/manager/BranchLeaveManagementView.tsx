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
  updateEmployeeLeaveQuotaAction,
  getEmployeeLeaveQuotaAction,
  LeaveQuotaInfo,
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
  Sliders,
  Check,
  X
} from "lucide-react";
import Link from "next/link";
import { isPaidLeave, isUnpaidLeave, getLeaveTypeLabel } from "../../utils/leave";

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

  // Quota Management modal state
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false);
  const [employeeQuotas, setEmployeeQuotas] = useState<Record<string, LeaveQuotaInfo>>({});
  const [loadingQuotas, setLoadingQuotas] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingQuotaValue, setEditingQuotaValue] = useState<string>("");
  const [isSavingQuota, setIsSavingQuota] = useState(false);
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
      setErrorMsg("โหลดข้อมูลการลาไม่สำเร็จ กรุณากดโหลดใหม่อีกครั้ง");
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

  // Load employee quotas
  const loadBranchEmployeeQuotas = useCallback(async () => {
    if (!employees.length) return;
    setLoadingQuotas(true);
    try {
      const quotaMap: Record<string, LeaveQuotaInfo> = {};
      await Promise.all(
        employees.map(async (emp) => {
          const res = await getEmployeeLeaveQuotaAction({ userId: emp.id, branchId: selectedBranchId });
          if (res.success && res.quota) {
            quotaMap[emp.id] = res.quota;
          }
        })
      );
      setEmployeeQuotas(quotaMap);
    } catch (e) {
      console.error("Error loading employee quotas:", e);
    } finally {
      setLoadingQuotas(false);
    }
  }, [employees, selectedBranchId]);

  useEffect(() => {
    if (isQuotaModalOpen) {
      queueMicrotask(() => {
        loadBranchEmployeeQuotas();
      });
    }
  }, [isQuotaModalOpen, loadBranchEmployeeQuotas]);

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
      setErrorMsg(e instanceof Error ? e.message : "อนุมัติรายการลาไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
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

  const handleSaveEmployeeQuota = async (userId: string) => {
    setIsSavingQuota(true);
    try {
      const val = editingQuotaValue.trim();
      const quotaNum = val === "" ? null : Math.max(0, parseInt(val, 10));
      const res = await updateEmployeeLeaveQuotaAction({
        userId,
        quota: quotaNum,
      });
      if (res.success) {
        setSuccessMsg("อัปเดตโควตาพนักงานเรียบร้อยแล้ว");
        setEditingUserId(null);
        loadBranchEmployeeQuotas();
      } else {
        setErrorMsg(res.error || "ไม่สามารถอัปเดตโควตาได้");
      }
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setIsSavingQuota(false);
    }
  };

  // Open modal handler
  const handleOpenAddModal = (userId?: string) => {
    setFormUserId(userId || (employees[0]?.id ?? ""));
    setFormLeaveType("paid");
    setFormPreserveStreak(true);
    setFormStartDate(thaiTodayStr);
    setFormEndDate(thaiTodayStr);
    setFormReason("");
    setFormError(null);
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
        setErrorMsg(res.error || "ยกเลิกรายการลาไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      }
    } catch (err: unknown) {
      console.error("Cancel leave error:", err);
      setErrorMsg("ยกเลิกรายการลาไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
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
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] pb-24">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-[var(--color-surface)]/90 backdrop-blur-md border-b border-[var(--color-border)] px-4 sm:px-6 py-3.5 transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onBackToDashboard ? (
              <button
                type="button"
                onClick={onBackToDashboard}
                className="p-2 -ml-2 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
                title="กลับสู่แดชบอร์ดหลัก"
              >
                <ArrowLeft size={18} />
              </button>
            ) : (
              <Link
                href="/manager/dashboard"
                className="p-2 -ml-2 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
                title="กลับสู่แดชบอร์ดผู้บริหาร"
              >
                <ArrowLeft size={18} />
              </Link>
            )}

            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <HeartPulse size={18} />
                </span>
                <h1 className="text-base sm:text-lg font-extrabold text-[var(--color-text)]">
                  ระบบบันทึกการลาพนักงาน
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  Manager & Assistant
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5 hidden sm:block">
                จัดการลาป่วยและลากิจสำหรับพนักงานในสาขา พร้อมระบบคุ้มครองคะแนนและสตรีค
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Branch Selector */}
            {branches.length > 1 && (
              <div className="flex items-center gap-1.5 bg-[var(--color-surface-2)] px-2.5 py-1.5 rounded-xl border border-[var(--color-border)]">
                <Store size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <select
                  value={selectedBranchId}
                  onChange={(e) => handleBranchChange(e.target.value)}
                  className="bg-transparent text-xs font-bold text-[var(--color-text)] focus:outline-none cursor-pointer pr-1"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id} className="bg-[var(--color-surface)] text-[var(--color-text)]">
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Tab Switcher: Presence vs Leaves */}
            <div className="flex items-center p-0.5 sm:p-1 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl shrink-0">
              {onTabChange ? (
                <button
                  type="button"
                  onClick={() => onTabChange("presence")}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    currentTab === "presence"
                      ? "bg-amber-500 text-amber-950 shadow-xs"
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
                    ? "bg-rose-600 text-white shadow-xs cursor-default"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer"
                }`}
              >
                <HeartPulse size={14} className={currentTab === "leaves" ? "text-white" : "text-rose-500"} />
                <span className="hidden sm:inline">จัดการการลา</span>
                <span className="sm:hidden">การลา</span>
              </button>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => loadData(selectedBranchId, true)}
              disabled={isRefreshing}
              className="p-2 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)] transition-colors cursor-pointer"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw size={15} className={isRefreshing ? "animate-spin text-amber-500" : ""} />
            </button>

            <ThemeToggle />

            {/* Manage Employee Quotas Button */}
            <button
              type="button"
              onClick={() => setIsQuotaModalOpen(true)}
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)] text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              title="จัดการโควตาการลาของพนักงานในสาขา"
            >
              <Sliders size={15} className="text-amber-600 dark:text-amber-400" />
              <span className="hidden sm:inline">โควตาพนักงาน</span>
            </button>

            {/* Primary Action Button */}
            <button
              type="button"
              onClick={() => handleOpenAddModal()}
              className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>บันทึกการลา</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Banner Alert Feedback */}
        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 flex items-center justify-between text-xs sm:text-sm animate-fade-in shadow-xs">
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
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-300 flex items-center justify-between text-xs sm:text-sm animate-fade-in shadow-xs">
            <div className="flex items-center gap-2.5">
              <AlertCircle size={18} className="text-rose-500 shrink-0" />
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

        {/* ─── GUARANTEE BADGE CARD & KPIS ─────────────────────────────────── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {/* Card 1: Today Leaves Count */}
          <div className="p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-[var(--color-text-muted)]">กำลังลางานวันนี้</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-[var(--color-text)]">
                  {stats.todayCount}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">คน</span>
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                ประจำวันที่ {formatThaiDate(thaiTodayStr)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <CalendarDays size={24} />
            </div>
          </div>

          {/* Card 2: Pending Approval Count */}
          <div className={`p-5 rounded-2xl bg-[var(--color-surface)] border-2 shadow-xs flex items-center justify-between ${
            stats.pendingCount > 0
              ? "border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/20"
              : "border-[var(--color-border)]"
          }`}>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${stats.pendingCount > 0 ? "bg-amber-500 animate-ping" : "bg-[var(--color-border)]"}`} />
                <p className="text-xs font-bold text-amber-700 dark:text-amber-400">คำขอรออนุมัติ</p>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-[var(--color-text)]">
                  {stats.pendingCount}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">รายการ</span>
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                {stats.pendingCount > 0 ? "มีคำขอจากพนักงานรอพิจารณา" : "ไม่มีคำขอรออนุมัติ"}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0">
              <Clock size={24} />
            </div>
          </div>

          {/* Card 3: Paid Leave Count */}
          <div className="p-5 rounded-2xl bg-[var(--color-surface)] border-2 border-emerald-500/30 dark:border-emerald-500/40 shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">ลาเเบบได้เงิน (Paid)</p>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-emerald-950 dark:text-emerald-200">
                  {stats.paidCount}
                </span>
                <span className="text-xs text-emerald-700 dark:text-emerald-400">คนในวันนี้</span>
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)]">ได้รับค่าจ้างตามสิทธิ</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <Coins size={24} />
            </div>
          </div>

          {/* Card 3: Unpaid Leave Count */}
          <div className="p-5 rounded-2xl bg-[var(--color-surface)] border-2 border-amber-500/30 dark:border-amber-500/40 shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <p className="text-xs font-bold text-amber-700 dark:text-amber-400">ลาเเบบไม่ได้รับเงิน (Unpaid Leave)</p>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-amber-950 dark:text-amber-200">
                  {stats.unpaidCount}
                </span>
                <span className="text-xs text-amber-700 dark:text-amber-400">คนในวันนี้</span>
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)]">ไม่ได้รับค่าจ้าง (Leave without pay)</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0">
              <FileText size={24} />
            </div>
          </div>

          {/* Card 4: Streak & Score Management */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-[var(--color-surface)] to-amber-500/10 border-2 border-emerald-500/40 shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  ดุลยพินิจจัดการสตรีค
                </p>
              </div>
              <p className="text-xs font-extrabold text-[var(--color-text)]">
                {stats.streakBrokenCount > 0 
                  ? `คุ้มครอง ${stats.totalRecorded - stats.streakBrokenCount} รายการ / ตัดสตรีค ${stats.streakBrokenCount} รายการ`
                  : "คุ้มครองสตรีค 100% (ไม่หักแต้ม)"}
              </p>
              <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                ผู้จัดการสามารถเลือกอนุมัติรักษาสตรีค หรือตัดสตรีคเป็น 0 ตามเกณฑ์ความสมเหตุสมผล
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0 shadow-xs">
              <Flame size={24} className="fill-amber-500 text-amber-500 animate-pulse" />
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
                        {(approvalLeaveTypes[pl.id] || "ลาเเบบได้เงิน") === "ลาเเบบได้เงิน" ? "หักสิทธิการลา (Paid)" : "ไม่หักสิทธิการลา (Unpaid)"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setApprovalLeaveTypes(prev => ({ ...prev, [pl.id]: "ลาเเบบได้เงิน" }))}
                        className={`p-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${(approvalLeaveTypes[pl.id] || "ลาเเบบได้เงิน") === "ลาเเบบได้เงิน"
                          ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500 font-extrabold shadow-2xs"
                          : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-[var(--color-surface)]"
                        }`}
                      >
                        <Coins size={14} className={(approvalLeaveTypes[pl.id] || "ลาเเบบได้เงิน") === "ลาเเบบได้เงิน" ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--color-text-muted)]"} />
                        <span>ลาเเบบได้เงิน</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setApprovalLeaveTypes(prev => ({ ...prev, [pl.id]: "ลาเเบบไม่ได้รับเงิน" }))}
                        className={`p-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${approvalLeaveTypes[pl.id] === "ลาเเบบไม่ได้รับเงิน"
                          ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500 font-extrabold shadow-2xs"
                          : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-[var(--color-surface)]"
                        }`}
                      >
                        <Clock size={14} className={approvalLeaveTypes[pl.id] === "ลาเเบบไม่ได้รับเงิน" ? "text-amber-600 dark:text-amber-400" : "text-[var(--color-text-muted)]"} />
                        <span>ลาเเบบไม่ได้รับเงิน</span>
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
                      onClick={() => handleApprove(pl.id, approvalLeaveTypes[pl.id] || "ลาเเบบได้เงิน", true)}
                      disabled={isApproving === pl.id}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-extrabold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      {isApproving === pl.id ? (
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Check size={14} />
                      )}
                      <span>อนุมัติ ({(approvalLeaveTypes[pl.id] || "ลาเเบบได้เงิน") === "ลาเเบบไม่ได้รับเงิน" ? "ไม่ได้รับเงิน" : "ได้เงิน"})</span>
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
                  ? "bg-amber-600 text-white shadow-xs"
                  : "text-amber-700 dark:text-amber-400 hover:text-amber-950"
              }`}
            >
              <Clock size={14} />
              <span>รออนุมัติ ({stats.pendingCount})</span>
              {stats.pendingCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter("paid")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                typeFilter === "paid"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-emerald-700 dark:text-emerald-400 hover:text-emerald-950"
              }`}
            >
              <Coins size={14} />
              <span>ลาเเบบได้เงิน ({leaves.filter(l => isPaidLeave(l.leaveType)).length})</span>
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter("unpaid")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                typeFilter === "unpaid"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "text-amber-700 dark:text-amber-400 hover:text-amber-950"
              }`}
            >
              <FileText size={14} />
              <span>ลาเเบบไม่ได้รับเงิน ({leaves.filter(l => isUnpaidLeave(l.leaveType)).length})</span>
            </button>
          </div>

          {/* Date Scope & Streak Status Filters & Search */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={streakFilter}
              onChange={(e) => setStreakFilter(e.target.value as "all" | "preserved" | "broken")}
              className="px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)] focus:outline-none cursor-pointer"
            >
              <option value="all">สตรีค: ทั้งหมด</option>
              <option value="preserved">🛡️ รักษาสตรีค</option>
              <option value="broken">⚠️ ตัดสตรีค</option>
            </select>

            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as "all" | "today" | "upcoming" | "past")}
              className="px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)] focus:outline-none cursor-pointer"
            >
              <option value="all">ทุกช่วงเวลา</option>
              <option value="today">กำลังลาวันนี้</option>
              <option value="upcoming">การลาในอนาคต</option>
              <option value="past">ประวัติการลาที่ผ่านมา</option>
            </select>

            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search size={14} className="absolute left-3 top-2.5 text-[var(--color-text-muted)]" />
              <input
                type="text"
                placeholder="ค้นหาชื่อพนักงาน หรือเหตุผล..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-2 focus:outline-rose-500"
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
          <div className="p-16 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-9 h-9 rounded-full border-3 border-rose-500 border-t-transparent animate-spin" />
            <p className="text-xs text-[var(--color-text-muted)]">กำลังโหลดรายการการลาของสาขา...</p>
          </div>
        ) : filteredLeaves.length === 0 ? (
          <div className="p-12 text-center bg-[var(--color-surface)] rounded-3xl border border-[var(--color-border)] flex flex-col items-center justify-center gap-3 shadow-xs">
            <div className="w-16 h-16 rounded-3xl bg-[var(--color-surface-2)] flex items-center justify-center text-[var(--color-text-muted)]">
              <Calendar size={32} />
            </div>
            <h3 className="text-base font-extrabold text-[var(--color-text)]">
              ไม่พบรายการการลาที่ตรงกับเงื่อนไข
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] max-w-sm">
              ยังไม่มีการบันทึกการลา หรือตัวกรองที่เลือกไม่พบข้อมูล คุณสามารถกดปุ่มด้านล่างเพื่อบันทึกการลาใหม่
            </p>
            <button
              type="button"
              onClick={() => handleOpenAddModal()}
              className="mt-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Plus size={15} />
              <span>บันทึกการลาพนักงาน</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 ${
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
          </div>
        )}
      </main>

      {/* ─── MODAL: RECORD LEAVE FORM ───────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-2xl p-6 space-y-5 animate-scale-up max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
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
                  <p className="font-bold">อนุมัติรักษาสตรีคและคะแนนสะสม (สตรีคไม่ขาด)</p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-relaxed">
                    การบันทึกการลานี้จะไม่หักคะแนน และไม่ตัดสตรีค (Streak) ของพนักงาน และระบบจะไม่แจ้งเตือนการขาดงาน
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300">
                <ZapOff size={18} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold">ตัดสตรีคเป็น 0 ตามดุลยพินิจผู้บริหาร (สตรีคขาด)</p>
                  <p className="text-[11px] text-rose-700 dark:text-rose-400 leading-relaxed">
                    การลานี้ถือว่าไม่ตรงตามเกณฑ์ หรือแจ้งกระชั้นชิดเกินไป สตรีคสะสมของพนักงานจะถูกรีเซ็ตเป็น 0 ทันที
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
              {/* Select Employee */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--color-text)] flex items-center justify-between">
                  <span>เลือกพนักงาน <span className="text-rose-500">*</span></span>
                  {selectedFormUser && (
                    <span className="text-[11px] font-normal text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Flame size={12} className="fill-amber-500" />
                      สตรีคปัจจุบัน: {selectedFormUser.pointStreak} วัน
                    </span>
                  )}
                </label>
                <select
                  value={formUserId}
                  onChange={(e) => setFormUserId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl text-xs sm:text-sm font-semibold text-[var(--color-text)] focus:outline-2 focus:outline-rose-500 cursor-pointer"
                >
                  <option value="" disabled>-- กรุณาเลือกพนักงาน --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.position || "พนักงาน"}) — สตรีค {emp.pointStreak} วัน
                    </option>
                  ))}
                </select>
              </div>

              {/* Leave Type Selector (2 Options: ลาเเบบได้เงิน vs ลาเเบบไม่ได้รับเงิน) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--color-text)]">
                  ประเภทการลา <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Paid Leave Option */}
                  <button
                    type="button"
                    onClick={() => setFormLeaveType("paid")}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                      isPaidLeave(formLeaveType)
                        ? "bg-emerald-500/15 border-emerald-500 text-emerald-950 dark:text-emerald-200 ring-2 ring-emerald-500/20"
                        : "bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-emerald-400"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="p-1.5 rounded-xl bg-emerald-600 text-white">
                        <Coins size={15} />
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                        ได้รับค่าจ้าง
                      </span>
                    </div>
                    <span className="text-xs font-bold text-[var(--color-text)] mt-0.5">
                      ลาเเบบได้เงิน
                    </span>
                    <span className="text-[11px] text-[var(--color-text-muted)] line-clamp-1">
                      ลาป่วยตามสิทธิ, ลาพักร้อน หรือลาได้รับค่าจ้าง
                    </span>
                  </button>

                  {/* Unpaid Leave Option */}
                  <button
                    type="button"
                    onClick={() => setFormLeaveType("unpaid")}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                      isUnpaidLeave(formLeaveType)
                        ? "bg-amber-500/15 border-amber-500 text-amber-950 dark:text-amber-200 ring-2 ring-amber-500/20"
                        : "bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-amber-400"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="p-1.5 rounded-xl bg-amber-600 text-white">
                        <FileText size={15} />
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300">
                        ไม่ได้รับค่าจ้าง
                      </span>
                    </div>
                    <span className="text-xs font-bold text-[var(--color-text)] mt-0.5">
                      ลาเเบบไม่ได้รับเงิน
                    </span>
                    <span className="text-[11px] text-[var(--color-text-muted)] line-clamp-1">
                      ลากิจส่วนตัว, ขาดงาน หรือลาไม่มีค่าจ้าง (Leave without pay)
                    </span>
                  </button>
                </div>
              </div>

              {/* Streak Decision Control (Manager Viewpoint) */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Flame size={15} className="text-amber-500" />
                    <label className="text-xs font-bold text-[var(--color-text)]">
                      การพิจารณาสตรีคคะแนน (Manager Streak Decision) <span className="text-rose-500">*</span>
                    </label>
                  </div>
                  {selectedFormUser && (
                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                      สตรีคปัจจุบัน: {selectedFormUser.pointStreak} วัน
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  ประเมินตามดุลยพินิจของผู้จัดการว่าการลานี้สมเหตุสมผลตามเกณฑ์ของร้านหรือไม่
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {/* Option 1: Preserve Streak */}
                  <button
                    type="button"
                    onClick={() => setFormPreserveStreak(true)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                      formPreserveStreak
                        ? "bg-emerald-500/15 border-emerald-500 text-emerald-950 dark:text-emerald-200 ring-2 ring-emerald-500/20"
                        : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-emerald-400"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-700 dark:text-emerald-400">
                        <ShieldCheck size={16} />
                        <span>อนุมัติรักษาสตรีค</span>
                      </div>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-200">
                        สตรีคไม่ขาด
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 leading-tight">
                      การลามีเหตุผลสมควรตามเกณฑ์ สตรีคคะแนนจะไม่ถูกตัดและสะสมต่อเนื่อง
                    </p>
                  </button>

                  {/* Option 2: Break Streak */}
                  <button
                    type="button"
                    onClick={() => setFormPreserveStreak(false)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                      !formPreserveStreak
                        ? "bg-rose-500/15 border-rose-500 text-rose-950 dark:text-rose-200 ring-2 ring-rose-500/20"
                        : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-rose-400"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-rose-700 dark:text-rose-400">
                        <ZapOff size={16} />
                        <span>ตัดสตรีคเป็น 0</span>
                      </div>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-800 dark:text-rose-200">
                        สตรีคขาด
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 leading-tight">
                      การลาไม่ตรงตามเกณฑ์ หรือแจ้งกระทันหัน สตรีคของพนักงานจะถูกตัดเป็น 0 ทันที
                    </p>
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
                    className="w-full px-3 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl text-xs sm:text-sm font-semibold text-[var(--color-text)] focus:outline-2 focus:outline-rose-500"
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
                    className="w-full px-3 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl text-xs sm:text-sm font-semibold text-[var(--color-text)] focus:outline-2 focus:outline-rose-500"
                  />
                </div>
              </div>

              {/* Reason / Comment Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[var(--color-text)]">
                    เหตุผลในการลา (Comment / Reason) <span className="text-rose-500">*</span>
                  </label>
                  {formLeaveType === "other" && (
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                      ⚠️ จำเป็นต้องระบุรายละเอียด
                    </span>
                  )}
                </div>
                <textarea
                  required
                  rows={3}
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder={
                    formLeaveType === "other"
                      ? "โปรดระบุรายละเอียดและเหตุผลอย่างชัดเจนสำหรับกรณีอื่นๆ เช่น อบรมกิจกรรมภายนอก, ปัญหาเหตุสุดวิสัยเร่งด่วน ฯลฯ"
                      : "ระบุเหตุผล เช่น มีไข้สูง อาเจียน ไปพบแพทย์ที่โรงพยาบาล, มีธุระติดต่อราชการจำเป็นเร่งด่วน ฯลฯ"
                  }
                  className={`w-full p-3 bg-[var(--color-surface-2)] border rounded-xl text-xs sm:text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-2 leading-relaxed resize-none ${
                    formLeaveType === "other" && !formReason.trim()
                      ? "border-amber-400 focus:outline-amber-500"
                      : "border-[var(--color-border)] focus:outline-rose-500"
                  }`}
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
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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

      {/* ─── MODAL: MANAGE EMPLOYEE QUOTAS ─────────────────────────────── */}
      {isQuotaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-2xl bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-2xl p-6 space-y-5 animate-scale-up max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Sliders size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[var(--color-text)]">
                    จัดการโควตาการลาพนักงาน
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    กำหนดจำกัดวันลาเฉพาะบุคคลของพนักงานในสาขา (หากไม่กำหนด จะใช้ค่าเริ่มต้นของสาขา)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsQuotaModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] flex items-center justify-center cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {loadingQuotas ? (
              <div className="py-12 text-center text-xs text-[var(--color-text-muted)]">
                กำลังโหลดข้อมูลโควตาพนักงาน...
              </div>
            ) : employees.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--color-text-muted)]">
                ยังไม่มีข้อมูลพนักงานในสาขานี้
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {employees.map((emp) => {
                  const q = employeeQuotas[emp.id];
                  const isEditing = editingUserId === emp.id;
                  const currentLimit = q?.customQuota !== null && q?.customQuota !== undefined ? q.customQuota : null;
                  const branchDef = q?.branchDefaultQuota ?? 30;

                  return (
                    <div key={emp.id} className="py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-[var(--color-text)]">{emp.name}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-muted)]">
                            {emp.position || "พนักงาน"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] mt-1">
                          <span>
                            โควตา:{" "}
                            {currentLimit !== null ? (
                              <strong className="text-amber-600 dark:text-amber-400">{currentLimit} วัน/ปี (กำหนดเฉพาะบุคคล)</strong>
                            ) : (
                              <span>ค่าเริ่มต้นสาขา ({branchDef} วัน/ปี)</span>
                            )}
                          </span>
                          {q && (
                            <span>
                              ใช้แล้ว: <strong className="text-[var(--color-text)]">{q.usedDays}</strong> วัน (คงเหลือ {q.remainingDays} วัน)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max="365"
                              placeholder={`${branchDef}`}
                              value={editingQuotaValue}
                              onChange={(e) => setEditingQuotaValue(e.target.value)}
                              className="w-20 px-2.5 py-1.5 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl text-xs font-bold text-[var(--color-text)] focus:outline-none focus:border-amber-400"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEmployeeQuota(emp.id)}
                              disabled={isSavingQuota}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer"
                            >
                              บันทึก
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingUserId(null)}
                              className="px-2.5 py-1.5 rounded-xl border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer"
                            >
                              ยกเลิก
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUserId(emp.id);
                              setEditingQuotaValue(currentLimit !== null ? String(currentLimit) : "");
                            }}
                            className="px-3 py-1.5 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] text-xs font-bold text-[var(--color-text)] transition-all cursor-pointer"
                          >
                            {currentLimit !== null ? "แก้ไขโควตา" : "ตั้งโควตาเฉพาะคน"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="pt-3 border-t border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-text-muted)]">
              <span>* เว้นว่างเพื่อคืนค่าเป็นค่าเริ่มต้นของสาขา</span>
              <button
                type="button"
                onClick={() => setIsQuotaModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] text-[var(--color-text)] font-bold text-xs cursor-pointer transition-colors"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
