import { useEffect, useMemo, useState, useCallback } from "react";
import { Notification, ShiftSession, ShiftType, User, ChecklistItem } from "../../types";

import {
  fmtDate,
  fmtTime,
  getNotifications,
  getSessions,
  saveNotifications,
  saveSessions,
  seedSampleData,
} from "../../data/storage";
import { secureGetItem, secureSetItem, secureRemoveItem } from "../../utils/crypto";
import { Badge, getShiftBadge, getShiftName } from "../common/Badge";
import { BrandLogo } from "../common/BrandLogo";
import { SessionDetailModal } from "../admin/SessionDetailModal";
import {
  getManagerShiftSessionsAction,
  getHistoryShiftSessionsAction,
  ManagerShiftSummary,
} from "../../actions/manager";
import {
  resetTodayChecklistDataAction,
} from "../../actions/checklist";
import { RefrigeratorConfigView } from "./RefrigeratorConfigView";
import { NotificationCenter } from "../common/NotificationCenter";
import { ThemeToggle } from "../common/ThemeToggle";
import { NavbarRefreshControl } from "../common/NavbarRefreshControl";
import { invalidateBranchCache } from "../../utils/cache";
import { LeaderboardWidget } from "./LeaderboardWidget";
import { ErrorBoundary } from "../common/ErrorBoundary";
import { ClipboardCheck, ShieldCheck, Building2, Award, Snowflake, History, CheckCircle2, AlertCircle, LogOut, HeartPulse, Users, ShieldAlert, Eye } from "lucide-react";
import Link from "next/link";

export type ExecutiveRole = "manager" | "committee" | "general_manager";

export function ExecutiveDashboard({
  user,
  onLogout,
}: {
  user: User;
  onLogout: () => void;
  activeSession?: ShiftSession | null;
  onStartChecklist?: (shift: ShiftType) => void;
  onUpdateSession?: (session: ShiftSession) => void;
  onEndShift?: () => void;
  onOpenChecklistPage?: () => void;
  onSwitchToManagerView?: () => void;
}) {
  const isAssistant = user.role === "manager_assistant" || (user.position?.includes("ผู้ช่วย") ?? false);

  useEffect(() => {
    if (isAssistant && typeof window !== "undefined") {
      window.location.replace("/manager/dashboard");
    }
  }, [isAssistant]);

  // Determine role directly from logged-in user account
  const currentRole: ExecutiveRole = useMemo(() => {
    if (user.role === "general_manager" || user.position?.includes("ผู้จัดการทั่วไป")) return "general_manager";
    if (user.role === "committee" || user.position?.includes("กรรมการ")) return "committee";
    return "manager";
  }, [user]);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [sessions, setSessions] = useState<ShiftSession[]>([]);
  const [historySessions, setHistorySessions] = useState<ShiftSession[]>([]);
  const [specificDaySessions, setSpecificDaySessions] = useState<ShiftSession[] | null>(null);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState<string>("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedSession, setSelectedSession] = useState<ShiftSession | null>(null);
  const [historySearch, setHistorySearch] = useState("");
  const [historyShiftFilter, setHistoryShiftFilter] = useState<"all" | ShiftType>("all");
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [isLiveFromDb, setIsLiveFromDb] = useState(false);
  const [isLoadingDb, setIsLoadingDb] = useState(false);
  const [hasAssistantLoggedInToday, setHasAssistantLoggedInToday] = useState(true);
  const [isNavbarRefreshing, setIsNavbarRefreshing] = useState(false);
  const [isNavbarDbRefreshing, setIsNavbarDbRefreshing] = useState(false);
  const [navbarLastRefreshedAt, setNavbarLastRefreshedAt] = useState<Date | null>(new Date());
  const [navbarLastRefreshType, setNavbarLastRefreshType] = useState<"cache" | "db">("cache");

  // Approval status tracking in client state (synced with Supabase task_work)
  const [approvals, setApprovals] = useState<Record<string, { assistantApproved?: boolean; managerApproved?: boolean }>>({});
  const [isResetting, setIsResetting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  // Filters for Live Shift Handover & Approval Queue
  const [shiftQueueStatusFilter, setShiftQueueStatusFilter] = useState<"all" | "pending" | "approved">("all");
  const [shiftQueueTimeFilter, setShiftQueueTimeFilter] = useState<"all" | ShiftType>("all");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<"all" | "pending" | "approved">("all");

  // Navigation tab
  type DashboardTab = "overview" | "history" | "refrigerator";
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");

  // Load live shift sessions from Supabase DB
  const loadDbSessions = useCallback(async (isManual = false) => {
    if (isAssistant) return;
    try {
      if (isManual) setIsLoadingDb(true);
      const res = await getManagerShiftSessionsAction();
      if (res.success && res.sessions) {
        setIsLiveFromDb(true);
        if (res.hasAssistantLoggedInToday !== undefined) {
          setHasAssistantLoggedInToday(res.hasAssistantLoggedInToday);
        }
        const mappedSessions: ShiftSession[] = res.sessions.map((s) => ({
          id: s.id,
          userId: s.userId,
          userName: s.userName,
          userPosition: s.userPosition,
          taskRole: s.taskRole,
          shift: s.shift,
          startedAt: s.startedAt,
          completedAt: s.completedAt,
          items: s.items.map((it) => ({
            id: it.id,
            label: it.label,
            category: it.category,
            completedAt: it.completedAt,
            taskWorkId: it.taskWorkId,
            isLate: it.isLate,
            comment: it.comment,
          })),
          notified: true,
          branchName: s.branchName,
          incompleteReason: s.incompleteReason,
          incompleteStatus: s.incompleteStatus,
          incompleteAction: s.incompleteAction,
          incompleteActionPoints: s.incompleteActionPoints,
          incompleteActionNote: s.incompleteActionNote,
          incompleteReviewedBy: s.incompleteReviewedBy,
          incompleteReviewedAt: s.incompleteReviewedAt,
        }));
        setSessions(mappedSessions);

        setApprovals((prev) => {
          const merged: Record<string, { assistantApproved?: boolean; managerApproved?: boolean }> = { ...prev };
          (res.sessions || []).forEach((s) => {
            const isMgr = Boolean(s.managerApproved || prev[s.id]?.managerApproved);
            merged[s.id] = {
              assistantApproved: isMgr || Boolean(s.assistantApproved || prev[s.id]?.assistantApproved),
              managerApproved: isMgr,
            };
          });
          return merged;
        });

        // Read notification IDs stored locally
        const readIds: string[] = (() => {
          try {
            return JSON.parse(secureGetItem("app_manager_read_notifs") ?? "[]");
          } catch {
            return [];
          }
        })();

        // Sync notifications 1-to-1 with Supabase shift sessions
        const dbNotifs: Notification[] = res.sessions
          .map((s) => {
            const latestTaskTime = s.items
              .map((i) => i.completedAt)
              .filter((t): t is string => t !== null)
              .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

            const eventTime = s.completedAt || latestTaskTime || s.startedAt;
            const isRead = s.managerApproved || readIds.includes(s.id);
            const isIncomplete = s.incompleteStatus === "pending_review" || (!s.isAllDone && Boolean(s.incompleteReason));

            return {
              id: `notif-${s.id}`,
              title: isIncomplete
                ? `⚠️ งานไม่ครบ: ${s.userName}`
                : `รายงานการส่งงาน: ${s.userName}`,
              message: isIncomplete
                ? `${s.userPosition || "พนักงาน"} จบกะโดยมีงานไม่ครบ: "${s.incompleteReason || "รอพิจารณา"}"`
                : `${s.userPosition || "พนักงาน"} ส่งงานกะ ${s.shift}`,
              type: isIncomplete ? "incomplete_shift" : "shift_submitted",
              shiftSessionId: s.id,
              userName: s.userName,
              userPosition: s.userPosition,
              shift: s.shift,
              completedAt: eventTime,
              createdAt: eventTime,
              read: isRead,
            };
          })
          .sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime());

        setNotifications(dbNotifs);
      }
    } catch (err) {
      console.error("Failed to fetch sessions from Supabase DB:", err);
    } finally {
      if (isManual) setIsLoadingDb(false);
    }
  }, []);

  // Sync initial DB fetch on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDbSessions();

    const handleRefresh = () => {
      loadDbSessions();
    };

    window.addEventListener("app:date-rollover", handleRefresh);
    window.addEventListener("focus", handleRefresh);

    // Auto-refresh from Supabase DB every 6 seconds (paused if tab is backgrounded)
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      loadDbSessions();
    }, 6000);

    return () => {
      window.removeEventListener("app:date-rollover", handleRefresh);
      window.removeEventListener("focus", handleRefresh);
      clearInterval(interval);
    };
  }, [loadDbSessions]);

  // Load history metadata
  const loadHistorySessions = useCallback(async () => {
    if (isAssistant) return;
    try {
      setIsLoadingHistory(true);
      const res = await getHistoryShiftSessionsAction(14);
      if (res.success && res.sessions) {
        const mappedSessions: ShiftSession[] = res.sessions.map((s) => ({
          id: s.id,
          userId: s.userId,
          userName: s.userName,
          userPosition: s.userPosition,
          taskRole: s.taskRole,
          shift: s.shift,
          startedAt: s.startedAt,
          completedAt: s.completedAt,
          items: s.items.map((it) => ({
            id: it.id,
            label: it.label,
            category: it.category,
            completedAt: it.completedAt,
            taskWorkId: it.taskWorkId,
            isLate: it.isLate,
            comment: it.comment,
          })),
          notified: true,
          branchName: s.branchName,
          incompleteReason: s.incompleteReason,
          incompleteStatus: s.incompleteStatus,
          incompleteAction: s.incompleteAction,
          incompleteActionPoints: s.incompleteActionPoints,
          incompleteActionNote: s.incompleteActionNote,
          incompleteReviewedBy: s.incompleteReviewedBy,
          incompleteReviewedAt: s.incompleteReviewedAt,
        }));
        setHistorySessions(mappedSessions);
      }
    } catch (err) {
      console.error("Failed to fetch history sessions:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Fetch history when tab becomes active
  useEffect(() => {
    if (activeTab === "history" && historySessions.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadHistorySessions();
    }
  }, [activeTab, loadHistorySessions, historySessions.length]);

  const fetchSpecificHistoryDate = async (dateStr: string) => {
    if (!dateStr) {
      setSpecificDaySessions(null);
      return;
    }

    try {
      setIsLoadingHistory(true);
      const res = await getHistoryShiftSessionsAction(14, dateStr);
      if (res.success && res.sessions) {
        const mappedSessions: ShiftSession[] = res.sessions.map((s) => ({
          id: s.id,
          userId: s.userId,
          userName: s.userName,
          userPosition: s.userPosition,
          taskRole: s.taskRole,
          shift: s.shift,
          startedAt: s.startedAt,
          completedAt: s.completedAt,
          items: s.items.map((it) => ({
            id: it.id,
            label: it.label,
            category: it.category,
            completedAt: it.completedAt,
            taskWorkId: it.taskWorkId,
            isLate: it.isLate,
            comment: it.comment,
          })),
          notified: true,
          branchName: s.branchName,
          incompleteReason: s.incompleteReason,
          incompleteStatus: s.incompleteStatus,
          incompleteAction: s.incompleteAction,
          incompleteActionPoints: s.incompleteActionPoints,
          incompleteActionNote: s.incompleteActionNote,
          incompleteReviewedBy: s.incompleteReviewedBy,
          incompleteReviewedAt: s.incompleteReviewedAt,
        }));
        setSpecificDaySessions(mappedSessions);
      }
    } catch (err) {
      console.error("Failed to fetch specific date history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleDateSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSelectedHistoryDate(val);
    fetchSpecificHistoryDate(val);
  };



  const handleNavbarRefresh = useCallback(async () => {
    try {
      setIsNavbarRefreshing(true);
      await Promise.all([
        loadDbSessions(true),
        activeTab === "history" ? loadHistorySessions() : Promise.resolve(),
      ]);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("refresh-dashboard-data", { detail: { forceDb: false } }));
      }
      setNavbarLastRefreshedAt(new Date());
      setNavbarLastRefreshType("cache");
      setActionFeedback("รีเฟรชข้อมูลล่าสุดเรียบร้อยแล้ว");
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err) {
      console.error("Navbar refresh error:", err);
    } finally {
      setIsNavbarRefreshing(false);
    }
  }, [loadDbSessions, activeTab, loadHistorySessions]);

  const handleNavbarRefreshFromDb = useCallback(async () => {
    try {
      setIsNavbarDbRefreshing(true);
      invalidateBranchCache();
      await Promise.all([
        loadDbSessions(true),
        activeTab === "history" ? loadHistorySessions() : Promise.resolve(),
      ]);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("refresh-dashboard-data", { detail: { forceDb: true } }));
      }
      setNavbarLastRefreshedAt(new Date());
      setNavbarLastRefreshType("db");
      setActionFeedback("ดึงข้อมูลสดจากฐานข้อมูลเรียบร้อย (Bypass Cache)");
      setTimeout(() => setActionFeedback(null), 3500);
    } catch (err) {
      console.error("Navbar refresh from DB error:", err);
    } finally {
      setIsNavbarDbRefreshing(false);
    }
  }, [loadDbSessions, activeTab, loadHistorySessions]);

  // Role metadata configurations
  const roleConfig = {
    manager: {
      title: "ผู้จัดการร้าน (Store Manager)",
      badge: "bg-[var(--color-brown)] text-amber-100 border-amber-500/40 font-bold shadow-2xs",
      description: "กำกับดูแลภาพรวมสาขา อนุมัติขั้นสุดท้าย และควบคุมมาตรฐานการปฏิบัติงาน",
      primaryDuty: "อนุมัติขั้นสุดท้าย (Manager Final Approval) & ควบคุมดัชนีร้าน",
      Icon: ShieldCheck,
    },
    committee: {
      title: "กรรมการบริหาร (Executive Committee)",
      badge: "bg-amber-100 text-amber-950 border-amber-300 font-bold shadow-2xs",
      description: "ตรวจสอบนโยบาย ติดตาม KPI คุณภาพสาขา และดูรายงานสรุปประสิทธิภาพ",
      primaryDuty: "ตรวจสอบดัชนีคุณภาพ (Quality Audit) & สรุปผลการดำเนินงาน",
      Icon: Building2,
    },
    general_manager: {
      title: "ผู้จัดการทั่วไป (General Manager)",
      badge: "bg-amber-200 text-amber-950 border-amber-400 font-bold shadow-2xs",
      description: "บริหารระดับสูง กำหนดทิศทาง ระเบียบปฏิบัติของทุกสาขา มีอำนาจสูงสุดคล้ายกรรมการบริหาร",
      primaryDuty: "ตรวจสอบดัชนีภาพรวม และติดตามความก้าวหน้า",
      Icon: Award,
    },
  }[currentRole];

  // Helper metrics
  const unreadCount = notifications.filter((n) => !n.read).length;
  const completedSessions = sessions.filter((s) => s.completedAt);
  const pendingApprovalsCount = sessions.filter((s) => {
    const app = approvals[s.id];
    return !app?.managerApproved;
  }).length;

  const totalChecklistItems = sessions.reduce((acc, s) => acc + s.items.length, 0);
  const completedChecklistItems = sessions.reduce(
    (acc, s) => acc + s.items.filter((i) => i.completedAt).length,
    0
  );
  const complianceRate =
    totalChecklistItems > 0 ? Math.round((completedChecklistItems / totalChecklistItems) * 100) : 95;

  function showToast(msg: string) {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3500);
  }





  async function handleResetChecklistData() {
    try {
      setIsResetting(true);
      await resetTodayChecklistDataAction();
      secureSetItem("app_sessions", "[]");
      secureRemoveItem("app_active_session");
      secureRemoveItem("app_manager_read_notifs");
      showToast("รีเซ็ตข้อมูลเช็คลิสต์ประจำวันเรียบร้อยแล้ว ✓");
      await loadDbSessions(true);
      setShowResetModal(false);
    } catch (err) {
      console.error("Reset error:", err);
      showToast("เกิดข้อผิดพลาดในการรีเซ็ตข้อมูล");
    } finally {
      setIsResetting(false);
    }
  }

  function handleMarkAllNotifsRead() {
    const allIds = notifications.map((n) => n.shiftSessionId);
    try {
      secureSetItem("app_manager_read_notifs", JSON.stringify(allIds));
    } catch { }
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    showToast("ทำเครื่องหมายว่าอ่านแล้วทั้งหมดเรียบร้อย");
  }

  const activeHistorySource = specificDaySessions !== null ? specificDaySessions : historySessions;
  const filteredHistory = activeHistorySource.filter((s) => {
    const matchesSearch =
      s.userName.toLowerCase().includes(historySearch.toLowerCase()) ||
      (s.userPosition || "").toLowerCase().includes(historySearch.toLowerCase());
    const matchesShift = historyShiftFilter === "all" || s.shift === historyShiftFilter;
    if (!matchesSearch || !matchesShift) return false;

    const app = approvals[s.id] || {};
    const isPending = !app.managerApproved;

    if (historyStatusFilter === "pending") return isPending;
    if (historyStatusFilter === "approved") {
      return !!app.managerApproved;
    }
    return true;
  });

  if (isAssistant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] p-4 font-sans">
        <div className="bg-[var(--color-surface)] border border-rose-300 dark:border-rose-900 rounded-2xl p-6 text-center max-w-md shadow-lg space-y-3">
          <ShieldAlert size={48} className="text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-[var(--color-text)]">ไม่มีสิทธิ์เข้าถึงหน้านี้ (Access Denied)</h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            ผู้ช่วยผู้จัดการร้านไม่มีสิทธิ์เข้าถึงระบบตรวจสอบระดับผู้บริหาร กำลังพาท่านกลับสู่หน้าหลัก...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] pb-16 font-sans">
      {/* ─── Top Brand Navigation Bar ────────────────────────────────────────────── */}
      <nav className="bg-[var(--color-surface)]/95 backdrop-blur-md border-b border-[var(--color-border)] sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <BrandLogo size={36} showText={false} isDark={false} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-extrabold text-xs sm:text-base text-[var(--color-text)] tracking-tight truncate">
                  Eater Egg Fresh Mart
                </span>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--color-surface-2)] text-[var(--color-text)] border border-[var(--color-border)] shrink-0">
                  {user.branchName || "ไม่ได้ระบุสาขา"}
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] hidden md:block">
                ระบบกำกับดูแลและตรวจสอบมาตรฐานงานสาขา (Operations & Audit Portal)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">

            <Link
              href="/manager/branches"
              className="text-xs font-bold text-[var(--color-text)] hover:text-amber-950 dark:hover:text-amber-200 bg-[var(--color-surface)] hover:bg-amber-100 dark:hover:bg-amber-950/70 border border-[var(--color-border)] hover:border-amber-400 px-3 py-1.5 rounded-xl transition-all inline-flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer min-h-[36px]"
              title="รายงานภาพรวมทุกสาขาและการปฏิบัติงาน"
            >
              <Building2 size={16} className="text-amber-600 shrink-0" />
              <span className="hidden sm:inline">ภาพรวมทุกสาขา</span>
            </Link>

            <Link
              href="/manager/leaves"
              className="text-xs font-bold text-[var(--color-text)] hover:text-amber-950 dark:hover:text-amber-200 bg-[var(--color-surface)] hover:bg-amber-100 dark:hover:bg-amber-950/70 border border-[var(--color-border)] hover:border-amber-400 px-3 py-1.5 rounded-xl transition-all inline-flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer min-h-[36px]"
              title="ระบบจัดการการลาและสถานะพนักงาน"
            >
              <HeartPulse size={16} className="text-rose-500 shrink-0" />
              <span className="hidden sm:inline">การลา & สถานะพนักงาน</span>
            </Link>

            <NavbarRefreshControl
              onRefresh={handleNavbarRefresh}
              onRefreshFromDb={handleNavbarRefreshFromDb}
              isLoading={isNavbarRefreshing}
              isDbLoading={isNavbarDbRefreshing}
              lastRefreshedAt={navbarLastRefreshedAt}
              lastRefreshType={navbarLastRefreshType}
            />
            <NotificationCenter />
            <ThemeToggle />

            {/* Logout Button: Responsive compact on mobile, labeled on tablet/desktop */}
            <button
              type="button"
              onClick={onLogout}
              title="ออกจากระบบ"
              aria-label="ออกจากระบบ"
              className="text-xs text-[var(--color-text-muted)] hover:text-rose-700 hover:bg-rose-50 hover:border-rose-200 dark:hover:bg-rose-950/40 dark:hover:border-rose-800 transition-all p-2 sm:px-3 sm:py-1.5 rounded-xl border border-[var(--color-border)] font-semibold cursor-pointer min-h-[36px] min-w-[36px] inline-flex items-center justify-center gap-1.5 shrink-0"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">ออกจากระบบ</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ─── Main Content Container ───────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Toast Notification Alert */}
        {actionFeedback && (
          <div className="p-3 bg-[var(--color-surface)] border border-[var(--color-primary)]/40 text-[var(--color-text)] text-xs font-semibold rounded-xl flex items-center justify-between shadow-md animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />
              <span>{actionFeedback}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionFeedback(null)}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)] text-xs font-bold px-2 py-0.5 cursor-pointer transition-colors"
            >
              ปิด
            </button>
          </div>
        )}

        {/* ─── Executive Welcome Banner ───────────────────────────────────────── */}
        <header className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative overflow-hidden">
          <div className="space-y-1.5 z-10">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xl sm:text-2xl font-bold text-[var(--color-text)] tracking-tight">
                สวัสดี, {user.name}
              </span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold flex items-center gap-1.5 ${roleConfig.badge}`}>
                <roleConfig.Icon size={13} strokeWidth={2.5} />
                <span>{roleConfig.title}</span>
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] max-w-2xl leading-relaxed">
              {roleConfig.description}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] font-mono pt-0.5">
              ภารกิจหลักวันนี้: <span className="font-semibold text-[var(--color-text)]">{roleConfig.primaryDuty}</span>
            </p>
          </div>

          {/* Quick Access to Leaves, Staff Status, and Branches */}
          <div className="flex items-center gap-2 z-10 shrink-0 flex-wrap sm:flex-nowrap">
            <Link
              href="/manager/branches"
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-amber-950 border border-amber-500 transition-all flex items-center gap-1.5 shadow-2xs"
            >
              <Building2 size={15} className="shrink-0" />
              <span>ภาพรวมทุกสาขา</span>
            </Link>
            <Link
              href="/manager/leaves"
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[var(--color-surface-2)] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[var(--color-text)] hover:text-rose-700 dark:hover:text-rose-300 border border-[var(--color-border)] hover:border-rose-300 transition-all flex items-center gap-1.5 shadow-2xs"
            >
              <HeartPulse size={15} className="text-rose-500 shrink-0" />
              <span>จัดการการลา</span>
            </Link>
            <Link
              href="/manager/staff-status"
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[var(--color-surface-2)] hover:bg-amber-50 dark:hover:bg-amber-950/40 text-[var(--color-text)] hover:text-amber-800 dark:hover:text-amber-200 border border-[var(--color-border)] hover:border-amber-300 transition-all flex items-center gap-1.5 shadow-2xs"
            >
              <Users size={15} className="text-amber-600 shrink-0" />
              <span>สถานะพนักงาน</span>
            </Link>
          </div>
        </header>

        {/* ─── Navigation Tabs (Tailored to Executive & Operations) ──────────── */}
        <div className="bg-[var(--color-surface-2)] p-1.5 rounded-2xl border border-[var(--color-border)] shadow-2xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
            {[
              {
                id: "overview" as DashboardTab,
                label: "ภาพรวมและการรับรองกะ",
                Icon: ClipboardCheck,
                desc: "ตรวจรับรองกะและแจ้งเตือน",
              },
              {
                id: "refrigerator" as DashboardTab,
                label: "ตู้แช่ & ตรวจสอบงาน",
                Icon: Snowflake,
                desc: "ตรวจเช็คสดและตั้งค่าตู้แช่",
              },
              {
                id: "history" as DashboardTab,
                label: "ประวัติการตรวจสอบย้อนหลัง",
                Icon: History,
                desc: "ค้นหาและดูรายละเอียดทุกกะ",
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`p-2 sm:p-3 rounded-xl text-left transition-all cursor-pointer flex flex-col justify-center min-h-[44px] sm:min-h-[54px] ${activeTab === tab.id
                  ? "bg-[var(--color-brown)] text-amber-100 shadow-sm font-bold"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]/70"
                  }`}
              >
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <tab.Icon size={16} strokeWidth={2.2} className="shrink-0" />
                  <span className="text-xs sm:text-sm line-clamp-1">{tab.label}</span>
                </div>
                <span className={`text-xs font-normal pl-6 hidden sm:block ${activeTab === tab.id ? "text-amber-200" : "text-[var(--color-text-muted)]"}`}>
                  {tab.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ─── TAB CONTENT ─────────────────────────────────────────────────── */}
        {activeTab === "refrigerator" && (
          <RefrigeratorConfigView user={user} />
        )}

        {activeTab === "overview" && (
          <div className="space-y-6 animate-fade-in">
            {/* ─── Integrated Store Operations Cards (Separated columns) ─── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
              {/* Card 1: Store Shift Operations */}
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 sm:p-6 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-xs" aria-hidden="true" />
                      <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                        กะปฏิบัติงานวันนี้
                      </span>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                      วันนี้
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 pt-1">
                    <span className="text-3xl sm:text-4xl font-extrabold font-mono text-[var(--color-text)] tracking-tight">
                      {sessions.length}
                    </span>
                    <span className="text-xs sm:text-sm text-[var(--color-text-muted)] font-semibold">
                      กะงานทั้งหมด
                    </span>
                  </div>
                </div>
                <div className="pt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between">
                  <p className="text-xs text-[var(--color-text-subtle)] font-medium">
                    {completedSessions.length} กะส่งมอบเรียบร้อยแล้ว
                  </p>
                  <span className="text-xs font-mono font-bold text-[var(--color-text)] bg-[var(--color-surface-2)] px-2 py-0.5 rounded-md border border-[var(--color-border)]">
                    {sessions.length > 0 ? Math.round((completedSessions.length / sessions.length) * 100) : 0}%
                  </span>
                </div>
              </div>

              {/* Card 2: Store Compliance Rate */}
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 sm:p-6 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" aria-hidden="true" />
                      <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                        ความสอดคล้องมาตรฐานสาขา
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                      {complianceRate}%
                    </span>
                  </div>
                  <div className="w-full bg-[var(--color-surface-2)] h-2.5 rounded-full overflow-hidden border border-[var(--color-border-subtle)] mt-2">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500 shadow-xs"
                      style={{ width: `${complianceRate}%` }}
                    />
                  </div>
                </div>
                <div className="pt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between">
                  <p className="text-xs text-[var(--color-text-subtle)] font-medium">
                    บันทึกแล้ว {completedChecklistItems} จาก {totalChecklistItems || 1} ข้อเช็คลิสต์
                  </p>
                </div>
              </div>

              {/* Card 3: Branch Operations & Manager Approval Status Overview */}
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${pendingApprovalsCount > 0 ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} aria-hidden="true" />
                      <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                        การรับรองกะโดย ผจก.สาขา
                      </span>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                      ระดับสาขา
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    {pendingApprovalsCount > 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-950 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 px-3 py-1.5 rounded-full shadow-2xs">
                        <AlertCircle size={14} className="text-amber-700 dark:text-amber-400" />
                        <span>รอ ผจก.สาขา ตรวจรับรอง {pendingApprovalsCount} กะ</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-900 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 px-3 py-1.5 rounded-full shadow-2xs">
                        <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
                        <span>✨ รับรองครบถ้วนทุกกะ — มาตรฐาน 100%</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="pt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between">
                  <Link
                    href="/manager/branches"
                    className="text-xs font-bold text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 inline-flex items-center gap-1 transition-colors"
                  >
                    <span>ดูภาพรวมทุกสาขา & กำลังพล</span>
                    <span>→</span>
                  </Link>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {sessions.length - pendingApprovalsCount}/{sessions.length} กะรับรองแล้ว
                  </span>
                </div>
              </div>
            </div>

            {/* ─── Staff Presence & Leave Management Hub Card ─── */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <HeartPulse size={20} />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-[var(--color-text)] flex items-center gap-2">
                    <span>การบริหารจัดการกำลังพล & วันลาพนักงาน</span>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                      HR & Staff
                    </span>
                  </h4>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    ตรวจสอบสถานะการเข้ากะของพนักงานประจำวัน บันทึกและอนุมัติการลาป่วย/ลากิจ พร้อมระบบคุ้มครองสตรีค
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                <Link
                  href="/manager/staff-status"
                  className="w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-bold bg-[var(--color-surface-2)] hover:bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)] hover:border-amber-400 transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <Users size={14} className="text-amber-600" />
                  <span>สถานะกะพนักงาน</span>
                </Link>
                <Link
                  href="/manager/leaves"
                  className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-amber-950 transition-all flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <HeartPulse size={14} className="text-rose-600" />
                  <span>ระบบจัดการการลา →</span>
                </Link>
              </div>
            </div>

            {/* Live Shift Handover & Approval Queue */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
              {/* Header Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] pb-3.5">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-[var(--color-text)] flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span>รายการกะงานสาขา (Live Shift Operations)</span>
                    </h3>
                    {isLiveFromDb && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-950 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                        <span>Supabase Live DB</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    ตรวจสอบและติดตามความคืบหน้าของรายการเช็คลิสต์และการทำงานของแต่ละสาขาแบบเรียลไทม์
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                  <button
                    type="button"
                    onClick={() => loadDbSessions(true)}
                    disabled={isLoadingDb}
                    className="text-xs font-semibold text-[var(--color-text)] hover:text-amber-950 bg-[var(--color-surface-2)] hover:bg-amber-100 border border-[var(--color-border)] min-h-[44px] sm:min-h-[34px] px-3.5 py-2 sm:px-3 sm:py-1.5 rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                    title="โหลดข้อมูลล่าสุดจากฐานข้อมูล"
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={isLoadingDb ? "animate-spin text-amber-600" : ""}
                    >
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                    <span>{isLoadingDb ? "กำลังรีเฟรช..." : "รีเฟรชข้อมูล"}</span>
                  </button>

                  <span className="text-xs font-mono text-[var(--color-text-muted)] bg-[var(--color-surface-2)] border border-[var(--color-border)] px-2.5 py-1.5 rounded-xl">
                    วันนี้: {fmtDate(new Date().toISOString())}
                  </span>
                </div>
              </div>

              {/* ─── Usability Enhancement: Quick Filter Pills Toolbar ─── */}
              {(() => {
                const sessionsForRole = sessions;
                const pendingCount = sessionsForRole.filter((s) => {
                  const app = approvals[s.id] || {};
                  return !app.managerApproved;
                }).length;
                const approvedCount = sessionsForRole.length - pendingCount;

                return (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                    {/* Status Tabs */}
                    <div className="flex items-center gap-1.5 overflow-x-auto max-w-full no-scrollbar pb-1 sm:pb-0">
                      <button
                        type="button"
                        onClick={() => setShiftQueueStatusFilter("all")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${shiftQueueStatusFilter === "all"
                          ? "bg-[var(--color-brown)] text-amber-100 shadow-2xs font-bold"
                          : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)]"
                          }`}
                      >
                        ทั้งหมด ({sessionsForRole.length})
                      </button>

                      <button
                        type="button"
                        onClick={() => setShiftQueueStatusFilter("pending")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${shiftQueueStatusFilter === "pending"
                          ? "bg-amber-500 text-amber-950 font-bold shadow-2xs"
                          : pendingCount > 0
                            ? "bg-amber-100 text-amber-950 border border-amber-300 hover:bg-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800"
                            : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)]"
                          }`}
                      >
                        <span>รอการตรวจรับรอง</span>
                        {pendingCount > 0 && (
                          <span className={`px-1.5 py-0.2 rounded-full text-xs font-extrabold ${shiftQueueStatusFilter === "pending" ? "bg-amber-950 text-amber-200" : "bg-amber-400 text-amber-950"}`}>
                            {pendingCount}
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setShiftQueueStatusFilter("approved")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${shiftQueueStatusFilter === "approved"
                          ? "bg-[var(--color-brown)] text-amber-100 shadow-2xs font-bold"
                          : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)]"
                          }`}
                      >
                        อนุมัติแล้ว ({approvedCount})
                      </button>
                    </div>

                    {/* Shift Filter Dropdown / Pills */}
                    <div className="flex items-center gap-1 self-start sm:self-auto">
                      <span className="text-xs text-[var(--color-text-muted)] hidden lg:inline mr-1">กะ:</span>
                      {(["all", "morning", "afternoon"] as const).map((sh) => (
                        <button
                          key={sh}
                          type="button"
                          onClick={() => setShiftQueueTimeFilter(sh)}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${shiftQueueTimeFilter === sh
                            ? "bg-[var(--color-text)] text-[var(--color-surface)] shadow-2xs font-bold"
                            : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
                            }`}
                        >
                          {sh === "all" ? "ทุกกะ" : sh === "morning" ? "กะเช้า" : "กะบ่าย"}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* ─── Render Shifts: Responsive Dual View (Cards on Mobile, Table on Desktop) ─── */}
              {(() => {
                const sessionsForRole = sessions;

                const filteredSessions = sessionsForRole
                  .filter((sess) => {
                    if (shiftQueueTimeFilter !== "all" && sess.shift !== shiftQueueTimeFilter) return false;
                    const app = approvals[sess.id] || {};
                    const isPending = !app.managerApproved;

                    if (shiftQueueStatusFilter === "pending") return isPending;
                    if (shiftQueueStatusFilter === "approved") {
                      return !!app.managerApproved;
                    }
                    return true;
                  })
                  .sort((a, b) => {
                    const aApp = approvals[a.id] || {};
                    const bApp = approvals[b.id] || {};
                    const aPending = !aApp.managerApproved;
                    const bPending = !bApp.managerApproved;
                    if (aPending && !bPending) return -1;
                    if (!aPending && bPending) return 1;
                    if (a.shift === "morning" && b.shift !== "morning") return -1;
                    if (a.shift !== "morning" && b.shift === "morning") return 1;
                    return 0;
                  });

                if (filteredSessions.length === 0) {
                  return (
                    <div className="py-10 text-center text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-2)]/40 rounded-2xl border border-dashed border-[var(--color-border)] p-6">
                      <p className="font-semibold text-[var(--color-text)]">
                        {shiftQueueStatusFilter === "pending"
                          ? "ไม่มีรายการกะที่ค้างการรับรองในขณะนี้ ✓"
                          : shiftQueueStatusFilter === "approved"
                            ? "ยังไม่มีกะที่ได้รับการอนุมัติ"
                            : "ยังไม่มีข้อมูลกะการทำงานในวันนี้"}
                      </p>
                      <p className="text-xs text-[var(--color-text-subtle)] mt-1">
                        {shiftQueueStatusFilter === "pending"
                          ? "พนักงานทุกคนในเงื่อนไขได้รับการตรวจรับรองเรียบร้อยแล้ว"
                          : "เมื่อพนักงานเริ่มเข้ากะ รายชื่อและเปอร์เซ็นต์ความคืบหน้าจะแสดงที่นี่แบบเรียลไทม์"}
                      </p>
                    </div>
                  );
                }

                // Helper to render approval badge
                const renderApprovalBadge = (sess: ShiftSession) => {
                  const app = approvals[sess.id] || {};
                  const isAssistantSession =
                    sess.taskRole === "manager_assistant" || sess.userPosition === "ผู้ช่วยผู้จัดการร้าน";

                  if (app.managerApproved) {
                    return (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 shadow-2xs">
                        <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
                        <span>อนุมัติสมบูรณ์</span>
                      </span>
                    );
                  }

                  if (isAssistantSession) {
                    return (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                        <span>รอผู้จัดการอนุมัติ (งานผู้ช่วย)</span>
                      </span>
                    );
                  }

                  if (app.assistantApproved) {
                    return (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                        <span>ผู้ช่วยรับรองแล้ว → รอผู้จัดการ</span>
                      </span>
                    );
                  }

                  if (!hasAssistantLoggedInToday) {
                    return (
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 border border-amber-200 dark:border-amber-800"
                        title="ไม่มีผู้ช่วยเข้างานในวันนี้ จึงข้ามขั้นตอนนี้ให้ผู้จัดการพิจารณาโดยตรง"
                      >
                        <span>รอผู้จัดการอนุมัติ (ข้ามผู้ช่วย)</span>
                      </span>
                    );
                  }

                  return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border border-[var(--color-border)]">
                      <span>รอผู้ช่วยรับรอง</span>
                    </span>
                  );
                };

                return (
                  <>
                    {/* 1. Mobile Cards View (< sm: 640px) */}
                    <div className="block sm:hidden space-y-3">
                      {filteredSessions.map((sess) => {
                        const completedCount = sess.items.filter((i) => i.completedAt).length;
                        const pct = Math.round((completedCount / (sess.items.length || 1)) * 100);
                        const isAssistantSession =
                          sess.taskRole === "manager_assistant" || sess.userPosition === "ผู้ช่วยผู้จัดการร้าน";

                        const lateItems = sess.items.filter((i) => {
                          if (i.isLate || i.comment) return true;
                          if (i.completedAt && i.category) {
                            const match = i.category.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
                            if (match) {
                              const [endHr, endMin] = match[2].split(':').map(Number);
                              const completedDate = new Date(i.completedAt);
                              const deadlineDate = new Date(sess.startedAt);
                              deadlineDate.setHours(endHr, endMin, 0, 0);
                              if (completedDate > deadlineDate) return true;
                            }
                          }
                          return false;
                        });

                        return (
                          <div
                            key={sess.id}
                            className="p-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs space-y-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="font-bold text-sm text-[var(--color-text)]">
                                  {sess.userName}
                                </span>
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                  <span
                                    className={`px-2 py-0.5 rounded-md font-bold text-xs ${isAssistantSession
                                      ? "bg-[var(--color-amber-glow)] text-[var(--color-text)] border border-[var(--color-amber)]"
                                      : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border border-[var(--color-border)]"
                                      }`}
                                  >
                                    {sess.userPosition || "พนักงาน"}
                                  </span>
                                  {getShiftBadge(sess.shift)}
                                </div>
                              </div>
                              {sess.completedAt ? (
                                <span className="text-xs font-mono text-[var(--color-text-muted)] bg-[var(--color-surface-2)] px-2 py-1 rounded-lg border border-[var(--color-border)]">
                                  {fmtTime(sess.completedAt)}
                                </span>
                              ) : (
                                <span className="text-xs font-bold text-amber-950 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 px-2 py-0.5 rounded-md">
                                  กำลังปฏิบัติงาน
                                </span>
                              )}
                            </div>

                            {/* Progress bar */}
                            <div className="space-y-1.5 bg-[var(--color-surface-2)]/60 p-2.5 rounded-xl border border-[var(--color-border)]">
                              <div className="flex items-center justify-between text-xs font-mono">
                                <span className="text-[var(--color-text-muted)]">ความคืบหน้า</span>
                                <span className="font-bold text-[var(--color-text)]">
                                  {completedCount}/{sess.items.length} ข้อ ({pct}%)
                                </span>
                              </div>
                              <div className="w-full bg-[var(--color-border-subtle)] h-2 rounded-full overflow-hidden border border-[var(--color-border)]">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${pct === 100 ? "bg-emerald-500" : "bg-amber-400"
                                    }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>

                            {/* Late items reason display on general mobile card */}
                            {lateItems.length > 0 && (
                              <div className="p-2.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs space-y-1.5">
                                <div className="flex items-center gap-1.5 text-rose-800 dark:text-rose-300 font-bold">
                                  <AlertCircle size={13} className="shrink-0" />
                                  <span>พบรายการล่าช้า {lateItems.length} ข้อ:</span>
                                </div>
                                <div className="space-y-1 pl-3 text-[11px] text-rose-950 dark:text-rose-200">
                                  {lateItems.map((li) => (
                                    <div key={li.id} className="leading-snug">
                                      <span className="font-semibold text-rose-800 dark:text-rose-300">{li.label}:</span>{" "}
                                      <span className="italic">
                                        {li.comment ? `"${li.comment}"` : "(ไม่ได้ระบุเหตุผล)"}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Incomplete shift badge and reason on mobile card */}
                            {(sess.incompleteStatus === "pending_review" || (sess.incompleteReason && sess.incompleteStatus !== "reviewed")) && (
                              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs space-y-1">
                                <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-200 font-bold">
                                  <AlertCircle size={13} className="shrink-0 text-amber-600 dark:text-amber-400" />
                                  <span>งานไม่ครบ (รอพิจารณามาตรการ):</span>
                                </div>
                                <p className="text-[11px] text-[var(--color-text)] pl-4 italic">
                                  &ldquo;{sess.incompleteReason || "ไม่ได้ระบุเหตุผล"}&rdquo;
                                </p>
                              </div>
                            )}
                            {sess.incompleteStatus === "reviewed" && (
                              <div className="p-2.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-blue-900 dark:text-blue-200 font-bold">
                                  <CheckCircle2 size={13} className="shrink-0 text-blue-600 dark:text-blue-400" />
                                  <span>พิจารณางานไม่ครบแล้ว</span>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-200">
                                  {sess.incompleteAction === "no_penalty" && "🛡️ อนุโลม"}
                                  {sess.incompleteAction === "deduct_points" && `🎯 หัก ${sess.incompleteActionPoints || 0} แต้ม`}
                                  {sess.incompleteAction === "break_streak" && "⚡ ตัดสตรีค"}
                                  {sess.incompleteAction === "deduct_leave_quota" && "📅 หักลา 1 วัน"}
                                </span>
                              </div>
                            )}

                            {/* Status & Action */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                              <div className="min-w-0">{renderApprovalBadge(sess)}</div>
                              <button
                                type="button"
                                onClick={() => setSelectedSession(sess)}
                                className="min-h-[44px] px-4 py-2 shrink-0 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs inline-flex items-center gap-1.5 text-[var(--color-text)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-2)]/80 border border-[var(--color-border)]"
                              >
                                <Eye size={14} className="text-[var(--color-text-muted)]" />
                                <span>ดูรายละเอียด</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* 2. Desktop / Tablet Table View (>= sm: 640px) */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-[var(--color-border)] text-[var(--color-text)] font-bold bg-[var(--color-surface-2)]">
                            <th className="py-2.5 px-3 rounded-l-lg">ผู้ปฏิบัติงาน</th>
                            <th className="py-2.5 px-3">ตำแหน่ง / กะ</th>
                            <th className="py-2.5 px-3">ความคืบหน้า</th>
                            <th className="py-2.5 px-3">เวลาส่งกะ</th>
                            <th className="py-2.5 px-3 text-center">สถานะการรับรอง</th>
                            <th className="py-2.5 px-3 text-right rounded-r-lg">การจัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)]/70">
                          {filteredSessions.map((sess) => {
                            const completedCount = sess.items.filter((i) => i.completedAt).length;
                            const pct = Math.round((completedCount / (sess.items.length || 1)) * 100);
                            const isAssistantSession =
                              sess.taskRole === "manager_assistant" || sess.userPosition === "ผู้ช่วยผู้จัดการร้าน";

                            const lateItems = sess.items.filter((i) => {
                              if (i.isLate || i.comment) return true;
                              if (i.completedAt && i.category) {
                                const match = i.category.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
                                if (match) {
                                  const [endHr, endMin] = match[2].split(':').map(Number);
                                  const completedDate = new Date(i.completedAt);
                                  const deadlineDate = new Date(sess.startedAt);
                                  deadlineDate.setHours(endHr, endMin, 0, 0);
                                  if (completedDate > deadlineDate) return true;
                                }
                              }
                              return false;
                            });

                            return (
                              <tr key={sess.id} className="hover:bg-[var(--color-background)] transition-colors">
                                <td className="py-3 px-3 font-semibold text-[var(--color-text)]">
                                  {sess.userName}
                                </td>
                                <td className="py-3 px-3 space-y-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span
                                      className={`px-2 py-0.5 rounded-md font-bold text-xs ${isAssistantSession
                                        ? "bg-[var(--color-amber-glow)] text-[var(--color-text)] border border-[var(--color-amber)]"
                                        : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border border-[var(--color-border)]"
                                        }`}
                                    >
                                      {sess.userPosition || "พนักงาน"}
                                    </span>
                                    {getShiftBadge(sess.shift)}
                                  </div>
                                </td>
                                <td className="py-3 px-3">
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between text-xs font-mono text-[var(--color-text-muted)]">
                                      <span>{completedCount}/{sess.items.length}</span>
                                      <span className="font-bold text-[var(--color-text)]">{pct}%</span>
                                    </div>
                                    <div className="w-24 bg-[var(--color-border-subtle)] h-1.5 rounded-full overflow-hidden border border-[var(--color-border)]">
                                      <div
                                        className={`h-full rounded-full ${pct === 100 ? "bg-emerald-500" : "bg-amber-400"}`}
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                    {lateItems.length > 0 && (
                                      <div className="mt-1">
                                        <span
                                          className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-1.5 py-0.5 rounded cursor-help"
                                          title={lateItems.map((li) => `${li.label}: ${li.comment || "ไม่ระบุเหตุผล"}`).join("\n")}
                                        >
                                          <AlertCircle size={10} className="text-rose-600" />
                                          <span>ล่าช้า {lateItems.length} ข้อ</span>
                                        </span>
                                      </div>
                                    )}
                                    {(sess.incompleteStatus === "pending_review" || (sess.incompleteReason && sess.incompleteStatus !== "reviewed")) && (
                                      <div className="mt-1">
                                        <span
                                          className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 px-1.5 py-0.5 rounded cursor-help"
                                          title={`เหตุผลจบกะงานไม่ครบ: ${sess.incompleteReason || "ไม่ระบุ"}`}
                                        >
                                          <AlertCircle size={10} className="text-amber-600 dark:text-amber-400" />
                                          <span>งานไม่ครบ (รอพิจารณา)</span>
                                        </span>
                                      </div>
                                    )}
                                    {sess.incompleteStatus === "reviewed" && (
                                      <div className="mt-1">
                                        <span
                                          className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-900 dark:text-blue-200 bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 px-1.5 py-0.5 rounded"
                                          title={`พิจารณาแล้ว: ${sess.incompleteAction || "-"}`}
                                        >
                                          <CheckCircle2 size={10} className="text-blue-600 dark:text-blue-400" />
                                          <span>พิจารณางานไม่ครบแล้ว</span>
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-3 font-mono text-[var(--color-text-muted)] text-xs">
                                  {sess.completedAt ? (
                                    fmtTime(sess.completedAt)
                                  ) : (
                                    <span className="text-amber-950 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 px-2 py-0.5 rounded-md font-bold text-xs">
                                      กำลังปฏิบัติงาน
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  {renderApprovalBadge(sess)}
                                </td>
                                <td className="py-3 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedSession(sess)}
                                    className="min-h-[44px] min-w-[44px] sm:min-h-[34px] sm:min-w-0 inline-flex items-center justify-center gap-1.5 px-4 py-2 sm:px-3.5 sm:py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs whitespace-nowrap text-[var(--color-text)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-2)]/80 border border-[var(--color-border)]"
                                  >
                                    <Eye size={14} className="text-[var(--color-text-muted)]" />
                                    <span>ดูรายละเอียด</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Shift Notifications Log */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                <h3 className="text-sm font-bold text-[var(--color-text)] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>บันทึกการส่งงานและแจ้งเตือนล่าสุด (Recent Shift Notifications)</span>
                </h3>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllNotifsRead}
                    className="text-xs font-semibold text-amber-700 hover:text-[var(--color-amber)] underline cursor-pointer"
                  >
                    อ่านทั้งหมดแล้ว
                  </button>
                )}
              </div>

              <div className="space-y-2.5">
                {notifications.length === 0 ? (
                  <div className="text-center py-6 text-[var(--color-text-muted)] text-xs bg-[var(--color-surface-2)]/60 rounded-xl border border-dashed border-[var(--color-border)]">
                    ยังไม่มีรายการส่งมอบกะในวันนี้ (ข้อมูลจะแสดงอัตโนมัติเมื่อมีพนักงานเริ่มงานหรือส่งกะ)
                  </div>
                ) : (
                  notifications.map((notif) => {
                    const target = sessions.find((s) => s.id === notif.shiftSessionId);
                    const isCompleted =
                      !!target?.completedAt ||
                      ((target?.items.length ?? 0) > 0 &&
                        (target?.items.every((i) => i.completedAt) ?? false));
                    const doneCount = target?.items.filter((i) => i.completedAt).length ?? 0;
                    const totalCount = target?.items.length ?? 0;

                    return (
                      <div
                        key={notif.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${notif.read
                          ? "bg-[var(--color-surface-2)]/50 border-[var(--color-border)]"
                          : "bg-[var(--color-amber-glow)]/70 border-[var(--color-amber)]"
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-2 h-2 rounded-full ${notif.read ? "bg-[var(--color-text-subtle)]" : "bg-amber-500"
                              }`}
                          />
                          <div>
                            <p className="text-xs font-semibold text-[var(--color-text)]">
                              {notif.userName}{" "}
                              <span className="font-normal text-[var(--color-text-muted)]">
                                ({notif.userPosition || "พนักงาน"})
                              </span>{" "}
                              {isCompleted ? (
                                <span className="text-emerald-700 font-semibold">ส่งมอบกะ {notif.shift ? getShiftName(notif.shift) : ""}</span>
                              ) : (
                                <span className="text-[var(--color-amber)]">
                                  กำลังปฏิบัติงานกะ {notif.shift ? getShiftName(notif.shift) : ""} ({doneCount}/
                                  {totalCount} ข้อ)
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] font-mono text-[var(--color-text-muted)]">
                              {isCompleted ? "ส่งเมื่อ" : "แจ้งเตือนเมื่อ"} {fmtDate(notif.completedAt || notif.createdAt)} เวลา {fmtTime(notif.completedAt || notif.createdAt)} น.
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (target) setSelectedSession(target);
                          }}
                          className="min-h-[44px] min-w-[44px] sm:min-h-[32px] sm:min-w-0 inline-flex items-center justify-center px-3.5 py-2 sm:px-2.5 sm:py-1 text-xs font-semibold text-[var(--color-text)] hover:text-[var(--color-brown-light)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg cursor-pointer transition-colors shadow-xs whitespace-nowrap"
                        >
                          ดูรายงาน
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Team Leaderboard & Performance */}
            <ErrorBoundary fallbackTitle="ไม่สามารถโหลดข้อมูลอันดับผลงานได้">
              <LeaderboardWidget branchId={user.branchId} />
            </ErrorBoundary>
          </div>
        )}


        {/* ─── TAB 3: AUDIT HISTORY & SHIFT REPORTS ───────────────────────────── */}
        {activeTab === "history" && (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[var(--color-text)] flex items-center gap-2">
                  <History size={18} className="text-amber-700" />
                  <span>ประวัติและรายงานการตรวจสอบย้อนหลัง (Audit Inspection History)</span>
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5 flex flex-wrap items-center gap-1.5">
                  <span>ค้นหาและเรียกดูรายละเอียดของแต่ละกะที่ปฏิบัติงานแล้ว</span>
                  <span className="inline-flex items-center text-xs bg-amber-500/15 text-amber-950 dark:text-amber-200 font-bold px-2 py-0.5 rounded border border-amber-500/30">
                    <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    แสดงข้อมูลย้อนหลัง 14 วัน (2 สัปดาห์)
                  </span>
                </p>
              </div>
            </div>

            {/* ─── Audit History Quick Filters & Search ─── */}
            {(() => {
              const baseHistoryForRole = activeHistorySource;

              const pendingHistoryCount = baseHistoryForRole.filter((s) => {
                const app = approvals[s.id] || {};
                return !app.managerApproved;
              }).length;

              const approvedHistoryCount = baseHistoryForRole.length - pendingHistoryCount;

              return (
                <div className="space-y-3 pt-1">
                  {/* Row 1: Quick Status Filter Pills & Shift Selector */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    {/* Status Tabs */}
                    <div className="flex items-center gap-1.5 overflow-x-auto max-w-full no-scrollbar pb-1 sm:pb-0">
                      <button
                        type="button"
                        onClick={() => setHistoryStatusFilter("all")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${historyStatusFilter === "all"
                          ? "bg-[var(--color-brown)] text-amber-300 shadow-2xs font-bold"
                          : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)]"
                          }`}
                      >
                        ทั้งหมด ({baseHistoryForRole.length})
                      </button>

                      <button
                        type="button"
                        onClick={() => setHistoryStatusFilter("pending")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${historyStatusFilter === "pending"
                          ? "bg-amber-400 text-amber-950 font-bold shadow-2xs"
                          : pendingHistoryCount > 0
                            ? "bg-amber-100 text-amber-950 border border-amber-300 hover:bg-amber-200"
                            : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)]"
                          }`}
                      >
                        <span>รอการตรวจรับรอง</span>
                        {pendingHistoryCount > 0 && (
                          <span className={`px-1.5 py-0.2 rounded-full text-xs font-extrabold ${historyStatusFilter === "pending" ? "bg-amber-950 text-amber-200" : "bg-amber-400 text-amber-950"}`}>
                            {pendingHistoryCount}
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setHistoryStatusFilter("approved")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${historyStatusFilter === "approved"
                          ? "bg-[var(--color-brown)] text-amber-300 shadow-2xs font-bold"
                          : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)]"
                          }`}
                      >
                        อนุมัติแล้ว ({approvedHistoryCount})
                      </button>
                    </div>

                    {/* Shift Filter Pills */}
                    <div className="flex items-center gap-1 self-start sm:self-auto overflow-x-auto max-w-full no-scrollbar pb-1 sm:pb-0">
                      <span className="text-xs text-[var(--color-text-muted)] hidden lg:inline mr-1">กะ:</span>
                      {(["all", "morning", "afternoon"] as const).map((sh) => (
                        <button
                          key={sh}
                          type="button"
                          onClick={() => setHistoryShiftFilter(sh)}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer shrink-0 ${historyShiftFilter === sh
                            ? "bg-[var(--color-text)] text-[var(--color-surface)] shadow-2xs font-bold"
                            : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
                            }`}
                        >
                          {sh === "all" ? "ทุกกะ" : sh === "morning" ? "กะเช้า" : "กะบ่าย"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Row 2: Search Input & Specific Date Fetcher */}
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <div className="flex-1 min-w-[180px]">
                      <input
                        type="text"
                        placeholder="ค้นหาชื่อ หรือตำแหน่งในประวัติ..."
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] rounded-xl focus:border-amber-400 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center justify-between sm:justify-start gap-1.5 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-2.5 py-1 w-full sm:w-auto">
                      <span className="text-xs text-[var(--color-text-muted)]">วันที่:</span>
                      <input
                        type="date"
                        value={selectedHistoryDate}
                        onChange={handleDateSelection}
                        className="bg-transparent text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:outline-none cursor-pointer"
                      />
                      {selectedHistoryDate && (
                        <button
                          type="button"
                          onClick={() => handleDateSelection({ target: { value: "" } } as React.ChangeEvent<HTMLInputElement>)}
                          className="text-xs text-rose-500 hover:text-rose-700 font-bold px-1.5 py-0.5 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                          title="ล้างวันที่เฉพาะเจาะจงและกลับไปแสดงย้อนหลัง 14 วัน"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ─── Render History: Responsive Dual View (Cards on Mobile, Table on Desktop) ─── */}
            {(() => {
              const visibleHistory = filteredHistory;

              if (visibleHistory.length === 0) {
                return (
                  <div className="py-10 text-center text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-2)]/40 rounded-2xl border border-dashed border-[var(--color-border)] p-6">
                    <p className="font-semibold text-[var(--color-text)]">ไม่พบประวัติการตรวจสอบตามเงื่อนไขที่เลือก</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      ลองเปลี่ยนคำค้นหา หรือเลือกวันที่อื่นเพื่อดูบันทึกย้อนหลัง
                    </p>
                  </div>
                );
              }

              const renderHistoryStatusBadge = (sess: ShiftSession) => {
                const app = approvals[sess.id] || {};
                const isAssistantSession =
                  sess.taskRole === "manager_assistant" || sess.userPosition === "ผู้ช่วยผู้จัดการร้าน";

                if (app.managerApproved) {
                  return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 shadow-2xs">
                      <CheckCircle2 size={12} className="text-emerald-600" />
                      <span>อนุมัติสมบูรณ์</span>
                    </span>
                  );
                }

                if (isAssistantSession) {
                  return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                      <span>รอผู้จัดการอนุมัติ (งานผู้ช่วย)</span>
                    </span>
                  );
                }

                if (app.assistantApproved) {
                  return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                      <span>ผู้ช่วยตรวจแล้ว → รอผู้จัดการ</span>
                    </span>
                  );
                }

                return (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border border-[var(--color-border)]">
                    <span>รอดำเนินการ</span>
                  </span>
                );
              };

              return (
                <>
                  {/* 1. Mobile Cards View (< sm: 640px) */}
                  <div className="block sm:hidden space-y-3">
                    {visibleHistory.map((sess) => {
                      const doneCount = sess.items.filter((i) => i.completedAt).length;
                      const pct = Math.round((doneCount / (sess.items.length || 1)) * 100);

                      return (
                        <div
                          key={sess.id}
                          className="p-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs space-y-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-bold text-sm text-[var(--color-text)]">
                                {sess.userName}
                              </span>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className="px-2 py-0.5 rounded-md font-semibold text-xs bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border border-[var(--color-border)]">
                                  {sess.userPosition || "พนักงาน"}
                                </span>
                                {getShiftBadge(sess.shift)}
                              </div>
                            </div>
                            <div className="text-right text-xs text-[var(--color-text-muted)]">
                              <span className="font-semibold text-[var(--color-text)] block">{fmtDate(sess.startedAt)}</span>
                              <span className="text-[10px] text-[var(--color-text-subtle)] font-mono">
                                {fmtTime(sess.startedAt)}
                              </span>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="space-y-1.5 bg-[var(--color-surface-2)]/60 p-2.5 rounded-xl border border-[var(--color-border)]">
                            <div className="flex items-center justify-between text-xs font-mono">
                              <span className="text-[var(--color-text-muted)]">ข้อที่สำเร็จ</span>
                              <span className="font-bold text-[var(--color-text)]">
                                {doneCount}/{sess.items.length} ข้อ ({pct}%)
                              </span>
                            </div>
                            <div className="w-full bg-[var(--color-border-subtle)] h-2 rounded-full overflow-hidden border border-[var(--color-border)]">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${pct === 100 ? "bg-emerald-500" : "bg-amber-400"
                                  }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>

                          {/* Status & Action */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                            <div className="min-w-0">{renderHistoryStatusBadge(sess)}</div>
                            <button
                              type="button"
                              onClick={() => setSelectedSession(sess)}
                              className="min-h-[44px] px-4 py-2 shrink-0 text-xs font-bold text-amber-950 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 rounded-xl transition-all cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                            >
                              <span>เปิดดูข้อตรวจ</span>
                              <span>→</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 2. Desktop / Tablet Table View (>= sm: 640px) */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[var(--color-border)] text-[var(--color-text-muted)] font-semibold bg-[var(--color-surface-2)]">
                          <th className="py-2.5 px-3 rounded-l-lg">วันที่ / เวลาเริ่ม</th>
                          <th className="py-2.5 px-3">ผู้ปฏิบัติงาน</th>
                          <th className="py-2.5 px-3">ตำแหน่ง</th>
                          <th className="py-2.5 px-3">กะงาน</th>
                          <th className="py-2.5 px-3">ข้อที่สำเร็จ</th>
                          <th className="py-2.5 px-3 text-center">สถานะรับรอง</th>
                          <th className="py-2.5 px-3 text-right rounded-r-lg">การจัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]/70">
                        {visibleHistory.map((sess) => {
                          const doneCount = sess.items.filter((i) => i.completedAt).length;
                          const pct = Math.round((doneCount / sess.items.length) * 100);

                          return (
                            <tr key={sess.id} className="hover:bg-[var(--color-background)] transition-colors">
                              <td className="py-3 px-3 text-[var(--color-text-muted)]">
                                <span className="font-semibold text-[var(--color-text)] block">{fmtDate(sess.startedAt)}</span>
                                <span className="text-xs text-[var(--color-text-subtle)] font-mono">{fmtTime(sess.startedAt)}</span>
                              </td>
                              <td className="py-3 px-3 font-semibold text-[var(--color-text)]">
                                {sess.userName}
                              </td>
                              <td className="py-3 px-3 text-[var(--color-text-muted)]">
                                {sess.userPosition || "-"}
                              </td>
                              <td className="py-3 px-3">
                                {getShiftBadge(sess.shift)}
                              </td>
                              <td className="py-3 px-3 font-mono">
                                <span className="font-bold text-[var(--color-text)]">{doneCount}/{sess.items.length}</span>
                                <span className="text-xs font-semibold text-[var(--color-text-muted)] ml-1">({pct}%)</span>
                              </td>
                              <td className="py-3 px-3 text-center">
                                {renderHistoryStatusBadge(sess)}
                              </td>
                              <td className="py-3 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => setSelectedSession(sess)}
                                  className="min-h-[44px] min-w-[44px] sm:min-h-[34px] sm:min-w-0 inline-flex items-center justify-center px-4 py-2 sm:px-3.5 sm:py-1.5 text-xs font-bold text-amber-950 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 rounded-xl transition-all cursor-pointer shadow-xs whitespace-nowrap"
                                >
                                  เปิดดูข้อตรวจ →
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </div>
        )}


      </main>

      {/* ─── Detail Modal (Inspect Shift Checklists) ──────────────────────────── */}
      {selectedSession && (() => {
        const isAssistantSess =
          selectedSession.taskRole === "manager_assistant" ||
          selectedSession.userPosition === "ผู้ช่วยผู้จัดการร้าน";
        const isMgrOrHigher = currentRole === "manager" || currentRole === "committee" || currentRole === "general_manager";

        const canApprove = !approvals[selectedSession.id]?.managerApproved;
        const isApproved = !!approvals[selectedSession.id]?.managerApproved;
        const approveTitle = roleConfig.title;

        return (
          <SessionDetailModal
            session={selectedSession}
            onClose={() => setSelectedSession(null)}
            canApprove={false}
            isApproved={!!approvals[selectedSession.id]?.managerApproved}
            approveRoleTitle={roleConfig.title}
            isApproving={false}
            reviewerId={user.id}
            canReviewIncomplete={false}
            onReviewSuccess={() => {
              loadDbSessions();
            }}
          />
        );
      })()}

      {/* ─── Accessible Reset Confirmation Modal ─────────────────────────────── */}
      {showResetModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 px-4 animate-in fade-in duration-150"
          onClick={() => !isResetting && setShowResetModal(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !isResetting) setShowResetModal(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-modal-title"
            aria-describedby="reset-modal-desc"
            tabIndex={-1}
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 sm:p-7 w-full max-w-sm focus-visible:outline-none shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center mb-3.5">
              <AlertCircle size={22} />
            </div>

            <h2 id="reset-modal-title" className="text-base sm:text-lg font-bold text-[var(--color-text)] mb-2">
              ต้องการรีเซ็ตข้อมูลเช็คลิสต์ประจำวัน?
            </h2>
            <p id="reset-modal-desc" className="text-sm text-[var(--color-text-muted)] mb-5 leading-relaxed">
              ระบบจะล้างข้อมูลผลการตรวจงาน ความคืบหน้ากะ และประวัติการรับรองทั้งหมดของวันนี้ออกจากระบบเพื่อเริ่มต้นรอบใหม่ คุณแน่ใจหรือไม่ว่าต้องการดำเนินการต่อ?
            </p>

            <div className="flex gap-2.5">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setShowResetModal(false)}
                className="flex-1 min-h-[44px] sm:min-h-[36px] py-2.5 rounded-xl border border-[var(--color-border)] text-xs sm:text-sm font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer disabled:opacity-50"
              >
                ยกเลิกโดยไม่ล้างข้อมูล
              </button>
              <button
                type="button"
                disabled={isResetting}
                onClick={handleResetChecklistData}
                className="flex-1 min-h-[44px] sm:min-h-[36px] py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs sm:text-sm font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <span>{isResetting ? "กำลังล้างข้อมูล..." : "ยืนยันล้างข้อมูลและเริ่มใหม่"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Footer with Reset Option (Same style as staff pages) ─────────────── */}
      <footer className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--color-text-muted)] border-t border-[var(--color-border)] mt-12">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[var(--color-text)]">Eater Egg Fresh Mart</span>
          <span>•</span>
          <span>Operations & Audit Management Portal</span>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            disabled={isResetting}
            className="text-xs text-[var(--color-text-muted)] hover:text-rose-700 font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            title="ล้างข้อมูลเช็คลิสต์ทั้งหมดเพื่อเริ่มทดสอบใหม่"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            <span>{isResetting ? "กำลังรีเซ็ตข้อมูล..." : "รีเซ็ตข้อมูลเช็คลิสต์"}</span>
          </button>
        </div>
      </footer>


    </div>
  );
}
