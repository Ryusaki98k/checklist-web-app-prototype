"use client";

import { useEffect, useState, useCallback } from "react";
import { Snowflake, CheckCircle2, Clock, UserCheck, AlertTriangle, RefreshCw, Check, Edit2, RotateCcw } from "lucide-react";
import { RefrigeratorTaskItem, getBranchRefrigeratorTasksAction, updateRefrigeratorTaskAction } from "../../actions/refrigerator";
import { fmtTime } from "../../data/storage";
import { ShiftType } from "../../types";

export function BranchRefrigeratorChecklist({
  userId,
  branchName,
  shiftSessionId,
  shift,
}: {
  userId: string;
  branchName?: string;
  shiftSessionId?: string;
  shift?: ShiftType;
}) {
  const [tasks, setTasks] = useState<RefrigeratorTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check Dialog State
  const [activeTask, setActiveTask] = useState<RefrigeratorTaskItem | null>(null);
  const [tempValue, setTempValue] = useState<number>(4);
  const [isOkayValue, setIsOkayValue] = useState<boolean>(true);
  const [commentValue, setCommentValue] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadTasks = useCallback(async (isSilent = false) => {
    try {
      const res = await getBranchRefrigeratorTasksAction({ userId });
      if (res.success && res.data) {
        setTasks(res.data);
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
    // Poll every 8s for live shared updates across stock employees
    const interval = setInterval(() => {
      void loadTasks(true);
    }, 8000);
    return () => clearInterval(interval);
  }, [loadTasks]);

  function handleOpenCheck(task: RefrigeratorTaskItem) {
    if (task.disableCheck) {
      alert("ตู้แช่นี้ถูกตั้งค่าปิดการตรวจสอบไว้ในระบบ จึงไม่สามารถบันทึกผลได้");
      return;
    }
    setActiveTask(task);
    setTempValue(task.temperature ?? task.maxTemperature ?? 4);
    setIsOkayValue(task.isOkay ?? true);
    setCommentValue(task.comment || "");
  }

  async function handleSaveCheck() {
    if (!activeTask) return;
    setIsSubmitting(true);
    try {
      const res = await updateRefrigeratorTaskAction({
        taskId: activeTask.taskId,
        userId,
        completed: true,
        temperature: tempValue,
        isOkay: isOkayValue,
        comment: commentValue.trim() || undefined,
        shiftSessionId,
        shift,
      });

      if (res.success && res.data) {
        setTasks((prev) =>
          prev.map((t) => (t.taskId === activeTask.taskId ? res.data! : t))
        );
        setActiveTask(null);
      } else {
        alert(res.error || "บันทึกไม่สำเร็จ");
      }
    } catch (err: unknown) {
      alert((err as Error)?.message || "เกิดข้อผิดพลาด");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResetCheck(task: RefrigeratorTaskItem) {
    if (!confirm(`ต้องการยกเลิกสถานะการตรวจของ "${task.name}" หรือไม่?`)) return;
    setIsSubmitting(true);
    try {
      const res = await updateRefrigeratorTaskAction({
        taskId: task.taskId,
        userId,
        completed: false,
      });

      if (res.success && res.data) {
        setTasks((prev) =>
          prev.map((t) => (t.taskId === task.taskId ? res.data! : t))
        );
        if (activeTask?.taskId === task.taskId) {
          setActiveTask(null);
        }
      } else {
        alert(res.error || "ยกเลิกไม่สำเร็จ");
      }
    } catch (err: unknown) {
      alert((err as Error)?.message || "เกิดข้อผิดพลาด");
    } finally {
      setIsSubmitting(false);
    }
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
                        onClick={() => handleOpenCheck(task)}
                        className="px-2.5 py-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                        title="แก้ไขผลตรวจ"
                      >
                        <Edit2 size={12} />
                        <span>แก้ไข</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenCheck(task)}
                        className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-extrabold text-xs transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                      >
                        <Check size={14} strokeWidth={2.5} />
                        <span>บันทึกตรวจ</span>
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
                    onClick={() => setTempValue((prev) => prev - 1)}
                    className="w-11 h-11 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:bg-black/5 dark:hover:bg-white/5 font-extrabold text-lg flex items-center justify-center cursor-pointer transition-colors"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={tempValue}
                    onChange={(e) => setTempValue(Number(e.target.value))}
                    className="flex-1 text-center font-mono font-black text-xl py-2 rounded-xl bg-[var(--color-surface)] border-2 border-sky-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setTempValue((prev) => prev + 1)}
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
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
                  onClick={() => setActiveTask(null)}
                  className="px-3.5 py-2 rounded-xl border border-[var(--color-border)] text-xs font-bold hover:bg-[var(--color-surface-2)] cursor-pointer transition-colors"
                >
                  ปิด
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleSaveCheck}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-extrabold cursor-pointer transition-colors shadow-xs"
                >
                  {isSubmitting ? "กำลังบันทึก..." : "ยืนยันผลตรวจ"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
