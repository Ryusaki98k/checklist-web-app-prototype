import { useEffect, useMemo, useState, useCallback, useTransition } from "react";
import { Notification, ShiftSession, ShiftType, User, ChecklistItem } from "../../types";
import { fmtTime } from "../../data/storage";
import { Badge, getShiftBadge, getShiftName } from "../common/Badge";
import { BrandLogo } from "../common/BrandLogo";
import { SessionDetailModal } from "../admin/SessionDetailModal";
import {
  getManagerShiftSessionsAction,
  getHistoryShiftSessionsAction,
  approveShiftSessionAction,
} from "../../actions/manager";
import {
  getOrCreateShiftSessionAction,
  toggleTaskWorkAction,
  resetTodayChecklistDataAction,
} from "../../actions/checklist";
import { NotificationCenter } from "../common/NotificationCenter";
import { ThemeToggle } from "../common/ThemeToggle";
import { NavbarRefreshControl } from "../common/NavbarRefreshControl";
import { invalidateBranchCache } from "../../utils/cache";
import { LeaderboardWidget } from "./LeaderboardWidget";
import { ErrorBoundary } from "../common/ErrorBoundary";
import { LateReasonModal } from "../common/LateReasonModal";
import {
  ClipboardCheck,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  LogOut,
  HeartPulse,
  Users,
  Store,
  Clock,
  Sparkles,
  ChevronRight,
  ShieldAlert,
  ListTodo,
  CheckCheck,
  History,
  Lock,
  Layers,
} from "lucide-react";
import Link from "next/link";

export function isSpecialClosingTask(item: ChecklistItem): boolean {
  if (item.isSpecial || item.zeroPoints) return true;
  const lower = (item.label || "").toLowerCase();
  return (
    lower.includes("turn off light") ||
    lower.includes("turn off refriderator") ||
    lower.includes("turn off refrigerator") ||
    lower.includes("turn off air conditioning") ||
    lower.includes("lock the store") ||
    lower.includes("ปิดไฟส่องสว่าง") ||
    lower.includes("ปิดไฟตู้แช่") ||
    lower.includes("ปิดเครื่องปรับอากาศ") ||
    lower.includes("ปิดแอร์") ||
    lower.includes("ล็อคประตูร้าน") ||
    lower.includes("ล็อคร้าน")
  );
}

export function ManagerDashboard({
  user,
  onLogout,
  activeSession: _activeSession,
  onStartChecklist: _onStartChecklist,
  onUpdateSession: _onUpdateSession,
  onEndShift: _onEndShift,
  onOpenChecklistPage: _onOpenChecklistPage,
  onSwitchToExecutiveView,
}: {
  user: User;
  onLogout: () => void;
  activeSession: ShiftSession | null;
  onStartChecklist: (shift: ShiftType) => void;
  onUpdateSession: (session: ShiftSession) => void;
  onEndShift: () => void;
  onOpenChecklistPage?: () => void;
  onSwitchToExecutiveView?: () => void;
}) {
  const isAssistant = user.role === "manager_assistant" || (user.position?.includes("ผู้ช่วย") ?? false);
  const isManager = user.role === "manager" || (!isAssistant && (user.position?.includes("ผู้จัดการ") ?? false));

  // Tab navigation
  type ManagerTab = "tasks" | "approvals" | "history";
  const [activeTab, setActiveTab] = useState<ManagerTab>("tasks");

  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Navbar refresh controls
  const [isNavbarRefreshing, setIsNavbarRefreshing] = useState(false);
  const [isNavbarDbRefreshing, setIsNavbarDbRefreshing] = useState(false);
  const [navbarLastRefreshedAt, setNavbarLastRefreshedAt] = useState<Date | null>(new Date());
  const [navbarLastRefreshType, setNavbarLastRefreshType] = useState<"cache" | "db">("cache");

  // --- Task Work State (Checklist) ---
  type ManagerTaskShiftTab = "morning" | "afternoon" | "closing";
  const [selectedTaskShiftTab, setSelectedTaskShiftTab] = useState<ManagerTaskShiftTab>(() => {
    return isManager ? "closing" : "morning";
  });
  const [myChecklistShift, setMyChecklistShift] = useState<ShiftType>(() => {
    return isManager ? "afternoon" : "morning";
  });
  const [myChecklistFilter, setMyChecklistFilter] = useState<"all" | "pending" | "completed">("all");
  const [myChecklistItems, setMyChecklistItems] = useState<ChecklistItem[]>([]);
  const [assistantSession, setAssistantSession] = useState<ShiftSession | null>(null);
  const [isLoadingChecklist, setIsLoadingChecklist] = useState(false);
  const [lateModalTarget, setLateModalTarget] = useState<{
    id: string;
    label: string;
    deadlineText?: string;
  } | null>(null);

  // --- Approvals & Live Sessions State ---
  const [sessions, setSessions] = useState<ShiftSession[]>([]);
  const [isLoadingDb, setIsLoadingDb] = useState(false);
  const [approvals, setApprovals] = useState<Record<string, { assistantApproved?: boolean; managerApproved?: boolean }>>({});
  const [shiftQueueStatusFilter, setShiftQueueStatusFilter] = useState<"all" | "pending" | "approved">("all");
  const [selectedSession, setSelectedSession] = useState<ShiftSession | null>(null);

  // --- History State ---
  const [historySessions, setHistorySessions] = useState<ShiftSession[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyShiftFilter, setHistoryShiftFilter] = useState<"all" | ShiftType>("all");

  const [, startTransition] = useTransition();

  function showToast(msg: string) {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3500);
  }

  // Load Assistant Manager / Manager checklist directly from Supabase DB
  const loadChecklist = useCallback(async (shift: ShiftType, isSilent = false) => {
    try {
      if (!isSilent) setIsLoadingChecklist(true);
      const userPosition = isManager ? "ผู้จัดการร้าน" : "ผู้ช่วยผู้จัดการร้าน";
      const res = await getOrCreateShiftSessionAction({
        userId: user.id,
        userName: user.name,
        position: userPosition,
        shift: shift,
      });

      if (res.success && res.session) {
        setAssistantSession(res.session);
        setMyChecklistItems((prev) => {
          const fresh = res.session!.items || [];
          const curSig = prev
            .map((i) => `${i.id}:${i.completedAt || ""}:${i.completedByName || ""}:${i.comment || ""}`)
            .join("|");
          const freshSig = fresh
            .map((i) => `${i.id}:${i.completedAt || ""}:${i.completedByName || ""}:${i.comment || ""}`)
            .join("|");
          if (curSig !== freshSig || prev.length !== fresh.length) {
            return fresh;
          }
          return prev;
        });
      }
    } catch (err) {
      console.error("Failed to load checklist from DB:", err);
    } finally {
      if (!isSilent) setIsLoadingChecklist(false);
    }
  }, [isManager, user]);

  const handleSelectShiftTab = useCallback((tab: ManagerTaskShiftTab) => {
    setSelectedTaskShiftTab(tab);
    const backendShift: ShiftType = tab === "morning" ? "morning" : "afternoon";
    setMyChecklistShift(backendShift);
    void loadChecklist(backendShift);
  }, [loadChecklist]);

  // Load live shift sessions from Supabase DB for approvals
  const loadDbSessions = useCallback(async (isManual = false) => {
    try {
      if (isManual) setIsLoadingDb(true);
      const res = await getManagerShiftSessionsAction();
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
        }));
        setSessions(mappedSessions);

        const newApprovals: Record<string, { assistantApproved?: boolean; managerApproved?: boolean }> = {};
        res.sessions.forEach((s) => {
          newApprovals[s.id] = {
            assistantApproved: s.assistantApproved,
            managerApproved: s.managerApproved,
          };
        });
        setApprovals(newApprovals);
      }
    } catch (err) {
      console.error("Failed to load DB sessions:", err);
    } finally {
      if (isManual) setIsLoadingDb(false);
    }
  }, []);

  // Load history sessions
  const loadHistory = useCallback(async () => {
    try {
      setIsLoadingHistory(true);
      const res = await getHistoryShiftSessionsAction(14);
      if (res.success && res.sessions) {
        const mapped: ShiftSession[] = res.sessions.map((s) => ({
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
        }));
        setHistorySessions(mapped);
      }
    } catch (err) {
      console.error("Failed to load history sessions:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Initial and recurring fetch
  useEffect(() => {
    void loadChecklist(myChecklistShift);
    void loadDbSessions();

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void loadChecklist(myChecklistShift, true);
      void loadDbSessions();
    }, 7000);

    return () => clearInterval(interval);
  }, [myChecklistShift, loadChecklist, loadDbSessions]);

  useEffect(() => {
    if (activeTab === "history") {
      void loadHistory();
    }
  }, [activeTab, loadHistory]);

  // Navbar refresh handlers
  const handleNavbarRefresh = useCallback(async () => {
    try {
      setIsNavbarRefreshing(true);
      await Promise.all([
        loadChecklist(myChecklistShift, false),
        loadDbSessions(true),
        activeTab === "history" ? loadHistory() : Promise.resolve(),
      ]);
      setNavbarLastRefreshedAt(new Date());
      setNavbarLastRefreshType("cache");
      showToast("รีเฟรชข้อมูลล่าสุดเรียบร้อยแล้ว");
    } catch (err) {
      console.error("Navbar refresh error:", err);
    } finally {
      setIsNavbarRefreshing(false);
    }
  }, [loadChecklist, myChecklistShift, loadDbSessions, activeTab, loadHistory]);

  const handleNavbarRefreshFromDb = useCallback(async () => {
    try {
      setIsNavbarDbRefreshing(true);
      invalidateBranchCache();
      await Promise.all([
        loadChecklist(myChecklistShift, false),
        loadDbSessions(true),
        activeTab === "history" ? loadHistory() : Promise.resolve(),
      ]);
      setNavbarLastRefreshedAt(new Date());
      setNavbarLastRefreshType("db");
      showToast("ดึงข้อมูลสดจากฐานข้อมูลเรียบร้อย (Bypass Cache)");
    } catch (err) {
      console.error("Navbar refresh from DB error:", err);
    } finally {
      setIsNavbarDbRefreshing(false);
    }
  }, [loadChecklist, myChecklistShift, loadDbSessions, activeTab, loadHistory]);

  // Toggle item in task work
  async function executeToggleItem(itemId: string, willBeDone: boolean, comment?: string) {
    const newCompletedAt = willBeDone ? new Date().toISOString() : null;
    const item = myChecklistItems.find((i) => i.id === itemId);
    const myTitle = user.position || (isManager ? "ผู้จัดการร้าน" : "ผู้ช่วยผู้จัดการร้าน");

    // Optimistic UI update
    setMyChecklistItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? {
              ...i,
              completedAt: newCompletedAt,
              completedBy: willBeDone ? user.id : null,
              completedByName: willBeDone ? `${user.name} (${myTitle})` : null,
              comment: willBeDone ? (comment ?? i.comment) : null,
              isLate: willBeDone ? (comment ? true : i.isLate) : false,
            }
          : i
      )
    );

    try {
      await toggleTaskWorkAction({
        shiftSessionId: assistantSession?.id,
        taskId: itemId,
        taskWorkId: item?.taskWorkId,
        completed: willBeDone,
        comment: willBeDone ? (comment || undefined) : undefined,
      });
      // Refresh in background
      void loadChecklist(myChecklistShift, true);
    } catch (err) {
      console.error("Failed to toggle task work:", err);
      showToast("เกิดข้อผิดพลาดในการบันทึกสถานะงาน");
    }
  }

  function handleLateSubmit(reason: string) {
    if (!lateModalTarget) return;
    void executeToggleItem(lateModalTarget.id, true, reason);
    setLateModalTarget(null);
  }

  async function handleToggleItem(itemId: string) {
    const item = myChecklistItems.find((i) => i.id === itemId);
    if (!item) return;

    if (item.completedAt) {
      await executeToggleItem(itemId, false);
      return;
    }

    // Check if late
    let isLate = false;
    let deadlineText: string | undefined;
    if (item.category) {
      const match = item.category.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
      if (match) {
        const endStr = match[2];
        const [endHr, endMin] = endStr.split(":").map(Number);
        const deadlineDate = new Date();
        deadlineDate.setHours(endHr, endMin, 0, 0);
        deadlineText = `${item.category} (สิ้นสุด ${endStr} น.)`;
        if (new Date() > deadlineDate) {
          isLate = true;
        }
      }
    }

    if (isLate) {
      setLateModalTarget({
        id: item.id,
        label: item.label,
        deadlineText,
      });
      return;
    }

    await executeToggleItem(itemId, true);
  }

  // Shift Approval Handler
  async function handleApproveSession(sessionId: string, type: "assistant" | "manager") {
    const target = sessions.find((s) => s.id === sessionId);
    const isAssistantSession =
      target?.taskRole === "manager_assistant" || target?.userPosition === "ผู้ช่วยผู้จัดการร้าน";

    if (isAssistantSession && isAssistant) {
      showToast("เฉพาะผู้จัดการร้านเท่านั้นที่สามารถอนุมัติงานของผู้ช่วยผู้จัดการร้านได้");
      return;
    }

    setApprovals((prev) => ({
      ...prev,
      [sessionId]: {
        ...prev[sessionId],
        assistantApproved: true,
        managerApproved: type === "manager" ? true : Boolean(prev[sessionId]?.managerApproved),
      },
    }));

    try {
      const roleForDb = type === "assistant" ? "manager_assistant" : "manager";
      const res = await approveShiftSessionAction({
        shiftSessionId: sessionId,
        role: roleForDb,
      });
      if (res.success) {
        showToast(
          type === "assistant"
            ? "ลงนามรับรองกะงานเบื้องต้น (Assistant Sign-off) สำเร็จ ✓"
            : "อนุมัติส่งมอบกะงานขั้นสุดท้าย (Manager Approval) สำเร็จ ✓"
        );
        void loadDbSessions(true);
      } else {
        showToast(res.error || "บันทึกในระบบเบื้องต้นแล้ว (Local)");
      }
    } catch {
      showToast("บันทึกในระบบเบื้องต้นแล้ว (Local)");
    }
  }

  // --- Partition Tasks into Afternoon Routine vs Special Closing ---
  const isAfternoon = myChecklistShift === "afternoon";
  const routineAfternoonTasks = useMemo(() => {
    return myChecklistItems.filter((i) => !isSpecialClosingTask(i));
  }, [myChecklistItems]);

  const specialClosingTasks = useMemo(() => {
    return myChecklistItems.filter((i) => isSpecialClosingTask(i));
  }, [myChecklistItems]);

  // Active tasks for the currently selected shift tab
  const activeShiftTasks = useMemo(() => {
    if (selectedTaskShiftTab === "morning") {
      return myChecklistItems;
    }
    if (selectedTaskShiftTab === "afternoon") {
      return routineAfternoonTasks;
    }
    return specialClosingTasks;
  }, [selectedTaskShiftTab, myChecklistItems, routineAfternoonTasks, specialClosingTasks]);

  // Overall counts for active display tab
  const totalCount = activeShiftTasks.length;
  const doneCount = activeShiftTasks.filter((i) => i.completedAt).length;
  const pendingCount = totalCount - doneCount;
  const overallPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // Filtered tasks based on status filter (all | pending | completed)
  const filteredActiveTasks = useMemo(() => {
    return activeShiftTasks.filter((item) => {
      if (myChecklistFilter === "pending") return !item.completedAt;
      if (myChecklistFilter === "completed") return Boolean(item.completedAt);
      return true;
    });
  }, [activeShiftTasks, myChecklistFilter]);

  // Filter queue for approvals tab
  const pendingApprovalsCount = sessions.filter((s) => {
    const app = approvals[s.id];
    const isTargetAssistant = s.taskRole === "manager_assistant" || s.userPosition === "ผู้ช่วยผู้จัดการร้าน";
    if (isAssistant) {
      if (isTargetAssistant) return false;
      return !app?.assistantApproved;
    }
    return !app?.managerApproved;
  }).length;

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] pb-20 font-sans">
      {/* ─── Top Brand Navigation Bar ────────────────────────────────────────── */}
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
                ระบบปฏิบัติงานและกำกับดูแลร้านสาขา (Store Manager & Assistant Portal)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <Link
              href="/manager/leaves"
              className="text-xs font-bold text-[var(--color-text)] hover:text-amber-950 dark:hover:text-amber-200 bg-[var(--color-surface)] hover:bg-amber-100 dark:hover:bg-amber-950/70 border border-[var(--color-border)] hover:border-amber-400 px-3 py-1.5 rounded-xl transition-all inline-flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer min-h-[36px]"
              title="ระบบจัดการการลาและสถานะพนักงาน"
            >
              <HeartPulse size={16} className="text-rose-500 shrink-0" />
              <span className="hidden sm:inline">การลา & สถานะพนักงาน</span>
            </Link>

            {onSwitchToExecutiveView && (
              <button
                type="button"
                onClick={onSwitchToExecutiveView}
                className="text-xs font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] px-2.5 py-1.5 rounded-xl transition-colors hidden lg:inline-flex items-center gap-1 cursor-pointer min-h-[36px]"
                title="สลับไปยังแดชบอร์ดผู้บริหาร (Executive Audit View)"
              >
                <span>มุมมองผู้บริหาร ↗</span>
              </button>
            )}

            <ThemeToggle />

            <NotificationCenter />

            <button
              type="button"
              onClick={onLogout}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-semibold transition-colors flex items-center gap-1.5 border border-rose-500/20 cursor-pointer min-h-[36px]"
              title="ออกจากระบบ"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">ออกจากระบบ</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ─── Main Content Container ────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-3 sm:px-6 pt-5 space-y-6">
        {/* Toast Notification */}
        {actionFeedback && (
          <div className="p-3 bg-amber-400 text-amber-950 font-bold text-xs rounded-xl shadow-md border border-amber-500 flex items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{actionFeedback}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionFeedback(null)}
              className="text-amber-950/70 hover:text-amber-950 text-sm font-black cursor-pointer px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* ─── Hero Header & Profile Banner ─────────────────────────────────── */}
        <header className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-amber-950 flex items-center justify-center font-bold text-xl shadow-md shrink-0">
              {isAssistant ? "A" : "M"}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-xl font-extrabold text-[var(--color-text)] tracking-tight">
                  {user.name}
                </h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${isAssistant ? "bg-amber-100 text-amber-950 border border-amber-300" : "bg-[var(--color-brown)] text-amber-100"}`}>
                  {user.position || (isAssistant ? "ผู้ช่วยผู้จัดการร้าน" : "ผู้จัดการร้าน")}
                </span>
                <span className="text-xs font-semibold text-[var(--color-text-muted)] bg-[var(--color-surface-2)] px-2 py-0.5 rounded-md border border-[var(--color-border)]">
                  {user.branchName || "สาขาหลัก"}
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 flex items-center gap-1.5 flex-wrap">
                <span>{isAssistant ? "บันทึกเช็คลิสต์ตรวจงานประจำกะ ตรวจชุดงานปิดร้าน และรับรองงานพนักงาน" : "ควบคุมมาตรฐานร้าน ตรวจสอบชุดงานปิดร้าน 4 ข้อ และอนุมัติรับรองกะ"}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center flex-wrap">
            <NavbarRefreshControl
              isLoading={isNavbarRefreshing}
              isDbLoading={isNavbarDbRefreshing}
              lastRefreshedAt={navbarLastRefreshedAt}
              lastRefreshType={navbarLastRefreshType}
              onRefresh={handleNavbarRefresh}
              onRefreshFromDb={handleNavbarRefreshFromDb}
            />
          </div>
        </header>

        {/* ─── Navigation Tabs ──────────────────────────────────────────────── */}
        <div className="bg-[var(--color-surface-2)] p-1.5 rounded-2xl border border-[var(--color-border)] shadow-2xs">
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab("tasks")}
              className={`p-2.5 sm:p-3 rounded-xl text-left transition-all cursor-pointer flex flex-col justify-center min-h-[48px] sm:min-h-[54px] ${activeTab === "tasks"
                ? "bg-[var(--color-brown)] text-amber-100 shadow-sm font-bold"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]/70"
              }`}
            >
              <div className="flex items-center gap-2">
                <ListTodo size={17} strokeWidth={2.2} className="shrink-0" />
                <span className="text-xs sm:text-sm font-bold">เช็คลิสต์และงานของฉัน</span>
              </div>
              <span className={`text-[11px] hidden sm:block ${activeTab === "tasks" ? "text-amber-200/90" : "text-[var(--color-text-muted)]"}`}>
                งานประจำกะ & ชุดงานปิดร้าน
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("approvals")}
              className={`p-2.5 sm:p-3 rounded-xl text-left transition-all cursor-pointer flex flex-col justify-center min-h-[48px] sm:min-h-[54px] relative ${activeTab === "approvals"
                ? "bg-[var(--color-brown)] text-amber-100 shadow-sm font-bold"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]/70"
              }`}
            >
              <div className="flex items-center gap-2">
                <ClipboardCheck size={17} strokeWidth={2.2} className="shrink-0" />
                <span className="text-xs sm:text-sm font-bold">รับรองกะงานพนักงาน</span>
                {pendingApprovalsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                    {pendingApprovalsCount}
                  </span>
                )}
              </div>
              <span className={`text-[11px] hidden sm:block ${activeTab === "approvals" ? "text-amber-200/90" : "text-[var(--color-text-muted)]"}`}>
                ตรวจรับรองกะส่งมอบ ({sessions.length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`p-2.5 sm:p-3 rounded-xl text-left transition-all cursor-pointer flex flex-col justify-center min-h-[48px] sm:min-h-[54px] ${activeTab === "history"
                ? "bg-[var(--color-brown)] text-amber-100 shadow-sm font-bold"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]/70"
              }`}
            >
              <div className="flex items-center gap-2">
                <History size={17} strokeWidth={2.2} className="shrink-0" />
                <span className="text-xs sm:text-sm font-bold">ประวัติย้อนหลัง</span>
              </div>
              <span className={`text-[11px] hidden sm:block ${activeTab === "history" ? "text-amber-200/90" : "text-[var(--color-text-muted)]"}`}>
                ตรวจสอบบันทึกผลงาน 14 วัน
              </span>
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB 1: TASK WORK (SEPARATED AFTERNOON ROUTINE VS SPECIAL CLOSING)
        ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "tasks" && (
          <div className="space-y-6 animate-fade-in">
            {/* Shift Picker Bar & Status Summary */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)] flex items-center gap-2">
                    <CheckCircle2 size={20} className="text-amber-600 shrink-0" />
                    <span>
                      {selectedTaskShiftTab === "morning"
                        ? "เช็คลิสต์ตรวจงานประจำกะเช้า (Morning Shift Tasks)"
                        : selectedTaskShiftTab === "afternoon"
                        ? "งานประจำกะบ่าย (Afternoon Shift Routine Tasks)"
                        : "ชุดงานพิเศษปิดร้าน 4 รายการ (Closing & Safety Checklist)"}
                    </span>
                  </h2>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {selectedTaskShiftTab === "morning"
                      ? "ขั้นตอนการปฏิบัติงานของผู้ช่วยผู้จัดการร้านประจำกะเช้า (เปิดร้าน, ตรวจสอบความพร้อม)"
                      : selectedTaskShiftTab === "afternoon"
                      ? "ขั้นตอนการปฏิบัติงานของผู้ช่วยผู้จัดการร้านประจำกะบ่าย (ตรวจนับเงินทอน, เช็คสินค้า, ความเรียบร้อย)"
                      : "ขั้นตอนตรวจสอบความปลอดภัยสำคัญตอนปิดร้าน (ปิดไฟ, ตู้แช่, แอร์, ล็อคประตูร้าน)"}
                  </p>
                </div>

                {/* ─── 3 SEPARATED SHIFT TABS ─────────────────────────────────── */}
                <div className="inline-flex items-center self-start sm:self-auto bg-[var(--color-surface-2)] p-1 rounded-xl border border-[var(--color-border)]">
                  <button
                    type="button"
                    onClick={() => handleSelectShiftTab("morning")}
                    className={`min-h-[36px] px-3.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      selectedTaskShiftTab === "morning"
                        ? "bg-[var(--color-brown)] text-amber-100 shadow-2xs font-bold"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    กะเช้า (Morning)
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectShiftTab("afternoon")}
                    className={`min-h-[36px] px-3.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      selectedTaskShiftTab === "afternoon"
                        ? "bg-[var(--color-brown)] text-amber-100 shadow-2xs font-bold"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    กะบ่าย (Afternoon)
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectShiftTab("closing")}
                    className={`min-h-[36px] px-3.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      selectedTaskShiftTab === "closing"
                        ? "bg-[var(--color-brown)] text-amber-100 shadow-2xs font-bold"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    <span>งานปิดร้าน (Closing)</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      selectedTaskShiftTab === "closing"
                        ? "bg-amber-400 text-amber-950 font-bold"
                        : "bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold"
                    }`}>
                      4 ข้อ
                    </span>
                  </button>
                </div>
              </div>

              {/* Progress and Filter Toolbar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[var(--color-surface-2)]/60 p-3 rounded-xl border border-[var(--color-border)]">
                {/* Filter Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  <button
                    type="button"
                    onClick={() => setMyChecklistFilter("all")}
                    className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${myChecklistFilter === "all"
                      ? "bg-[var(--color-brown)] text-amber-100 shadow-2xs font-bold"
                      : "bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)]"
                    }`}
                  >
                    <span>ทั้งหมด</span>
                    <span className="font-mono text-xs font-bold">({totalCount})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMyChecklistFilter("pending")}
                    className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${myChecklistFilter === "pending"
                      ? "bg-amber-400 text-amber-950 font-bold shadow-2xs"
                      : pendingCount > 0
                        ? "bg-amber-100 text-amber-950 border border-amber-300 hover:bg-amber-200/80 font-bold"
                        : "bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)]"
                    }`}
                  >
                    <span>ยังไม่ตรวจ</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold font-mono bg-amber-950/10">
                      {pendingCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMyChecklistFilter("completed")}
                    className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${myChecklistFilter === "completed"
                      ? "bg-[var(--color-brown)] text-amber-100 shadow-2xs font-bold"
                      : "bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)]"
                    }`}
                  >
                    <span>ตรวจแล้ว</span>
                    <span className="font-mono text-xs font-bold">({doneCount})</span>
                  </button>
                </div>

                {/* Overall Progress Meter */}
                <div className="flex items-center gap-3 md:min-w-[200px] justify-end">
                  <div className="flex-1 max-w-[140px] bg-[var(--color-border)] h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${overallPct}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono font-bold text-[var(--color-text)] whitespace-nowrap">
                    {doneCount}/{totalCount} <span className="text-[var(--color-text-muted)] font-normal font-sans">({overallPct}%)</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Loading Indicator */}
            {isLoadingChecklist ? (
              <div className="py-16 text-center text-[var(--color-text-muted)] text-xs flex flex-col items-center justify-center gap-2">
                <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <span>กำลังดึงข้อมูลรายการเช็คลิสต์จากระบบ...</span>
              </div>
            ) : totalCount === 0 ? (
              <div className="py-12 text-center text-[var(--color-text-muted)] text-xs border border-dashed border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] p-6">
                {isManager && selectedTaskShiftTab === "morning" ? (
                  <div className="space-y-3 max-w-md mx-auto">
                    <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center mx-auto text-xl shadow-xs">
                      🛡️
                    </div>
                    <h3 className="font-bold text-sm text-[var(--color-text)]">
                      ผู้จัดการร้านไม่มีงานตรวจเช็คลิสต์ในกะเช้า
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      งานตรวจประจำกะเช้าเป็นหน้าที่ของผู้ช่วยผู้จัดการร้าน โดยผู้จัดการร้านสามารถตรวจสอบชุดงานพิเศษปิดร้าน 4 รายการได้ที่แท็บงานปิดร้าน
                    </p>
                    <button
                      type="button"
                      onClick={() => handleSelectShiftTab("closing")}
                      className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-400 text-amber-950 hover:bg-amber-300 transition-all cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                    >
                      <span>สลับไปดูงานปิดร้าน</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                ) : (
                  "ไม่พบรายการเช็คลิสต์สำหรับตำแหน่งนี้ในกะที่เลือก"
                )}
              </div>
            ) : selectedTaskShiftTab === "closing" ? (
              /* ─── TAB: SPECIAL CLOSING SHIFT TASKS (ชุดงานพิเศษปิดร้าน 4 รายการ) ─ */
              <div className="bg-gradient-to-br from-amber-500/10 via-[var(--color-surface)] to-[var(--color-surface)] border-2 border-amber-500/30 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-500 text-amber-950 flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
                      🛡️
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm sm:text-base font-extrabold text-amber-950 dark:text-amber-200">
                          ชุดงานพิเศษปิดร้าน (Special Store Closing Tasks / 4 รายการ)
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-amber-950 shadow-2xs">
                          0 Points • ไม่มีคะแนน
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40">
                          🔗 แชร์ร่วมระดับสาขา
                        </span>
                      </div>
                      <p className="text-xs text-amber-900/80 dark:text-amber-300/80 mt-0.5">
                        4 รายการความปลอดภัย: 1) ปิดไฟ 2) ปิดไฟตู้แช่ 3) ปิดแอร์ 4) ล็อคประตูร้าน (ผู้จัดการหรือผู้ช่วยผู้จัดการคนใดคนหนึ่งตรวจแล้ว ซิงค์สถานะทั้งสาขาทันที)
                      </p>
                    </div>
                  </div>

                  {/* Section Progress Counter */}
                  <div className="flex items-center gap-2.5 bg-amber-500/15 px-3 py-1.5 rounded-xl border border-amber-500/30 self-start sm:self-center">
                    <div className="w-20 bg-amber-200 dark:bg-amber-950 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${overallPct}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono font-bold text-amber-950 dark:text-amber-200">
                      {doneCount}/{totalCount} ({overallPct}%)
                    </span>
                  </div>
                </div>

                {/* Closing Tasks Items List */}
                <div className="grid grid-cols-1 gap-2.5">
                  {filteredActiveTasks.map((item, idx) => {
                    const isDone = Boolean(item.completedAt);
                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 sm:p-4 rounded-xl border-2 transition-all ${isDone
                          ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/40"
                          : "bg-[var(--color-surface)] border-amber-400/60 shadow-xs hover:border-amber-500"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => void handleToggleItem(item.id)}
                            className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer shrink-0 ${isDone
                              ? "bg-emerald-600 border-emerald-600 text-white shadow-2xs"
                              : "border-amber-500 hover:bg-amber-500/20 text-transparent"
                            }`}
                            title={isDone ? "คลิกเพื่อยกเลิกการตรวจ" : "คลิกเพื่อยืนยันการตรวจ"}
                            aria-label={`${item.label} (${isDone ? "ตรวจแล้ว" : "ยังไม่ตรวจ"})`}
                          >
                            <svg
                              className={`w-3.5 h-3.5 stroke-[3] transition-transform ${isDone ? "scale-100 text-white" : "scale-0"}`}
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 mb-1">
                              <span className="font-mono text-xs font-bold text-amber-900 dark:text-amber-300">
                                #{idx + 1}
                              </span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-400 text-amber-950 shadow-2xs">
                                🛡️ งานพิเศษปิดร้าน
                              </span>
                              {item.category && (
                                <span className="text-[11px] font-medium text-amber-900 dark:text-amber-200 bg-amber-100/60 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-300">
                                  {item.category}
                                </span>
                              )}
                            </div>

                            <p
                              className={`text-xs sm:text-sm font-bold transition-all cursor-pointer ${isDone
                                ? "line-through text-[var(--color-text-muted)] font-normal"
                                : "text-[var(--color-text)]"
                              }`}
                              onClick={() => void handleToggleItem(item.id)}
                            >
                              {item.label}
                            </p>

                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                              {isDone ? (
                                <span className="text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1">
                                  <CheckCheck size={14} />
                                  <span>✓ ตรวจเรียบร้อยเมื่อ {fmtTime(item.completedAt!)} น.</span>
                                  {item.completedByName && (
                                    <span className="text-[var(--color-text-muted)] font-normal">
                                      (บันทึกโดย: {item.completedByName})
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                  <span>รอดำเนินการตรวจความปลอดภัยปิดร้าน</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* ─── TAB: MORNING OR AFTERNOON ROUTINE TASKS ───────────────────── */
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-800 dark:text-amber-300 flex items-center justify-center font-bold text-base shrink-0">
                      {selectedTaskShiftTab === "morning" ? "☀️" : "📦"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm sm:text-base font-bold text-[var(--color-text)]">
                          {selectedTaskShiftTab === "morning"
                            ? "งานประจำกะเช้า (Morning Shift Tasks)"
                            : "งานประจำกะบ่าย (Afternoon Shift Routine Tasks)"}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-950 border border-amber-300">
                          มีคะแนน • Regular KPI
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        {selectedTaskShiftTab === "morning"
                          ? "ขั้นตอนการปฏิบัติงานของผู้ช่วยผู้จัดการร้านประจำกะเช้า (เปิดร้าน, ตรวจสอบความพร้อม)"
                          : "ขั้นตอนการปฏิบัติงานของผู้ช่วยผู้จัดการร้านประจำกะบ่าย (ตรวจนับเงินทอน, เช็คสินค้า, ความเรียบร้อย)"}
                      </p>
                    </div>
                  </div>

                  {/* Section Progress Counter */}
                  <div className="flex items-center gap-2.5 bg-[var(--color-surface-2)] px-3 py-1.5 rounded-xl border border-[var(--color-border)] self-start sm:self-center">
                    <div className="w-20 bg-[var(--color-border)] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${overallPct}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono font-bold text-[var(--color-text)]">
                      {doneCount}/{totalCount}
                    </span>
                  </div>
                </div>

                {/* Routine Task Items List */}
                <div className="grid grid-cols-1 gap-2.5">
                  {filteredActiveTasks.map((item, idx) => {
                    const isDone = Boolean(item.completedAt);
                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 sm:p-4 rounded-xl border transition-all ${isDone
                          ? "bg-[var(--color-surface-2)]/40 border-[var(--color-border)] opacity-85"
                          : "bg-[var(--color-surface)] border-[var(--color-border)] shadow-2xs hover:border-amber-400"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => void handleToggleItem(item.id)}
                            className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer shrink-0 ${isDone
                              ? "bg-emerald-600 border-emerald-600 text-white shadow-2xs"
                              : "border-[var(--color-border)] hover:border-amber-500 text-transparent"
                            }`}
                            title={isDone ? "คลิกเพื่อยกเลิกการตรวจ" : "คลิกเพื่อยืนยันการตรวจ"}
                            aria-label={`${item.label} (${isDone ? "ตรวจแล้ว" : "ยังไม่ตรวจ"})`}
                          >
                            <svg
                              className={`w-3.5 h-3.5 stroke-[3] transition-transform ${isDone ? "scale-100 text-white" : "scale-0"}`}
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 mb-1">
                              <span className="font-mono text-xs font-bold text-[var(--color-text-muted)]">
                                #{idx + 1}
                              </span>
                              {item.category && (
                                <span className="text-[11px] font-medium text-[var(--color-text-muted)] bg-[var(--color-surface-2)] px-2 py-0.5 rounded-md border border-[var(--color-border)]">
                                  {item.category}
                                </span>
                              )}
                            </div>

                            <p
                              className={`text-xs sm:text-sm font-semibold transition-all cursor-pointer ${isDone
                                ? "line-through text-[var(--color-text-muted)] font-normal"
                                : "text-[var(--color-text)]"
                              }`}
                              onClick={() => void handleToggleItem(item.id)}
                            >
                              {item.label}
                            </p>

                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
                              {isDone ? (
                                <span className="text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1">
                                  <CheckCheck size={14} />
                                  <span>ตรวจแล้วเมื่อ {fmtTime(item.completedAt!)} น.</span>
                                  {item.completedByName && (
                                    <span className="text-[var(--color-text-muted)] font-normal">
                                      โดย {item.completedByName}
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-amber-800 dark:text-amber-300 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                  <span>รอดำเนินการตรวจสอบ</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB 2: APPROVALS QUEUE (ตรวจรับรองกะส่งมอบพนักงาน)
        ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "approvals" && (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-6 shadow-sm space-y-5 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)] flex items-center gap-2">
                  <ClipboardCheck size={20} className="text-amber-600 shrink-0" />
                  <span>คิวรับรองกะงานพนักงาน ({sessions.length})</span>
                </h2>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {isAssistant
                    ? "ผู้ช่วยผู้จัดการร้านลงนามรับรองเบื้องต้น (Assistant Sign-off) ก่อนส่งมอบให้ผู้จัดการร้าน"
                    : "ผู้จัดการร้านตรวจสอบและอนุมัติขั้นสุดท้าย (Manager Final Approval)"}
                </p>
              </div>

              {/* Status Filter */}
              <div className="inline-flex items-center bg-[var(--color-surface-2)] p-1 rounded-xl border border-[var(--color-border)] self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setShiftQueueStatusFilter("all")}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${shiftQueueStatusFilter === "all" ? "bg-[var(--color-brown)] text-amber-100 font-bold" : "text-[var(--color-text-muted)]"}`}
                >
                  ทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={() => setShiftQueueStatusFilter("pending")}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${shiftQueueStatusFilter === "pending" ? "bg-amber-400 text-amber-950 font-bold" : "text-[var(--color-text-muted)]"}`}
                >
                  รอรับรอง ({pendingApprovalsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setShiftQueueStatusFilter("approved")}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${shiftQueueStatusFilter === "approved" ? "bg-[var(--color-brown)] text-amber-100 font-bold" : "text-[var(--color-text-muted)]"}`}
                >
                  รับรองแล้ว
                </button>
              </div>
            </div>

            {/* List of Sessions */}
            {sessions.length === 0 ? (
              <div className="py-12 text-center text-[var(--color-text-muted)] text-xs border border-dashed border-[var(--color-border)] rounded-2xl bg-[var(--color-surface-2)]/40 p-6">
                ยังไม่มีข้อมูลกะการทำงานของพนักงานในวันนี้
              </div>
            ) : (
              <div className="space-y-3">
                {sessions
                  .filter((s) => {
                    const app = approvals[s.id] || {};
                    const isTargetAssistant = s.taskRole === "manager_assistant" || s.userPosition === "ผู้ช่วยผู้จัดการร้าน";
                    const isPending = isAssistant
                      ? !isTargetAssistant && !app.assistantApproved
                      : !app.managerApproved;
                    if (shiftQueueStatusFilter === "pending") return isPending;
                    if (shiftQueueStatusFilter === "approved") return !isPending;
                    return true;
                  })
                  .map((sess) => {
                    const app = approvals[sess.id] || {};
                    const isTargetAssistant = sess.taskRole === "manager_assistant" || sess.userPosition === "ผู้ช่วยผู้จัดการร้าน";
                    const isFullyApproved = Boolean(app.managerApproved);
                    const isAssistantApproved = Boolean(app.assistantApproved);
                    const doneItems = sess.items.filter((i) => i.completedAt).length;

                    return (
                      <div
                        key={sess.id}
                        className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xs hover:border-amber-400 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-[var(--color-text)]">
                              {sess.userName}
                            </span>
                            {sess.userPosition && (
                              <Badge color="muted">{sess.userPosition}</Badge>
                            )}
                            {getShiftBadge(sess.shift)}
                            <Badge color={doneItems === sess.items.length ? "green" : "amber"}>
                              {doneItems}/{sess.items.length} รายการ
                            </Badge>
                          </div>
                          <p className="text-[11px] text-[var(--color-text-muted)]">
                            เริ่ม {fmtTime(sess.startedAt)} น. {sess.completedAt ? `• เสร็จสิ้น ${fmtTime(sess.completedAt)} น.` : "• กำลังปฏิบัติงาน"}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setSelectedSession(sess)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--color-surface-2)] text-[var(--color-text)] hover:bg-[var(--color-border)] transition-colors cursor-pointer"
                          >
                            ดูรายละเอียด
                          </button>

                          {/* Assistant sign-off */}
                          {isAssistant && !isTargetAssistant && (
                            <button
                              type="button"
                              onClick={() => void handleApproveSession(sess.id, "assistant")}
                              disabled={isAssistantApproved}
                              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${isAssistantApproved
                                ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                : "bg-amber-400 text-amber-950 hover:bg-amber-300 shadow-2xs"
                              }`}
                            >
                              {isAssistantApproved ? "✓ ผู้ช่วยฯ รับรองแล้ว" : "ลงนามรับรอง (ผู้ช่วยฯ)"}
                            </button>
                          )}

                          {/* Manager final approval */}
                          {isManager && (
                            <button
                              type="button"
                              onClick={() => void handleApproveSession(sess.id, "manager")}
                              disabled={isFullyApproved}
                              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${isFullyApproved
                                ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                : "bg-amber-600 hover:bg-amber-700 text-white shadow-2xs"
                              }`}
                            >
                              {isFullyApproved ? "✓ อนุมัติขั้นสุดท้ายแล้ว" : "อนุมัติขั้นสุดท้าย (ผู้จัดการ)"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB 3: HISTORY & AUDIT LOGS
        ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "history" && (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-6 shadow-sm space-y-5 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)] flex items-center gap-2">
                  <History size={20} className="text-amber-600 shrink-0" />
                  <span>ประวัติการตรวจกะย้อนหลัง ({historySessions.length})</span>
                </h2>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  แสดงข้อมูลบันทึกผลการปฏิบัติงานและการส่งมอบกะย้อนหลัง 14 วัน
                </p>
              </div>

              {/* Shift Filter */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="ค้นหาชื่อหรือตำแหน่ง..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {isLoadingHistory ? (
              <div className="py-16 text-center text-[var(--color-text-muted)] text-xs flex flex-col items-center justify-center gap-2">
                <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <span>กำลังโหลดประวัติย้อนหลัง...</span>
              </div>
            ) : historySessions.length === 0 ? (
              <div className="py-12 text-center text-[var(--color-text-muted)] text-xs border border-dashed border-[var(--color-border)] rounded-2xl bg-[var(--color-surface-2)]/40 p-6">
                ยังไม่มีข้อมูลประวัติการตรวจกะย้อนหลังในระบบ
              </div>
            ) : (
              <div className="space-y-2.5">
                {historySessions
                  .filter((s) => {
                    const matches =
                      s.userName.toLowerCase().includes(historySearch.toLowerCase()) ||
                      (s.userPosition || "").toLowerCase().includes(historySearch.toLowerCase());
                    const shiftMatch = historyShiftFilter === "all" || s.shift === historyShiftFilter;
                    return matches && shiftMatch;
                  })
                  .map((sess) => (
                    <button
                      key={sess.id}
                      type="button"
                      onClick={() => setSelectedSession(sess)}
                      className="w-full text-left p-3.5 sm:p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)]/50 hover:border-amber-400 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-[var(--color-text)]">{sess.userName}</span>
                          {sess.userPosition && <Badge color="muted">{sess.userPosition}</Badge>}
                          {getShiftBadge(sess.shift)}
                          <Badge color="muted">
                            {sess.items.filter((i) => i.completedAt).length}/{sess.items.length} รายการ
                          </Badge>
                        </div>
                        <p className="text-[11px] font-mono text-[var(--color-text-muted)]">
                          เริ่ม {fmtTime(sess.startedAt)} น. {sess.completedAt ? `→ เสร็จ ${fmtTime(sess.completedAt)} น.` : ""}
                        </p>
                      </div>

                      <span className="text-xs text-amber-700 dark:text-amber-300 font-bold flex items-center gap-1 shrink-0">
                        <span>ดูผลตรวจ</span>
                        <ChevronRight size={14} />
                      </span>
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Team Leaderboard Widget */}
        <ErrorBoundary fallbackTitle="ไม่สามารถโหลดข้อมูลอันดับผลงานได้">
          <LeaderboardWidget branchId={user.branchId} />
        </ErrorBoundary>
      </main>

      {/* Late Reason Modal */}
      <LateReasonModal
        isOpen={Boolean(lateModalTarget)}
        taskLabel={lateModalTarget?.label || ""}
        deadlineText={lateModalTarget?.deadlineText}
        onSubmit={handleLateSubmit}
        onCancel={() => setLateModalTarget(null)}
      />

      {/* Session Detail Modal */}
      <SessionDetailModal
        session={selectedSession}
        onClose={() => setSelectedSession(null)}
        reviewerId={user.id}
        canReviewIncomplete={isManager}
      />
    </div>
  );
}
