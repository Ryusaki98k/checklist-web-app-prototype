"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { User, ShiftType } from "../../types";
import {
  BranchOperationsReportData,
  BranchOperationsSummaryItem,
  BranchEmployeeStatusItem,
  getBranchOperationsReportAction,
} from "../../actions/branch";
import { BrandLogo } from "../common/BrandLogo";
import { ThemeToggle } from "../common/ThemeToggle";
import { NotificationCenter } from "../common/NotificationCenter";
import { getShiftBadge, getShiftName } from "../common/Badge";
import { fmtDate, fmtTime } from "../../data/storage";
import {
  Building2,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  Search,
  Flame,
  Award,
  Snowflake,
  HeartPulse,
  Calendar,
  ChevronDown,
  ChevronUp,
  Layers,
  ShieldCheck,
  TrendingUp,
  Sparkles,
  ArrowUpDown,
  UserCheck,
  Sun,
  Sunset,
  Moon,
  LogOut,
  HelpCircle,
  Check,
  Zap,
} from "lucide-react";
import Link from "next/link";

interface BranchOperationsPageProps {
  currentUser: User;
  onLogout: () => void;
}

export function BranchOperationsPage({
  currentUser,
  onLogout,
}: BranchOperationsPageProps) {
  const [reportData, setReportData] = useState<BranchOperationsReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");

  // Filters & Controls
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "excellent" | "in_progress" | "needs_attention">("all");
  const [sortBy, setSortBy] = useState<"completion_desc" | "completion_asc" | "name" | "staff">("completion_desc");
  const [expandedBranchIds, setExpandedBranchIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  const loadReport = useCallback(
    async (isBackground = false, dateStr?: string) => {
      try {
        if (!isBackground) setIsLoading(true);
        else setIsRefreshing(true);
        setErrorMsg(null);

        const targetDate = dateStr !== undefined ? dateStr : selectedDate;
        const res = await getBranchOperationsReportAction(targetDate || undefined);

        if (res.success && res.data) {
          setReportData(res.data);
          setLastRefreshedAt(new Date());

          // Default: expand all branches on initial load so user immediately sees roster
          if (!isBackground) {
            setExpandedBranchIds(new Set(res.data.branches.map((b) => b.id)));
          }
        } else {
          setErrorMsg(res.error || "ไม่สามารถโหลดข้อมูลรายงานสาขาได้");
        }
      } catch (err: unknown) {
        console.error("Failed to load branch operations report:", err);
        setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการโหลดข้อมูล");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [selectedDate]
  );

  useEffect(() => {
    loadReport();

    // Auto-refresh every 12 seconds in background
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      loadReport(true);
    }, 12000);

    return () => clearInterval(interval);
  }, [loadReport]);

  const handleDateChange = (dateVal: string) => {
    setSelectedDate(dateVal);
    loadReport(false, dateVal);
  };

  const toggleBranchExpanded = (branchId: string) => {
    setExpandedBranchIds((prev) => {
      const next = new Set(prev);
      if (next.has(branchId)) next.delete(branchId);
      else next.add(branchId);
      return next;
    });
  };

  const expandAllBranches = () => {
    if (!reportData) return;
    setExpandedBranchIds(new Set(reportData.branches.map((b) => b.id)));
  };

  const collapseAllBranches = () => {
    setExpandedBranchIds(new Set());
  };

  // Filter and sort branches
  const filteredBranches = useMemo(() => {
    if (!reportData) return [];

    return reportData.branches
      .filter((branch) => {
        // Status filter
        if (statusFilter !== "all" && branch.healthStatus !== statusFilter) {
          return false;
        }

        // Search query: match branch name, code, manager name, or any employee name
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchBranch =
            branch.name.toLowerCase().includes(q) ||
            branch.code.toLowerCase().includes(q) ||
            branch.managerName.toLowerCase().includes(q);

          const matchEmployee = branch.employees.some(
            (emp) =>
              emp.name.toLowerCase().includes(q) ||
              emp.position.toLowerCase().includes(q) ||
              emp.username.toLowerCase().includes(q)
          );

          if (!matchBranch && !matchEmployee) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "completion_desc") {
          return b.todayCompletionRate - a.todayCompletionRate;
        }
        if (sortBy === "completion_asc") {
          return a.todayCompletionRate - b.todayCompletionRate;
        }
        if (sortBy === "name") {
          return a.name.localeCompare(b.name, "th");
        }
        if (sortBy === "staff") {
          return b.staffCount - a.staffCount;
        }
        return 0;
      });
  }, [reportData, statusFilter, searchQuery, sortBy]);

  const summary = reportData?.summary;

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] pb-20 font-sans">
      {/* ─── Top Brand Navigation Bar ────────────────────────────────────────── */}
      <nav className="bg-[var(--color-surface)]/95 backdrop-blur-md border-b border-[var(--color-border)] sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo size={36} showText={false} isDark={false} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base text-[var(--color-text)] tracking-tight truncate">
                  Eater Egg Fresh Mart
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800 shrink-0">
                  Branch Operations Portal
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] hidden md:block truncate">
                รายงานความคืบหน้าการทำงานรายสาขา และสถานะกำลังพลปฏิบัติงานแบบเรียลไทม์
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              href="/manager/dashboard"
              className="text-xs font-bold text-[var(--color-text)] hover:text-amber-950 dark:hover:text-amber-200 bg-[var(--color-surface)] hover:bg-amber-100 dark:hover:bg-amber-950/70 border border-[var(--color-border)] hover:border-amber-400 px-3 py-1.5 rounded-xl transition-all inline-flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer min-h-[36px]"
              title="กลับสู่แดชบอร์ดหลัก"
            >
              <ArrowLeft size={15} />
              <span className="hidden sm:inline">กลับแดชบอร์ด</span>
            </Link>

            <Link
              href="/manager/leaves"
              className="text-xs font-bold text-[var(--color-text)] hover:text-rose-700 bg-[var(--color-surface)] hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-[var(--color-border)] hover:border-rose-300 px-3 py-1.5 rounded-xl transition-all inline-flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer min-h-[36px]"
              title="ระบบจัดการการลาพนักงาน"
            >
              <HeartPulse size={15} className="text-rose-500" />
              <span className="hidden sm:inline">การลาพนักงาน</span>
            </Link>

            <button
              type="button"
              onClick={() => loadReport(true)}
              disabled={isRefreshing || isLoading}
              className="p-2 sm:px-3 sm:py-1.5 text-xs font-bold text-[var(--color-text)] bg-[var(--color-surface-2)] hover:bg-amber-100 dark:hover:bg-amber-950/50 border border-[var(--color-border)] rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 min-h-[36px] shadow-2xs"
              title="รีเฟรชข้อมูลล่าสุด"
            >
              <RefreshCw size={14} className={isRefreshing ? "animate-spin text-amber-600" : ""} />
              <span className="hidden md:inline">รีเฟรช</span>
            </button>

            <NotificationCenter />
            <ThemeToggle />

            <button
              type="button"
              onClick={onLogout}
              title="ออกจากระบบ"
              aria-label="ออกจากระบบ"
              className="text-xs text-[var(--color-text-muted)] hover:text-rose-700 hover:bg-rose-50 hover:border-rose-200 dark:hover:bg-rose-950/40 dark:hover:border-rose-800 transition-all p-2 sm:px-3 sm:py-1.5 rounded-xl border border-[var(--color-border)] font-semibold cursor-pointer min-h-[36px] min-w-[36px] inline-flex items-center justify-center gap-1.5 shrink-0"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">ออก</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ─── Main Content Container ─────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Error Alert */}
        {errorMsg && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 rounded-2xl flex items-start gap-3 shadow-sm animate-fade-in">
            <AlertCircle className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" size={18} />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-rose-950 dark:text-rose-200">เกิดข้อผิดพลาด</h4>
              <p className="text-xs text-rose-800 dark:text-rose-300 mt-0.5">{errorMsg}</p>
            </div>
            <button
              type="button"
              onClick={() => loadReport(false)}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              ลองใหม่
            </button>
          </div>
        )}

        {/* ─── Header Banner ──────────────────────────────────────────────── */}
        <header className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-400/40 flex items-center justify-center">
                <Building2 size={22} />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-extrabold text-[var(--color-text)] tracking-tight">
                  ภาพรวมการปฏิบัติงานทุกสาขา (Branch Operations)
                </h1>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  ติดตามเปอร์เซ็นต์ความคืบหน้าของงานเช็คลิสต์และตรวจสอบรายชื่อพนักงานที่กำลังเข้ากะในแต่ละสาขา
                </p>
              </div>
            </div>
          </div>

          {/* Date Picker & Live Badge */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
            <div className="flex items-center gap-1.5 bg-[var(--color-surface-2)] border border-[var(--color-border)] px-3 py-1.5 rounded-xl">
              <Calendar size={14} className="text-[var(--color-text-muted)] shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="bg-transparent text-xs font-bold text-[var(--color-text)] focus:outline-none cursor-pointer"
                title="เลือกวันที่ต้องการดูรายงาน"
              />
              {selectedDate && (
                <button
                  type="button"
                  onClick={() => handleDateChange("")}
                  className="text-[10px] font-bold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer ml-1"
                >
                  วันนี้
                </button>
              )}
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live DB</span>
              <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 font-normal">
                ({fmtTime(lastRefreshedAt.toISOString())})
              </span>
            </div>
          </div>
        </header>

        {/* ─── Hero KPI Summary Cards (Company Level) ─────────────────────── */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {/* KPI 1: Overall Work Completion */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5 shadow-xs space-y-2 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                ความคืบหน้ารวมทุกสาขา
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                <TrendingUp size={16} />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold font-mono text-[var(--color-text)] tracking-tight">
                  {summary ? summary.averageCompletionRate : 0}%
                </span>
                <span className="text-xs text-[var(--color-text-muted)] font-medium">เฉลี่ย</span>
              </div>
              <div className="w-full bg-[var(--color-surface-2)] h-2 rounded-full overflow-hidden border border-[var(--color-border)] mt-2">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${summary ? summary.averageCompletionRate : 0}%` }}
                />
              </div>
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)] pt-1 border-t border-[var(--color-border-subtle)]">
              เสร็จสิ้น {summary ? summary.completedTasksToday : 0} จาก {summary ? summary.totalTasksToday : 0} รายการงาน
            </p>
          </div>

          {/* KPI 2: Active Branches */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5 shadow-xs space-y-2 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                สาขาทั้งหมด
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center">
                <Building2 size={16} />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold font-mono text-[var(--color-text)] tracking-tight">
                  {summary ? summary.activeBranchesCount : 0}
                </span>
                <span className="text-xs text-[var(--color-text-muted)] font-medium">สาขา</span>
              </div>
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)] pt-1 border-t border-[var(--color-border-subtle)]">
              พนักงานรวมประจำสาขา: {summary ? summary.totalStaff : 0} คน
            </p>
          </div>

          {/* KPI 3: Staff on Duty Today */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5 shadow-xs space-y-2 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                พนักงานเข้ากะตอนนี้
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                <UserCheck size={16} />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
                  {summary ? summary.totalWorkingStaff : 0}
                </span>
                <span className="text-xs text-[var(--color-text-muted)] font-medium">คนกำลังปฏิบัติงาน</span>
              </div>
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)] pt-1 border-t border-[var(--color-border-subtle)]">
              ลางานวันนี้: {summary ? summary.totalOnLeaveStaff : 0} คน (ได้รับอนุมัติ)
            </p>
          </div>

          {/* KPI 4: Refrigerator Compliance */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5 shadow-xs space-y-2 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                การบันทึกตู้แช่สาขา
              </span>
              <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400 flex items-center justify-center">
                <Snowflake size={16} />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold font-mono text-[var(--color-text)] tracking-tight">
                  {summary ? summary.averageRefrigeratorCompliance : 100}%
                </span>
                <span className="text-xs text-[var(--color-text-muted)] font-medium">ความครบถ้วน</span>
              </div>
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)] pt-1 border-t border-[var(--color-border-subtle)]">
              เกณฑ์มาตรฐานอุณหภูมิและความปลอดภัย
            </p>
          </div>
        </section>

        {/* ─── Search, Filters & Controls Toolbar ─────────────────────────── */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
              />
              <input
                type="text"
                placeholder="ค้นหาชื่อสาขา, รหัสสาขา, หรือชื่อพนักงาน..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl pl-10 pr-4 py-2 text-xs font-medium text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-amber-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: "all", label: "ทั้งหมด" },
                { id: "excellent", label: "🟢 ดีเยี่ยม (≥80%)" },
                { id: "in_progress", label: "🟡 กำลังดำเนินการ" },
                { id: "needs_attention", label: "🔴 ต้องติดตาม (<40%)" },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setStatusFilter(pill.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    statusFilter === pill.id
                      ? "bg-amber-400 text-amber-950 shadow-2xs"
                      : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)]"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Secondary Controls: Sort & Bulk Expand */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-[var(--color-border-subtle)] text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[var(--color-text-muted)] font-medium flex items-center gap-1">
                <ArrowUpDown size={13} />
                <span>จัดเรียง:</span>
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs font-semibold rounded-lg px-2.5 py-1 text-[var(--color-text)] focus:outline-none cursor-pointer"
              >
                <option value="completion_desc">เปอร์เซ็นต์งาน (สูงสุด → ต่ำสุด)</option>
                <option value="completion_asc">เปอร์เซ็นต์งาน (ต่ำสุด → สูงสุด)</option>
                <option value="name">ชื่อสาขา (ก-ฮ)</option>
                <option value="staff">จำนวนพนักงาน (มาก → น้อย)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={expandAllBranches}
                className="text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
              >
                คลี่ดูพนักงานทั้งหมด
              </button>
              <span className="text-[var(--color-text-muted)]">•</span>
              <button
                type="button"
                onClick={collapseAllBranches}
                className="text-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer"
              >
                ย่อทั้งหมด
              </button>
            </div>
          </div>
        </div>

        {/* ─── Loading Skeleton State ──────────────────────────────────────── */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-xs animate-pulse space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="h-6 w-48 bg-[var(--color-surface-2)] rounded-lg" />
                  <div className="h-6 w-20 bg-[var(--color-surface-2)] rounded-lg" />
                </div>
                <div className="h-4 w-full bg-[var(--color-surface-2)] rounded-full" />
                <div className="grid grid-cols-3 gap-3">
                  <div className="h-16 bg-[var(--color-surface-2)] rounded-xl" />
                  <div className="h-16 bg-[var(--color-surface-2)] rounded-xl" />
                  <div className="h-16 bg-[var(--color-surface-2)] rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─── Empty State ─────────────────────────────────────────────────── */}
        {!isLoading && filteredBranches.length === 0 && (
          <div className="bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-2xl p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center mx-auto">
              <Building2 size={24} />
            </div>
            <h3 className="text-base font-bold text-[var(--color-text)]">ไม่พบข้อมูลสาขาที่ตรงกับเงื่อนไข</h3>
            <p className="text-xs text-[var(--color-text-muted)] max-w-md mx-auto">
              กรุณาตรวจสอบคำค้นหาหรือลองเลือกตัวกรองสถานะอื่นเพื่อดูรายการสาขา
            </p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-amber-950 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                ล้างการค้นหา
              </button>
            )}
          </div>
        )}

        {/* ─── Branch Cards Grid ───────────────────────────────────────────── */}
        {!isLoading && filteredBranches.length > 0 && (
          <div className="space-y-6">
            {filteredBranches.map((branch) => {
              const isExpanded = expandedBranchIds.has(branch.id);

              return (
                <div
                  key={branch.id}
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-xs hover:shadow-md transition-shadow overflow-hidden"
                >
                  {/* Branch Card Header */}
                  <div className="p-5 sm:p-6 border-b border-[var(--color-border-subtle)] space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start sm:items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-amber-400/20 text-amber-800 dark:text-amber-300 border border-amber-400/40 flex items-center justify-center shrink-0">
                          <Building2 size={24} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-base sm:text-lg font-extrabold text-[var(--color-text)] tracking-tight">
                              {branch.name}
                            </h2>
                            <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-[var(--color-surface-2)] text-[var(--color-text)] border border-[var(--color-border)]">
                              {branch.code}
                            </span>
                            {/* Health Badge */}
                            {branch.healthStatus === "excellent" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800">
                                <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
                                <span>มาตรฐานยอดเยี่ยม</span>
                              </span>
                            )}
                            {branch.healthStatus === "in_progress" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                                <Clock size={13} className="text-amber-600 dark:text-amber-400 animate-pulse" />
                                <span>กำลังปฏิบัติงาน</span>
                              </span>
                            )}
                            {branch.healthStatus === "needs_attention" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-950 dark:bg-rose-950 dark:text-rose-200 border border-rose-300 dark:border-rose-800">
                                <AlertCircle size={13} className="text-rose-600 dark:text-rose-400" />
                                <span>ต่ำกว่าเกณฑ์ / ต้องติดตาม</span>
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--color-text-muted)] mt-1 flex items-center gap-2 flex-wrap">
                            <span>ผู้จัดการสาขา: <strong className="text-[var(--color-text)]">{branch.managerName}</strong></span>
                            <span>•</span>
                            <span>พนักงานทั้งหมด: <strong className="text-[var(--color-text)]">{branch.staffCount}</strong> คน</span>
                            <span>•</span>
                            <span>โควตาลาสาขา: <strong className="text-[var(--color-text)]">{branch.leaveQuota}</strong> วัน/คน</span>
                          </p>
                        </div>
                      </div>

                      {/* Main Overall Percentage Radial / Metric Box */}
                      <div className="flex items-center gap-4 bg-[var(--color-surface-2)] p-3 sm:px-4 sm:py-2.5 rounded-2xl border border-[var(--color-border)] shrink-0 justify-between sm:justify-start">
                        <div className="text-right sm:text-left">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] block">
                            สถานะงานวันนี้
                          </span>
                          <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                            {branch.completedTasksToday}/{branch.totalTasksToday} งานสำเร็จ
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span
                            className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
                              branch.todayCompletionRate >= 80
                                ? "text-emerald-600 dark:text-emerald-400"
                                : branch.todayCompletionRate >= 40
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {branch.todayCompletionRate}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="w-full bg-[var(--color-surface-2)] h-2.5 rounded-full overflow-hidden border border-[var(--color-border)]">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            branch.todayCompletionRate >= 80
                              ? "bg-emerald-500"
                              : branch.todayCompletionRate >= 40
                              ? "bg-amber-400"
                              : "bg-rose-400"
                          }`}
                          style={{ width: `${branch.todayCompletionRate}%` }}
                        />
                      </div>
                    </div>

                    {/* 3 Shifts Breakdown & Refrigerator Status */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-1">
                      {/* Morning Shift */}
                      <div className="bg-[var(--color-surface-2)]/60 border border-[var(--color-border)] rounded-xl p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[var(--color-text)] flex items-center gap-1.5">
                            <Sun size={14} className="text-amber-500" />
                            <span>กะเช้า</span>
                          </span>
                          <span className="font-mono font-bold text-xs">
                            {branch.shifts.morning.completionRate}%
                          </span>
                        </div>
                        <div className="w-full bg-[var(--color-border-subtle)] h-1.5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-400 rounded-full"
                            style={{ width: `${branch.shifts.morning.completionRate}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
                          <span>{branch.shifts.morning.completedTasks}/{branch.shifts.morning.totalTasks} รายการ</span>
                          <span>{branch.shifts.morning.activeStaffCount} พนักงาน</span>
                        </div>
                      </div>

                      {/* Afternoon Shift */}
                      <div className="bg-[var(--color-surface-2)]/60 border border-[var(--color-border)] rounded-xl p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[var(--color-text)] flex items-center gap-1.5">
                            <Sunset size={14} className="text-orange-500" />
                            <span>กะบ่าย</span>
                          </span>
                          <span className="font-mono font-bold text-xs">
                            {branch.shifts.afternoon.completionRate}%
                          </span>
                        </div>
                        <div className="w-full bg-[var(--color-border-subtle)] h-1.5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-400 rounded-full"
                            style={{ width: `${branch.shifts.afternoon.completionRate}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
                          <span>{branch.shifts.afternoon.completedTasks}/{branch.shifts.afternoon.totalTasks} รายการ</span>
                          <span>{branch.shifts.afternoon.activeStaffCount} พนักงาน</span>
                        </div>
                      </div>

                      {/* Night Shift */}
                      <div className="bg-[var(--color-surface-2)]/60 border border-[var(--color-border)] rounded-xl p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[var(--color-text)] flex items-center gap-1.5">
                            <Moon size={14} className="text-indigo-400" />
                            <span>กะดึก</span>
                          </span>
                          <span className="font-mono font-bold text-xs">
                            {branch.shifts.night.completionRate}%
                          </span>
                        </div>
                        <div className="w-full bg-[var(--color-border-subtle)] h-1.5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-400 rounded-full"
                            style={{ width: `${branch.shifts.night.completionRate}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
                          <span>{branch.shifts.night.completedTasks}/{branch.shifts.night.totalTasks} รายการ</span>
                          <span>{branch.shifts.night.activeStaffCount} พนักงาน</span>
                        </div>
                      </div>

                      {/* Refrigerator Check */}
                      <div className="bg-[var(--color-surface-2)]/60 border border-[var(--color-border)] rounded-xl p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[var(--color-text)] flex items-center gap-1.5">
                            <Snowflake size={14} className="text-cyan-500" />
                            <span>ตู้แช่สาขา</span>
                          </span>
                          <span className="font-mono font-bold text-xs">
                            {branch.refrigeratorComplianceRate}%
                          </span>
                        </div>
                        <div className="w-full bg-[var(--color-border-subtle)] h-1.5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-cyan-400 rounded-full"
                            style={{ width: `${branch.refrigeratorComplianceRate}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
                          <span>บันทึก {branch.checkedRefrigeratorsToday}/{branch.totalRefrigerators} ตู้</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            {branch.checkedRefrigeratorsToday >= branch.totalRefrigerators ? "ครบถ้วน" : "รอตรวจ"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Branch Staff Roster Toggle Bar */}
                  <div
                    onClick={() => toggleBranchExpanded(branch.id)}
                    className="px-5 sm:px-6 py-3.5 bg-[var(--color-surface-2)]/40 hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer flex items-center justify-between text-xs border-b border-[var(--color-border-subtle)] select-none"
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-bold text-[var(--color-text)] flex items-center gap-1.5">
                        <Users size={15} className="text-amber-600" />
                        <span>กำลังพลประจำสาขานี้ ({branch.employees.length} คน)</span>
                      </span>

                      <div className="flex items-center gap-2">
                        {branch.workingStaffCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            <span>กำลังเข้ากะ {branch.workingStaffCount} คน</span>
                          </span>
                        )}
                        {branch.completedStaffCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[11px] bg-blue-100 text-blue-950 dark:bg-blue-950 dark:text-blue-200">
                            <span>จบกะแล้ว {branch.completedStaffCount} คน</span>
                          </span>
                        )}
                        {branch.onLeaveStaffCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[11px] bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-200">
                            <span>ลางาน {branch.onLeaveStaffCount} คน</span>
                          </span>
                        )}
                        {branch.offDutyStaffCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium text-[11px] bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)]">
                            <span>นอกเวลา {branch.offDutyStaffCount} คน</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-[var(--color-text-muted)] font-semibold shrink-0">
                      <span>{isExpanded ? "ซ่อนรายชื่อ" : "แสดงรายชื่อพนักงาน"}</span>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  {/* Expandable Employee Roster View */}
                  {isExpanded && (
                    <div className="p-4 sm:p-6 bg-[var(--color-surface)] animate-in fade-in duration-150">
                      {branch.employees.length === 0 ? (
                        <p className="text-center text-xs text-[var(--color-text-muted)] py-4">
                          ยังไม่มีพนักงานที่ถูกจัดสรรเข้าสู่สาขานี้
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {branch.employees.map((emp) => {
                            const isWorking = emp.status === "working";
                            const isCompleted = emp.status === "completed";
                            const isOnLeave = emp.status === "on_leave";

                            return (
                              <div
                                key={emp.id}
                                className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                                  isWorking
                                    ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 shadow-2xs"
                                    : isCompleted
                                    ? "bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
                                    : isOnLeave
                                    ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800"
                                    : "bg-[var(--color-surface-2)]/50 border-[var(--color-border)] text-[var(--color-text-muted)]"
                                }`}
                              >
                                {/* Employee Header */}
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div
                                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                                        isWorking
                                          ? "bg-emerald-500 text-white ring-2 ring-emerald-300 dark:ring-emerald-700"
                                          : isOnLeave
                                          ? "bg-amber-500 text-amber-950 ring-2 ring-amber-300 dark:ring-amber-700"
                                          : "bg-[var(--color-surface-2)] text-[var(--color-text)] border border-[var(--color-border)]"
                                      }`}
                                    >
                                      {emp.name.slice(0, 1)}
                                    </div>
                                    <div className="min-w-0">
                                      <h4 className="text-xs sm:text-sm font-bold text-[var(--color-text)] truncate">
                                        {emp.name}
                                      </h4>
                                      <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                                        {emp.position}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Status Pill */}
                                  <div>
                                    {isWorking && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-950 dark:bg-emerald-900 dark:text-emerald-100 border border-emerald-300 dark:border-emerald-700">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                                        <span>กำลังเข้ากะ</span>
                                      </span>
                                    )}
                                    {isCompleted && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-950 dark:bg-blue-900 dark:text-blue-100 border border-blue-300 dark:border-blue-700">
                                        <Check size={11} />
                                        <span>จบกะแล้ว</span>
                                      </span>
                                    )}
                                    {isOnLeave && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-950 dark:bg-amber-900 dark:text-amber-100 border border-amber-300 dark:border-amber-700">
                                        <span>ลางาน</span>
                                      </span>
                                    )}
                                    {emp.status === "off_duty" && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)]">
                                        <span>นอกเวลากะ</span>
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Shift Details if Active or Completed */}
                                {(isWorking || isCompleted) && emp.activeShift && (
                                  <div className="bg-[var(--color-surface)]/80 p-2 rounded-lg border border-[var(--color-border-subtle)] space-y-1.5 text-xs">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1">
                                        {getShiftBadge(emp.activeShift)}
                                        {emp.shiftStartTime && (
                                          <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
                                            เริ่ม {fmtTime(emp.shiftStartTime)}
                                          </span>
                                        )}
                                      </div>
                                      <span className="font-mono font-bold text-[11px] text-[var(--color-text)]">
                                        {emp.completedTasksCount}/{emp.totalTasksCount} ข้อ ({emp.taskCompletionRate}%)
                                      </span>
                                    </div>
                                    <div className="w-full bg-[var(--color-border-subtle)] h-1.5 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-emerald-500 rounded-full transition-all"
                                        style={{ width: `${emp.taskCompletionRate}%` }}
                                      />
                                    </div>
                                  </div>
                                )}

                                {/* Leave Info if On Leave */}
                                {isOnLeave && emp.leaveInfo && (
                                  <div className="bg-[var(--color-surface)]/80 p-2 rounded-lg border border-amber-200 dark:border-amber-900 space-y-0.5 text-xs">
                                    <p className="font-bold text-amber-900 dark:text-amber-200 text-[11px]">
                                      {emp.leaveInfo.leaveType === "paid" ? "ลาแบบได้รับเงิน" : "ลาแบบไม่ได้รับเงิน"}
                                    </p>
                                    <p className="text-[10px] text-[var(--color-text-muted)]">
                                      เหตุผล: {emp.leaveInfo.reason || "-"}
                                    </p>
                                  </div>
                                )}

                                {/* Employee Gamification Footer: Points & Streak */}
                                <div className="flex items-center justify-between pt-1 border-t border-[var(--color-border-subtle)] text-[11px]">
                                  <span className="font-semibold text-[var(--color-text-muted)] flex items-center gap-1">
                                    <Award size={12} className="text-amber-500" />
                                    <span>{emp.point} แต้ม</span>
                                  </span>

                                  {emp.pointStreak > 0 && (
                                    <span className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                      <Flame size={12} className="text-orange-500" />
                                      <span>สตรีค {emp.pointStreak} วัน</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
