"use client";

import { useEffect, useState, useCallback } from "react";
import { Snowflake, CheckCircle2, Clock, UserCheck, AlertTriangle, RefreshCw, Thermometer, ShieldCheck, FileText, Ban } from "lucide-react";
import { RefrigeratorTaskItem, getBranchRefrigeratorTasksAction } from "../../actions/refrigerator";
import { fmtTime } from "../../data/storage";
import { User } from "../../types";

export function BranchRefrigeratorLiveView({ user }: { user: User }) {
  const [tasks, setTasks] = useState<RefrigeratorTaskItem[]>([]);
  const [disabledRefrigerators, setDisabledRefrigerators] = useState<
    Array<{ id: string; name: string; minTemperature: number; maxTemperature: number }>
  >([]);
  const [branchName, setBranchName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "done" | "pending" | "disabled" | "issues">("all");

  const loadData = useCallback(async (isSilent = false) => {
    try {
      const res = await getBranchRefrigeratorTasksAction({ userId: user.id });
      if (res.success && res.data) {
        setTasks(res.data);
        if (res.disabledRefrigerators) {
          setDisabledRefrigerators(res.disabledRefrigerators);
        }
        if (res.branchName) setBranchName(res.branchName);
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
  }, [user.id]);

  useEffect(() => {
    void loadData(true);
    const interval = setInterval(() => {
      void loadData(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  const total = tasks.length;
  const done = tasks.filter((t) => t.completed).length;
  const disabledCount = tasks.filter((t) => t.disableCheck).length;
  const pending = tasks.filter((t) => !t.completed && !t.disableCheck).length;

  const isTaskIssue = (t: RefrigeratorTaskItem) => {
    if (!t.completed || t.disableCheck) return false;
    if (!t.isOkay) return true;
    if (t.temperature !== null && t.temperature !== undefined) {
      if (t.temperature > t.maxTemperature) return true;
      if (t.minTemperature !== undefined && t.temperature < t.minTemperature) return true;
    }
    return false;
  };

  const issues = tasks.filter(isTaskIssue).length;

  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

  const filteredTasks = tasks.filter((t) => {
    if (filter === "done") return t.completed;
    if (filter === "pending") return !t.completed && !t.disableCheck;
    if (filter === "disabled") return Boolean(t.disableCheck);
    if (filter === "issues") return isTaskIssue(t);
    return true;
  });

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Top Banner & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950/80 border border-sky-300 dark:border-sky-800 text-sky-800 dark:text-sky-300 flex items-center justify-center shrink-0">
            <Snowflake size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-extrabold text-[var(--color-text)]">
                สถานะการตรวจเช็คตู้แช่วันนี้
              </h2>
              <span className="text-xs font-bold text-sky-900 dark:text-sky-200 bg-sky-100 dark:bg-sky-950/80 border border-sky-300 dark:border-sky-800 px-2.5 py-0.5 rounded-full">
                {branchName ? `สาขา ${branchName}` : user.branchName ? `สาขา ${user.branchName}` : "ประจำสาขา"}
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              ติดตามการบันทึกอุณหภูมิและความเรียบร้อยของตู้แช่ที่บันทึกโดยพนักงานสต็อกประจำสาขา
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => loadData()}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text)] hover:text-sky-600 hover:border-sky-300 text-xs font-bold transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin text-sky-600" : ""} />
          <span>รีเฟรชข้อมูล</span>
        </button>
      </div>

      {/* KPI Cards Cockpit */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs">
          <span className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide">
            ตู้แช่ทั้งหมด
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black font-mono text-[var(--color-text)]">{total}</span>
            <span className="text-xs text-[var(--color-text-muted)] font-semibold">ตู้</span>
          </div>
          <div className="mt-2 text-[11px] text-[var(--color-text-muted)] flex items-center gap-1">
            <Snowflake size={12} className="text-sky-600" />
            <span>ในสาขานี้</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs">
          <span className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide">
            ตรวจแล้ววันนี้
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black font-mono text-emerald-800 dark:text-emerald-300">
              {done}
            </span>
            <span className="text-xs text-[var(--color-text-muted)] font-semibold">/{total}</span>
          </div>
          <div className="mt-2 text-[11px] text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-1">
            <CheckCircle2 size={12} />
            <span>{completionRate}% เรียบร้อย</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs">
          <span className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide">
            รอดำเนินการ
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black font-mono text-amber-800 dark:text-amber-300">
              {pending}
            </span>
            <span className="text-xs text-[var(--color-text-muted)] font-semibold">ตู้</span>
          </div>
          <div className="mt-2 text-[11px] text-[var(--color-text-muted)] flex items-center gap-1">
            <Clock size={12} className="text-amber-600" />
            <span>พนักงานยังไม่บันทึก</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs">
          <span className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide">
            ความผิดปกติ
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className={`text-2xl font-black font-mono ${issues > 0 ? "text-rose-800 dark:text-rose-300" : "text-emerald-800 dark:text-emerald-300"}`}>
              {issues}
            </span>
            <span className="text-xs text-[var(--color-text-muted)] font-semibold">ตู้</span>
          </div>
          <div className="mt-2 text-[11px] font-bold flex items-center gap-1">
            {issues > 0 ? (
              <span className="text-rose-800 dark:text-rose-300 flex items-center gap-1">
                <AlertTriangle size={12} />
                <span>ต้องเข้าตรวจสอบ</span>
              </span>
            ) : (
              <span className="text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                <ShieldCheck size={12} />
                <span>อุณหภูมิปกติทุกตู้</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 bg-[var(--color-surface-2)] p-1 rounded-xl border border-[var(--color-border)] text-xs font-semibold overflow-x-auto">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
            filter === "all"
              ? "bg-[var(--color-brown)] text-amber-100 dark:bg-amber-400 dark:text-amber-950 font-bold shadow-xs"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          }`}
        >
          ทั้งหมด ({total})
        </button>
        <button
          type="button"
          onClick={() => setFilter("done")}
          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
            filter === "done"
              ? "bg-[var(--color-brown)] text-amber-100 dark:bg-amber-400 dark:text-amber-950 font-bold shadow-xs"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          }`}
        >
          ตรวจแล้ว ({done})
        </button>
        <button
          type="button"
          onClick={() => setFilter("pending")}
          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
            filter === "pending"
              ? "bg-[var(--color-brown)] text-amber-100 dark:bg-amber-400 dark:text-amber-950 font-bold shadow-xs"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          }`}
        >
          ยังไม่ได้ตรวจ ({pending})
        </button>
        {disabledCount > 0 && (
          <button
            type="button"
            onClick={() => setFilter("disabled")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              filter === "disabled"
                ? "bg-rose-700 text-white font-bold shadow-xs"
                : "text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/40"
            }`}
          >
            🚫 ปิดใช้งาน ({disabledCount})
          </button>
        )}
        {issues > 0 && (
          <button
            type="button"
            onClick={() => setFilter("issues")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              filter === "issues"
                ? "bg-rose-600 text-white font-bold shadow-xs"
                : "text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/40"
            }`}
          >
            พบปัญหา ({issues})
          </button>
        )}
      </div>

      {/* Task List */}
      {loading ? (
        <div className="p-8 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent mx-auto mb-2" />
          <p className="text-xs text-[var(--color-text-muted)]">กำลังดึงข้อมูลตู้แช่ประจำสาขา...</p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-xs text-rose-900 dark:text-rose-200">
          <p className="font-bold">{error}</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="p-8 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl">
          <Snowflake size={24} className="mx-auto text-[var(--color-text-muted)] mb-2" />
          <p className="text-sm font-bold text-[var(--color-text)]">ไม่พบรายการตู้แช่ในหมวดนี้</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => {
            const isDisabled = Boolean(task.disableCheck);
            const isDone = task.completed;
            const isTempHigh =
              task.temperature !== null &&
              task.temperature !== undefined &&
              task.temperature > task.maxTemperature;
            const isTempLow =
              task.temperature !== null &&
              task.temperature !== undefined &&
              task.minTemperature !== undefined &&
              task.temperature < task.minTemperature;
            const isTempAbnormal = isTempHigh || isTempLow;

            return (
              <div
                key={task.taskId}
                className={`p-4 rounded-2xl border transition-all ${
                  isDisabled
                    ? "bg-rose-50/25 dark:bg-rose-950/20 border-dashed border-rose-300/90 dark:border-rose-800/80 shadow-xs"
                    : isDone
                    ? isTempAbnormal || !task.isOkay
                      ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800"
                      : "bg-[var(--color-surface)] border-[var(--color-border)]"
                    : "bg-[var(--color-surface-2)]/60 border-dashed border-[var(--color-border)]"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        isDisabled
                          ? "bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800"
                          : isDone
                          ? isTempAbnormal || !task.isOkay
                            ? "bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950 dark:text-rose-300"
                            : "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300"
                      }`}
                    >
                      {isDisabled ? <Ban size={18} /> : <Snowflake size={18} />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`text-sm sm:text-base font-bold text-[var(--color-text)] ${isDisabled ? "line-through opacity-85" : ""}`}>
                          {task.name}
                        </h3>
                        <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-muted)]">
                          เกณฑ์ปกติ: {task.minTemperature}°C ~ {task.maxTemperature}°C
                        </span>
                        {isDisabled ? (
                          <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300 dark:bg-rose-950/90 dark:text-rose-200 dark:border-rose-800 flex items-center gap-1">
                            🚫 ปิดใช้งานชั่วคราว
                          </span>
                        ) : isDone ? (
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                              isTempAbnormal || !task.isOkay
                                ? "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/80 dark:text-rose-200"
                                : "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200"
                            }`}
                          >
                            {isTempHigh ? "อุณหภูมิเกินเกณฑ์" : isTempLow ? "อุณหภูมิต่ำกว่าเกณฑ์" : !task.isOkay ? "พบสิ่งผิดปกติ" : "ปกติเรียบร้อย"}
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/80 dark:text-amber-200">
                            ยังไม่ได้รับการตรวจ
                          </span>
                        )}
                      </div>

                      {/* Details row */}
                      {isDisabled ? (
                        <p className="text-xs text-rose-800 dark:text-rose-300 mt-1 font-medium flex items-center gap-1.5">
                          <span>ตู้แช่นี้ถูกตั้งค่าปิดการตรวจสอบไว้ในระบบ (อยู่ระหว่างซ่อมบำรุงหรืองดใช้งานชั่วคราว)</span>
                        </p>
                      ) : isDone ? (
                        <div className="flex items-center gap-3 flex-wrap mt-2 text-xs">
                          {task.completedByUserName && (
                            <span className="inline-flex items-center gap-1 font-semibold text-[var(--color-text)] bg-[var(--color-surface-2)] px-2 py-0.5 rounded-lg border border-[var(--color-border)]">
                              <UserCheck size={12} className="text-sky-600" />
                              <span>ผู้ตรวจ: {task.completedByUserName}</span>
                            </span>
                          )}

                          {task.completedAt && (
                            <span className="inline-flex items-center gap-1 font-mono text-[var(--color-text-muted)]">
                              <Clock size={12} />
                              <span>เวลา: {fmtTime(task.completedAt)}</span>
                            </span>
                          )}

                          {task.comment && (
                            <span className="text-[var(--color-text-muted)] italic truncate max-w-sm">
                              &ldquo;{task.comment}&rdquo;
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                          รอพนักงานสต็อกประจำกะบันทึกผลการตรวจเช็คอุณหภูมิ
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Status / Temperature Readout Pill */}
                  {isDisabled ? (
                    <div className="shrink-0 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-100/70 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 text-xs font-bold self-start sm:self-auto flex items-center gap-1.5">
                      <Ban size={13} />
                      <span>งดตรวจเช็ค</span>
                    </div>
                  ) : isDone && task.temperature !== null && task.temperature !== undefined ? (
                    <div
                      className={`shrink-0 px-3.5 py-2 rounded-xl border flex items-center gap-2 self-start sm:self-auto ${
                        isTempAbnormal || !task.isOkay
                          ? "bg-rose-100 text-rose-950 border-rose-300 dark:bg-rose-950/80 dark:text-rose-200"
                          : "bg-emerald-100 text-emerald-950 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200"
                      }`}
                    >
                      <Thermometer size={16} />
                      <div className="text-right">
                        <div className="font-mono font-black text-sm sm:text-base leading-tight">
                          {task.temperature}°C
                        </div>
                        <div className="text-[10px] font-bold">
                          {isTempHigh
                            ? `เกิน +${task.temperature - task.maxTemperature}°C`
                            : isTempLow
                            ? `ต่ำกว่า -${task.minTemperature - task.temperature}°C`
                            : "อยู่ในเกณฑ์"}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
