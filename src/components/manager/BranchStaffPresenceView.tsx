"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { User, ShiftType } from "../../types";
import { BranchEmployeeStatus, getBranchStaffStatusAction } from "../../actions/manager";
import { BrandLogo } from "../common/BrandLogo";
import { ThemeToggle } from "../common/ThemeToggle";
import { 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft, 
  RefreshCw, 
  Search, 
  Store, 
  Flame, 
  Award, 
  Check, 
  CircleDot,
  Calendar,
  Layers,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  HeartPulse,
  ShieldCheck,
  FileText,
  HelpCircle,
  Coins,
  ZapOff
} from "lucide-react";
import Link from "next/link";
import { isPaidLeave, getLeaveTypeLabel } from "../../utils/leave";
import { getShiftBadge, getShiftName } from "../common/Badge";

interface BranchStaffPresenceViewProps {
  currentUser: User;
  currentTab?: "presence" | "leaves";
  onTabChange?: (tab: "presence" | "leaves") => void;
  onSwitchToLeaves?: (userId?: string) => void;
}

export function BranchStaffPresenceView({
  currentUser,
  currentTab = "presence",
  onTabChange,
  onSwitchToLeaves,
}: BranchStaffPresenceViewProps) {
  const [employees, setEmployees] = useState<BranchEmployeeStatus[]>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<"all" | "on_duty" | "off_duty" | "on_leave">("all");
  const [shiftFilter, setShiftFilter] = useState<"all" | ShiftType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState<string>("all");

  // Selected Employee for detail drawer/modal
  const [inspectedEmployee, setInspectedEmployee] = useState<BranchEmployeeStatus | null>(null);

  const loadData = useCallback(async (branchId?: string, isManual = false) => {
    try {
      if (isManual) setIsRefreshing(true);
      else setIsLoading(true);
      setErrorMsg(null);

      const res = await getBranchStaffStatusAction(branchId);
      if (res.success && res.employees) {
        setEmployees(res.employees);
        setBranches(res.branches || []);
        if (res.selectedBranchId) {
          setSelectedBranchId(res.selectedBranchId);
        }
        setLastRefreshedAt(new Date());
      } else {
        setErrorMsg(res.error || "ไม่สามารถโหลดข้อมูลพนักงานได้");
      }
    } catch (err: any) {
      console.error("Error loading branch staff presence:", err);
      setErrorMsg("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData(currentUser.branchId);
  }, [loadData, currentUser.branchId]);

  const handleBranchChange = (newBranchId: string) => {
    setSelectedBranchId(newBranchId);
    loadData(newBranchId, true);
  };

  // KPI Calculations
  const totalStaff = employees.length;
  const onDutyCount = useMemo(() => employees.filter(e => e.isOnDuty).length, [employees]);
  const onLeaveCount = useMemo(() => employees.filter(e => e.isOnLeave).length, [employees]);
  const offDutyCount = totalStaff - onDutyCount - onLeaveCount;
  const totalShiftsToday = useMemo(() => employees.reduce((acc, e) => acc + e.todayShiftsCount, 0), [employees]);

  // Available unique positions for filter
  const availablePositions = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      if (e.position) set.add(e.position);
    });
    return Array.from(set);
  }, [employees]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      // Status filter
      if (statusFilter === "on_duty" && !emp.isOnDuty) return false;
      if (statusFilter === "off_duty" && (emp.isOnDuty || emp.isOnLeave)) return false;
      if (statusFilter === "on_leave" && !emp.isOnLeave) return false;

      // Shift filter
      if (shiftFilter !== "all") {
        if (!emp.isOnDuty || emp.activeShift?.shift !== shiftFilter) return false;
      }

      // Position filter
      if (positionFilter !== "all" && emp.position !== positionFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = emp.name.toLowerCase().includes(q);
        const matchesUsername = (emp.username || "").toLowerCase().includes(q);
        const matchesPosition = emp.position?.toLowerCase().includes(q);
        if (!matchesName && !matchesUsername && !matchesPosition) return false;
      }

      return true;
    });
  }, [employees, statusFilter, shiftFilter, positionFilter, searchQuery]);

  const activeBranchName = useMemo(() => {
    const b = branches.find(item => item.id === selectedBranchId);
    return b ? b.name : employees[0]?.branchName || "สาขาหลัก";
  }, [branches, selectedBranchId, employees]);

  function formatTime(isoStr: string) {
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "-";
    }
  }

  function formatDate(isoStr?: string | null) {
    if (!isoStr) return "ยังไม่มีประวัติ";
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "-";
    }
  }

  function formatDuration(minutes: number) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} นาที`;
    return `${hours} ชม. ${mins} นาที`;
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] flex flex-col font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-[var(--color-surface)]/95 backdrop-blur-md border-b border-[var(--color-border)] px-4 sm:px-8 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/manager/dashboard"
              className="p-2 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
              title="กลับไปยังแดชบอร์ดหลัก"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">แดชบอร์ด</span>
            </Link>

            <div className="h-5 w-px bg-[var(--color-border)]" />

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-amber-950 flex items-center justify-center font-bold text-xs shadow-2xs">
                <Users size={18} />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-[var(--color-text)] leading-tight flex items-center gap-2">
                  <span>สถานะพนักงานและการเข้ากะสาขา</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                    {onDutyCount} เข้ากะอยู่
                  </span>
                </h1>
                <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                  <Store size={12} className="text-amber-600" />
                  <span>{activeBranchName}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Branch Selector (if multiple) */}
            {branches.length > 1 && (
              <select
                value={selectedBranchId}
                onChange={e => handleBranchChange(e.target.value)}
                className="px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)] focus:outline-2 focus:outline-amber-500"
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}

            {/* Tab Switcher: Presence vs Leaves */}
            <div className="flex items-center p-0.5 sm:p-1 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl shrink-0">
              <button
                type="button"
                onClick={() => onTabChange?.("presence")}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition-all ${
                  currentTab === "presence"
                    ? "bg-amber-500 text-amber-950 shadow-xs cursor-default"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer"
                }`}
              >
                <Users size={14} />
                <span className="hidden sm:inline">สถานะกะพนักงาน</span>
                <span className="sm:hidden">กะงาน</span>
              </button>
              {onTabChange ? (
                <button
                  type="button"
                  onClick={() => onTabChange("leaves")}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    currentTab === "leaves"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                >
                  <HeartPulse size={14} className={currentTab === "leaves" ? "text-white" : "text-rose-500"} />
                  <span className="hidden sm:inline">จัดการการลา</span>
                  <span className="sm:hidden">การลา</span>
                </button>
              ) : (
                <Link
                  href="/manager/leaves"
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition-all text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer"
                >
                  <HeartPulse size={14} className="text-rose-500" />
                  <span className="hidden sm:inline">จัดการการลา</span>
                  <span className="sm:hidden">การลา</span>
                </Link>
              )}
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => loadData(selectedBranchId, true)}
              disabled={isRefreshing}
              className="px-3 py-1.5 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 text-[var(--color-text)] cursor-pointer"
              title="รีเฟรชข้อมูลสถานะพนักงาน"
            >
              <RefreshCw size={14} className={isRefreshing ? "animate-spin text-amber-600" : ""} />
              <span className="hidden sm:inline">อัปเดต</span>
            </button>

            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-6 flex-1 flex flex-col gap-6">
        {/* Error notification if any */}
        {errorMsg && (
          <div className="p-4 rounded-xl border-l-4 border-red-500 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200 flex items-center justify-between text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => loadData(selectedBranchId, true)}
              className="underline font-bold"
            >
              ลองใหม่
            </button>
          </div>
        )}

        {/* KPI Summary Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* Card 1: Total Staff */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--color-text-muted)]">พนักงานในสาขาทั้งหมด</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-[var(--color-text)] mt-1">
                {totalStaff} <span className="text-xs font-normal text-[var(--color-text-muted)]">คน</span>
              </p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 flex items-center justify-center shrink-0">
              <Users size={22} />
            </div>
          </div>

          {/* Card 2: Currently On Duty */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[var(--color-surface)] border-2 border-emerald-400 dark:border-emerald-600 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                กำลังปฏิบัติงาน (On Duty)
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-emerald-950 dark:text-emerald-200 mt-1">
                {onDutyCount} <span className="text-xs font-normal text-emerald-700 dark:text-emerald-400">คน</span>
              </p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <Clock size={22} />
            </div>
          </div>

          {/* Card 3: Currently On Leave */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[var(--color-surface)] border-2 border-rose-400 dark:border-rose-600 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                ลางานวันนี้ (On Leave)
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-rose-950 dark:text-rose-200 mt-1">
                {onLeaveCount} <span className="text-xs font-normal text-rose-700 dark:text-rose-400">คน</span>
              </p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 flex items-center justify-center shrink-0">
              <HeartPulse size={22} />
            </div>
          </div>

          {/* Card 4: Off Duty */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--color-text-muted)]">อยู่นอกกะ (Off Duty)</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-[var(--color-text)] mt-1">
                {offDutyCount} <span className="text-xs font-normal text-[var(--color-text-muted)]">คน</span>
              </p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[var(--color-surface-2)] text-[var(--color-text-muted)] flex items-center justify-center shrink-0">
              <CircleDot size={22} />
            </div>
          </div>

          {/* Card 5: Total Shifts Today */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--color-text-muted)]">จำนวนกะเข้าทำงานวันนี้</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-[var(--color-primary)] dark:text-amber-300 mt-1">
                {totalShiftsToday} <span className="text-xs font-normal text-[var(--color-text-muted)]">กะ</span>
              </p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
              <Layers size={22} />
            </div>
          </div>
        </section>

        {/* Filter and Search Controls */}
        <section className="p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 p-1 bg-[var(--color-surface-2)] rounded-xl overflow-x-auto shrink-0">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === "all"
                  ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-xs"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              ทั้งหมด ({totalStaff})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("on_duty")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                statusFilter === "on_duty"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-emerald-800 dark:text-emerald-400 hover:text-emerald-950"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span>กำลังเข้ากะ ({onDutyCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("on_leave")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                statusFilter === "on_leave"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-rose-800 dark:text-rose-400 hover:text-rose-950"
              }`}
            >
              <HeartPulse size={13} />
              <span>ลางาน ({onLeaveCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("off_duty")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === "off_duty"
                  ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-xs"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              อยู่นอกกะ ({offDutyCount})
            </button>
          </div>

          {/* Secondary Filters: Shift, Position, and Search */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Shift Filter (only visible when on duty or all) */}
            <select
              value={shiftFilter}
              onChange={e => setShiftFilter(e.target.value as any)}
              className="px-2.5 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-medium text-[var(--color-text)]"
            >
              <option value="all">ทุกรอบกะ</option>
              <option value="morning">กะเช้า</option>
              <option value="afternoon">กะบ่าย</option>
              <option value="both">กะควบ</option>
            </select>

            {/* Position Filter */}
            {availablePositions.length > 0 && (
              <select
                value={positionFilter}
                onChange={e => setPositionFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-medium text-[var(--color-text)]"
              >
                <option value="all">ทุกตำแหน่ง</option>
                {availablePositions.map(pos => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>
            )}

            {/* Search Input */}
            <div className="relative flex-1 sm:w-56">
              <Search size={14} className="absolute left-2.5 top-2.5 text-[var(--color-text-muted)]" />
              <input
                type="text"
                placeholder="ค้นหาชื่อ หรือชื่อผู้ใช้..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs focus:outline-2 focus:outline-amber-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Staff Cards Grid */}
        {isLoading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-3 border-amber-500 border-t-transparent animate-spin" />
            <p className="text-xs text-[var(--color-text-muted)]">กำลังตรวจสอบสถานะการเข้ากะของพนักงาน...</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-12 text-center bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] flex flex-col items-center justify-center gap-3">
            <Users size={36} className="text-[var(--color-text-muted)] opacity-50" />
            <p className="text-sm font-bold text-[var(--color-text)]">ไม่พบพนักงานที่ตรงกับเงื่อนไขการค้นหา</p>
            <p className="text-xs text-[var(--color-text-muted)]">ลองปรับเปลี่ยนตัวกรอง หรือล้างคำค้นหา</p>
            {(statusFilter !== "all" || shiftFilter !== "all" || positionFilter !== "all" || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("all");
                  setShiftFilter("all");
                  setPositionFilter("all");
                  setSearchQuery("");
                }}
                className="mt-2 px-3 py-1.5 rounded-xl bg-amber-500 text-amber-950 font-bold text-xs hover:bg-amber-400 transition-colors"
              >
                ล้างตัวกรองทั้งหมด
              </button>
            )}
          </div>
        ) : (
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEmployees.map(emp => {
              const isOnDuty = emp.isOnDuty;
              const active = emp.activeShift;

              return (
                <div
                  key={emp.id}
                  className={`p-5 rounded-2xl bg-[var(--color-surface)] border transition-all flex flex-col justify-between shadow-xs hover:shadow-md ${
                    isOnDuty
                      ? "border-emerald-500/80 dark:border-emerald-600 bg-gradient-to-b from-emerald-50/20 to-[var(--color-surface)]"
                      : "border-[var(--color-border)] hover:border-amber-400"
                  }`}
                >
                  <div>
                    {/* Header: Avatar, Name, Status Badge */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-3">
                        <div className="relative">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm ${
                            isOnDuty 
                              ? "bg-emerald-600 text-white shadow-xs" 
                              : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                          }`}>
                            {emp.name.slice(0, 2)}
                          </div>
                          {/* Status Dot */}
                          <span
                            className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[var(--color-surface)] ${
                              isOnDuty 
                                ? "bg-emerald-500 animate-pulse" 
                                : emp.isOnLeave 
                                ? "bg-rose-500" 
                                : "bg-gray-400"
                            }`}
                            title={isOnDuty ? "กำลังปฏิบัติงาน" : emp.isOnLeave ? "ลางาน (ได้รับอนุมัติ)" : "อยู่นอกกะ"}
                          />
                        </div>

                        <div>
                          <h3 className="text-sm font-bold text-[var(--color-text)] leading-tight">
                            {emp.name}
                          </h3>
                          <span className="inline-block mt-0.5 text-xs text-[var(--color-text-muted)]">
                            {emp.position || "พนักงานสาขา"}
                          </span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      {emp.isOnLeave && emp.activeLeave ? (
                        (() => {
                          const isPaid = isPaidLeave(emp.activeLeave.leaveType);
                          return (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${
                              isPaid
                                ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800"
                                : "bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800"
                            }`}>
                              {isPaid ? <Coins size={12} /> : <FileText size={12} />}
                              <span>{isPaid ? "ลาเเบบได้เงิน" : "ลาเเบบไม่ได้รับเงิน"}</span>
                            </span>
                          );
                        })()
                      ) : isOnDuty ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                          <span>เข้ากะอยู่</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border border-[var(--color-border)] shrink-0">
                          อยู่นอกกะ
                        </span>
                      )}
                    </div>

                    {/* Active Shift Details Box (If On Duty) OR Active Leave Box */}
                    {isOnDuty && active ? (
                      <div className="my-3 p-3.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-emerald-950 dark:text-emerald-200 flex items-center gap-1">
                            <Clock size={13} className="text-emerald-600" />
                            <span>{getShiftName(active.shift)} ({active.taskRoleTitle || active.taskRole})</span>
                          </span>
                          <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-mono">
                            เริ่ม {formatTime(active.startedAt)}
                          </span>
                        </div>

                        <div className="text-xs text-emerald-900 dark:text-emerald-300 font-medium">
                          ทำงานมาแล้ว: <strong className="font-bold">{formatDuration(active.durationMinutes)}</strong>
                        </div>

                        {/* Checklist progress bar */}
                        <div>
                          <div className="flex items-center justify-between text-[11px] text-emerald-900 dark:text-emerald-300 font-medium mb-1">
                            <span>ความคืบหน้าเช็คลิสต์:</span>
                            <span className="font-bold">{active.completedTasks} / {active.totalTasks} ข้อ ({active.completionPercentage}%)</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-emerald-200/80 dark:bg-emerald-950 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                              style={{ width: `${active.completionPercentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : emp.isOnLeave && emp.activeLeave ? (
                      <div className={`my-3 p-3.5 rounded-xl border space-y-1.5 ${
                        isPaidLeave(emp.activeLeave.leaveType)
                          ? "bg-emerald-500/10 border-emerald-200 dark:border-emerald-900/60"
                          : "bg-amber-500/10 border-amber-200 dark:border-amber-900/60"
                      }`}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold flex items-center gap-1 text-[var(--color-text)]">
                            <Calendar size={13} className="text-[var(--color-text-muted)]" />
                            <span>
                              {emp.activeLeave.startDate === emp.activeLeave.endDate
                                ? emp.activeLeave.startDate
                                : `${emp.activeLeave.startDate} ถึง ${emp.activeLeave.endDate}`}
                            </span>
                          </span>
                          {emp.activeLeave.preserveStreak !== false ? (
                            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                              <ShieldCheck size={12} />
                              <span>สตรีคคงเดิม</span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1">
                              <ZapOff size={12} />
                              <span>ตัดสตรีคเป็น 0</span>
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[var(--color-text)] italic bg-[var(--color-surface)]/60 p-2 rounded-lg">
                          &ldquo;{emp.activeLeave.reason}&rdquo;
                        </div>
                        {emp.activeLeave.recordedByName && (
                          <div className="text-[11px] text-[var(--color-text-muted)]">
                            อนุมัติโดย: <strong className="text-[var(--color-text)]">{emp.activeLeave.recordedByName}</strong>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="my-3 p-3 rounded-xl bg-[var(--color-surface-2)]/60 text-xs text-[var(--color-text-muted)] flex items-center justify-between">
                        <span>เข้ากะล่าสุด:</span>
                        <span className="font-medium text-[var(--color-text-subtle)]">
                          {formatDate(emp.lastShiftAt)}
                        </span>
                      </div>
                    )}

                    {/* Shift Statistics Summary */}
                    <div className="grid grid-cols-2 gap-2 my-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-[var(--color-surface-2)]/40 border border-[var(--color-border-subtle)]">
                        <span className="text-[11px] text-[var(--color-text-muted)] block">เข้ากะวันนี้</span>
                        <span className="text-base font-extrabold text-[var(--color-text)]">
                          {emp.todayShiftsCount} <span className="text-[11px] font-normal text-[var(--color-text-muted)]">กะ</span>
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[var(--color-surface-2)]/40 border border-[var(--color-border-subtle)]">
                        <span className="text-[11px] text-[var(--color-text-muted)] block">กะสะสมทั้งหมด</span>
                        <span className="text-base font-extrabold text-[var(--color-text)]">
                          {emp.totalShiftsWorked} <span className="text-[11px] font-normal text-[var(--color-text-muted)]">กะ</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer: Gamification & Action */}
                  <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 font-bold text-amber-900 dark:text-amber-300">
                        <Award size={13} className="text-amber-600" />
                        <span>{emp.point} แต้ม</span>
                      </span>
                      {emp.pointStreak > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-orange-600 dark:text-orange-400">
                          <Flame size={12} />
                          <span>{emp.pointStreak} วัน</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {onSwitchToLeaves ? (
                        <button
                          type="button"
                          onClick={() => onSwitchToLeaves(emp.id)}
                          className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 flex items-center gap-1 transition-colors cursor-pointer"
                          title="บันทึกการลาสำหรับพนักงานคนนี้"
                        >
                          <HeartPulse size={12} />
                          <span>บันทึกการลา</span>
                        </button>
                      ) : (
                        <Link
                          href={`/manager/leaves?userId=${emp.id}`}
                          className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 flex items-center gap-1 transition-colors"
                          title="บันทึกการลาสำหรับพนักงานคนนี้"
                        >
                          <HeartPulse size={12} />
                          <span>บันทึกการลา</span>
                        </Link>
                      )}

                      <button
                        type="button"
                        onClick={() => setInspectedEmployee(emp)}
                        className="text-xs font-semibold text-amber-900 dark:text-amber-300 hover:text-amber-950 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span>รายละเอียด</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </main>

      {/* Employee Detail Modal */}
      {inspectedEmployee && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-lg bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-2xl p-6 text-[var(--color-text)] flex flex-col gap-4">
            <div className="flex items-start justify-between border-b border-[var(--color-border)] pb-3">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-base ${
                  inspectedEmployee.isOnDuty ? "bg-emerald-600 text-white" : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                }`}>
                  {inspectedEmployee.name.slice(0, 2)}
                </div>
                <div>
                  <h2 className="text-base font-bold text-[var(--color-text)]">{inspectedEmployee.name}</h2>
                  <p className="text-xs text-[var(--color-text-muted)]">@{inspectedEmployee.username || inspectedEmployee.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectedEmployee(null)}
                className="p-1.5 rounded-lg bg-[var(--color-surface-2)] hover:bg-amber-200 text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--color-surface-2)]/60">
                <span className="text-[var(--color-text-muted)]">สถานะปัจจุบัน:</span>
                <span className={`font-bold px-2 py-0.5 rounded-full text-xs ${
                  inspectedEmployee.isOnDuty ? "bg-emerald-100 text-emerald-900 border border-emerald-300" : "bg-gray-200 text-gray-800"
                }`}>
                  {inspectedEmployee.isOnDuty ? "🟢 กำลังปฏิบัติงาน (On Duty)" : "⚪ อยู่นอกกะ (Off Duty)"}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--color-surface-2)]/60">
                <span className="text-[var(--color-text-muted)]">สาขาประจำการ:</span>
                <span className="font-semibold">{inspectedEmployee.branchName || activeBranchName}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--color-surface-2)]/60">
                <span className="text-[var(--color-text-muted)]">ตำแหน่งงาน:</span>
                <span className="font-semibold">{inspectedEmployee.position || "พนักงานสาขา"}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-300/40 text-center">
                  <span className="text-[11px] text-[var(--color-text-muted)] block">จำนวนกะที่ทำวันนี้</span>
                  <span className="text-2xl font-extrabold text-amber-950 dark:text-amber-200">{inspectedEmployee.todayShiftsCount}</span>
                  <span className="text-[11px] text-[var(--color-text-muted)] block">กะ</span>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-300/40 text-center">
                  <span className="text-[11px] text-[var(--color-text-muted)] block">จำนวนกะสะสมทั้งหมด</span>
                  <span className="text-2xl font-extrabold text-amber-950 dark:text-amber-200">{inspectedEmployee.totalShiftsWorked}</span>
                  <span className="text-[11px] text-[var(--color-text-muted)] block">กะ</span>
                </div>
              </div>

              {inspectedEmployee.activeShift && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2 mt-2">
                  <div className="font-bold text-emerald-950 dark:text-emerald-200">
                    ข้อมูลกะที่กำลังปฏิบัติงาน:
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>รอบกะ:</span>
                    <span className="font-semibold">{getShiftName(inspectedEmployee.activeShift.shift)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>เวลาเข้ากะ:</span>
                    <span className="font-semibold">{formatTime(inspectedEmployee.activeShift.startedAt)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>ระยะเวลาที่ปฏิบัติงาน:</span>
                    <span className="font-semibold">{formatDuration(inspectedEmployee.activeShift.durationMinutes)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>ความคืบหน้างาน:</span>
                    <span className="font-semibold">{inspectedEmployee.activeShift.completedTasks} / {inspectedEmployee.activeShift.totalTasks} รายการ</span>
                  </div>
                </div>
              )}
              {inspectedEmployee.isOnLeave && inspectedEmployee.activeLeave && (
                (() => {
                  const isPaid = isPaidLeave(inspectedEmployee.activeLeave.leaveType);
                  return (
                    <div className={`p-3.5 rounded-xl border space-y-2 mt-2 ${
                      isPaid
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200"
                        : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200"
                    }`}>
                      <div className="flex items-center justify-between font-bold text-xs">
                        <span className="flex items-center gap-1.5">
                          {isPaid ? (
                            <Coins size={14} className="text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <FileText size={14} className="text-amber-600 dark:text-amber-400" />
                          )}
                          <span>
                            สถานะการลา: {isPaid ? "ลาเเบบได้เงิน" : "ลาเเบบไม่ได้รับเงิน"}
                          </span>
                        </span>
                        {inspectedEmployee.activeLeave.preserveStreak !== false ? (
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <ShieldCheck size={12} />
                        <span>สตรีคคุ้มครอง 100%</span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-rose-700 dark:text-rose-400 font-semibold flex items-center gap-1">
                        <ZapOff size={12} />
                        <span>สตรีคถูกตัดเป็น 0</span>
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--color-text)]">
                    ช่วงเวลา: {inspectedEmployee.activeLeave.startDate} ถึง {inspectedEmployee.activeLeave.endDate}
                  </div>
                  <div className="text-xs italic bg-[var(--color-surface)]/70 p-2 rounded-lg text-[var(--color-text)]">
                    เหตุผล: &ldquo;{inspectedEmployee.activeLeave.reason}&rdquo;
                  </div>
                </div>
                  );
                })()
              )}
            </div>

            <div className="pt-2 flex justify-between items-center gap-2">
              {onSwitchToLeaves ? (
                <button
                  type="button"
                  onClick={() => {
                    const targetId = inspectedEmployee.id;
                    setInspectedEmployee(null);
                    onSwitchToLeaves(targetId);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <HeartPulse size={14} />
                  <span>บันทึกการลาให้พนักงานคนนี้</span>
                </button>
              ) : (
                <Link
                  href={`/manager/leaves?userId=${inspectedEmployee.id}`}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <HeartPulse size={14} />
                  <span>บันทึกการลาให้พนักงานคนนี้</span>
                </Link>
              )}
              <button
                type="button"
                onClick={() => setInspectedEmployee(null)}
                className="px-4 py-2 rounded-xl bg-[var(--color-surface-2)] text-[var(--color-text)] border border-[var(--color-border)] font-bold text-xs hover:bg-[var(--color-surface)] transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-4 border-t border-[var(--color-border)] text-center text-xs text-[var(--color-text-muted)]">
        Eater Egg Fresh Mart • Staff Presence & Shift Tracking Portal
      </footer>
    </div>
  );
}
