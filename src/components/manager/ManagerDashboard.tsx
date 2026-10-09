import { useEffect, useMemo, useState, useCallback, useTransition, useRef } from "react";
import { Notification, ShiftSession, ShiftType, User, ChecklistItem } from "../../types";
import { fmtDate, fmtTime } from "../../data/storage";
import { Badge, getShiftBadge, getShiftName } from "../common/Badge";
import { BrandLogo } from "../common/BrandLogo";
import { SessionDetailModal } from "../admin/SessionDetailModal";
import {
  getManagerShiftSessionsAction,
  getHistoryShiftSessionsAction,
  approveShiftSessionAction,
} from "../../actions/manager";
import { executeResilientApproval, flushPendingApprovals } from "../../utils/sessionApprovalBuffer";
import {
  getOrCreateShiftSessionAction,
  toggleTaskWorkAction,
  resetTodayChecklistDataAction,
} from "../../actions/checklist";
import { NotificationCenter } from "../common/NotificationCenter";
import { ThemeToggle } from "../common/ThemeToggle";
import { RoleSwitcher } from "../common/RoleSwitcher";
import { NavbarRefreshControl } from "../common/NavbarRefreshControl";
import { invalidateBranchCache } from "../../utils/cache";
import { useTaskChecklistBuffer } from "../../utils/taskChecklistBuffer";
import { LeaderboardWidget } from "./LeaderboardWidget";
import { RefrigeratorConfigView } from "./RefrigeratorConfigView";
import { SubordinateHistoryAuditView } from "./history/SubordinateHistoryAuditView";
import { ErrorBoundary } from "../common/ErrorBoundary";
import { LateReasonModal } from "../common/LateReasonModal";
import { DbSyncNotification } from "../common/DbSyncNotification";
import { UserAvatar } from "../common/UserAvatar";
import { EditProfileModal } from "../common/EditProfileModal";
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
  Snowflake,
  Calendar,
  UserPen,
  Flame,
  Send,
  Sliders,
  UserCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";

import {
  getSpecialTasksAction,
  approveSpecialTaskAction,
} from "../../actions/specialTask";
import { SpecialTaskItem } from "../../types";

export function isSpecialClosingTask(item: ChecklistItem): boolean {
  return Boolean(item.forManagers || item.isSpecial || item.zeroPoints);
}

export function ManagerDashboard({
  user,
  onLogout,
  activeSession: _activeSession,
  onStartChecklist: _onStartChecklist,
  onUpdateSession: _onUpdateSession,
  onEndShift: _onEndShift,
  onOpenChecklistPage: _onOpenChecklistPage,
}: {
  user: User;
  onLogout: () => void;
  activeSession: ShiftSession | null;
  onStartChecklist: (shift: ShiftType) => void;
  onUpdateSession: (session: ShiftSession) => void;
  onEndShift: () => void;
  onOpenChecklistPage?: () => void;
}) {
  const isAssistant = user.role === "manager_assistant" || (user.position?.includes("ผู้ช่วย") ?? false);
  const isExecutive =
    !isAssistant &&
    (user.role === "general_manager" ||
      user.role === "committee" ||
      (user.position?.includes("กรรมการ") ?? false) ||
      (user.position?.includes("ผู้จัดการทั่วไป") ?? false));
  const isManager =
    !isExecutive &&
    (user.role === "manager" || (!isAssistant && (user.position?.includes("ผู้จัดการ") ?? false)));

  useEffect(() => {
    if (isExecutive && typeof window !== "undefined") {
      window.location.replace("/manager/dashboard");
    }
  }, [isExecutive]);

  // Tab navigation
  type ManagerTab = "tasks" | "approvals" | "refrigerator" | "history";
  const [activeTab, setActiveTab] = useState<ManagerTab>("tasks");

  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

  // Sub-tabs inside Approvals: daily | special
  const [approvalSubTab, setApprovalSubTab] = useState<"daily" | "special">("daily");

  // Special tasks approval state
  const [specialTasksToReview, setSpecialTasksToReview] = useState<SpecialTaskItem[]>([]);
  const [isLoadingSpecialReview, setIsLoadingSpecialReview] = useState(false);
  const [isReviewingSpecial, setIsReviewingSpecial] = useState(false);

  const loadSpecialTasksToReview = useCallback(async () => {
    if (!user.branchId) return;
    setIsLoadingSpecialReview(true);
    try {
      const res = await getSpecialTasksAction({ branchId: user.branchId });
      if (res.success && res.tasks) {
        setSpecialTasksToReview(res.tasks);
      }
    } catch {
      // non-blocking
    } finally {
      setIsLoadingSpecialReview(false);
    }
  }, [user.branchId]);

  useEffect(() => {
    if (activeTab === "approvals" && approvalSubTab === "special") {
      void loadSpecialTasksToReview();
    }
  }, [activeTab, approvalSubTab, loadSpecialTasksToReview]);

  const handleReviewSpecialTask = async (specialTaskId: string, isApproved: boolean) => {
    setIsReviewingSpecial(true);
    try {
      const declineReason = !isApproved ? prompt("กรุณาระบุเหตุผลที่ไม่อนุมัติ (ไม่บังคับ):") || undefined : undefined;
      const res = await approveSpecialTaskAction({
        specialTaskId,
        reviewerUserId: user.id,
        reviewerRole: user.role,
        isApproved,
        declineReason,
      });
      if (res.success) {
        setActionFeedback(isApproved ? "อนุมัติภารกิจพิเศษและมอบคะแนนเรียบร้อยแล้ว!" : "ปฏิเสธภารกิจพิเศษเรียบร้อยแล้ว");
        void loadSpecialTasksToReview();
      } else {
        setActionFeedback(`เกิดข้อผิดพลาด: ${res.error || "ไม่สามารถดำเนินการได้"}`);
      }
    } catch (err: any) {
      setActionFeedback(`การเชื่อมต่อขัดข้อง: ${err?.message}`);
    } finally {
      setIsReviewingSpecial(false);
    }
  };

  // Navbar refresh controls
  const [isNavbarRefreshing, setIsNavbarRefreshing] = useState(false);
  const [isNavbarDbRefreshing, setIsNavbarDbRefreshing] = useState(false);
  const [navbarLastRefreshedAt, setNavbarLastRefreshedAt] = useState<Date | null>(new Date());
  const [navbarLastRefreshType, setNavbarLastRefreshType] = useState<"cache" | "db">("cache");

  // --- Task Work State (Checklist) ---
  type ManagerTaskShiftTab = "morning" | "afternoon" | "night";
  const [selectedTaskShiftTab, setSelectedTaskShiftTab] = useState<ManagerTaskShiftTab>(() => {
    return isManager ? "night" : "morning";
  });
  const [myChecklistShift, setMyChecklistShift] = useState<ShiftType>(() => {
    return isManager ? "night" : "morning";
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

  // --- Task Checklist Buffer & Cache ---
  const loadChecklistRef = useRef<((shift: ShiftType, isSilent?: boolean) => Promise<void>) | null>(null);
  const checklistCacheKey = `mgr_${user.id}_${myChecklistShift}`;
  const {
    enqueueToggle,
    flush: flushChecklistBuffer,
    reconcile: reconcileChecklist,
    saveToCache: saveChecklistCache,
    loadFromCache: loadChecklistCache,
    dbSyncNotification,
    clearDbSyncNotification,
  } = useTaskChecklistBuffer({
    cacheKey: checklistCacheKey,
    onBatchSuccess: (results) => {
      setMyChecklistItems((prev) =>
        prev.map((item) => {
          const match = results.find((r) => r.taskId === item.id);
          if (match && match.taskWorkId && match.taskWorkId !== item.taskWorkId) {
            return { ...item, taskWorkId: match.taskWorkId };
          }
          return item;
        })
      );
      // Trigger prompt DB cache check to verify and notify user
      setTimeout(() => {
        void loadChecklistRef.current?.(myChecklistShift, true);
      }, 1000);
    },
    onBatchError: (err) => {
      console.error("Batch checklist error:", err);
      showToast("เกิดข้อผิดพลาดในการบันทึกสถานะงาน");
    },
  });

  // Tab navigation handler that flushes checklist buffer before switching away from tasks tab
  const handleTabChange = useCallback((tab: ManagerTab) => {
    if (activeTab === "tasks") {
      void flushChecklistBuffer();
    }
    setActiveTab(tab);
  }, [activeTab, flushChecklistBuffer]);

  // --- Approvals & Live Sessions State ---
  const [sessions, setSessions] = useState<ShiftSession[]>([]);
  const [isLoadingDb, setIsLoadingDb] = useState(false);
  const [hasAssistantLoggedInToday, setHasAssistantLoggedInToday] = useState(true);
  const [approvals, setApprovals] = useState<Record<string, { assistantApproved?: boolean; managerApproved?: boolean }>>({});
  const [approvingSessionIds, setApprovingSessionIds] = useState<Set<string>>(new Set());
  const approvingStartedAtRef = useRef<Map<string, number>>(new Map());
  const [shiftQueueStatusFilter, setShiftQueueStatusFilter] = useState<"all" | "pending" | "approved">("all");
  const [selectedSession, setSelectedSession] = useState<ShiftSession | null>(null);

  // --- History State ---
  const [historySessions, setHistorySessions] = useState<ShiftSession[]>([]);
  const [specificDaySessions, setSpecificDaySessions] = useState<ShiftSession[] | null>(null);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState<string>("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<"all" | "pending" | "approved">("all");
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
        const fresh = res.session.items || [];
        setMyChecklistItems((prev) => {
          if (prev.length === 0) {
            const cached = loadChecklistCache();
            if (cached && cached.length > 0) {
              const { mergedItems } = reconcileChecklist(fresh, cached);
              saveChecklistCache(mergedItems, res.session!.id);
              return mergedItems;
            }
            saveChecklistCache(fresh, res.session!.id);
            return fresh;
          }

          const { mergedItems, hasExternalChanges } = reconcileChecklist(fresh, prev);
          if (hasExternalChanges || prev.length !== fresh.length) {
            saveChecklistCache(mergedItems, res.session!.id);
            return mergedItems;
          }
          return prev;
        });
      }
    } catch (err) {
      console.error("Failed to load checklist from DB:", err);
    } finally {
      if (!isSilent) setIsLoadingChecklist(false);
    }
  }, [isManager, user, loadChecklistCache, reconcileChecklist, saveChecklistCache]);

  useEffect(() => {
    loadChecklistRef.current = loadChecklist;
  }, [loadChecklist]);

  const handleSelectShiftTab = useCallback((tab: ManagerTaskShiftTab) => {
    void flushChecklistBuffer();
    setSelectedTaskShiftTab(tab);
    const backendShift: ShiftType = tab;
    setMyChecklistShift(backendShift);
    void loadChecklist(backendShift);
  }, [flushChecklistBuffer, loadChecklist]);

  // Load live shift sessions from Supabase DB for approvals
  const loadDbSessions = useCallback(async (isManual = false) => {
    const fetchStartTime = Date.now();
    try {
      if (isManual) setIsLoadingDb(true);
      const res = await getManagerShiftSessionsAction();
      if (res.success && res.sessions) {
        if (res.hasAssistantLoggedInToday !== undefined) {
          setHasAssistantLoggedInToday(res.hasAssistantLoggedInToday);
        }
        const mappedSessions: ShiftSession[] = res.sessions.map((s) => ({
          id: s.id,
          userId: s.userId,
          userName: s.userName,
          userPosition: s.userPosition,
          userRole: s.userRole,
          userProfileId: s.userProfileId,
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
          incompleteReviewedByName: s.incompleteReviewedByName,
          incompleteReviewedAt: s.incompleteReviewedAt,
        }));
        setSessions(mappedSessions);

        // Keep active session in detail modal updated with latest DB state
        setSelectedSession((prev) => {
          if (!prev) return null;
          const fresh = mappedSessions.find((s) => s.id === prev.id);
          return fresh ? fresh : prev;
        });

        // Reconcile approvals map from fresh DB records
        const newApprovals: Record<string, { assistantApproved?: boolean; managerApproved?: boolean }> = {};
        res.sessions.forEach((s) => {
          newApprovals[s.id] = {
            assistantApproved: Boolean(s.assistantApproved),
            managerApproved: Boolean(s.managerApproved),
          };
        });
        setApprovals((prev) => ({ ...prev, ...newApprovals }));

        // Reconcile approving button states with fresh DB state
        setApprovingSessionIds((prev) => {
          if (prev.size === 0) return prev;
          const next = new Set(prev);
          let changed = false;

          for (const sessionId of prev) {
            const dbMatch = res.sessions?.find((s) => s.id === sessionId);
            const startedAt = approvingStartedAtRef.current.get(sessionId) || 0;

            if (dbMatch) {
              if (dbMatch.managerApproved || dbMatch.assistantApproved) {
                next.delete(sessionId);
                approvingStartedAtRef.current.delete(sessionId);
                changed = true;
                continue;
              }
            }

            // If approval has been pending for >= 5s without DB confirmation, or was initiated
            // prior to this fetch without showing in DB, revert button so user is never stuck
            if (startedAt > 0 && (Date.now() - startedAt >= 5000 || fetchStartTime - startedAt >= 3500)) {
              next.delete(sessionId);
              approvingStartedAtRef.current.delete(sessionId);
              changed = true;
            }
          }

          return changed ? next : prev;
        });
      }
    } catch (err) {
      console.error("Failed to load DB sessions:", err);
    } finally {
      if (isManual) setIsLoadingDb(false);
    }
  }, [setIsLoadingDb, setSessions, setApprovals, setHasAssistantLoggedInToday, setApprovingSessionIds, setSelectedSession]);

  // Load history sessions
  const loadHistory = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setIsLoadingHistory(true);
      const res = await getHistoryShiftSessionsAction(14);
      if (res.success && res.sessions) {
        const mapped: ShiftSession[] = res.sessions.map((s) => ({
          id: s.id,
          userId: s.userId,
          userName: s.userName,
          userPosition: s.userPosition,
          userRole: s.userRole,
          userProfileId: s.userProfileId,
          branchId: s.branchId,
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
          incompleteReviewedByName: s.incompleteReviewedByName,
          incompleteReviewedAt: s.incompleteReviewedAt,
        }));
        setHistorySessions(mapped);

        // Sync approvals state
        const historyApprovals: Record<string, { assistantApproved?: boolean; managerApproved?: boolean }> = {};
        res.sessions.forEach((s) => {
          historyApprovals[s.id] = {
            assistantApproved: s.assistantApproved,
            managerApproved: s.managerApproved,
          };
        });
        setApprovals((prev) => ({ ...prev, ...historyApprovals }));

        // Keep open modal in sync
        setSelectedSession((prev) => {
          if (!prev) return null;
          const fresh = mapped.find((s) => s.id === prev.id);
          return fresh ? fresh : prev;
        });

        // Reconcile approving state for history items
        setApprovingSessionIds((prev) => {
          if (prev.size === 0) return prev;
          const next = new Set(prev);
          let changed = false;
          for (const sessionId of prev) {
            const histMatch = res.sessions?.find((s) => s.id === sessionId);
            if (histMatch && (histMatch.managerApproved || histMatch.assistantApproved)) {
              next.delete(sessionId);
              approvingStartedAtRef.current.delete(sessionId);
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      }
    } catch (err) {
      console.error("Failed to load history sessions:", err);
    } finally {
      if (!isSilent) setIsLoadingHistory(false);
    }
  }, [setIsLoadingHistory, setHistorySessions, setApprovals, setApprovingSessionIds, setSelectedSession]);

  // Fetch specific history date (for Manager Audit)
  const fetchSpecificHistoryDate = useCallback(async (dateStr: string, isSilent = false) => {
    if (!dateStr) {
      setSpecificDaySessions(null);
      return;
    }
    try {
      if (!isSilent) setIsLoadingHistory(true);
      const res = await getHistoryShiftSessionsAction(14, dateStr);
      if (res.success && res.sessions) {
        const mapped: ShiftSession[] = res.sessions.map((s) => ({
          id: s.id,
          userId: s.userId,
          userName: s.userName,
          userPosition: s.userPosition,
          userRole: s.userRole,
          userProfileId: s.userProfileId,
          branchId: s.branchId,
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
          incompleteReviewedByName: s.incompleteReviewedByName,
          incompleteReviewedAt: s.incompleteReviewedAt,
        }));
        setSpecificDaySessions(mapped);

        const historyApprovals: Record<string, { assistantApproved?: boolean; managerApproved?: boolean }> = {};
        res.sessions.forEach((s) => {
          historyApprovals[s.id] = {
            assistantApproved: s.assistantApproved,
            managerApproved: s.managerApproved,
          };
        });
        setApprovals((prev) => ({ ...prev, ...historyApprovals }));

        setSelectedSession((prev) => {
          if (!prev) return null;
          const fresh = mapped.find((s) => s.id === prev.id);
          return fresh ? fresh : prev;
        });

        setApprovingSessionIds((prev) => {
          if (prev.size === 0) return prev;
          const next = new Set(prev);
          let changed = false;
          for (const sessionId of prev) {
            const histMatch = res.sessions?.find((s) => s.id === sessionId);
            if (histMatch && (histMatch.managerApproved || histMatch.assistantApproved)) {
              next.delete(sessionId);
              approvingStartedAtRef.current.delete(sessionId);
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      }
    } catch (err) {
      console.error("Failed to load specific history date:", err);
    } finally {
      if (!isSilent) setIsLoadingHistory(false);
    }
  }, [setIsLoadingHistory, setSpecificDaySessions, setApprovals, setApprovingSessionIds, setSelectedSession]);

  const activeTabRef = useRef(activeTab);
  const selectedHistoryDateRef = useRef(selectedHistoryDate);
  const loadHistoryRef = useRef(loadHistory);
  const fetchSpecificHistoryDateRef = useRef(fetchSpecificHistoryDate);

  useEffect(() => {
    activeTabRef.current = activeTab;
    selectedHistoryDateRef.current = selectedHistoryDate;
    loadHistoryRef.current = loadHistory;
    fetchSpecificHistoryDateRef.current = fetchSpecificHistoryDate;
  }, [activeTab, selectedHistoryDate, loadHistory, fetchSpecificHistoryDate]);

  // Initial and recurring fetch
  useEffect(() => {
    void flushPendingApprovals();
    void loadChecklist(myChecklistShift);
    void loadDbSessions();

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void loadChecklist(myChecklistShift, true);
      void loadDbSessions();
      if (activeTabRef.current === "history") {
        if (selectedHistoryDateRef.current) {
          void fetchSpecificHistoryDateRef.current?.(selectedHistoryDateRef.current, true);
        } else {
          void loadHistoryRef.current?.(true);
        }
      }
    }, 7000);

    return () => clearInterval(interval);
  }, [myChecklistShift, loadChecklist, loadDbSessions]);

  // Window visibility & real-time score/approval update listeners
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        void loadChecklist(myChecklistShift, true);
        void loadDbSessions();
        if (activeTabRef.current === "history") {
          if (selectedHistoryDateRef.current) {
            void fetchSpecificHistoryDateRef.current?.(selectedHistoryDateRef.current, true);
          } else {
            void loadHistoryRef.current?.(true);
          }
        }
      }
    };

    const handleScoreOrApprovalUpdate = () => {
      void loadDbSessions(false);
      if (activeTabRef.current === "history") {
        if (selectedHistoryDateRef.current) {
          void fetchSpecificHistoryDateRef.current?.(selectedHistoryDateRef.current, true);
        } else {
          void loadHistoryRef.current?.(true);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("app:scores-updated", handleScoreOrApprovalUpdate);

    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        channel = new BroadcastChannel("app_scores_sync");
        channel.onmessage = (msg) => {
          if (msg.data?.type === "SCORES_UPDATED") {
            handleScoreOrApprovalUpdate();
          }
        };
      }
    } catch (e) {
      console.warn("BroadcastChannel error:", e);
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("app:scores-updated", handleScoreOrApprovalUpdate);
      channel?.close();
    };
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
      await flushChecklistBuffer();
      if (activeTab === "refrigerator") {
        window.dispatchEvent(new Event("refresh-dashboard-data"));
      }
      await Promise.all([
        loadChecklist(myChecklistShift, false),
        loadDbSessions(true),
        activeTab === "history"
          ? (selectedHistoryDate ? fetchSpecificHistoryDate(selectedHistoryDate) : loadHistory())
          : Promise.resolve(),
      ]);
      setNavbarLastRefreshedAt(new Date());
      setNavbarLastRefreshType("cache");
      showToast("รีเฟรชข้อมูลล่าสุดเรียบร้อยแล้ว");
    } catch (err) {
      console.error("Navbar refresh error:", err);
    } finally {
      setIsNavbarRefreshing(false);
    }
  }, [flushChecklistBuffer, loadChecklist, myChecklistShift, loadDbSessions, activeTab, selectedHistoryDate, fetchSpecificHistoryDate, loadHistory]);

  const handleNavbarRefreshFromDb = useCallback(async () => {
    try {
      setIsNavbarDbRefreshing(true);
      await flushChecklistBuffer();
      invalidateBranchCache();
      if (activeTab === "refrigerator") {
        window.dispatchEvent(new Event("refresh-dashboard-data"));
      }
      await Promise.all([
        loadChecklist(myChecklistShift, false),
        loadDbSessions(true),
        activeTab === "history"
          ? (selectedHistoryDate ? fetchSpecificHistoryDate(selectedHistoryDate) : loadHistory())
          : Promise.resolve(),
      ]);
      setNavbarLastRefreshedAt(new Date());
      setNavbarLastRefreshType("db");
      showToast("ดึงข้อมูลสดจากฐานข้อมูลเรียบร้อย (Bypass Cache)");
    } catch (err) {
      console.error("Navbar refresh from DB error:", err);
    } finally {
      setIsNavbarDbRefreshing(false);
    }
  }, [flushChecklistBuffer, loadChecklist, myChecklistShift, loadDbSessions, activeTab, selectedHistoryDate, fetchSpecificHistoryDate, loadHistory]);

  const handleDateSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSelectedHistoryDate(val);
    void fetchSpecificHistoryDate(val);
  };

  const handleQuickDateSelect = (dateStr: string) => {
    setSelectedHistoryDate(dateStr);
    void fetchSpecificHistoryDate(dateStr);
  };

  const todayIso = useMemo(() => new Date().toISOString().split("T")[0], []);
  const yesterdayIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  }, []);

  // Toggle item in task work with buffer & collective batch sync
  async function executeToggleItem(itemId: string, willBeDone: boolean, comment?: string) {
    const newCompletedAt = willBeDone ? new Date().toISOString() : null;
    const item = myChecklistItems.find((i) => i.id === itemId);
    const myTitle = user.position || (isManager ? "ผู้จัดการร้าน" : "ผู้ช่วยผู้จัดการร้าน");

    // 1. Optimistic UI update + instant cache
    setMyChecklistItems((prev) => {
      const updated = prev.map((i) =>
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
      );
      saveChecklistCache(updated, assistantSession?.id);
      return updated;
    });

    // 2. Buffer collective update debounced to database
    enqueueToggle({
      shiftSessionId: assistantSession?.id,
      taskId: itemId,
      taskWorkId: item?.taskWorkId,
      completed: willBeDone,
      comment: willBeDone ? (comment || undefined) : undefined,
    });
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
  async function handleApproveSession(sessionId: string, type: "assistant" | "manager", isException?: boolean) {
    if (approvingSessionIds.has(sessionId)) return;

    const target =
      sessions.find((s) => s.id === sessionId) ||
      historySessions.find((s) => s.id === sessionId) ||
      specificDaySessions?.find((s) => s.id === sessionId) ||
      (selectedSession?.id === sessionId ? selectedSession : undefined);

    const isAssistantSession =
      target?.taskRole === "manager_assistant" || target?.userPosition === "ผู้ช่วยผู้จัดการร้าน";

    if (isAssistantSession && isAssistant) {
      showToast("เฉพาะผู้จัดการร้านเท่านั้นที่สามารถอนุมัติงานของผู้ช่วยผู้จัดการร้านได้");
      return;
    }

    const prevApproval = approvals[sessionId];

    setApprovals((prev) => ({
      ...prev,
      [sessionId]: {
        ...prev[sessionId],
        assistantApproved: true,
        managerApproved: type === "manager" ? true : Boolean(prev[sessionId]?.managerApproved),
      },
    }));

    setApprovingSessionIds((prev) => new Set(prev).add(sessionId));
    approvingStartedAtRef.current.set(sessionId, Date.now());

    try {
      const roleForDb = type === "assistant" ? "manager_assistant" : "manager";
      const res = await executeResilientApproval({
        shiftSessionId: sessionId,
        role: roleForDb,
        isException: Boolean(isException),
      });

      if (res.success) {
        showToast(
          type === "assistant"
            ? "ลงนามรับรองกะงานเบื้องต้น (Assistant Sign-off) สำเร็จ ✓"
            : "อนุมัติส่งมอบกะงานขั้นสุดท้าย (Manager Approval) สำเร็จ ✓"
        );
        void loadDbSessions(true);
        if (activeTab === "history") {
          if (selectedHistoryDate) {
            void fetchSpecificHistoryDate(selectedHistoryDate);
          } else {
            void loadHistory();
          }
        }
      } else {
        setApprovals((prev) => ({
          ...prev,
          [sessionId]: prevApproval || {},
        }));
        showToast(res.error || "เกิดข้อผิดพลาดในการอนุมัติ กรุณาลองใหม่อีกครั้ง");
      }
    } catch (err: any) {
      setApprovals((prev) => ({
        ...prev,
        [sessionId]: prevApproval || {},
      }));
      showToast(err?.message || "เกิดข้อผิดพลาดในการอนุมัติ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setApprovingSessionIds((prev) => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
      approvingStartedAtRef.current.delete(sessionId);
    }
  }

  // Active tasks for the currently selected shift tab (fetched from database)
  const activeShiftTasks = useMemo(() => {
    if (selectedTaskShiftTab === "morning" || selectedTaskShiftTab === "afternoon") {
      return myChecklistItems.filter((i) => !isSpecialClosingTask(i));
    }
    return myChecklistItems;
  }, [selectedTaskShiftTab, myChecklistItems]);

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

  // Executive audit metrics for Manager
  const completedSessions = sessions.filter((s) => s.completedAt);
  const totalChecklistItems = sessions.reduce((acc, s) => acc + s.items.length, 0);
  const completedChecklistItems = sessions.reduce(
    (acc, s) => acc + s.items.filter((i) => i.completedAt).length,
    0
  );
  const complianceRate =
    totalChecklistItems > 0 ? Math.round((completedChecklistItems / totalChecklistItems) * 100) : 100;

  if (isExecutive) {
    return null;
  }

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
            <ThemeToggle />

            <NotificationCenter />

            <NavbarRefreshControl
              isLoading={isNavbarRefreshing}
              isDbLoading={isNavbarDbRefreshing}
              lastRefreshedAt={navbarLastRefreshedAt}
              lastRefreshType={navbarLastRefreshType}
              onRefresh={handleNavbarRefresh}
              onRefreshFromDb={handleNavbarRefreshFromDb}
            />

            <button
              type="button"
              onClick={async () => {
                try {
                  await flushChecklistBuffer();
                } catch (e) {
                  console.warn("Flush before logout:", e);
                }
                onLogout();
              }}
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
        <header className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-20">
          <div className="flex items-start sm:items-center gap-3.5">
            <UserAvatar
              user={user}
              size="lg"
              editable={true}
              onEdit={() => setIsEditProfileOpen(true)}
              className="shadow-md shrink-0"
            />
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
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(true)}
                  className="px-2.5 py-0.5 rounded-full bg-[var(--color-surface-2)] hover:bg-[var(--color-border-subtle)] border border-[var(--color-border)] text-[11px] font-bold text-[var(--color-text)] transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                  title="แก้ไขโปรไฟล์และรูปภาพประจำตัว"
                >
                  <UserPen size={12} className="text-amber-600 dark:text-amber-400" />
                  <span>แก้ไขโปรไฟล์</span>
                </button>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 flex items-center gap-1.5 flex-wrap">
                <span>{isAssistant ? "บันทึกเช็คลิสต์ตรวจงานประจำกะ ตรวจชุดงานปิดร้าน และรับรองงานพนักงาน" : "ควบคุมมาตรฐานร้าน ตรวจสอบชุดงานปิดร้าน 4 ข้อ และอนุมัติรับรองกะ"}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center flex-wrap">
            <Link
              href="/manager/staff-status"
              className="text-xs font-bold text-[var(--color-text)] hover:text-amber-950 dark:hover:text-amber-200 bg-[var(--color-surface-2)] hover:bg-amber-100 dark:hover:bg-amber-950/70 border border-[var(--color-border)] hover:border-amber-400 px-3.5 py-2 rounded-xl transition-all inline-flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer min-h-[38px]"
              title="จัดการพนักงานและสถานะกะในสาขา"
            >
              <Users size={16} className="text-amber-600 shrink-0" />
              <span>จัดการพนักงาน</span>
            </Link>

            <Link
              href="/manager/leaves"
              className="text-xs font-bold text-[var(--color-text)] hover:text-rose-950 dark:hover:text-rose-200 bg-[var(--color-surface-2)] hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-[var(--color-border)] hover:border-rose-400 px-3.5 py-2 rounded-xl transition-all inline-flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer min-h-[38px]"
              title="ระบบจัดการการลาและสถานะพนักงาน"
            >
              <HeartPulse size={16} className="text-rose-500 shrink-0" />
              <span>จัดการการลา</span>
            </Link>

            <RoleSwitcher />
          </div>
        </header>

        {/* ─── Store Manager Operations & Audit Pulse (Strictly Manager Only) ── */}
        {isManager && !isAssistant && (
          <section className="space-y-4 animate-fade-in" aria-label="ภาพรวมการกำกับดูแลสาขาสำหรับผู้จัดการร้าน">
            {/* Assistant Manager Attendance Alert */}
            {!hasAssistantLoggedInToday && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <AlertCircle size={20} className="text-amber-600 dark:text-amber-400 shrink-0" />
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-amber-950 dark:text-amber-200">
                      ⚠️ วันนี้ยังไม่มีผู้ช่วยผู้จัดการร้านเข้าสู่ระบบ
                    </p>
                    <p className="text-xs text-amber-900/80 dark:text-amber-300/80 mt-0.5">
                      ระบบเปิดให้ผู้จัดการร้านตรวจสอบและอนุมัติกะงานได้โดยตรง (ข้ามขั้นตอนการลงนามของผู้ช่วยฯ เพื่อไม่ให้การส่งมอบกะล่าช้า)
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 3 Executive Audit Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              {/* Card 1: Store Shift Operations */}
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-xs" aria-hidden="true" />
                      <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                        กะปฏิบัติงานวันนี้
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                      วันนี้
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-extrabold font-mono text-[var(--color-text)] tracking-tight">
                      {sessions.length}
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)] font-semibold">
                      กะงานทั้งหมด
                    </span>
                  </div>
                </div>
                <div className="pt-2.5 border-t border-[var(--color-border)] flex items-center justify-between">
                  <p className="text-xs text-[var(--color-text-muted)] font-medium">
                    {completedSessions.length} กะส่งมอบเรียบร้อยแล้ว
                  </p>
                  <span className="text-xs font-mono font-bold text-[var(--color-text)] bg-[var(--color-surface-2)] px-2 py-0.5 rounded-md border border-[var(--color-border)]">
                    {sessions.length > 0 ? Math.round((completedSessions.length / sessions.length) * 100) : 0}%
                  </span>
                </div>
              </div>

              {/* Card 2: Store Compliance Rate */}
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
                <div className="space-y-2">
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
                  <div className="w-full bg-[var(--color-surface-2)] h-2 rounded-full overflow-hidden border border-[var(--color-border)] mt-2">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${complianceRate}%` }}
                    />
                  </div>
                </div>
                <div className="pt-2.5 border-t border-[var(--color-border)] flex items-center justify-between">
                  <p className="text-xs text-[var(--color-text-muted)] font-medium">
                    บันทึกแล้ว {completedChecklistItems} จาก {totalChecklistItems || 1} ข้อเช็คลิสต์
                  </p>
                </div>
              </div>

              {/* Card 3: Direct Approval Action Callout */}
              <div
                onClick={() => {
                  handleTabChange("approvals");
                  if (pendingApprovalsCount > 0) {
                    setShiftQueueStatusFilter((prev) => (prev === "pending" ? "all" : "pending"));
                  }
                }}
                className={`rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3 transition-all cursor-pointer group hover:shadow-md border ${
                  pendingApprovalsCount > 0
                    ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 hover:border-amber-500"
                    : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-emerald-400"
                }`}
                title="คลิกเพื่อไปยังคิวรับรองกะงาน"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${pendingApprovalsCount > 0 ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} aria-hidden="true" />
                      <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                        สถานะการลงนามรับรอง
                      </span>
                    </div>
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-200 group-hover:underline flex items-center gap-1">
                      <span>คิวรับรอง</span>
                      <span>→</span>
                    </span>
                  </div>
                  <div className="pt-0.5">
                    {pendingApprovalsCount > 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-950 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 px-2.5 py-1 rounded-full shadow-2xs">
                        <AlertCircle size={13} className="text-amber-700 dark:text-amber-400" />
                        <span>ค้างรับรอง {pendingApprovalsCount} กะ</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-900 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 px-2.5 py-1 rounded-full shadow-2xs">
                        <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
                        <span>รับรองครบทุกกะ (100%)</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="pt-2.5 border-t border-[var(--color-border)]">
                  <p className="text-xs text-[var(--color-text-muted)] font-medium">
                    {pendingApprovalsCount > 0
                      ? "คลิกเพื่อไปตรวจรับรองกะที่รอดำเนินการทันที"
                      : "สาขาพร้อมเปิดทำการเต็มมาตรฐาน รับรองครบทุกกะงานแล้ว"}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ─── Navigation Tabs ──────────────────────────────────────────────── */}
        <div className="bg-[var(--color-surface-2)] p-1.5 rounded-2xl border border-[var(--color-border)] shadow-2xs">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => handleTabChange("tasks")}
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
              onClick={() => handleTabChange("approvals")}
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
              onClick={() => handleTabChange("refrigerator")}
              className={`p-2.5 sm:p-3 rounded-xl text-left transition-all cursor-pointer flex flex-col justify-center min-h-[48px] sm:min-h-[54px] ${activeTab === "refrigerator"
                ? "bg-[var(--color-brown)] text-amber-100 shadow-sm font-bold"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]/70"
              }`}
            >
              <div className="flex items-center gap-2">
                <Snowflake size={17} strokeWidth={2.2} className="shrink-0 text-cyan-400" />
                <span className="text-xs sm:text-sm font-bold">ตู้แช่ประจำสาขา</span>
              </div>
              <span className={`text-[11px] hidden sm:block ${activeTab === "refrigerator" ? "text-amber-200/90" : "text-[var(--color-text-muted)]"}`}>
                เช็คลิสต์ & ตั้งค่าอุณหภูมิ
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("history")}
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
                        ? "เช็คลิสต์ตรวจงานประจำกะบ่าย (Afternoon Shift Routine Tasks)"
                        : "เช็คลิสต์ตรวจงานกะดึก (Night Shift Tasks)"}
                    </span>
                  </h2>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {selectedTaskShiftTab === "morning"
                      ? "ขั้นตอนการปฏิบัติงานของผู้ช่วยผู้จัดการร้านประจำกะเช้า (เปิดร้าน, ตรวจสอบความพร้อม)"
                      : selectedTaskShiftTab === "afternoon"
                      ? "ขั้นตอนการปฏิบัติงานของผู้ช่วยผู้จัดการร้านประจำกะบ่าย (ตรวจนับเงินทอน, เช็คสินค้า, ความเรียบร้อย)"
                      : "ขั้นตอนการปฏิบัติงานประจำกะดึก (ตรวจสอบความปลอดภัย 4 ข้อตอนปิดร้าน)"}
                  </p>
                </div>

                {/* ─── SHIFT TABS ─────────────────────────────────── */}
                <div className="inline-flex items-center self-start sm:self-auto bg-[var(--color-surface-2)] p-1 rounded-xl border border-[var(--color-border)]">
                  {isAssistant && (
                    <>
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
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => handleSelectShiftTab("night")}
                    className={`min-h-[36px] px-3.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      selectedTaskShiftTab === "night"
                        ? "bg-[var(--color-brown)] text-amber-100 shadow-2xs font-bold"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    <span>กะดึก (Night)</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      selectedTaskShiftTab === "night"
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
                ไม่พบรายการเช็คลิสต์สำหรับตำแหน่งนี้ในกะที่เลือก
              </div>
            ) : selectedTaskShiftTab === "night" ? (
              /* ─── TAB: NIGHT / FOR_MANAGERS TASKS (ชุดงานกะดึกปิดร้าน 4 รายการ) ─ */
              <div className="bg-gradient-to-br from-amber-500/10 via-[var(--color-surface)] to-[var(--color-surface)] border-2 border-amber-500/30 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-500 text-amber-950 flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
                      🛡️
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm sm:text-base font-extrabold text-amber-950 dark:text-amber-200">
                          ชุดงานกะดึกและงานปิดร้าน (Night Shift & Store Closing / 4 รายการ)
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
            {/* ─── Sub-tabs inside Approvals & Checklist Hub Link ─────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setApprovalSubTab("daily")}
                  className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    approvalSubTab === "daily"
                      ? "bg-[var(--color-brown)] text-amber-100 shadow-sm"
                      : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                >
                  <UserCheck size={16} />
                  <span>งานประจำวันรายบุคคล (Daily Sessions)</span>
                  {pendingApprovalsCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-black animate-pulse">
                      {pendingApprovalsCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setApprovalSubTab("special");
                    void loadSpecialTasksToReview();
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    approvalSubTab === "special"
                      ? "bg-[var(--color-brown)] text-amber-100 shadow-sm"
                      : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                >
                  <Sparkles size={16} />
                  <span>ภารกิจพิเศษ (Special Tasks)</span>
                  {specialTasksToReview.filter((t) => t.status === "submitted").length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-amber-950 font-black animate-pulse">
                      {specialTasksToReview.filter((t) => t.status === "submitted").length}
                    </span>
                  )}
                </button>
              </div>

              <Link
                href="/manager/checklists"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 active:scale-95 text-amber-950 transition-all shadow-xs shrink-0 self-start sm:self-auto"
              >
                <Sliders size={14} />
                <span>เข้าสู่ศูนย์จัดการเช็คลิสต์</span>
                <ChevronRight size={14} />
              </Link>
            </div>

            {/* ─── SUB-TAB 1: DAILY SESSIONS APPROVAL ──────────────────── */}
            {approvalSubTab === "daily" && (
              <div className="space-y-4">
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
                              disabled={isAssistantApproved || approvingSessionIds.has(sess.id)}
                              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${isAssistantApproved
                                ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                : "bg-amber-400 text-amber-950 hover:bg-amber-300 shadow-2xs"
                              } ${approvingSessionIds.has(sess.id) && !isAssistantApproved ? "opacity-75 cursor-wait" : ""}`}
                            >
                              {isAssistantApproved ? (
                                "✓ ผู้ช่วยฯ รับรองแล้ว"
                              ) : approvingSessionIds.has(sess.id) ? (
                                <>
                                  <svg className="animate-spin h-3.5 w-3.5 text-amber-950" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                                  </svg>
                                  <span>กำลังลงนาม...</span>
                                </>
                              ) : (
                                "ลงนามรับรอง (ผู้ช่วยฯ)"
                              )}
                            </button>
                          )}

                          {/* Manager final approval */}
                          {isManager && (
                            <button
                              type="button"
                              onClick={() => void handleApproveSession(sess.id, "manager")}
                              disabled={isFullyApproved || approvingSessionIds.has(sess.id)}
                              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${isFullyApproved
                                ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                : "bg-amber-600 hover:bg-amber-700 text-white shadow-2xs"
                              } ${approvingSessionIds.has(sess.id) && !isFullyApproved ? "opacity-75 cursor-wait" : ""}`}
                            >
                              {isFullyApproved ? (
                                "✓ อนุมัติขั้นสุดท้ายแล้ว"
                              ) : approvingSessionIds.has(sess.id) ? (
                                <>
                                  <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                                  </svg>
                                  <span>กำลังอนุมัติ...</span>
                                </>
                              ) : (
                                "อนุมัติขั้นสุดท้าย (ผู้จัดการ)"
                              )}
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



            {/* ─── SUB-TAB 3: SPECIAL TASKS APPROVAL ────────────────── */}
            {approvalSubTab === "special" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--color-text)]">รายการภารกิจพิเศษที่รอตรวจสอบ</h3>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      ภารกิจพิเศษจะไม่ถูกลบโดยรอบ 14 วัน และสามารถตรวจสอบรับรองได้ตลอดเวลา
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadSpecialTasksToReview()}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-surface-2)] text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-surface)] cursor-pointer"
                  >
                    รีเฟรช
                  </button>
                </div>

                {isLoadingSpecialReview ? (
                  <div className="py-12 text-center text-[var(--color-text-muted)] text-xs">
                    <span className="animate-spin inline-block mr-2">⏳</span> กำลังโหลดภารกิจพิเศษ...
                  </div>
                ) : specialTasksToReview.length === 0 ? (
                  <div className="py-12 text-center text-[var(--color-text-muted)] text-xs border border-dashed border-[var(--color-border)] rounded-2xl bg-[var(--color-surface-2)]/40 p-6">
                    ไม่มีภารกิจพิเศษในสาขานี้
                  </div>
                ) : (
                  <div className="space-y-3">
                    {specialTasksToReview.map((task) => {
                      const isSubmitted = task.status === "submitted";
                      const isApproved = task.status === "approved";
                      const isDeclined = task.status === "declined";

                      return (
                        <div
                          key={task.id}
                          className={`p-4 rounded-xl border transition-all ${
                            isSubmitted
                              ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800"
                              : isApproved
                              ? "bg-emerald-50/20 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900"
                              : "bg-[var(--color-surface)] border-[var(--color-border)]"
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-sm text-[var(--color-text)]">{task.title}</span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-950">
                                  +{task.pointsReward} คะแนน
                                </span>
                                {task.penaltyStreak && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                                    <Flame size={11} className="text-rose-600" />
                                    กระทบสตรีคหากไม่เสร็จ
                                  </span>
                                )}
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    isSubmitted
                                      ? "bg-amber-400 text-amber-950 animate-pulse"
                                      : isApproved
                                      ? "bg-emerald-200 text-emerald-900"
                                      : isDeclined
                                      ? "bg-rose-200 text-rose-900"
                                      : "bg-neutral-200 text-neutral-800"
                                  }`}
                                >
                                  {isSubmitted ? "รอตรวจรับรอง" : isApproved ? "อนุมัติแล้ว" : isDeclined ? "ปฏิเสธ" : "กำลังดำเนินการ"}
                                </span>
                              </div>

                              {task.description && (
                                <p className="text-xs text-[var(--color-text-muted)]">{task.description}</p>
                              )}

                              <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-text-muted)] pt-1">
                                <span>
                                  ช่วงเวลา: {task.startDate} ถึง {task.endDate}
                                </span>
                                <span>•</span>
                                <span>
                                  ผู้รับผิดชอบ: {task.assignedRole ? `บทบาท ${task.assignedRole}` : task.assignedUserName ? task.assignedUserName : task.targetType === "group" ? "กลุ่มพนักงาน" : "พนักงานที่ระบุ"}
                                </span>
                                {task.submittedByUserName && (
                                  <>
                                    <span>•</span>
                                    <span>ส่งโดย: {task.submittedByUserName}</span>
                                  </>
                                )}
                              </div>

                              {/* Submission details if submitted */}
                              {task.submissionComment && (
                                <div className="mt-2 p-2.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-xs space-y-1">
                                  <span className="font-bold text-[var(--color-text)]">หมายเหตุการส่งงาน:</span>
                                  <p className="text-[var(--color-text-muted)]">{task.submissionComment}</p>
                                </div>
                              )}
                            </div>

                            {/* Approval buttons */}
                            <div className="flex items-center gap-2 shrink-0">
                              {isSubmitted ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => void handleReviewSpecialTask(task.id, true)}
                                    disabled={isReviewingSpecial}
                                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <CheckCheck size={14} />
                                    <span>อนุมัติ (+{task.pointsReward} แต้ม)</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleReviewSpecialTask(task.id, false)}
                                    disabled={isReviewingSpecial}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-100 hover:bg-rose-200 text-rose-800 transition-all flex items-center gap-1 cursor-pointer"
                                  >
                                    <XCircle size={14} />
                                    <span>ปฏิเสธ</span>
                                  </button>
                                </>
                              ) : isApproved ? (
                                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                                  <CheckCircle2 size={14} />
                                  อนุมัติสำเร็จ
                                </span>
                              ) : isDeclined ? (
                                <span className="text-xs font-bold text-rose-600 flex items-center gap-1">
                                  <XCircle size={14} />
                                  ไม่อนุมัติ
                                </span>
                              ) : (
                                <span className="text-xs text-[var(--color-text-muted)]">ยังไม่ส่งงาน</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB 3: REFRIGERATOR MONITORING & CONFIGURATION
        ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "refrigerator" && (
          <RefrigeratorConfigView user={user} />
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB 4: HISTORY & AUDIT LOGS (Subordinate Team Audit Dossier)
        ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "history" && (
          <SubordinateHistoryAuditView
            sessions={specificDaySessions ?? historySessions}
            approvals={approvals}
            onSelectSession={setSelectedSession}
            selectedDate={selectedHistoryDate}
            onSelectDate={(dateStr) => {
              setSelectedHistoryDate(dateStr);
              void fetchSpecificHistoryDate(dateStr);
            }}
            todayIso={todayIso}
            yesterdayIso={yesterdayIso}
            isLoading={isLoadingHistory}
            isManager={isManager}
            isAssistant={isAssistant}
            currentUserId={user.id}
            branchName={user.branchName}
          />
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
        canApprove={isManager && !approvals[selectedSession?.id || ""]?.managerApproved}
        isApproved={Boolean(approvals[selectedSession?.id || ""]?.managerApproved)}
        approveRoleTitle="ผู้จัดการร้าน"
        isApproving={Boolean(selectedSession && approvingSessionIds.has(selectedSession.id))}
        onApprove={(sessId, isException) => {
          void handleApproveSession(sessId, "manager", isException);
        }}
        onReviewSuccess={() => {
          void loadDbSessions(true);
        }}
      />

      {/* Local notification on DB cache check verification */}
      <DbSyncNotification
        notification={dbSyncNotification}
        onClose={clearDbSyncNotification}
      />

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        onProfileUpdated={() => {
          void loadDbSessions(true);
          void loadHistory(true);
        }}
      />

      {/* Footer */}
      <footer className="mt-12 py-6 border-t border-[var(--color-border)] text-center text-xs text-[var(--color-text-muted)]">
        Eater Egg Fresh Mart • Manager Portal
      </footer>
    </div>
  );
}
