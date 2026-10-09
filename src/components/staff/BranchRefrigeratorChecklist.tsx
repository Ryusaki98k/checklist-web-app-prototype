"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Snowflake, CheckCircle2, Clock, UserCheck, AlertTriangle, RefreshCw, Check, Edit2, RotateCcw, FileSpreadsheet, Download } from "lucide-react";
import {
  RefrigeratorTaskItem,
  getBranchRefrigeratorTasksAction,
  batchUpdateRefrigeratorTasksAction,
} from "../../actions/refrigerator";
import { fmtTime } from "../../data/storage";
import { ShiftType } from "../../types";
import { exportRefrigeratorDataAsCSV, exportRefrigeratorDataAsExcel } from "../../utils/exportRefrigeratorData";

export function BranchRefrigeratorChecklist({
  userId,
  userName,
  branchName,
  shiftSessionId,
  shift,
}: {
  userId: string;
  userName?: string;
  branchName?: string;
  shiftSessionId?: string;
  shift?: ShiftType;
}) {
  const [tasks, setTasks] = useState<RefrigeratorTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Background in-flight sync tracking
  const [syncingTaskIds, setSyncingTaskIds] = useState<Set<string>>(new Set());
  const savingTaskIdsRef = useRef<Set<string>>(new Set());

  // Toast feedback state
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((type: "success" | "error", text: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMsg({ type, text });
    toastTimeoutRef.current = setTimeout(() => {
      setToastMsg(null);
    }, 4000);
  }, []);

  // Check Dialog State
  const [activeTask, setActiveTask] = useState<RefrigeratorTaskItem | null>(null);
  const [tempValue, setTempValue] = useState<number>(4);
  const [isOkayValue, setIsOkayValue] = useState<boolean>(true);
  const [commentValue, setCommentValue] = useState<string>("");

  const loadTasks = useCallback(async (isSilent = false) => {
    try {
      const res = await getBranchRefrigeratorTasksAction({ userId });
      if (res.success && res.data) {
        setTasks((prev) => {
          const inFlight = savingTaskIdsRef.current;
          if (inFlight.size === 0) return res.data!;
          // Merge safely: preserve optimistic state for any task currently in flight
          const prevMap = new Map(prev.map((t) => [t.taskId, t]));
          return res.data!.map((serverItem) => {
            if (inFlight.has(serverItem.taskId)) {
              return prevMap.get(serverItem.taskId) || serverItem;
            }
            return serverItem;
          });
        });
        setError(null);
      } else if (!isSilent) {
        setError(res.error || "ไม่สามารถโหลดข้อมูลตู้แช่ได้");
      }
    } catch (err: unknown) {
      if (!isSilent) setError((err as Error)?.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadTasks(true);
    // Poll every 10s for live shared updates across stock employees
    const interval = setInterval(() => {
      void loadTasks(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [loadTasks]);

  function handleOpenCheck(task: RefrigeratorTaskItem) {
    if (task.disableCheck) {
      alert("ตู้แช่นี้ถูกตั้งค่าปิดการตรวจสอบไว้ในระบบ จึงไม่สามารถบันทึกผลได้");
      return;
    }
    if (syncingTaskIds.has(task.taskId)) {
      showToast("error", `ตู้แช่ "${task.name}" กำลังบันทึกข้อมูลกับระบบ กรุณารอสักครู่`);
      return;
    }
    setActiveTask(task);
    setTempValue(task.temperature ?? task.maxTemperature ?? 4);
    setIsOkayValue(task.isOkay ?? true);
    setCommentValue(task.comment || "");
  }

  // --- Stacking Buffer Queue for Refrigerator Checks ---
  interface PendingRefrigeratorCheck {
    taskId: string;
    userId: string;
    completed: boolean;
    temperature?: number;
    isOkay?: boolean;
    comment?: string;
    shiftSessionId?: string;
    shift?: ShiftType;
    snapshot: RefrigeratorTaskItem;
    timestamp: number;
  }

  const pendingChecksRef = useRef<Map<string, PendingRefrigeratorCheck>>(new Map());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstQueueTimeRef = useRef<number | null>(null);
  const isFlushingRef = useRef<boolean>(false);
  const activeFlushPromiseRef = useRef<Promise<void> | null>(null);

  const flushRefrigeratorStackRef = useRef<() => Promise<void>>(async () => {});

  const flushRefrigeratorStack = async () => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    firstQueueTimeRef.current = null;

    if (isFlushingRef.current && activeFlushPromiseRef.current) {
      await activeFlushPromiseRef.current;
      if (pendingChecksRef.current.size === 0) return;
    }

    if (pendingChecksRef.current.size === 0) return;

    const itemsToFlush = Array.from(pendingChecksRef.current.values());
    isFlushingRef.current = true;

    const performFlush = async () => {
      try {
        const payload = itemsToFlush.map((item) => ({
          taskId: item.taskId,
          userId: item.userId,
          completed: item.completed,
          temperature: item.temperature,
          isOkay: item.isOkay,
          comment: item.comment,
          shiftSessionId: item.shiftSessionId,
          shift: item.shift,
        }));

        const res = await batchUpdateRefrigeratorTasksAction(payload);

        if (res.success && res.data) {
          const returnedMap = new Map(res.data.map((d) => [d.taskId, d]));
          setTasks((prev) =>
            prev.map((t) => {
              const fresh = returnedMap.get(t.taskId);
              return fresh || t;
            })
          );

          for (const flushed of itemsToFlush) {
            const cur = pendingChecksRef.current.get(flushed.taskId);
            if (cur && cur.timestamp <= flushed.timestamp) {
              pendingChecksRef.current.delete(flushed.taskId);
            }
          }
        } else {
          // Rollback on failure
          setTasks((prev) =>
            prev.map((t) => {
              const item = itemsToFlush.find((i) => i.taskId === t.taskId);
              return item ? item.snapshot : t;
            })
          );
          for (const flushed of itemsToFlush) {
            pendingChecksRef.current.delete(flushed.taskId);
          }
          showToast("error", `บันทึกรายการตู้แช่ไม่สำเร็จ: ${res.error || "เกิดข้อผิดพลาด"}`);
        }
      } catch (err: unknown) {
        // Rollback on network exception
        setTasks((prev) =>
          prev.map((t) => {
            const item = itemsToFlush.find((i) => i.taskId === t.taskId);
            return item ? item.snapshot : t;
          })
        );
        for (const flushed of itemsToFlush) {
          pendingChecksRef.current.delete(flushed.taskId);
        }
        showToast("error", `การเชื่อมต่อขัดข้อง: ${(err as Error)?.message || "กรุณาลองใหม่"}`);
      } finally {
        for (const flushed of itemsToFlush) {
          savingTaskIdsRef.current.delete(flushed.taskId);
        }
        setSyncingTaskIds((prev) => {
          const next = new Set(prev);
          for (const flushed of itemsToFlush) {
            next.delete(flushed.taskId);
          }
          return next;
        });

        isFlushingRef.current = false;
        activeFlushPromiseRef.current = null;

        // Pipeline: if more items arrived while flush was in flight, flush immediately
        if (pendingChecksRef.current.size > 0) {
          if (flushTimerRef.current) {
            clearTimeout(flushTimerRef.current);
            flushTimerRef.current = null;
          }
          firstQueueTimeRef.current = null;
          setTimeout(() => {
            if (pendingChecksRef.current.size > 0 && !isFlushingRef.current) {
              void flushRefrigeratorStackRef.current();
            }
          }, 25);
        }
      }
    };

    activeFlushPromiseRef.current = performFlush();
    await activeFlushPromiseRef.current;
  };

  useEffect(() => {
    flushRefrigeratorStackRef.current = flushRefrigeratorStack;
  });

  const queueRefrigeratorCheck = (checkData: Omit<PendingRefrigeratorCheck, "timestamp">) => {
    const now = Date.now();
    const item: PendingRefrigeratorCheck = {
      ...checkData,
      timestamp: now,
    };

    pendingChecksRef.current.set(item.taskId, item);
    savingTaskIdsRef.current.add(item.taskId);
    setSyncingTaskIds((prev) => new Set(prev).add(item.taskId));

    if (!firstQueueTimeRef.current) {
      firstQueueTimeRef.current = now;
    }
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
    }
    const elapsed = now - firstQueueTimeRef.current;
    const delay = Math.max(0, Math.min(250, 750 - elapsed));
    flushTimerRef.current = setTimeout(() => {
      void flushRefrigeratorStackRef.current();
    }, delay);
  };

  useEffect(() => {
    const handleUnload = () => {
      if (pendingChecksRef.current.size > 0) {
        void flushRefrigeratorStackRef.current();
      }
    };
    window.addEventListener("pagehide", handleUnload);
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("pagehide", handleUnload);
      window.removeEventListener("beforeunload", handleUnload);
      if (pendingChecksRef.current.size > 0) {
        void flushRefrigeratorStackRef.current();
      }
    };
  }, []);

  function handleSaveCheck() {
    if (!activeTask) return;

    const taskSnapshot = activeTask;
    const taskId = taskSnapshot.taskId;
    const clampedTemp = Math.min(100, Math.max(-100, tempValue));
    const isOkay = isOkayValue;
    const comment = commentValue.trim();

    // 1. Immediately close modal for lightning-fast user interaction (0ms)
    setActiveTask(null);

    // 2. Immediately update UI state optimistically
    const optimisticTask: RefrigeratorTaskItem = {
      ...taskSnapshot,
      completed: true,
      completedAt: new Date().toISOString(),
      completedByUserId: userId,
      completedByUserName: userName || "คุณ",
      temperature: clampedTemp,
      isOkay,
      comment: comment || null,
    };

    setTasks((prev) =>
      prev.map((t) => (t.taskId === taskId ? optimisticTask : t))
    );

    // 3. Queue into debounced stacking buffer to collect compatible requests
    queueRefrigeratorCheck({
      taskId,
      userId,
      completed: true,
      temperature: clampedTemp,
      isOkay,
      comment: comment || undefined,
      shiftSessionId,
      shift,
      snapshot: taskSnapshot,
    });
  }

  function handleResetCheck(task: RefrigeratorTaskItem) {
    if (!confirm(`ต้องการยกเลิกสถานะการตรวจของ "${task.name}" หรือไม่?`)) return;

    const taskSnapshot = task;
    const taskId = task.taskId;

    // Immediately close modal if open
    if (activeTask?.taskId === taskId) {
      setActiveTask(null);
    }

    // Optimistically reset
    const optimisticResetTask: RefrigeratorTaskItem = {
      ...taskSnapshot,
      completed: false,
      completedAt: null,
      completedByUserId: null,
      completedByUserName: null,
      temperature: null,
      isOkay: true,
      comment: null,
    };

    setTasks((prev) =>
      prev.map((t) => (t.taskId === taskId ? optimisticResetTask : t))
    );

    // Queue into debounced stacking buffer
    queueRefrigeratorCheck({
      taskId,
      userId,
      completed: false,
      snapshot: taskSnapshot,
    });
  }

  const total = tasks.length;
  const done = tasks.filter((t) => t.completed).length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  const allDone = total > 0 && done === total;

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-7 h-7 rounded-xl bg-sky-100 dark:bg-sky-950/80 border border-sky-300 dark:border-sky-800 text-sky-800 dark:text-sky-300 flex items-center justify-center shrink-0">
              <Snowflake size={15} />
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-[var(--color-text)] flex items-center gap-1.5">
                <span>ตู้แช่สินค้าประจำสาขา</span>
                <span className="text-[10px] font-bold text-sky-900 dark:text-sky-200 bg-sky-100 dark:bg-sky-950/80 border border-sky-300 dark:border-sky-800 px-2 py-0.5 rounded-full">
                  แชร์ในสาขา
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-[var(--color-text-muted)] font-medium">
                {branchName ? `สาขา ${branchName}` : "ประจำสาขา"} • ข้อมูลจะซิงค์ระหว่างพนักงานสต็อกทุกคน
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                const targetDate = tasks[0]?.taskDate || new Date().toISOString().split("T")[0];
                exportRefrigeratorDataAsExcel(tasks, branchName || "สาขาหลัก", targetDate);
              }}
              disabled={loading || tasks.length === 0}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border border-emerald-500/30 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              title="ส่งออกรายงานตู้แช่วันนี้เป็น Excel (.xls)"
            >
              <FileSpreadsheet size={13} className="text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">ส่งออก</span> Excel
            </button>

            <button
              type="button"
              onClick={() => {
                const targetDate = tasks[0]?.taskDate || new Date().toISOString().split("T")[0];
                exportRefrigeratorDataAsCSV(tasks, branchName || "สาขาหลัก", targetDate);
              }}
              disabled={loading || tasks.length === 0}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border border-amber-500/30 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-900 dark:text-amber-300 text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              title="ส่งออกรายงานตู้แช่วันนี้เป็น CSV (.csv)"
            >
              <Download size={13} className="text-amber-600 dark:text-amber-400" />
              <span className="hidden sm:inline">ส่งออก</span> CSV
            </button>

            <button
              type="button"
              onClick={() => loadTasks()}
              disabled={refreshing}
              className="p-1.5 sm:p-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text)] hover:text-sky-600 hover:border-sky-300 transition-colors cursor-pointer shrink-0"
              title="รีเฟรชข้อมูลตู้แช่"
              aria-label="รีเฟรชข้อมูลตู้แช่"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin text-sky-600" : ""} />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex items-center justify-between text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
          <span>ตรวจเช็คความเย็นวันนี้</span>
          <span className="font-mono font-bold text-[var(--color-text)]">
            {done}/{total} ตู้ ({progress}%)
          </span>
        </div>
        <div className="relative w-full h-2 bg-[var(--color-border-subtle)] rounded-full overflow-hidden p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-300 ease-out ${
              allDone ? "bg-emerald-600" : "bg-sky-600"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Refrigerator Tasks List */}
      {loading ? (
        <div className="p-8 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent mx-auto mb-2" />
          <p className="text-xs text-[var(--color-text-muted)]">กำลังโหลดรายการตู้แช่สาขา...</p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-xs text-rose-900 dark:text-rose-200">
          <p className="font-bold">{error}</p>
          <button
            type="button"
            onClick={() => loadTasks()}
            className="mt-2 px-3 py-1 bg-rose-200 dark:bg-rose-800 rounded-lg font-bold hover:bg-rose-300 cursor-pointer"
          >
            ลองใหม่
          </button>
        </div>
      ) : tasks.length === 0 ? (
        <div className="p-8 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-xs">
          <Snowflake size={28} className="mx-auto text-[var(--color-text-muted)] mb-2" />
          <p className="text-sm font-bold text-[var(--color-text)]">ยังไม่มีรายการตู้แช่ในสาขานี้</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">ผู้จัดการร้านสามารถเพิ่มรายการตู้แช่ได้ที่แดชบอร์ดบริหาร</p>
        </div>
      ) : (
        <div className="space-y-2.5" role="group" aria-label="รายการเช็คลิสต์ตู้แช่">
          {tasks.map((task) => {
            const isDone = task.completed;
            const isSyncing = syncingTaskIds.has(task.taskId);
            const isTempHigh = task.temperature !== null && task.temperature !== undefined && task.temperature > task.maxTemperature;
            const isTempLow = task.temperature !== null && task.temperature !== undefined && task.minTemperature !== undefined && task.temperature < task.minTemperature;
            const isTempWarning = isTempHigh || isTempLow;

            return (
              <div
                key={task.taskId}
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                  isDone
                    ? "bg-[var(--color-surface-2)]/90 border-[var(--color-border)]"
                    : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-sky-400 hover:shadow-xs"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Status Check Icon */}
                    <div
                      className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-transform ${
                        isDone
                          ? "border-emerald-600 bg-emerald-600 text-white shadow-2xs"
                          : "border-sky-400/80 bg-sky-50 dark:bg-sky-950/40 text-sky-600"
                      }`}
                    >
                      {isDone ? (
                        <Check size={14} strokeWidth={3} />
                      ) : (
                        <Snowflake size={12} strokeWidth={2.5} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`text-sm sm:text-base font-bold leading-snug ${task.disableCheck ? "text-[var(--color-text-muted)] line-through" : "text-[var(--color-text)]"}`}>
                          {task.name}
                        </h3>
                        <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-muted)]">
                          เกณฑ์: {task.minTemperature}°C ~ {task.maxTemperature}°C
                        </span>
                        {task.disableCheck && (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                            ปิดใช้งาน (งดตรวจ)
                          </span>
                        )}
                      </div>

                      {/* Completed Details */}
                      {isDone && (
                        <div className="mt-2 pt-2 border-t border-[var(--color-border-subtle)] space-y-1">
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-800 dark:text-emerald-300">
                              <CheckCircle2 size={13} />
                              ตรวจแล้ว
                            </span>

                            {isSyncing && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-950/80 px-2 py-0.5 rounded-md border border-sky-300 dark:border-sky-800 animate-pulse">
                                <RefreshCw size={10} className="animate-spin text-sky-600 dark:text-sky-400" />
                                <span>กำลังบันทึก...</span>
                              </span>
                            )}

                            {task.completedByUserName && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-text)] bg-[var(--color-surface)] px-1.5 py-0.5 rounded-md border border-[var(--color-border)]">
                                <UserCheck size={11} className="text-sky-600" />
                                {task.completedByUserName}
                              </span>
                            )}

                            {task.completedAt && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[var(--color-text-muted)]">
                                <Clock size={11} />
                                {fmtTime(task.completedAt)}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-wrap pt-0.5">
                            {task.temperature !== null && task.temperature !== undefined && (
                              <span
                                className={`text-xs font-mono font-extrabold px-2 py-0.5 rounded-lg border ${
                                  isTempWarning
                                    ? "bg-rose-100 dark:bg-rose-950/80 border-rose-300 text-rose-950 dark:text-rose-200"
                                    : "bg-emerald-100 dark:bg-emerald-950/80 border-emerald-300 text-emerald-950 dark:text-emerald-200"
                                }`}
                              >
                                วัดได้ {task.temperature}°C
                              </span>
                            )}

                            <span
                              className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
                                task.isOkay
                                    ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300"
                                    : "bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300"
                              }`}
                            >
                              {task.isOkay ? "✓ สภาพปกติ" : "⚠ ผิดปกติ"}
                            </span>

                            {task.comment && (
                              <span className="text-xs text-[var(--color-text-muted)] italic truncate max-w-xs">
                                &ldquo;{task.comment}&rdquo;
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="shrink-0 flex items-center gap-1">
                    {task.disableCheck ? (
                      <span className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-[var(--color-surface-2)] text-[var(--color-text-muted)] font-bold text-xs border border-[var(--color-border)] cursor-not-allowed inline-flex items-center gap-1.5 opacity-70">
                        <span>งดตรวจ</span>
                      </span>
                    ) : isDone ? (
                      <button
                        type="button"
                        disabled={isSyncing}
                        onClick={() => handleOpenCheck(task)}
                        className="px-2.5 py-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                        title="แก้ไขผลตรวจ"
                      >
                        <Edit2 size={12} />
                        <span>แก้ไข</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isSyncing}
                        onClick={() => handleOpenCheck(task)}
                        className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-extrabold text-xs transition-all cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSyncing ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" />
                            <span>กำลังบันทึก...</span>
                          </>
                        ) : (
                          <>
                            <Check size={14} strokeWidth={2.5} />
                            <span>บันทึกตรวจ</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Check Modal */}
      {activeTask && (
        <div className="fixed inset-0 z-50 bg-[var(--color-brown)]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl text-[var(--color-text)] animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0">
                  <Snowflake size={16} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[var(--color-text)] leading-tight">
                    {activeTask.name}
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    เกณฑ์อุณหภูมิ: {activeTask.minTemperature}°C ถึง {activeTask.maxTemperature}°C
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Temperature Stepper */}
              <div>
                <label className="block text-xs font-bold text-[var(--color-text)] mb-1.5">
                  อุณหภูมิที่อ่านได้จริง (°C)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTempValue((prev) => Math.max(-100, prev - 1))}
                    className="w-11 h-11 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:bg-black/5 dark:hover:bg-white/5 font-extrabold text-lg flex items-center justify-center cursor-pointer transition-colors"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={-100}
                    max={100}
                    value={tempValue}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!isNaN(val)) {
                        setTempValue(Math.min(100, Math.max(-100, val)));
                      }
                    }}
                    className="flex-1 text-center font-mono font-black text-xl py-2 rounded-xl bg-[var(--color-surface)] border-2 border-sky-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setTempValue((prev) => Math.min(100, prev + 1))}
                    className="w-11 h-11 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:bg-black/5 dark:hover:bg-white/5 font-extrabold text-lg flex items-center justify-center cursor-pointer transition-colors"
                  >
                    +
                  </button>
                </div>
                {tempValue > activeTask.maxTemperature && (
                  <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    อุณหภูมิสูงกว่าเกณฑ์ที่กำหนด (เกิน {activeTask.maxTemperature}°C)
                  </p>
                )}
                {tempValue < activeTask.minTemperature && (
                  <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    อุณหภูมิต่ำกว่าเกณฑ์ที่กำหนด (ต่ำกว่า {activeTask.minTemperature}°C)
                  </p>
                )}
              </div>

              {/* Status Switch */}
              <div>
                <label className="block text-xs font-bold text-[var(--color-text)] mb-1.5">
                  สภาพการทำงานของตู้แช่
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsOkayValue(true)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      isOkayValue
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border-[var(--color-border)]"
                    }`}
                  >
                    <Check size={14} strokeWidth={2.5} />
                    <span>ปกติ (ได้เกณฑ์)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOkayValue(false)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      !isOkayValue
                        ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                        : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border-[var(--color-border)]"
                    }`}
                  >
                    <AlertTriangle size={14} />
                    <span>ผิดปกติ / ต้องปรับปรุง</span>
                  </button>
                </div>
              </div>

              {/* Comment Input */}
              <div>
                <label className="block text-xs font-bold text-[var(--color-text)] mb-1.5">
                  หมายเหตุ / ข้อสังเกต (ถ้ามี)
                </label>
                <input
                  type="text"
                  placeholder="เช่น ปิดฝาสนิท น้ำแข็งไม่เกาะ อุณหภูมิคงที่"
                  value={commentValue}
                  onChange={(e) => setCommentValue(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-sky-400"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="mt-5 pt-3 border-t border-[var(--color-border)] flex items-center justify-between gap-2">
              {activeTask.completed ? (
                <button
                  type="button"
                  onClick={() => handleResetCheck(activeTask)}
                  className="px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RotateCcw size={12} />
                  <span>ยกเลิกผลตรวจ</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTask(null)}
                  className="px-3.5 py-2 rounded-xl border border-[var(--color-border)] text-xs font-bold hover:bg-[var(--color-surface-2)] cursor-pointer transition-colors"
                >
                  ปิด
                </button>
                <button
                  type="button"
                  onClick={handleSaveCheck}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-95 text-white text-xs font-extrabold cursor-pointer transition-all shadow-xs flex items-center gap-1.5"
                >
                  <Check size={14} strokeWidth={2.5} />
                  <span>ยืนยันผลตรวจ</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Background Toast Feedback */}
      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold transition-all animate-in fade-in slide-in-from-bottom-3 duration-200 ${
            toastMsg.type === "error"
              ? "bg-rose-50 dark:bg-rose-950 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200"
              : "bg-emerald-50 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
          }`}
        >
          {toastMsg.type === "error" ? (
            <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          )}
          <span>{toastMsg.text}</span>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="ml-2 text-current opacity-70 hover:opacity-100 cursor-pointer text-sm"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
