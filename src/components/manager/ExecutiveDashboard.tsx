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
  approveShiftSessionAction,
  ManagerShiftSummary,
} from "../../actions/manager";
import {
  getOrCreateShiftSessionAction,
  toggleTaskWorkAction,
  resetTodayChecklistDataAction,
} from "../../actions/checklist";
import { RefrigeratorConfigView } from "./RefrigeratorConfigView";
import { NotificationCenter } from "../common/NotificationCenter";
import { ThemeToggle } from "../common/ThemeToggle";
import { NavbarRefreshControl } from "../common/NavbarRefreshControl";
import { invalidateBranchCache } from "../../utils/cache";
import { LeaderboardWidget } from "./LeaderboardWidget";
import { ErrorBoundary } from "../common/ErrorBoundary";
import { ClipboardCheck, ShieldCheck, Building2, Award, Snowflake, History, CheckCircle2, AlertCircle, LogOut } from "lucide-react";
import { LateReasonModal } from "../common/LateReasonModal";

export type ExecutiveRole = "manager_assistant" | "manager" | "committee" | "general_manager";

export function ExecutiveDashboard({
  user,
  onLogout,
  activeSession,
  onStartChecklist,
  onUpdateSession,
  onEndShift,
  onOpenChecklistPage,
}: {
  user: User;
  onLogout: () => void;
  activeSession: ShiftSession | null;
  onStartChecklist: (shift: ShiftType) => void;
  onUpdateSession: (session: ShiftSession) => void;
  onEndShift: () => void;
  onOpenChecklistPage: () => void;
}) {
  // Determine role directly from logged-in user account
  const currentRole: ExecutiveRole = useMemo(() => {
    if (user.role === "general_manager" || user.position?.includes("ผู้จัดการทั่วไป")) return "general_manager";
    if (user.role === "committee" || user.position?.includes("กรรมการ")) return "committee";
    if (user.role === "manager_assistant" || user.position?.includes("ผู้ช่วย")) return "manager_assistant";
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

  // Checklist for Assistant Manager self-check (connected to Supabase)
  const [myChecklistShift, setMyChecklistShift] = useState<ShiftType>("morning");
  const [myChecklistItems, setMyChecklistItems] = useState<ChecklistItem[]>([]);
  const [myChecklistFilter, setMyChecklistFilter] = useState<"all" | "pending" | "completed">("all");
  const [assistantSession, setAssistantSession] = useState<ShiftSession | null>(null);
  const [isLoadingChecklist, setIsLoadingChecklist] = useState(false);

  // Navigation tab
  type DashboardTab = "overview" | "checklist" | "history" | "refrigerator";
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");

  // Load live shift sessions from Supabase DB
  const loadDbSessions = useCallback(async (isManual = false) => {
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

            return {
              id: `notif-${s.id}`,
              title: `รายงานการส่งงาน: ${s.userName}`,
              message: `${s.userPosition || "พนักงาน"} ส่งงานกะ ${s.shift}`,
              type: "shift_submitted",
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

    // Auto-refresh from Supabase DB every 6 seconds (paused if tab is backgrounded)
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      loadDbSessions();
    }, 6000);

    return () => clearInterval(interval);
  }, [loadDbSessions]);

  // Load history metadata
  const loadHistorySessions = useCallback(async () => {
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

  // Load assistant manager checklist directly from Supabase DB
  const loadAssistantChecklist = useCallback(async (shift: ShiftType, isSilent = false) => {
    if (currentRole !== "manager_assistant") return;
    try {
      if (!isSilent) setIsLoadingChecklist(true);
      const res = await getOrCreateShiftSessionAction({
        userId: user.id,
        userName: user.name,
        position: "ผู้ช่วยผู้จัดการร้าน",
        shift: shift,
      });
      if (res.success && res.session) {
        setAssistantSession(res.session);
        setMyChecklistItems((prev) => {
          const fresh = res.session!.items || [];
          const curSig = prev.map((i) => `${i.id}:${i.label}:${i.category}`).join("|");
          const freshSig = fresh.map((i) => `${i.id}:${i.label}:${i.category}`).join("|");
          if (curSig !== freshSig || prev.length === 0) {
            return fresh.map((f) => {
              const local = prev.find((p) => p.id === f.id);
              if (local && local.completedAt && !f.completedAt) {
                return { ...f, completedAt: local.completedAt, comment: local.comment, isLate: local.isLate };
              }
              return f;
            });
          }
          return prev;
        });
      }
    } catch (err) {
      console.error("Failed to load assistant checklist from DB:", err);
    } finally {
      if (!isSilent) setIsLoadingChecklist(false);
    }
  }, [currentRole, user]);

  useEffect(() => {
    if (currentRole === "manager_assistant") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAssistantChecklist(myChecklistShift);

      const interval = setInterval(() => {
        if (typeof document !== "undefined" && document.hidden) return;
        void loadAssistantChecklist(myChecklistShift, true);
      }, 6000);

      return () => clearInterval(interval);
    } else {
      setAssistantSession(null);
      setMyChecklistItems([]);
      if (activeTab === "checklist") {
        setActiveTab("overview");
      }
    }
  }, [currentRole, myChecklistShift, loadAssistantChecklist, activeTab]);

  const handleNavbarRefresh = useCallback(async () => {
    try {
      setIsNavbarRefreshing(true);
      await Promise.all([
        loadDbSessions(true),
        currentRole === "manager_assistant" ? loadAssistantChecklist(myChecklistShift, false) : Promise.resolve(),
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
  }, [loadDbSessions, currentRole, loadAssistantChecklist, myChecklistShift, activeTab, loadHistorySessions]);

  const handleNavbarRefreshFromDb = useCallback(async () => {
    try {
      setIsNavbarDbRefreshing(true);
      invalidateBranchCache();
      await Promise.all([
        loadDbSessions(true),
        currentRole === "manager_assistant" ? loadAssistantChecklist(myChecklistShift, false) : Promise.resolve(),
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
  }, [loadDbSessions, currentRole, loadAssistantChecklist, myChecklistShift, activeTab, loadHistorySessions]);

  // Role metadata configurations
  const roleConfig = {
    manager_assistant: {
      title: "ผู้ช่วยผู้จัดการร้าน (Assistant Manager)",
      badge: "bg-amber-100 text-amber-950 border-amber-300 font-bold shadow-2xs",
      description: "ตรวจสอบความเรียบร้อยหน้างาน รับรองกะพนักงานเบื้องต้น และรายงานสรุป",
      primaryDuty: "ตรวจรับรองกะงานพนักงาน (Morning / Afternoon Sign-off)",
      Icon: ClipboardCheck,
    },
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
    const isAssistantSession = s.taskRole === "manager_assistant" || s.userPosition === "ผู้ช่วยผู้จัดการร้าน";
    if (currentRole === "manager_assistant") {
      // Assistant manager cannot approve tasks from assistant manager
      if (isAssistantSession) return false;
      return !app?.assistantApproved;
    }
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

  async function handleApproveSession(sessionId: string, type: "assistant" | "manager") {
    // Check if target session is from assistant manager
    const target = sessions.find((s) => s.id === sessionId);
    const isAssistantSession =
      target?.taskRole === "manager_assistant" || target?.userPosition === "ผู้ช่วยผู้จัดการร้าน";

    if (isAssistantSession && currentRole === "manager_assistant") {
      showToast("เฉพาะผู้จัดการร้านหรือกรรมการบริหารเท่านั้นที่สามารถอนุมัติงานของผู้ช่วยผู้จัดการร้านได้");
      return;
    }

    // Optimistic UI update
    setApprovals((prev) => {
      const isMgr = type !== "assistant";
      return {
        ...prev,
        [sessionId]: {
          ...prev[sessionId],
          assistantApproved: true,
          managerApproved: isMgr ? true : Boolean(prev[sessionId]?.managerApproved ?? false),
        },
      };
    });

    try {
      const roleForDb =
        type === "assistant"
          ? "manager_assistant"
          : (currentRole === "committee" || currentRole === "general_manager")
            ? currentRole
            : "manager";

      const res = await approveShiftSessionAction({
        shiftSessionId: sessionId,
        role: roleForDb,
      });

      if (res.success) {
        showToast(
          type === "assistant"
            ? "บันทึกการรับรองกะโดยผู้ช่วยผู้จัดการลงฐานข้อมูลเรียบร้อยแล้ว ✓"
            : (currentRole === "committee" || currentRole === "general_manager")
              ? `รับรองผลการตรวจงานโดย${roleConfig.title}ลงฐานข้อมูลเรียบร้อยแล้ว ✓`
              : "อนุมัติกะโดยผู้จัดการร้านลงฐานข้อมูลเรียบร้อยแล้ว ✓"
        );
        await loadDbSessions();
      } else {
        showToast(res.error || "บันทึกในระบบเบื้องต้นแล้ว (Local)");
      }
    } catch {
      showToast("บันทึกในระบบเบื้องต้นแล้ว (Local)");
    }
  }

  const [lateModalTarget, setLateModalTarget] = useState<{
    id: string;
    label: string;
    deadlineText?: string;
  } | null>(null);

  async function executeToggleMyItem(itemId: string, willBeDone: boolean, comment?: string) {
    const newCompletedAt = willBeDone ? new Date().toISOString() : null;
    const item = myChecklistItems.find((i) => i.id === itemId);

    // Optimistic UI update
    setMyChecklistItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? {
            ...i,
            completedAt: newCompletedAt,
            comment: willBeDone ? (comment ?? i.comment) : null,
            isLate: willBeDone ? (comment ? true : i.isLate) : false,
          }
          : i
      )
    );

    // Persist to Supabase database
    try {
      await toggleTaskWorkAction({
        shiftSessionId: assistantSession?.id,
        taskId: itemId,
        taskWorkId: item?.taskWorkId,
        completed: willBeDone,
        comment: willBeDone ? (comment || undefined) : undefined,
      });
      // Refresh live shift sessions in background
      loadDbSessions();
    } catch (err) {
      console.error("Failed to toggle assistant task work in DB:", err);
    }
  }

  function handleAssistantLateSubmit(reason: string) {
    if (!lateModalTarget) return;
    executeToggleMyItem(lateModalTarget.id, true, reason);
    setLateModalTarget(null);
  }

  async function handleToggleMyItem(itemId: string) {
    const item = myChecklistItems.find((i) => i.id === itemId);
    if (!item) return;

    if (item.completedAt) {
      // Unchecking task
      await executeToggleMyItem(itemId, false);
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

    await executeToggleMyItem(itemId, true);
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
      if (currentRole === "manager_assistant") {
        await loadAssistantChecklist(myChecklistShift);
      }
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
    const isAssistantSession = s.taskRole === "manager_assistant" || s.userPosition === "ผู้ช่วยผู้จัดการร้าน";
    const isPending = currentRole === "manager_assistant"
      ? (!isAssistantSession && !app.assistantApproved && !app.managerApproved)
      : !app.managerApproved;

    if (historyStatusFilter === "pending") return isPending;
    if (historyStatusFilter === "approved") {
      return currentRole === "manager_assistant"
        ? (!!app.assistantApproved || !!app.managerApproved)
        : !!app.managerApproved;
    }
    return true;
  });

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

          <div className="flex items-center gap-2.5 z-10 flex-wrap sm:flex-nowrap">
            {currentRole === "manager_assistant" && (
              <button
                type="button"
                onClick={() => setActiveTab("checklist")}
                className="px-4 py-2.5 bg-[var(--color-brown)] hover:bg-[var(--color-brown-light)] active:bg-black text-amber-100 text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                <span>ตรวจเช็คลิสต์ประจำกะ →</span>
              </button>
            )}
          </div>
        </header>

        {/* ─── Navigation Tabs (Tailored to Executive & Operations) ──────────── */}
        <div className="bg-[var(--color-surface-2)] p-1.5 rounded-2xl border border-[var(--color-border)] shadow-2xs">
          <div className={`grid ${currentRole === "manager_assistant" ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"} gap-1`}>
            {[
              {
                id: "overview" as DashboardTab,
                label: "ภาพรวมและการรับรองกะ",
                Icon: ClipboardCheck,
                desc: "ตรวจรับรองกะและแจ้งเตือน",
              },
              ...(currentRole === "manager_assistant"
                ? [
                  {
                    id: "checklist" as DashboardTab,
                    label: "เช็คลิสต์ตรวจงานของฉัน",
                    Icon: CheckCircle2,
                    desc: "บันทึกเช็คลิสต์ประจำกะ",
                  },
                ]
                : []),
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

        {/* ─── TAB 1: OVERVIEW & LIVE SHIFT APPROVALS ──────────────────────────── */}
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

              {/* Card 3: Direct Approval Action Callout */}
              <div
                onClick={() => {
                  if (pendingApprovalsCount > 0) {
                    setShiftQueueStatusFilter((prev) => (prev === "pending" ? "all" : "pending"));
                  }
                }}
                className={`rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4 transition-all ${pendingApprovalsCount > 0
                    ? `cursor-pointer group hover:shadow-md border ${shiftQueueStatusFilter === "pending"
                      ? "bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 ring-2 ring-amber-400/30"
                      : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-amber-400"
                    }`
                    : "bg-[var(--color-surface)] border border-[var(--color-border)]"
                  }`}
                title={pendingApprovalsCount > 0 ? "คลิกเพื่อกรองเฉพาะกะที่รอดำเนินการรับรอง" : undefined}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${pendingApprovalsCount > 0 ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} aria-hidden="true" />
                      <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                        สถานะการลงนามรับรอง
                      </span>
                    </div>
                    {pendingApprovalsCount > 0 && (
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full transition-colors flex items-center gap-1 ${shiftQueueStatusFilter === "pending"
                          ? "bg-amber-300 text-amber-950 dark:bg-amber-800 dark:text-amber-100"
                          : "text-amber-950 bg-amber-100 dark:bg-amber-950 dark:text-amber-200 group-hover:bg-amber-200 border border-amber-300 dark:border-amber-800"
                        }`}>
                        <span>{shiftQueueStatusFilter === "pending" ? "✓ กำลังกรองกะค้าง" : "คลิกเพื่อกรอง"}</span>
                        <span>→</span>
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    {pendingApprovalsCount > 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-950 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 px-3 py-1.5 rounded-full shadow-2xs">
                        <AlertCircle size={14} className="text-amber-700 dark:text-amber-400" />
                        <span>ค้างรับรอง {pendingApprovalsCount} กะ</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-900 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 px-3 py-1.5 rounded-full shadow-2xs">
                        <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
                        <span>✨ รับรองครบถ้วนทุกกะ — มาตรฐาน 100%</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="pt-3 border-t border-[var(--color-border-subtle)]">
                  <p className="text-xs text-[var(--color-text-muted)] font-medium">
                    {pendingApprovalsCount > 0
                      ? shiftQueueStatusFilter === "pending"
                        ? "กำลังแสดงเฉพาะกะที่รอดำเนินการ (คลิกการ์ดนี้เพื่อดูทั้งหมด)"
                        : "คลิกเพื่อกรองดูเฉพาะกะที่รอการตรวจรับรองทันที"
                      : "สาขาพร้อมเปิดทำการเต็มมาตรฐาน รับรองครบทุกกะงานแล้ว"}
                  </p>
                </div>
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
                      <span>รายการกะงานสาขา & การรับรองกะ</span>
                    </h3>
                    {isLiveFromDb && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-950 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                        <span>Supabase Live DB</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    ตรวจสอบความเรียบร้อยของรายการเช็คลิสต์และกดรับรองกะงาน
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
                const sessionsForRole = sessions.filter((sess) => {
                  if (currentRole === "manager_assistant") {
                    return !(sess.taskRole === "manager_assistant" || sess.userPosition === "ผู้ช่วยผู้จัดการร้าน");
                  }
                  return true;
                });
                const pendingCount = sessionsForRole.filter((s) => {
                  const app = approvals[s.id] || {};
                  const isAssistantSession = s.taskRole === "manager_assistant" || s.userPosition === "ผู้ช่วยผู้จัดการร้าน";
                  if (currentRole === "manager_assistant") {
                    if (isAssistantSession) return false;
                    return !app.assistantApproved && !app.managerApproved;
                  }
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
                const sessionsForRole = sessions.filter((sess) => {
                  if (currentRole === "manager_assistant") {
                    return !(sess.taskRole === "manager_assistant" || sess.userPosition === "ผู้ช่วยผู้จัดการร้าน");
                  }
                  return true;
                });

                const filteredSessions = sessionsForRole
                  .filter((sess) => {
                    if (shiftQueueTimeFilter !== "all" && sess.shift !== shiftQueueTimeFilter) return false;
                    const app = approvals[sess.id] || {};
                    const isAssistantSession =
                      sess.taskRole === "manager_assistant" || sess.userPosition === "ผู้ช่วยผู้จัดการร้าน";
                    const isPending = currentRole === "manager_assistant"
                      ? (!isAssistantSession && !app.assistantApproved && !app.managerApproved)
                      : !app.managerApproved;

                    if (shiftQueueStatusFilter === "pending") return isPending;
                    if (shiftQueueStatusFilter === "approved") {
                      return currentRole === "manager_assistant"
                        ? (!!app.assistantApproved || !!app.managerApproved)
                        : !!app.managerApproved;
                    }
                    return true;
                  })
                  .sort((a, b) => {
                    const aApp = approvals[a.id] || {};
                    const bApp = approvals[b.id] || {};
                    const aPending = currentRole === "manager_assistant"
                      ? (!aApp.assistantApproved && !aApp.managerApproved)
                      : !aApp.managerApproved;
                    const bPending = currentRole === "manager_assistant"
                      ? (!bApp.assistantApproved && !bApp.managerApproved)
                      : !bApp.managerApproved;
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

                            {/* Status & Action */}
                            {(() => {
                              const app = approvals[sess.id] || {};
                              const isAssistantSession =
                                sess.taskRole === "manager_assistant" || sess.userPosition === "ผู้ช่วยผู้จัดการร้าน";
                              const isPendingForMe = currentRole === "manager_assistant"
                                ? (!isAssistantSession && !app.assistantApproved && !app.managerApproved)
                                : !app.managerApproved;

                              return (
                                <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                                  <div className="min-w-0">{renderApprovalBadge(sess)}</div>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedSession(sess)}
                                    className={`min-h-[44px] px-4 py-2 shrink-0 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs inline-flex items-center gap-1.5 ${isPendingForMe
                                        ? "text-amber-950 bg-amber-400 hover:bg-amber-300 active:bg-amber-500"
                                        : "text-[var(--color-text)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-2)]/80 border border-[var(--color-border)]"
                                      }`}
                                  >
                                    <span>
                                      {isPendingForMe
                                        ? "ตรวจรับรอง"
                                        : currentRole === "manager_assistant" && app.assistantApproved && !app.managerApproved
                                          ? "รับรองแล้ว (รอผู้จัดการ)"
                                          : "ดูรายละเอียด"}
                                    </span>
                                    {isPendingForMe && <span>→</span>}
                                  </button>
                                </div>
                              );
                            })()}
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
                                  {(() => {
                                    const app = approvals[sess.id] || {};
                                    const isAssistantSession =
                                      sess.taskRole === "manager_assistant" || sess.userPosition === "ผู้ช่วยผู้จัดการร้าน";
                                    const isPendingForMe = currentRole === "manager_assistant"
                                      ? (!isAssistantSession && !app.assistantApproved && !app.managerApproved)
                                      : !app.managerApproved;

                                    return (
                                      <button
                                        type="button"
                                        onClick={() => setSelectedSession(sess)}
                                        className={`min-h-[44px] min-w-[44px] sm:min-h-[34px] sm:min-w-0 inline-flex items-center justify-center px-4 py-2 sm:px-3.5 sm:py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs whitespace-nowrap ${isPendingForMe
                                            ? "text-amber-950 bg-amber-400 hover:bg-amber-300 active:bg-amber-500"
                                            : "text-[var(--color-text)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-2)]/80 border border-[var(--color-border)]"
                                          }`}
                                      >
                                        {isPendingForMe
                                          ? "ตรวจรับรอง →"
                                          : currentRole === "manager_assistant" && app.assistantApproved && !app.managerApproved
                                            ? "รับรองแล้ว (รอผู้จัดการ)"
                                            : "ดูรายละเอียด"}
                                      </button>
                                    );
                                  })()}
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
                              {isCompleted ? "ส่งเมื่อ" : "บันทึกล่าสุด"} {fmtTime(notif.completedAt || notif.createdAt)}
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

        {/* ─── TAB 2: MY CHECKLIST (ASSISTANT MANAGER ONLY) ─────────────────── */}
        {activeTab === "checklist" && currentRole === "manager_assistant" && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
              {/* Header: Title, Description & Shift Toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[var(--color-text)] flex items-center gap-2">
                    <roleConfig.Icon size={18} className="text-amber-700 shrink-0" />
                    <span>เช็คลิสต์ตรวจงานประจำกะ</span>
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    บันทึกผลการตรวจสอบขั้นตอนการปฏิบัติงานของผู้ช่วยผู้จัดการร้าน
                  </p>
                </div>

                {/* Shift Selector */}
                <div className="inline-flex items-center self-start sm:self-auto bg-[var(--color-surface-2)] p-1 rounded-xl border border-[var(--color-border)]">
                  {(["morning", "afternoon"] as ShiftType[]).map((sh) => (
                    <button
                      key={sh}
                      type="button"
                      onClick={() => {
                        setMyChecklistShift(sh);
                        loadAssistantChecklist(sh);
                      }}
                      className={`min-h-[36px] px-3.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${myChecklistShift === sh
                          ? "bg-[var(--color-brown)] text-amber-100 shadow-2xs font-bold"
                          : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                        }`}
                    >
                      {sh === "morning" ? "กะเช้า" : "กะบ่าย"}
                    </button>
                  ))}
                </div>
              </div>

              {isLoadingChecklist ? (
                <div className="py-12 text-center text-[var(--color-text-muted)] text-xs flex flex-col items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  <span>กำลังดึงรายการเช็คลิสต์จากฐานข้อมูล...</span>
                </div>
              ) : (
                <>
                  {/* Distilled Toolbar: Task Status Filters & Compact Progress Meter */}
                  {(() => {
                    const doneCount = myChecklistItems.filter((i) => i.completedAt).length;
                    const totalCount = myChecklistItems.length;
                    const pendingCount = totalCount - doneCount;
                    const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

                    return (
                      <div className="space-y-3">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[var(--color-surface-2)]/60 p-2.5 sm:p-3 rounded-xl border border-[var(--color-border)]">
                          {/* Filter Tabs */}
                          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                            <button
                              type="button"
                              onClick={() => setMyChecklistFilter("all")}
                              className={`min-h-[40px] px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${myChecklistFilter === "all"
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
                              className={`min-h-[40px] px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${myChecklistFilter === "pending"
                                  ? "bg-amber-400 text-amber-950 font-bold shadow-2xs"
                                  : pendingCount > 0
                                    ? "bg-amber-100 text-amber-950 border border-amber-300 hover:bg-amber-200/80 font-bold"
                                    : "bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)]"
                                }`}
                            >
                              <span>ยังไม่ตรวจ</span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-bold font-mono ${myChecklistFilter === "pending"
                                    ? "bg-amber-950 text-amber-200"
                                    : pendingCount > 0
                                      ? "bg-amber-400 text-amber-950"
                                      : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                                  }`}
                              >
                                {pendingCount}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setMyChecklistFilter("completed")}
                              className={`min-h-[40px] px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${myChecklistFilter === "completed"
                                  ? "bg-[var(--color-brown)] text-amber-100 shadow-2xs font-bold"
                                  : "bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)]"
                                }`}
                            >
                              <span>ตรวจแล้ว</span>
                              <span className="font-mono text-xs font-bold">({doneCount})</span>
                            </button>
                          </div>

                          {/* Slim Inline Progress Bar */}
                          <div className="flex items-center gap-3 md:min-w-[200px] justify-end">
                            <div className="flex-1 max-w-[140px] bg-[var(--color-border)] h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-amber-400 h-full rounded-full transition-all duration-300"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono font-bold text-[var(--color-text)] whitespace-nowrap">
                              {doneCount}/{totalCount} <span className="text-[var(--color-text-muted)] font-normal font-sans">({pct}%)</span>
                            </span>
                          </div>
                        </div>

                        {/* Checklist items list */}
                        {(() => {
                          const filteredItems = myChecklistItems.filter((item) => {
                            if (myChecklistFilter === "pending") return !item.completedAt;
                            if (myChecklistFilter === "completed") return !!item.completedAt;
                            return true;
                          });

                          if (totalCount === 0) {
                            return (
                              <div className="py-10 text-center text-[var(--color-text-muted)] text-xs border border-dashed border-[var(--color-border)] rounded-xl bg-[var(--color-surface-2)]/40 p-4">
                                ไม่พบรายการเช็คลิสต์ของตำแหน่งผู้ช่วยผู้จัดการร้านสำหรับกะนี้
                              </div>
                            );
                          }

                          if (filteredItems.length === 0) {
                            if (myChecklistFilter === "pending") {
                              return (
                                <div className="py-10 px-4 text-center rounded-2xl border border-emerald-200 bg-emerald-50/60 flex flex-col items-center justify-center gap-2.5">
                                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-emerald-950">
                                      ตรวจเช็คลิสต์ครบถ้วนทุกข้อแล้ว!
                                    </p>
                                    <p className="text-xs text-emerald-800 mt-0.5">
                                      ไม่มีงานที่ค้างตรวจสำหรับ{myChecklistShift === "morning" ? "กะเช้า" : "กะบ่าย"}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setMyChecklistFilter("completed")}
                                    className="mt-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                                  >
                                    ดูรายการที่ตรวจแล้ว ({doneCount})
                                  </button>
                                </div>
                              );
                            }

                            if (myChecklistFilter === "completed") {
                              return (
                                <div className="py-10 px-4 text-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)]/40 flex flex-col items-center justify-center gap-2">
                                  <div className="w-10 h-10 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)] flex items-center justify-center">
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <circle cx="12" cy="12" r="10" />
                                      <polyline points="12 6 12 12 14 14" />
                                    </svg>
                                  </div>
                                  <div>
                                    <p className="text-xs sm:text-sm font-semibold text-[var(--color-text)]">
                                      ยังไม่มีรายการที่ได้รับการตรวจเสร็จ
                                    </p>
                                    <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                                      เลือกแท็บ &quot;ยังไม่ตรวจ&quot; เพื่อเริ่มติ๊กตรวจสอบขั้นตอนการทำงาน
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setMyChecklistFilter("pending")}
                                    className="mt-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-400 text-amber-950 hover:bg-amber-500 transition-colors cursor-pointer"
                                  >
                                    ตรวจงานที่ค้างอยู่ ({pendingCount})
                                  </button>
                                </div>
                              );
                            }
                          }

                          return (
                            <div className="space-y-2">
                              {filteredItems.map((item, idx) => {
                                const isDone = !!item.completedAt;
                                return (
                                  <div
                                    key={item.id}
                                    role="checkbox"
                                    aria-checked={isDone}
                                    tabIndex={0}
                                    onClick={() => handleToggleMyItem(item.id)}
                                    onKeyDown={(e) => {
                                      if (e.key === " " || e.key === "Enter") {
                                        e.preventDefault();
                                        handleToggleMyItem(item.id);
                                      }
                                    }}
                                    className={`p-3 sm:p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all select-none min-h-[48px] focus:outline-hidden focus:ring-2 focus:ring-amber-500/50 ${isDone
                                        ? "bg-[var(--color-amber-glow)]/30 border-[var(--color-amber)]/40 hover:bg-[var(--color-amber-glow)]/50"
                                        : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-amber-400 hover:bg-[var(--color-surface-2)]/50"
                                      }`}
                                  >
                                    <div
                                      className={`w-5 h-5 rounded-md border flex items-center justify-center mt-0.5 shrink-0 transition-colors ${isDone
                                          ? "bg-amber-500 border-amber-500 text-white"
                                          : "border-[var(--color-border-strong)] bg-[var(--color-surface)]"
                                        }`}
                                    >
                                      {isDone && (
                                        <svg
                                          width="12"
                                          height="12"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="3"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        >
                                          <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                      )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="text-xs font-mono text-[var(--color-text-muted)]">
                                          {String(idx + 1).padStart(2, "0")}
                                        </span>
                                        {item.category && (
                                          <span className="text-xs font-semibold text-[var(--color-text)] bg-[var(--color-surface-2)] px-1.5 py-0.5 rounded border border-[var(--color-border)]">
                                            {item.category}
                                          </span>
                                        )}
                                      </div>
                                      <p
                                        className={`text-xs sm:text-sm font-medium mt-1 leading-snug ${isDone
                                            ? "text-[var(--color-text-muted)] line-through"
                                            : "text-[var(--color-text)]"
                                          }`}
                                      >
                                        {item.label}
                                      </p>
                                      {item.completedAt && (() => {
                                        let isLate = item.isLate ?? false;
                                        if (!isLate && item.category) {
                                          const match = item.category.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
                                          if (match) {
                                            const endStr = match[2];
                                            const [endHr, endMin] = endStr.split(":").map(Number);
                                            const completedDate = new Date(item.completedAt);
                                            const deadlineDate = new Date(); // use today
                                            deadlineDate.setHours(endHr, endMin, 0, 0);
                                            if (completedDate > deadlineDate) {
                                              isLate = true;
                                            }
                                          }
                                        }
                                        return (
                                          <div className="mt-1 flex flex-col gap-1">
                                            <p className="text-xs font-mono text-emerald-800 dark:text-emerald-300 font-semibold flex items-center gap-1">
                                              <span>บันทึกเมื่อ: {fmtTime(item.completedAt)}</span>
                                              {isLate && (
                                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-xs font-bold bg-amber-100 text-amber-950 border border-amber-300">
                                                  ล่าช้า
                                                </span>
                                              )}
                                            </p>
                                            {item.comment && (
                                              <div className="text-xs text-rose-900 dark:text-rose-300 bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-lg px-2.5 py-1 flex items-start gap-1 font-sans font-normal">
                                                <span className="font-semibold shrink-0">เหตุผล:</span>
                                                <span className="break-words">{item.comment}</span>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
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
              const baseHistoryForRole = activeHistorySource.filter((sess) => {
                if (currentRole === "manager_assistant") {
                  return !(sess.taskRole === "manager_assistant" || sess.userPosition === "ผู้ช่วยผู้จัดการร้าน");
                }
                return true;
              });

              const pendingHistoryCount = baseHistoryForRole.filter((s) => {
                const app = approvals[s.id] || {};
                const isAssistantSession = s.taskRole === "manager_assistant" || s.userPosition === "ผู้ช่วยผู้จัดการร้าน";
                if (currentRole === "manager_assistant") {
                  if (isAssistantSession) return false;
                  return !app.assistantApproved;
                }
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
              const visibleHistory = filteredHistory.filter((sess) => {
                if (currentRole === "manager_assistant") {
                  return !(sess.taskRole === "manager_assistant" || sess.userPosition === "ผู้ช่วยผู้จัดการร้าน");
                }
                return true;
              });

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

        const canApprove = isAssistantSess
          ? isMgrOrHigher && !approvals[selectedSession.id]?.managerApproved
          : currentRole === "manager_assistant"
            ? !approvals[selectedSession.id]?.assistantApproved && !approvals[selectedSession.id]?.managerApproved
            : !approvals[selectedSession.id]?.managerApproved;

        const isApproved = isAssistantSess
          ? !!approvals[selectedSession.id]?.managerApproved
          : currentRole === "manager_assistant"
            ? (!!approvals[selectedSession.id]?.assistantApproved || !!approvals[selectedSession.id]?.managerApproved)
            : !!approvals[selectedSession.id]?.managerApproved;

        const approveTitle = isAssistantSess
          ? (currentRole === "committee" || currentRole === "general_manager")
            ? roleConfig.title
            : "ผู้จัดการร้าน"
          : roleConfig.title;

        return (
          <SessionDetailModal
            session={selectedSession}
            onClose={() => setSelectedSession(null)}
            canApprove={canApprove}
            isApproved={isApproved}
            approveRoleTitle={approveTitle}
            onApprove={(sessId) => {
              handleApproveSession(
                sessId,
                isAssistantSess ? "manager" : currentRole === "manager_assistant" ? "assistant" : "manager"
              );
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

      {/* Late Reason Requirement Modal for Assistant Manager */}
      <LateReasonModal
        isOpen={Boolean(lateModalTarget)}
        taskLabel={lateModalTarget?.label || ""}
        deadlineText={lateModalTarget?.deadlineText}
        onSubmit={handleAssistantLateSubmit}
        onCancel={() => setLateModalTarget(null)}
      />
    </div>
  );
}
