"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChecklistItem, ShiftSession, ShiftType } from "../../types";
import { fmtTime, isTodayThai } from "../../data/storage";
import { secureGetItem, secureSetItem, secureRemoveItem } from "../../utils/crypto";
import { getShiftBadge } from "../common/Badge";
import { useModalFocusTrap } from "../common/ModalFocusTrap";
import { NotificationCenter } from "../common/NotificationCenter";
import { PointStreakBadge } from "../common/PointStreakBadge";
import { ThemeToggle } from "../common/ThemeToggle";
import { RoleSwitcher } from "../common/RoleSwitcher";
import { 
  Check, 
  CheckCircle2, 
  Clock, 
  LogOut, 
  Sparkles, 
  ArrowRight, 
  AlertCircle,
  LayoutDashboard,
  Users,
  Flame,
  Calendar,
  Send,
  ShieldAlert,
  X,
  RefreshCw,
} from "lucide-react";
import { BranchRefrigeratorChecklist } from "./BranchRefrigeratorChecklist";
import { JointTaskDetailsModal } from "./JointTaskDetailsModal";
import { LateReasonModal } from "../common/LateReasonModal";
import { getOrCreateShiftSessionAction, validateShiftCompletionAction } from "../../actions/checklist";
import { getBranchJointTasksAction, toggleJointTaskItemAction } from "../../actions/jointTask";
import { getSpecialTasksAction, submitSpecialTaskAction } from "../../actions/specialTask";
import { SpecialTaskItem, JointTaskItem } from "../../types";
import { useTaskChecklistBuffer } from "../../utils/taskChecklistBuffer";
import { DbSyncNotification } from "../common/DbSyncNotification";
import { useApp } from "../../context/AppContext";
import { UserAvatar } from "../common/UserAvatar";
import { EditProfileModal } from "../common/EditProfileModal";

function getCategoryColor(category?: string) {
  if (!category) {
    return {
      dot: "bg-amber-600",
      text: "text-[var(--color-text)] font-extrabold",
    };
  }
  const cat = category.toLowerCase();
  if (cat.includes("แช่") || cat.includes("เย็น") || cat.includes("ตู้") || cat.includes("chill") || cat.includes("temp")) {
    return {
      dot: "bg-sky-600",
      text: "text-sky-950 dark:text-sky-200 font-extrabold",
    };
  }
  if (cat.includes("สด") || cat.includes("สินค้า") || cat.includes("stock") || cat.includes("สต็อก") || cat.includes("เรียง")) {
    return {
      dot: "bg-emerald-600",
      text: "text-emerald-950 dark:text-emerald-200 font-extrabold",
    };
  }
  if (cat.includes("ปิด") || cat.includes("สรุป") || cat.includes("ปลอดภัย") || cat.includes("เงิน")) {
    return {
      dot: "bg-orange-600",
      text: "text-orange-950 dark:text-orange-300 font-extrabold",
    };
  }
  return {
    dot: "bg-amber-600",
    text: "text-[var(--color-text)] font-extrabold",
  };
}

export function ChecklistPage({
  session,
  selectedShift: _selectedShift,
  onUpdate,
  onEndShift,
  onOpenDashboard,
  onExit,
}: {
  session: ShiftSession;
  selectedShift?: ShiftType | null;
  onUpdate: (s: ShiftSession) => void;
  onEndShift: (continueNextShift?: boolean, reason?: string) => Promise<void> | void;
  onOpenDashboard?: () => void;
  onExit?: () => void;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [showIncompleteModal, setShowIncompleteModal] = useState(false);
  const [incompleteReason, setIncompleteReason] = useState("");
  const [dbPendingTasks, setDbPendingTasks] = useState<Array<{ id: string; name: string }>>([]);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const { currentUser } = useApp();
  const [isValidatingDb, setIsValidatingDb] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const isPageBusy = isValidatingDb || isEnding;
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");

  const isStockShift =
    session.taskRole === "stock" ||
    Boolean(session.userPosition?.includes("สต็อก") || session.userPosition?.includes("stock"));


  const hasNextShift = session.shift === "morning";

  const [continueShift, setContinueShift] = useState<boolean>(() => {
    if (!hasNextShift) return false;
    if (typeof window !== "undefined") {
      return secureGetItem("app_queue_afternoon") === "true";
    }
    return false;
  });

  const { dialogRef: confirmDialogRef, handleKeyDown: handleConfirmKeyDown } = useModalFocusTrap(
    showConfirm,
    () => setShowConfirm(false)
  );
  const { dialogRef: incompleteDialogRef, handleKeyDown: handleIncompleteKeyDown } = useModalFocusTrap(
    showIncompleteModal,
    () => setShowIncompleteModal(false)
  );
  const { dialogRef: exitDialogRef, handleKeyDown: handleExitKeyDown } = useModalFocusTrap(
    showExitConfirm,
    () => setShowExitConfirm(false)
  );

  const [items, setItems] = useState<ChecklistItem[]>(session.items || []);
  const [shiftCompleted, setShiftCompleted] = useState<boolean>(Boolean(session.completedAt));
  const [prevSession, setPrevSession] = useState(session);

  // Main Tabs State (Optimized for Mobile & Desktop without remounts or refetches)
  const [activeMainTab, setActiveMainTab] = useState<"shift" | "joint" | "special">("shift");
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  // --- ROW 2: Joint Tasks State ---
  const [jointTasks, setJointTasks] = useState<JointTaskItem[]>([]);
  const [isJointModalOpen, setIsJointModalOpen] = useState(false);
  const [jointSubTab, setJointSubTab] = useState<"refrigerators" | "joint_tasks">("refrigerators");

  // --- ROW 3: Special Tasks State ---
  const [specialTasks, setSpecialTasks] = useState<SpecialTaskItem[]>([]);
  const [submittingSpecialTask, setSubmittingSpecialTask] = useState<SpecialTaskItem | null>(null);
  const [submissionComment, setSubmissionComment] = useState("");
  const [isSubmittingSpecial, setIsSubmittingSpecial] = useState(false);

  // Toast feedback for Joint & Special tasks
  const [rowToast, setRowToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const showRowToast = (type: "success" | "error", text: string) => {
    setRowToast({ type, text });
    setTimeout(() => setRowToast(null), 4000);
  };

  const branchId = session.branchId || currentUser?.branchId;

  const loadJointTasks = useCallback(async () => {
    if (!branchId) return;
    try {
      const res = await getBranchJointTasksAction({
        branchId,
        shift: session.shift,
      });
      if (res.success && res.data) {
        setJointTasks(res.data);
      }
    } catch {
      // non-blocking
    }
  }, [branchId, session.shift]);

  const loadSpecialTasks = useCallback(async () => {
    if (!branchId) return;
    try {
      const res = await getSpecialTasksAction({
        branchId,
        userId: session.userId,
        role: session.taskRole || currentUser?.role,
      });
      if (res.success && res.tasks) {
        setSpecialTasks(res.tasks);
      }
    } catch {
      // non-blocking
    }
  }, [branchId, session.userId, session.taskRole, currentUser]);

  useEffect(() => {
    void loadJointTasks();
    void loadSpecialTasks();
    const interval = setInterval(() => {
      void loadJointTasks();
      void loadSpecialTasks();
    }, 12000);
    return () => clearInterval(interval);
  }, [loadJointTasks, loadSpecialTasks]);

  const handleToggleJointTask = async (task: JointTaskItem) => {
    if (!branchId) return;
    const willComplete = !task.completed;

    // Optimistic update
    setJointTasks((prev) =>
      prev.map((t) =>
        t.taskId === task.taskId
          ? {
              ...t,
              completed: willComplete,
              completedByUserId: willComplete ? session.userId : null,
              completedByUserName: willComplete ? (session.userName || "คุณ") : null,
              completedAt: willComplete ? new Date().toISOString() : null,
            }
          : t
      )
    );

    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await toggleJointTaskItemAction({
        jointWorkId: task.id,
        taskId: task.taskId,
        branchId,
        dateStr: today,
        shift: session.shift,
        userId: session.userId,
        completed: willComplete,
      });

      if (res.conflict) {
        showRowToast("error", res.message || "รายการนี้ถูกตรวจเช็คโดยเพื่อนร่วมงานแล้ว");
        void loadJointTasks();
      } else if (!res.success) {
        showRowToast("error", res.error || "เกิดข้อผิดพลาดในการบันทึก");
        void loadJointTasks();
      } else if (res.data) {
        setJointTasks((prev) =>
          prev.map((t) => (t.taskId === task.taskId ? res.data! : t))
        );
      }
    } catch (err: any) {
      showRowToast("error", err?.message || "การเชื่อมต่อขัดข้อง");
      void loadJointTasks();
    }
  };

  const handleSubmitSpecialTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submittingSpecialTask) return;
    setIsSubmittingSpecial(true);
    try {
      const res = await submitSpecialTaskAction({
        specialTaskId: submittingSpecialTask.id,
        userId: session.userId,
        comment: submissionComment.trim() || undefined,
      });
      if (res.success) {
        showRowToast("success", "ส่งมอบภารกิจพิเศษสำเร็จ! รอการอนุมัติจากผู้จัดการ");
        setSubmittingSpecialTask(null);
        setSubmissionComment("");
        void loadSpecialTasks();
      } else {
        showRowToast("error", res.error || "ไม่สามารถส่งมอบภารกิจได้");
      }
    } catch (err: any) {
      showRowToast("error", err?.message || "เกิดข้อผิดพลาดในการส่งมอบ");
    } finally {
      setIsSubmittingSpecial(false);
    }
  };

  if (session !== prevSession) {
    setPrevSession(session);
    if (session.items) {
      setItems(session.items);
    }
    setShiftCompleted(Boolean(session.completedAt));
  }

  const itemsRef = useRef(items);
  const sessionRef = useRef(session);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    itemsRef.current = items;
    sessionRef.current = session;
    onUpdateRef.current = onUpdate;
  });

  // Task Checklist Buffer & Cache for collective DB sync
  const syncTasksRef = useRef<(() => Promise<void>) | null>(null);
  const checklistCacheKey = `staff_${session.userId}_${session.shift}`;
  const {
    enqueueToggle,
    flush: flushChecklistBuffer,
    reconcile: reconcileChecklist,
    saveToCache: saveChecklistCache,
    dbSyncNotification,
    clearDbSyncNotification,
  } = useTaskChecklistBuffer({
    cacheKey: checklistCacheKey,
    onBatchSuccess: (results) => {
      setItems((prev) =>
        prev.map((item) => {
          const match = results.find((r) => r.taskId === item.id);
          if (match && match.taskWorkId && match.taskWorkId !== item.taskWorkId) {
            return { ...item, taskWorkId: match.taskWorkId };
          }
          return item;
        })
      );
      // Trigger the next DB cache checking to verify and notify user
      setTimeout(() => {
        void syncTasksRef.current?.();
      }, 1000);
    },
    onBatchError: (err) => {
      console.error("Batch checklist error in staff checklist:", err);
    },
  });

  // Background sync every 10 seconds to reflect tasks added/disabled by manager live
  useEffect(() => {
    let isMounted = true;

    async function syncTasksFromDb() {
      if (typeof document !== "undefined" && document.hidden) return;
      const currentSess = sessionRef.current;
      if (!currentSess?.userId) return;

      try {
        const res = await getOrCreateShiftSessionAction({
          userId: currentSess.userId,
          userName: currentSess.userName,
          position: currentSess.userPosition || "พนักงาน",
          shift: currentSess.shift,
        });

        if (res.success && res.session && isMounted) {
          const freshSession = res.session;
          const freshItems = freshSession.items || [];
          const curItems = itemsRef.current;

          // If session ID changed or the previous session is from a different day,
          // adopt today's fresh session completely without carrying over yesterday's completion status
          if (freshSession.id !== currentSess.id || (currentSess.startedAt && !isTodayThai(currentSess.startedAt))) {
            setItems(freshItems);
            setShiftCompleted(Boolean(freshSession.completedAt));
            onUpdateRef.current(freshSession);
            return;
          }

          const { mergedItems, hasExternalChanges } = reconcileChecklist(freshItems, curItems);
          if (hasExternalChanges || curItems.length !== freshItems.length) {
            setItems(mergedItems);
            saveChecklistCache(mergedItems, currentSess.id);
            onUpdateRef.current({
              ...currentSess,
              items: mergedItems,
            });
          }
        }
      } catch (err) {
        console.warn("Live task sync error in ChecklistPage:", err);
      }
    }

    syncTasksRef.current = syncTasksFromDb;

    const handleDateRollover = () => {
      if (isMounted) syncTasksFromDb();
    };
    window.addEventListener("app:date-rollover", handleDateRollover);
    window.addEventListener("focus", handleDateRollover);

    const interval = setInterval(syncTasksFromDb, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener("app:date-rollover", handleDateRollover);
      window.removeEventListener("focus", handleDateRollover);
    };
  }, [reconcileChecklist, saveChecklistCache]);

  const handleManualDbRefresh = useCallback(async () => {
    if (isManualRefreshing || isPageBusy) return;
    setIsManualRefreshing(true);
    try {
      await flushChecklistBuffer();
      await Promise.all([
        syncTasksRef.current ? syncTasksRef.current() : Promise.resolve(),
        loadJointTasks(),
        loadSpecialTasks(),
      ]);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("app:refresh-refrigerators"));
      }
      showRowToast("success", "ซิงค์และอัปเดตข้อมูลล่าสุดจากฐานข้อมูลเรียบร้อยแล้ว");
    } catch (err: any) {
      showRowToast("error", err?.message || "การเชื่อมต่อขัดข้อง ไม่สามารถรีเฟรชได้");
    } finally {
      setIsManualRefreshing(false);
    }
  }, [isManualRefreshing, isPageBusy, flushChecklistBuffer, loadJointTasks, loadSpecialTasks]);

  const total = items.length;
  const done = items.filter((i) => i.completedAt).length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  const allDone = progress === 100;

  const canContinueShift = hasNextShift && progress === 100 && !shiftCompleted;

  const filteredItems = items.filter((i) => {
    if (filter === "pending") return !i.completedAt;
    if (filter === "done") return !!i.completedAt;
    return true;
  });

  const [lateModalTarget, setLateModalTarget] = useState<{
    id: string;
    label: string;
    deadlineText?: string;
  } | null>(null);

  const executeToggle = useCallback(
    (targetItem: ChecklistItem, willBeDone: boolean, comment?: string | null, isLate: boolean = false) => {
      const itemId = targetItem.id;
      const nowIso = new Date().toISOString();
      const targetComment = willBeDone ? (comment ?? targetItem.comment ?? null) : null;
      const targetIsLate = willBeDone ? isLate : false;

      // 1. Optimistic local UI update + save to cache
      const updated = items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              completedAt: willBeDone ? nowIso : null,
              isLate: targetIsLate,
              comment: targetComment,
            }
          : item
      );
      setItems(updated);
      saveChecklistCache(updated, session.id);

      if (shiftCompleted) {
        setShiftCompleted(false);
      }

      const allComplete = updated.length > 0 && updated.every((i) => i.completedAt);
      let updatedSession = { ...session, completedAt: null, items: updated };
      if (allComplete && !session.notified) {
        updatedSession = { ...updatedSession, notified: true };
      }
      onUpdate(updatedSession);

      // 2. Buffer collective update debounced to database
      enqueueToggle({
        shiftSessionId: session.id,
        taskId: itemId,
        taskWorkId: targetItem.taskWorkId,
        completed: willBeDone,
        comment: willBeDone ? (targetComment || undefined) : undefined,
      });
    },
    [enqueueToggle, items, onUpdate, saveChecklistCache, session, shiftCompleted]
  );

  function handleLateReasonSubmit(reason: string) {
    if (!lateModalTarget) return;
    const targetItem = items.find((i) => i.id === lateModalTarget.id);
    if (targetItem) {
      void executeToggle(targetItem, true, reason, true);
    }
    setLateModalTarget(null);
  }

  function toggleItem(id: string) {
    const targetItem = items.find((i) => i.id === id);
    if (!targetItem) return;

    if (targetItem.completedAt) {
      // Uncheck task
      void executeToggle(targetItem, false, null, false);
      return;
    }

    let isLate = false;
    let deadlineText: string | undefined;
    if (targetItem.category) {
      const match = targetItem.category.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
      if (match) {
        const endStr = match[2];
        const [endHr, endMin] = endStr.split(":").map(Number);
        const deadlineDate = new Date(session.startedAt);
        deadlineDate.setHours(endHr, endMin, 0, 0);
        deadlineText = `${targetItem.category} (สิ้นสุด ${endStr} น.)`;
        if (new Date() > deadlineDate) {
          isLate = true;
        }
      }
    }

    if (isLate) {
      setLateModalTarget({
        id: targetItem.id,
        label: targetItem.label,
        deadlineText,
      });
      return;
    }

    void executeToggle(targetItem, true, null, false);
  }

  function handleToggleContinue() {
    if (!canContinueShift) return;
    const nextVal = !continueShift;
    setContinueShift(nextVal);
    if (typeof window !== "undefined") {
      if (nextVal) {
        secureSetItem("app_queue_afternoon", "true");
      } else {
        secureRemoveItem("app_queue_afternoon");
      }
    }
  }

  async function handleInitiateEndShift() {
    if (shiftCompleted || isValidatingDb) return;
    setIsValidatingDb(true);
    try {
      // Flush buffered toggles to DB before validating
      await flushChecklistBuffer();
      // Validate live directly from the database online
      const res = await validateShiftCompletionAction(session.id);
      if (res.success) {
        if (res.isComplete) {
          setShowConfirm(true);
        } else {
          setDbPendingTasks(res.pendingTasks || []);
          setShowIncompleteModal(true);
        }
      } else {
        // Fallback to local check if connection fails
        if (done === total && total > 0) {
          setShowConfirm(true);
        } else {
          const localPending = items.filter((i) => !i.completedAt).map((i) => ({ id: i.id, name: i.label }));
          setDbPendingTasks(localPending);
          setShowIncompleteModal(true);
        }
      }
    } catch (err) {
      console.error("Online validation check error:", err);
      if (done === total && total > 0) {
        setShowConfirm(true);
      } else {
        const localPending = items.filter((i) => !i.completedAt).map((i) => ({ id: i.id, name: i.label }));
        setDbPendingTasks(localPending);
        setShowIncompleteModal(true);
      }
    } finally {
      setIsValidatingDb(false);
    }
  }

  async function endCompleteShift() {
    if (isEnding) return;
    setIsEnding(true);
    try {
      setShiftCompleted(true);
      await flushChecklistBuffer();
      await onEndShift(continueShift);
      setShowConfirm(false);
    } catch (e) {
      console.error("Flush or end shift error:", e);
      setShiftCompleted(false);
      setIsEnding(false);
    }
  }

  async function endIncompleteShift() {
    if (!incompleteReason.trim() || isEnding) return;
    setIsEnding(true);
    try {
      setShiftCompleted(true);
      await flushChecklistBuffer();
      await onEndShift(continueShift, incompleteReason.trim());
      setShowIncompleteModal(false);
    } catch (e) {
      console.error("Flush or end incomplete shift error:", e);
      setShiftCompleted(false);
      setIsEnding(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] flex flex-col items-center pb-28 sm:pb-32 px-3 sm:px-6 pt-3 sm:pt-6">
      {/* Assistive Tech Announcements */}
      <div aria-live="polite" className="sr-only">
        ความคืบหน้าเช็คลิสต์ {done} จาก {total} รายการ ({progress}%)
      </div>

      <div className={`w-full space-y-4 transition-all ${isStockShift ? "max-w-6xl" : "max-w-2xl"}`}>
        {/* Top App Bar */}
        <nav aria-label="แถบข้อมูลผู้ใช้งานและเครื่องมือ" className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl px-2.5 sm:px-4 py-2 sm:py-3 shadow-xs flex items-center justify-between gap-1.5 sm:gap-4 relative z-20">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
            <UserAvatar
              user={currentUser || { name: session.userName, role: session.taskRole as any }}
              size="sm"
              editable={true}
              onEdit={() => setIsEditProfileOpen(true)}
              title={`${session.userName} • คลิกเพื่อแก้ไขโปรไฟล์`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs sm:text-sm font-extrabold text-[var(--color-text)] truncate max-w-[120px] sm:max-w-none">
                  {session.branchName || "สาขาหลัก"}
                </span>
                {session.userPosition && (
                  <span className="text-[11px] sm:text-xs font-semibold text-[var(--color-text)] bg-[var(--color-surface-2)] px-1.5 sm:px-2 py-0.5 rounded-full border border-[var(--color-border)] shrink-0">
                    {session.userPosition}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsEditProfileOpen(true)}
                className="text-xs sm:text-sm font-bold text-[var(--color-text)] hover:text-amber-700 dark:hover:text-amber-400 truncate leading-tight cursor-pointer text-left block"
                title="คลิกเพื่อแก้ไขโปรไฟล์"
              >
                {session.userName}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <PointStreakBadge />
            <RoleSwitcher />
            <NotificationCenter />
            <ThemeToggle />

            {/* Manual DB Refresh Button */}
            <button
              type="button"
              disabled={isPageBusy || isManualRefreshing}
              onClick={handleManualDbRefresh}
              aria-label="รีเฟรชข้อมูลล่าสุดจากฐานข้อมูล (Sync DB)"
              title="รีเฟรชข้อมูลล่าสุดจากฐานข้อมูล (Sync DB)"
              className="p-1.5 sm:p-2 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] hover:text-amber-700 hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-950/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer min-w-[36px] min-h-[36px] inline-flex items-center justify-center relative group"
            >
              <RefreshCw
                size={16}
                className={isManualRefreshing ? "animate-spin text-amber-600 dark:text-amber-400" : "transition-transform group-hover:rotate-45"}
              />
            </button>
            
            {onOpenDashboard && (
              <button
                type="button"
                disabled={isPageBusy}
                onClick={async () => {
                  try {
                    await flushChecklistBuffer();
                  } catch (e) {
                    console.warn("Flush before opening dashboard:", e);
                  }
                  onOpenDashboard();
                }}
                aria-label="เปิดหน้าแดชบอร์ด"
                className="p-1.5 sm:p-2 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] hover:text-[var(--color-text)] hover:bg-[var(--color-border-subtle)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer min-w-[36px] min-h-[36px] inline-flex items-center justify-center"
                title="เปิดหน้าแดชบอร์ด"
              >
                <LayoutDashboard size={16} />
              </button>
            )}

            <button
              type="button"
              disabled={isPageBusy}
              onClick={() => setShowExitConfirm(true)}
              className="p-1.5 sm:p-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text)] hover:text-rose-700 hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 dark:hover:border-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer min-w-[36px] min-h-[36px] inline-flex items-center justify-center"
              title="ออกจากหน้าเช็คลิสต์"
              aria-label="ออกจากหน้าเช็คลิสต์"
            >
              <LogOut size={16} />
            </button>
          </div>
        </nav>

        {/* Hero Progress Banner */}
        <header className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              {getShiftBadge(session.shift)}
              <span className="text-xs sm:text-sm font-mono text-[var(--color-text)] flex items-center gap-1 font-semibold">
                <Clock size={14} className="text-amber-600" />
                เริ่ม {fmtTime(session.startedAt)}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-bold text-[var(--color-text)]">เสร็จสิ้น</span>
              <span className="text-base sm:text-lg font-extrabold font-mono text-[var(--color-text)]">
                {done}<span className="text-xs sm:text-sm text-[var(--color-text-muted)] font-bold">/{total}</span>
              </span>
            </div>
          </div>

          {/* Progress Bar Track */}
          <div className="relative w-full h-2.5 bg-[var(--color-border-subtle)] rounded-full overflow-hidden p-0.5 border border-[var(--color-border-subtle)]">
            <div
              className={`h-full rounded-full transition-all duration-300 ease-out ${
                allDone ? "bg-emerald-600" : "bg-amber-500"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-2.5 flex items-center justify-between text-xs sm:text-sm">
            <span className="font-semibold text-[var(--color-text)] flex items-center gap-1.5">
              {allDone ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 font-bold text-xs shadow-2xs">
                  <Sparkles size={13} className="text-emerald-600 dark:text-emerald-400" />
                  <span>ร้านสด สะอาด พร้อมบริการ 100% ครบทุกข้อ!</span>
                </span>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>เหลืออีก {total - done} ข้อในการปฏิบัติงาน</span>
                </>
              )}
            </span>
            <span className={`font-mono font-black text-xs sm:text-sm ${allDone ? "text-emerald-700 dark:text-emerald-300" : "text-[var(--color-text)]"}`}>
              {progress}%
            </span>
          </div>
        </header>

        {/* Feedback toast for Row 2 & 3 */}
        {rowToast && (
          <div className="fixed top-5 right-5 z-50 animate-bounce">
            <div
              className={`px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs sm:text-sm font-bold border ${
                rowToast.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                  : "bg-rose-50 dark:bg-rose-950 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200"
              }`}
            >
              {rowToast.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{rowToast.text}</span>
            </div>
          </div>
        )}

        {/* Main Tab Navigation for Mobile & Desktop */}
        <div
          role="tablist"
          aria-label="หมวดหมู่งานเช็คลิสต์"
          className="grid grid-cols-3 bg-[var(--color-surface)] p-1 sm:p-1.5 rounded-2xl border border-[var(--color-border)] shadow-xs gap-1 sm:gap-2 sticky top-2 z-30 backdrop-blur-md bg-[var(--color-surface)]/95"
        >
          {/* Tab 1: งานประจำกะ */}
          <button
            type="button"
            role="tab"
            aria-selected={activeMainTab === "shift"}
            onClick={() => setActiveMainTab("shift")}
            className={`py-2 sm:py-2.5 px-1.5 sm:px-3 rounded-xl flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition-all cursor-pointer select-none text-center ${
              activeMainTab === "shift"
                ? "bg-amber-500 text-amber-950 font-black shadow-xs dark:bg-amber-400"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] font-bold"
            }`}
          >
            <div className="flex items-center gap-1">
              <CheckCircle2 size={15} className={activeMainTab === "shift" ? "text-amber-950" : "text-amber-600 dark:text-amber-400"} />
              <span className="text-xs sm:text-sm truncate">งานประจำกะ</span>
            </div>
            <span
              className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-mono font-extrabold ${
                activeMainTab === "shift"
                  ? "bg-amber-600/25 text-amber-950"
                  : allDone
                  ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                  : "bg-[var(--color-surface-2)] text-[var(--color-text)] border border-[var(--color-border)]"
              }`}
            >
              {done}/{total}
            </span>
          </button>

          {/* Tab 2: งานส่วนกลาง */}
          <button
            type="button"
            role="tab"
            aria-selected={activeMainTab === "joint"}
            onClick={() => setActiveMainTab("joint")}
            className={`py-2 sm:py-2.5 px-1.5 sm:px-3 rounded-xl flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition-all cursor-pointer select-none text-center ${
              activeMainTab === "joint"
                ? "bg-sky-600 text-white font-black shadow-xs dark:bg-sky-500"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] font-bold"
            }`}
          >
            <div className="flex items-center gap-1">
              <Users size={15} className={activeMainTab === "joint" ? "text-white" : "text-sky-600 dark:text-sky-400"} />
              <span className="text-xs sm:text-sm truncate">งานส่วนกลาง</span>
            </div>
            <span
              className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-bold ${
                activeMainTab === "joint"
                  ? "bg-white/20 text-white"
                  : "bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-200"
              }`}
            >
              ตู้แช่ • {jointTasks.length}
            </span>
          </button>

          {/* Tab 3: ภารกิจพิเศษ */}
          <button
            type="button"
            role="tab"
            aria-selected={activeMainTab === "special"}
            onClick={() => setActiveMainTab("special")}
            className={`py-2 sm:py-2.5 px-1.5 sm:px-3 rounded-xl flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition-all cursor-pointer select-none text-center ${
              activeMainTab === "special"
                ? "bg-amber-600 text-white font-black shadow-xs dark:bg-amber-500"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] font-bold"
            }`}
          >
            <div className="flex items-center gap-1">
              <Sparkles size={15} className={activeMainTab === "special" ? "text-white" : "text-amber-600 dark:text-amber-400"} />
              <span className="text-xs sm:text-sm truncate">ภารกิจพิเศษ</span>
            </div>
            <span
              className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-bold ${
                activeMainTab === "special"
                  ? "bg-white/20 text-white"
                  : specialTasks.length > 0
                  ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                  : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
              }`}
            >
              {specialTasks.length}
            </span>
          </button>
        </div>

        {/* Tab Contents Container - Components remain mounted in DOM to prevent extra DB refetches on tab switch */}
        <div className="space-y-4">
          {/* ═══════════════════════════════════════════════════════════════════
              TAB 1: งานประจำวันของฉัน (Daily Shift Tasks)
          ═══════════════════════════════════════════════════════════════════ */}
          <div className={activeMainTab === "shift" ? "block space-y-4" : "hidden"}>
            <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--color-surface)] p-4 rounded-2xl border border-[var(--color-border)] shadow-xs">
              <div>
                <h2 className="text-base sm:text-lg font-black text-[var(--color-text)] flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>แถวที่ 1: งานประจำวันของฉัน (Daily Tasks)</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 font-extrabold">
                    {session.shift === "morning" ? "กะเช้า" : session.shift === "afternoon" ? "กะบ่าย" : session.shift === "night" ? "กะดึก/ปิดร้าน" : "ทุกช่วงกะ"}
                  </span>
                </h2>
                <p className="text-xs text-[var(--color-text-muted)] font-medium mt-0.5">
                  รายการงานประจำกะที่ต้องตรวจเช็คให้ครบถ้วนเพื่อส่งมอบงานจบกะ
                </p>
              </div>

              {/* Filter Segmented Control */}
              <div
                role="tablist"
                aria-label="กรองรายการเช็คลิสต์"
                className="flex bg-[var(--color-surface-2)] p-1 rounded-xl text-xs font-semibold gap-1 border border-[var(--color-border)] shadow-2xs self-start sm:self-auto"
              >
                {(["all", "pending", "done"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    disabled={isPageBusy}
                    aria-selected={filter === t}
                    onClick={() => setFilter(t)}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold text-xs ${
                      filter === t
                        ? "bg-[var(--color-brown)] text-amber-200 dark:bg-amber-400 dark:text-amber-950 shadow-xs"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    {t === "all" ? `ทั้งหมด (${total})` : t === "pending" ? `รอดำเนินการ (${total - done})` : `เสร็จแล้ว (${done})`}
                  </button>
                ))}
              </div>
            </div>

        {/* Shift Completed Notice Banner */}
        {shiftCompleted && (
          <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5 text-xs sm:text-sm text-amber-950 dark:text-amber-200">
              <Sparkles size={18} className="text-amber-600 shrink-0" />
              <div>
                <p className="font-extrabold">กะการทำงานนี้ได้รับการบันทึกจบกะแล้ว</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">คุณสามารถคลิกที่รายการด้านล่างเพื่อตรวจเช็คหรือแก้ไขต่อได้ตลอดเวลา</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setShiftCompleted(false);
                onUpdate({ ...session, completedAt: null });
              }}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-amber-950 font-extrabold text-xs transition-colors cursor-pointer shrink-0 shadow-2xs"
            >
              ปลดล็อคเพื่อทำรายการต่อ
            </button>
          </div>
        )}

        {/* Tactile Checklist Cards */}
        <div className="space-y-2.5" role="group" aria-label="รายการตรวจสอบประจำกะ">
          {filteredItems.map((item, idx) => {
            const isDone = !!item.completedAt;
            const originalIndex = items.findIndex((i) => i.id === item.id);
            const prevItem = idx > 0 ? filteredItems[idx - 1] : null;
            const showCategoryHeader = item.category && (!prevItem || prevItem.category !== item.category);

            return (
              <div key={item.id} className="space-y-1.5">
                {showCategoryHeader && (() => {
                  const catTheme = getCategoryColor(item.category);
                  return (
                    <div className="pt-3 pb-1 flex items-center gap-2 px-1">
                      <span className={`w-2 h-2 rounded-full ${catTheme.dot}`} aria-hidden="true" />
                      <h2 className={`text-xs font-bold tracking-wide uppercase ${catTheme.text}`}>
                        {item.category}
                      </h2>
                    </div>
                  );
                })()}
                
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isDone}
                  disabled={isPageBusy || shiftCompleted}
                  onClick={() => !(isPageBusy || shiftCompleted) && toggleItem(item.id)}
                  className={`w-full group flex items-start gap-3.5 p-4 rounded-2xl border text-left transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 active:scale-[0.99] ${
                    isDone
                      ? "bg-[var(--color-surface-2)]/80 border-[var(--color-border)] shadow-2xs"
                      : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-amber-400 hover:bg-amber-50/70 dark:hover:bg-amber-950/20 shadow-xs hover:shadow-sm"
                  }`}
                >
                  {/* Checkbox Visual Toggle Target */}
                  <div
                    className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-transform duration-150 group-active:scale-90 ${
                      isDone
                        ? "border-emerald-600 bg-emerald-600 text-white shadow-2xs"
                        : "border-[var(--color-border)] bg-[var(--color-surface)] group-hover:border-amber-400"
                    }`}
                  >
                    {isDone && (
                      <Check size={14} strokeWidth={3} className="animate-in zoom-in-50 duration-150" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-start gap-2">
                        <span
                          className={`text-xs font-mono select-none pt-0.5 shrink-0 ${
                            isDone ? "text-[var(--color-text-muted)] font-bold" : "text-[var(--color-text)] font-extrabold"
                          }`}
                          aria-hidden="true"
                        >
                          {String(originalIndex + 1).padStart(2, "0")}
                        </span>
                        <p
                          className={`text-sm sm:text-base leading-snug transition-all ${
                            isDone
                              ? "text-[var(--color-text-muted)] line-through font-medium"
                              : "text-[var(--color-text)] font-medium"
                          }`}
                        >
                          {item.label}
                        </p>
                      </div>
                      {(item.forManagers || item.isSpecial || item.zeroPoints) && (
                        <div className="pl-0 sm:pl-6">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-900 dark:text-amber-300 border border-amber-400/40">
                            🛡️ ชุดงานกะดึก/ปิดร้าน (0 แต้ม • แชร์ร่วมระดับสาขา)
                          </span>
                        </div>
                      )}
                    </div>

                    {isDone && item.completedAt && (() => {
                      let isLate = item.isLate ?? false;
                      if (!isLate && item.category) {
                        const match = item.category.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
                        if (match) {
                          const endStr = match[2];
                          const [endHr, endMin] = endStr.split(":").map(Number);
                          const completedDate = new Date(item.completedAt);
                          const deadlineDate = new Date(session.startedAt);
                          deadlineDate.setHours(endHr, endMin, 0, 0);
                          if (completedDate > deadlineDate) {
                            isLate = true;
                          }
                        }
                      }

                      return (
                        <div className="flex flex-col gap-1 mt-2 pl-0 sm:pl-6">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono text-emerald-900 dark:text-emerald-300 font-bold">
                            <CheckCircle2 size={13} className="text-emerald-700" />
                            <span>บันทึกเมื่อ {fmtTime(item.completedAt)}</span>
                            {item.completedByName && (
                              <span className="text-xs font-sans text-emerald-950 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-md border border-emerald-300/60 font-medium">
                                ตรวจโดย {item.completedByName}
                              </span>
                            )}
                            {isLate && (
                              <span className="text-rose-950 dark:text-rose-200 font-bold bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 px-1.5 py-0.5 rounded-md ml-1">
                                (ล่าช้า)
                              </span>
                            )}
                          </div>
                          {item.comment && (
                            <div className="text-xs text-rose-900 dark:text-rose-300 bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-lg px-2.5 py-1 flex items-start gap-1.5 font-sans font-normal">
                              <span className="font-semibold shrink-0">เหตุผล:</span>
                              <span className="break-words">{item.comment}</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </button>
              </div>
            );
          })}

          {filteredItems.length === 0 && (
            <div className="p-8 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-xs">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center justify-center mx-auto mb-2.5">
                {filter === "pending" ? <Sparkles size={24} /> : <Check size={24} />}
              </div>
              <p className="text-sm sm:text-base font-extrabold text-[var(--color-text)]">
                {filter === "pending" ? "ยอดเยี่ยม! ตรวจเช็คครบถ้วนทุกข้อแล้ว" : "ไม่มีรายการในหมวดนี้"}
              </p>
              <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-1.5 max-w-sm mx-auto leading-relaxed font-medium">
                {filter === "pending"
                  ? "ไม่มีงานค้างในหมวดนี้แล้ว คุณสามารถตรวจทานข้ออื่นหรือกดส่งมอบงานจบกะได้ทันที"
                  : "ยังไม่มีรายการที่ได้รับการบันทึก"}
              </p>
            </div>
          )}
        </div>
      </section>
    </div>

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 2: งานส่วนกลาง (Joint Tasks & Refrigerator Checks)
          ═══════════════════════════════════════════════════════════════════ */}
          <div className={activeMainTab === "joint" ? "block space-y-4" : "hidden"}>
            <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--color-surface)] p-4 rounded-2xl border border-[var(--color-border)] shadow-xs">
              <div>
                <h2 className="text-base sm:text-lg font-black text-[var(--color-text)] flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                  <span>แถวที่ 2: งานส่วนกลาง (Joint Tasks)</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-900 dark:text-sky-200 font-extrabold">
                    แชร์ร่วมในสาขา
                  </span>
                </h2>
                <p className="text-xs text-[var(--color-text-muted)] font-medium mt-0.5">
                  งานที่หลายคนช่วยกันตรวจเช็คได้ พร้อมระบบป้องกันการเขียนทับซ้อน (Concurrency Safe)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsJointModalOpen(true)}
                  className="px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text)] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Users size={15} className="text-sky-600 dark:text-sky-400" />
                  <span>ดูรายละเอียดผู้ร่วมงาน</span>
                </button>
              </div>
            </div>

            {/* Joint sub-tabs: Refrigerators vs Other Joint Tasks */}
            <div className="flex bg-[var(--color-surface-2)] p-1 rounded-xl border border-[var(--color-border)] text-xs font-bold gap-1">
              <button
                type="button"
                onClick={() => setJointSubTab("refrigerators")}
                className={`flex-1 py-2 rounded-lg text-center cursor-pointer transition-all ${
                  jointSubTab === "refrigerators"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                ❄️ ตรวจเช็คตู้แช่สาขา (รอบเช้า & รอบบ่าย)
              </button>
              <button
                type="button"
                onClick={() => setJointSubTab("joint_tasks")}
                className={`flex-1 py-2 rounded-lg text-center cursor-pointer transition-all ${
                  jointSubTab === "joint_tasks"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                🤝 รายการงานส่วนกลางอื่น ๆ ({jointTasks.length})
              </button>
            </div>

            {/* Always keep BranchRefrigeratorChecklist mounted so switching tabs never causes extra DB fetches */}
            <div className={jointSubTab === "refrigerators" ? "block" : "hidden"}>
              <BranchRefrigeratorChecklist
                userId={session.userId}
                userName={session.userName}
                branchName={session.branchName}
                shiftSessionId={session.id}
                shift={session.shift}
              />
            </div>

            <div className={jointSubTab === "joint_tasks" ? "block space-y-2.5" : "hidden"}>
                {jointTasks.length === 0 ? (
                  <div className="p-8 text-center bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-2xl">
                    <Users size={32} className="mx-auto text-[var(--color-text-muted)] mb-2" />
                    <p className="text-sm font-bold text-[var(--color-text)]">ไม่มีรายการงานส่วนกลางเพิ่มเติมสำหรับตำแหน่งนี้</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">ผู้จัดการสามารถกำหนดงานส่วนกลางได้จากระบบจัดการเช็คลิสต์</p>
                  </div>
                ) : (
                  jointTasks.map((jt) => (
                    <div
                      key={jt.id}
                      className={`p-4 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                        jt.completed
                          ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-500/30"
                          : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-sky-400"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => void handleToggleJointTask(jt)}
                          className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer ${
                            jt.completed
                              ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                              : "border-[var(--color-border)] hover:border-sky-500 bg-[var(--color-surface)]"
                          }`}
                        >
                          {jt.completed && <Check size={14} strokeWidth={3} />}
                        </button>
                        <div>
                          <p className={`text-sm font-extrabold ${jt.completed ? "line-through text-[var(--color-text-muted)]" : "text-[var(--color-text)]"}`}>
                            {jt.name}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mt-1 flex-wrap">
                            {jt.category && (
                              <span className="px-2 py-0.5 rounded-md bg-[var(--color-surface-2)] font-semibold">
                                {jt.category}
                              </span>
                            )}
                            {jt.completed ? (
                              <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                                ✓ ตรวจแล้วโดย {jt.completedByUserName || "เพื่อนร่วมงาน"}{jt.completedAt ? ` เมื่อ ${fmtTime(jt.completedAt)} น.` : ""}
                              </span>
                            ) : (
                              <span>รอดำเนินการตรวจเช็ค</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
          </section>
        </div>

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 3: ภารกิจพิเศษ (Special Period Tasks)
          ═══════════════════════════════════════════════════════════════════ */}
          <div className={activeMainTab === "special" ? "block space-y-4" : "hidden"}>
            <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--color-surface)] p-4 rounded-2xl border border-[var(--color-border)] shadow-xs">
              <div>
                <h2 className="text-base sm:text-lg font-black text-[var(--color-text)] flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>แถวที่ 3: ภารกิจพิเศษ (Special Period Tasks)</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 font-extrabold">
                    {specialTasks.length} ภารกิจ
                  </span>
                </h2>
                <p className="text-xs text-[var(--color-text-muted)] font-medium mt-0.5">
                  ภารกิจที่ได้รับมอบหมายตามช่วงเวลา พร้อมคะแนนพิเศษและเงื่อนไขรักษาสตรีค
                </p>
              </div>
            </div>

            {specialTasks.length === 0 ? (
              <div className="p-8 text-center bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-2xl">
                <Sparkles size={32} className="mx-auto text-[var(--color-text-muted)] mb-2" />
                <p className="text-sm font-bold text-[var(--color-text)]">ไม่มีภารกิจพิเศษที่เปิดอยู่ในขณะนี้</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">เมื่อผู้จัดการออกภารกิจใหม่ จะปรากฏในแถวนี้โดยอัตโนมัติ</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {specialTasks.map((st) => (
                  <div
                    key={st.id}
                    className="p-4 sm:p-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-extrabold text-sm sm:text-base text-[var(--color-text)]">
                            {st.title}
                          </h3>
                          <p className="text-xs text-[var(--color-text-muted)] mt-1 line-clamp-3">
                            {st.description || "ไม่มีรายละเอียดเพิ่มเติม"}
                          </p>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-xl text-xs font-black uppercase tracking-wider shrink-0 ${
                            st.status === "approved"
                              ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                              : st.status === "submitted"
                              ? "bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300"
                              : st.status === "declined"
                              ? "bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300"
                              : "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
                          }`}
                        >
                          {st.status === "approved"
                            ? "อนุมัติแล้ว"
                            : st.status === "submitted"
                            ? "รออนุมัติ"
                            : st.status === "declined"
                            ? "ไม่อนุมัติ"
                            : "รอดำเนินการ"}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-xs pt-1">
                        <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-300 font-extrabold flex items-center gap-1">
                          <Flame size={12} />
                          +{st.pointsReward} คะแนนพิเศษ
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-[var(--color-surface-2)] text-[var(--color-text-muted)] font-medium flex items-center gap-1">
                          <Calendar size={12} />
                          {st.startDate} ถึง {st.endDate}
                        </span>
                        {st.penaltyStreak ? (
                          <span className="px-2 py-0.5 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 font-bold flex items-center gap-1">
                            <ShieldAlert size={12} />
                            สตรีคเสียหายหากไม่สำเร็จ
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold">
                            ไม่กระทบสตรีค
                          </span>
                        )}
                      </div>

                      {st.submissionComment && (
                        <div className="p-2 rounded-xl bg-[var(--color-surface-2)] text-xs text-[var(--color-text)]">
                          <span className="font-bold text-[var(--color-text-muted)]">บันทึกการส่งมอบ: </span>
                          {st.submissionComment}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between">
                      <span className="text-[11px] text-[var(--color-text-muted)]">
                        มอบหมายโดย: {st.issuedByUserName}
                      </span>
                      {st.status === "pending" && (
                        <button
                          type="button"
                          onClick={() => {
                            setSubmittingSpecialTask(st);
                            setSubmissionComment("");
                          }}
                          className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-amber-950 font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        >
                          <Send size={13} />
                          <span>ส่งมอบงานภารกิจ</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>

      {/* Modals for Joint Tasks & Special Tasks */}
      <JointTaskDetailsModal
        isOpen={isJointModalOpen}
        onClose={() => setIsJointModalOpen(false)}
        branchId={branchId || ""}
        dateStr={new Date().toISOString().split("T")[0]}
        shift={session.shift}
      />

      {submittingSpecialTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <h3 className="text-base font-extrabold text-[var(--color-text)] flex items-center gap-2">
                <Sparkles size={18} className="text-amber-500" />
                <span>ส่งมอบภารกิจพิเศษ</span>
              </h3>
              <button
                onClick={() => setSubmittingSpecialTask(null)}
                className="p-1 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitSpecialTask} className="space-y-3">
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">ชื่อภารกิจ:</p>
                <p className="text-sm font-bold text-[var(--color-text)]">{submittingSpecialTask.title}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                  หมายเหตุ / บันทึกผลการดำเนินงาน (ไม่บังคับ)
                </label>
                <textarea
                  rows={3}
                  value={submissionComment}
                  onChange={(e) => setSubmissionComment(e.target.value)}
                  placeholder="เช่น ทำความสะอาดและจัดเรียงสินค้าเสร็จสิ้นตามมาตรฐานแล้ว..."
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs text-[var(--color-text)]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
                <button
                  type="button"
                  onClick={() => setSubmittingSpecialTask(null)}
                  className="px-3.5 py-2 rounded-xl border border-[var(--color-border)] text-xs font-bold text-[var(--color-text)] cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSpecial}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-amber-950 text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Send size={13} />
                  <span>{isSubmittingSpecial ? "กำลังส่ง..." : "ยืนยันส่งมอบ"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sticky Bottom Ergonomic Action Dock (Floor Staff Thumb Zone) */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--color-surface)]/95 backdrop-blur-md border-t border-[var(--color-border)] p-2.5 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-md">
        <div className={`mx-auto flex items-center justify-between gap-2 sm:gap-3 ${isStockShift ? "max-w-6xl" : "max-w-2xl"}`}>
          {/* Progress pill indicator */}
          <div className="flex flex-col shrink-0">
            <span className="text-[11px] sm:text-xs font-bold text-[var(--color-text)] leading-tight">
              ความคืบหน้ารวม
            </span>
            <span className="text-xs sm:text-sm font-extrabold font-mono text-[var(--color-text)]">
              {progress}% <span className="text-[11px] sm:text-xs text-[var(--color-text-muted)] font-bold">({done}/{total})</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 justify-end">
            {/* Optional "ต่อกะ" Toggle for Morning Shift */}
            {hasNextShift && !shiftCompleted && (
              <button
                type="button"
                disabled={!canContinueShift || isPageBusy}
                onClick={handleToggleContinue}
                className={`text-xs sm:text-sm px-2 sm:px-3 py-2 sm:py-2.5 rounded-xl border font-bold flex items-center gap-1 transition-colors min-h-[40px] sm:min-h-[44px] cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
                  !canContinueShift || isPageBusy
                    ? "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border-[var(--color-border)] cursor-not-allowed"
                    : continueShift
                    ? "bg-[var(--color-brown)] text-amber-100 dark:bg-amber-400 dark:text-amber-950 border-[var(--color-text)] shadow-xs"
                    : "bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border)] hover:border-amber-500"
                }`}
                title={canContinueShift ? "เลือกต่อกะบ่าย" : "ต้องครบ 100% ก่อนจึงจะเลือกต่อกะ"}
              >
                <ArrowRight size={14} strokeWidth={2.2} />
                <span className="hidden sm:inline">{continueShift ? "ต่อกะบ่าย (เลือกแล้ว)" : "ต่อกะบ่าย"}</span>
                <span className="sm:hidden">{continueShift ? "ต่อกะ ✓" : "ต่อกะ"}</span>
              </button>
            )}

            {/* Primary Action Button: "จบกะงาน" */}
            <button
              type="button"
              disabled={shiftCompleted || isPageBusy}
              onClick={handleInitiateEndShift}
              className={`text-xs sm:text-sm px-2.5 sm:px-5 py-2 sm:py-2.5 rounded-xl font-extrabold flex items-center justify-center gap-1.5 min-h-[40px] sm:min-h-[44px] transition-all cursor-pointer shadow-xs min-w-0 truncate ${
                shiftCompleted
                  ? "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] font-bold border border-[var(--color-border)] cursor-not-allowed shadow-none"
                  : isPageBusy
                  ? "bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/40 cursor-wait opacity-60"
                  : allDone
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow-md active:scale-95 ring-2 ring-emerald-400/40"
                  : "bg-amber-600 hover:bg-amber-700 text-white shadow-sm hover:shadow-md active:scale-95"
              }`}
            >
              {isValidatingDb ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
                  <span>กำลังตรวจสถานะออนไลน์...</span>
                </>
              ) : allDone ? (
                <>
                  <Sparkles size={15} className="shrink-0" />
                  <span>ส่งมอบงานจบกะ</span>
                </>
              ) : (
                <>
                  <AlertCircle size={15} className="shrink-0" />
                  <span className="hidden sm:inline">จบกะงาน </span>
                  <span className="truncate">(เหลืองาน {total - done} ข้อ)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </footer>

      {/* Confirmation Finish Modal for 100% Completed */}
      {showConfirm && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 px-4 animate-in fade-in duration-150"
          onClick={() => setShowConfirm(false)}
          onKeyDown={handleConfirmKeyDown}
        >
          <div
            ref={confirmDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-shift-title"
            tabIndex={-1}
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 sm:p-7 w-full max-w-sm focus-visible:outline-none shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-amber-950 flex items-center justify-center mb-3.5 shadow-xs">
              <Sparkles size={22} />
            </div>

            <h2 id="confirm-shift-title" className="text-lg sm:text-xl font-extrabold text-[var(--color-text)] mb-2">
              ยืนยันการส่งมอบงานจบกะ?
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] mb-4 leading-relaxed font-medium">
              คุณได้ตรวจสอบเช็คลิสต์ครบถ้วนสมบูรณ์ 100% แล้ว (ตรวจสอบสดจากฐานข้อมูลเรียบร้อย) เมื่อกดยืนยัน ระบบจะบันทึกผลและส่งแจ้งเตือนไปยังผู้จัดการร้านเพื่อตรวจรับรอง
            </p>

            {continueShift && (
              <div className="mb-5 p-3 rounded-xl bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-200 text-xs font-bold flex items-center gap-2">
                <Check size={14} className="text-amber-800 shrink-0" />
                <span>เลือกต่อกะไว้: ระบบจะเริ่มเช็คลิสต์ของกะบ่ายให้อัตโนมัติ</span>
              </div>
            )}

            <div className="flex gap-2.5">
              <button
                type="button"
                disabled={isEnding}
                onClick={() => setShowConfirm(false)}
                className="flex-1 min-h-[44px] sm:min-h-[36px] py-2.5 rounded-xl border border-[var(--color-border)] text-xs sm:text-sm font-bold text-[var(--color-text)] hover:bg-[var(--color-surface-2)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                กลับไปตรวจทาน
              </button>
              <button
                type="button"
                disabled={isEnding}
                onClick={endCompleteShift}
                className="flex-1 min-h-[44px] sm:min-h-[36px] py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-amber-400 text-amber-950 text-xs sm:text-sm font-extrabold transition-all shadow-sm cursor-pointer"
              >
                {isEnding ? "กำลังส่งมอบงาน..." : "ส่งมอบงานจบกะ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Incomplete Shift Reason Modal */}
      {showIncompleteModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 px-4 animate-in fade-in duration-150"
          onClick={() => setShowIncompleteModal(false)}
          onKeyDown={handleIncompleteKeyDown}
        >
          <div
            ref={incompleteDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="incomplete-modal-title"
            tabIndex={-1}
            className="bg-[var(--color-surface)] border border-amber-500/50 rounded-2xl p-5 sm:p-7 w-full max-w-md focus-visible:outline-none shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 flex items-center justify-center shrink-0 shadow-xs">
                <AlertCircle size={24} />
              </div>
              <div>
                <h2 id="incomplete-modal-title" className="text-base sm:text-lg font-extrabold text-[var(--color-text)]">
                  แจ้งจบกะงาน (มีงานค้าง)
                </h2>
                <p className="text-xs text-[var(--color-text-muted)] font-medium">
                  ตรวจสอบสดจากฐานข้อมูลออนไลน์ (Live DB Verified)
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-950 dark:text-amber-200 space-y-1.5">
              <div className="font-extrabold flex items-center gap-1.5">
                <span>⚠️ ตรวจพบงานที่ยังไม่ได้ทำ {dbPendingTasks.length} รายการ</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-900/80 dark:text-amber-300/80">
                คุณสามารถจบกะได้ แต่จำเป็นต้องระบุเหตุผลเพื่อส่งให้ผู้จัดการและผู้ช่วยผู้จัดการพิจารณาดำเนินการ
              </p>
            </div>

            {/* List of pending tasks */}
            {dbPendingTasks.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-[var(--color-text-muted)]">
                  รายการงานคงค้างในระบบ ({dbPendingTasks.length} ข้อ):
                </span>
                <div className="max-h-28 overflow-y-auto p-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs space-y-1">
                  {dbPendingTasks.map((t, idx) => (
                    <div key={t.id || idx} className="flex items-start gap-1.5 text-[var(--color-text)] font-medium">
                      <span className="text-amber-600 font-bold shrink-0">•</span>
                      <span className="break-words leading-tight">{t.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reason Textarea */}
            <div className="space-y-1.5">
              <label htmlFor="incomplete-shift-reason" className="text-xs font-bold text-[var(--color-text)] flex items-center justify-between">
                <span>ระบุเหตุผลที่ทำงานไม่ครบก่อนจบกะ <span className="text-rose-500">*</span></span>
                <span className="text-[10px] text-[var(--color-text-muted)] font-normal">จำเป็นต้องระบุ</span>
              </label>
              <textarea
                id="incomplete-shift-reason"
                rows={3}
                value={incompleteReason}
                onChange={(e) => setIncompleteReason(e.target.value)}
                placeholder="เช่น สินค้าหมดสต็อก, มีเหตุฉุกเฉินหน้าร้าน, ป่วยกะทันหัน, ลูกค้าหน้าร้านแน่นมาก ฯลฯ"
                className="w-full text-xs sm:text-sm p-3 rounded-xl border border-[var(--color-border)] focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-[var(--color-surface)] text-[var(--color-text)] resize-none transition-all placeholder:text-[var(--color-text-muted)]/60"
              />
            </div>

            <div className="p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[11px] text-[var(--color-text-muted)] leading-relaxed">
              <span className="font-bold text-[var(--color-text)]">ℹ️ ผลกระทบการจบกะงานไม่ครบ:</span> เหตุผลของคุณจะถูกส่งแจ้งเตือนไปยังผู้จัดการร้านและผู้ช่วยผู้จัดการร้านทันที ผู้บริหารสามารถเลือกพิจารณาได้ว่า: <strong>อนุโลม (ไม่ลงโทษ)</strong>, <strong>หักคะแนน</strong>, <strong>ตัดสตรีคเป็น 0</strong> หรือ <strong>หักโควตาลา</strong> (คล้ายระบบลางาน)
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                disabled={isEnding}
                onClick={() => setShowIncompleteModal(false)}
                className="flex-1 min-h-[44px] sm:min-h-[36px] py-2.5 rounded-xl border border-[var(--color-border)] text-xs sm:text-sm font-bold text-[var(--color-text)] hover:bg-[var(--color-surface-2)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                กลับไปตรวจต่อ
              </button>
              <button
                type="button"
                disabled={!incompleteReason.trim() || isEnding}
                onClick={endIncompleteShift}
                className="flex-1 min-h-[44px] sm:min-h-[36px] py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-amber-400 text-amber-950 text-xs sm:text-sm font-extrabold transition-all shadow-sm cursor-pointer"
              >
                {isEnding ? "กำลังส่งเหตุผล..." : "ยืนยันจบกะและส่งเหตุผล"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exit Modal */}
      {showExitConfirm && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 px-4 animate-in fade-in duration-150"
          onClick={() => setShowExitConfirm(false)}
          onKeyDown={handleExitKeyDown}
        >
          <div
            ref={exitDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="exit-modal-title"
            tabIndex={-1}
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 sm:p-7 w-full max-w-sm focus-visible:outline-none shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-center justify-center mb-3.5 shadow-xs">
              <AlertCircle size={22} />
            </div>
            
            <h2 id="exit-modal-title" className="text-lg sm:text-xl font-extrabold text-[var(--color-text)] mb-2">
              ต้องการออกจากหน้าเช็คลิสต์?
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] mb-5 leading-relaxed font-medium">
              ความคืบหน้าข้อที่ตรวจเสร็จแล้วได้รับการบันทึกลงฐานข้อมูลเรียบร้อย คุณสามารถกลับมาตรวจต่อได้ตลอดเวลาก่อนหมดเวลากะ
            </p>

            <div className="flex gap-2.5">
              <button
                type="button"
                disabled={isPageBusy}
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 min-h-[44px] sm:min-h-[36px] py-2.5 rounded-xl border border-[var(--color-border)] text-xs sm:text-sm font-bold text-[var(--color-text)] hover:bg-[var(--color-surface-2)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                อยู่ตรวจเช็คลิสต์ต่อ
              </button>
              <button
                type="button"
                disabled={isPageBusy}
                onClick={async () => {
                  setShowExitConfirm(false);
                  try {
                    await flushChecklistBuffer();
                  } catch (e) {
                    console.warn("Flush before exit:", e);
                  }
                  if (onExit) {
                    onExit();
                  } else if (typeof window !== "undefined") {
                    window.location.href = "/shift";
                  }
                }}
                className="flex-1 min-h-[44px] sm:min-h-[36px] py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-extrabold transition-all shadow-sm cursor-pointer"
              >
                ออกจากหน้างาน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Late Reason Requirement Modal */}
      <LateReasonModal
        isOpen={Boolean(lateModalTarget)}
        taskLabel={lateModalTarget?.label || ""}
        deadlineText={lateModalTarget?.deadlineText}
        onSubmit={handleLateReasonSubmit}
        onCancel={() => setLateModalTarget(null)}
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
      />
    </div>
  );
}
