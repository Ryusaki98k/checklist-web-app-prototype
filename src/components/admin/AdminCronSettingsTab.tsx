"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  Save,
  Snowflake,
  Trash2,
  Moon,
  Calendar,
  Bell,
  Sliders,
  Check,
  Loader2,
  Activity,
  RefreshCw,
  Info,
  CalendarClock,
  ShieldCheck,
  ChevronRight,
  Award,
} from "lucide-react";
import { CronSetting, CleanupDataConfig, EndShiftsConfig, DailyRefrigeratorsConfig, ResetScoresConfig } from "../../services/types";
import {
  getCronSettingsAction,
  updateCronSettingAction,
  runCronJobManualAction,
} from "../../actions/cron";

interface AdminCronSettingsTabProps {
  showToast: (msg: string) => void;
}

export function AdminCronSettingsTab({ showToast }: AdminCronSettingsTabProps) {
  const [settings, setSettings] = useState<CronSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingJobId, setSavingJobId] = useState<string | null>(null);
  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [runResultModal, setRunResultModal] = useState<{
    jobName: string;
    success: boolean;
    skipped?: boolean;
    message?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result?: any;
  } | null>(null);

  // Local draft states for live editing before saving
  const [draftSettings, setDraftSettings] = useState<Record<string, { enabled: boolean; config: Record<string, unknown> }>>({});

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    const res = await getCronSettingsAction();
    setIsLoading(false);

    if (res.success && res.settings) {
      setSettings(res.settings);
      const drafts: Record<string, { enabled: boolean; config: Record<string, unknown> }> = {};
      res.settings.forEach((s) => {
        drafts[s.id] = {
          enabled: s.enabled,
          config: { ...s.config },
        };
      });
      setDraftSettings(drafts);
    } else {
      showToast(res.error || "โหลดการตั้งค่างานอัตโนมัติไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    }
  }, [showToast]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  function handleToggleEnabled(jobId: string) {
    setDraftSettings((prev) => {
      const current = prev[jobId];
      if (!current) return prev;
      return {
        ...prev,
        [jobId]: {
          ...current,
          enabled: !current.enabled,
        },
      };
    });
  }

  function handleConfigChange(jobId: string, key: string, value: unknown) {
    setDraftSettings((prev) => {
      const current = prev[jobId];
      if (!current) return prev;
      return {
        ...prev,
        [jobId]: {
          ...current,
          config: {
            ...current.config,
            [key]: value,
          },
        },
      };
    });
  }

  async function handleSaveJob(jobId: string) {
    const draft = draftSettings[jobId];
    if (!draft) return;

    setSavingJobId(jobId);
    const res = await updateCronSettingAction(jobId, {
      enabled: draft.enabled,
      config: draft.config,
    });
    setSavingJobId(null);

    if (res.success && res.setting) {
      showToast(`บันทึกการตั้งค่า ${res.setting.name} เรียบร้อยแล้ว`);
      setSettings((prev) => prev.map((s) => (s.id === jobId ? res.setting! : s)));
    } else {
      showToast(res.error || "บันทึกการตั้งค่าไม่สำเร็จ ค่าที่แก้ไขยังไม่ถูกบันทึก กรุณาลองใหม่อีกครั้ง");
    }
  }

  async function handleRunNow(job: CronSetting, force: boolean = false) {
    const draft = draftSettings[job.id] || { enabled: job.enabled, config: job.config };
    setRunningJobId(job.id);

    try {
      const res = await runCronJobManualAction(job.id, {
        force,
        config: draft.config,
      });
      setRunningJobId(null);

      setRunResultModal({
        jobName: job.name,
        success: res.success,
        skipped: res.skipped,
        message: res.message || (res.error ? `ข้อผิดพลาด: ${res.error}` : "ประมวลผลเสร็จสิ้น"),
        result: res.result,
      });

      // Reload settings to refresh execution timestamp and status
      await loadSettings();
    } catch (err) {
      setRunningJobId(null);
      const errMsg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการทำงานนี้ กรุณาลองใหม่อีกครั้ง";
      showToast(errMsg);
    }
  }

  function formatThaiDate(dateStr: string | Date | null | undefined): string {
    if (!dateStr) return "ยังไม่เคยทำงาน";
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat("th-TH", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(d) + " น.";
    } catch {
      return String(dateStr);
    }
  }

  const enabledCount = settings.filter((s) => draftSettings[s.id]?.enabled ?? s.enabled).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ─── Top Header & Summary Strip ─────────────────────────────────── */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6 divide-y md:divide-y-0 md:divide-x divide-[var(--color-border)]">
        {/* Metric 1: System Cron Health */}
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-1.5">
              <Activity size={14} className="text-amber-600 dark:text-amber-400" />
              สถานะงานระบบอัตโนมัติ
            </span>
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                enabledCount === settings.length && settings.length > 0
                  ? "bg-emerald-50 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800"
                  : enabledCount > 0
                  ? "bg-amber-50 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800"
                  : "bg-rose-50 dark:bg-rose-950/80 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-800"
              }`}
            >
              {enabledCount === settings.length ? "เปิดครบทุกระบบ" : `เปิด ${enabledCount}/${settings.length} งาน`}
            </span>
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="text-3xl font-extrabold font-mono text-[var(--color-text)]">
              {enabledCount}
            </span>
            <span className="text-xs text-[var(--color-text-subtle)] font-medium">
              / {settings.length} งานที่เปิดใช้งานอยู่
            </span>
          </div>
        </div>

        {/* Metric 2: Scheduler Provider */}
        <div className="flex-1 pt-4 md:pt-0 md:pl-6 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-1.5">
              <CalendarClock size={14} className="text-blue-600 dark:text-blue-400" />
              ผู้ประมวลผลรอบเวลา
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/70 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800 font-mono">
              Vercel Cron
            </span>
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="text-sm font-bold text-[var(--color-text)]">
              UTC Sync / Timezone: Asia/Bangkok
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-subtle)]">
            ตั้งเวลาใน vercel.json และอิงพฤติกรรมตามตารางด้านล่าง
          </p>
        </div>

        {/* Metric 3: Control Actions */}
        <div className="flex-1 pt-4 md:pt-0 md:pl-6 flex flex-col justify-center items-start sm:items-end gap-2">
          <button
            type="button"
            onClick={loadSettings}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl text-xs font-bold border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-2xs"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            <span>รีเฟรชข้อมูลสถานะ</span>
          </button>
          <span className="text-[11px] text-[var(--color-text-subtle)]">
            แก้ไขการตั้งค่าแล้วกด &quot;บันทึก&quot; ในแต่ละงาน
          </span>
        </div>
      </div>

      {/* ─── Cron Jobs List ─────────────────────────────────────────────── */}
      {isLoading && settings.length === 0 ? (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-12 text-center shadow-xs">
          <Loader2 size={32} className="animate-spin mx-auto text-amber-600 mb-3" />
          <p className="text-sm font-semibold text-[var(--color-text)]">กำลังโหลดการตั้งค่างานระบบ...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {settings.map((job) => {
            const draft = draftSettings[job.id] || { enabled: job.enabled, config: job.config };
            const isSaving = savingJobId === job.id;
            const isRunning = runningJobId === job.id;

            return (
              <div
                key={job.id}
                className={`bg-[var(--color-surface)] border rounded-2xl p-5 sm:p-6 transition-all shadow-xs ${
                  draft.enabled
                    ? "border-[var(--color-border)] hover:border-amber-400/60"
                    : "border-gray-200 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900/40 opacity-90"
                }`}
              >
                {/* Header Row: Title, Schedule, and Enable Toggle */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-[var(--color-border)]">
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-2xs transition-all ${
                        job.id === "end-shifts"
                          ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                          : job.id === "daily-refrigerators"
                          ? "bg-cyan-100 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-200"
                          : job.id === "reset-scores"
                          ? "bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200"
                          : "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200"
                      }`}
                    >
                      {job.id === "end-shifts" && <Moon size={22} />}
                      {job.id === "daily-refrigerators" && <Snowflake size={22} />}
                      {job.id === "reset-scores" && <Award size={22} />}
                      {job.id === "cleanup-data" && <Trash2 size={22} />}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-[var(--color-text)]">{job.name}</h3>
                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                            draft.enabled
                              ? "bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700"
                              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-300 dark:border-neutral-700"
                          }`}
                        >
                          {draft.enabled ? "เปิดทำงานอัตโนมัติ" : "ปิดการทำงาน (Disabled)"}
                        </span>
                      </div>

                      <p className="text-xs text-[var(--color-text-subtle)] mt-1 max-w-2xl leading-relaxed">
                        {job.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 mt-2.5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-mono font-medium bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border border-[var(--color-border)] px-2.5 py-0.5 rounded-md">
                          <Calendar size={12} />
                          {job.schedule_description}
                        </span>
                        <span className="text-[11px] text-[var(--color-text-subtle)] font-mono">
                          Cron: {job.schedule_cron}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Switch Toggle */}
                  <div className="flex items-center gap-3 sm:self-center shrink-0">
                    <span className="text-xs font-bold text-[var(--color-text)]">
                      {draft.enabled ? "เปิดระบบ" : "ปิดระบบ"}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={draft.enabled}
                      onClick={() => handleToggleEnabled(job.id)}
                      className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        draft.enabled
                          ? "bg-amber-600 dark:bg-amber-500"
                          : "bg-neutral-300 dark:bg-neutral-700"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          draft.enabled ? "translate-x-6" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Job-Specific Behavior Configuration */}
                <div className="py-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Sliders size={16} className="text-amber-600 dark:text-amber-400" />
                    <h4 className="text-xs font-extrabold text-[var(--color-text-muted)] uppercase tracking-wider">
                      พฤติกรรมและการตั้งค่าการประมวลผล (Behavior Config)
                    </h4>
                  </div>

                  {/* Case 1: end-shifts */}
                  {job.id === "end-shifts" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Attendance Alerts Toggle */}
                      <label className="flex items-start gap-3 p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 hover:bg-[var(--color-surface-2)] transition-all cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(draft.config as unknown as Partial<EndShiftsConfig>)?.sendAttendanceAlerts !== false}
                          onChange={(e) =>
                            handleConfigChange(job.id, "sendAttendanceAlerts", e.target.checked)
                          }
                          className="mt-1 h-4 w-4 rounded-sm border-gray-300 text-amber-600 focus:ring-amber-500"
                        />
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5">
                            <Bell size={13} className="text-amber-600 dark:text-amber-400" />
                            ส่งแจ้งเตือนเรื่องคนไม่ปิดกะ / ขาดงาน
                          </span>
                          <p className="text-[11px] text-[var(--color-text-subtle)] leading-relaxed">
                            ระบบจะตรวจสอบพนักงานที่เข้ากะแล้วลืมปิดกะ หรือพนักงานที่ไม่มาเข้างาน แล้วส่งแจ้งเตือนถึง ผจก. และผู้ช่วย ผจก. ประจำสาขานั้น
                          </p>
                        </div>
                      </label>

                      {/* Auto End Shifts Toggle */}
                      <label className="flex items-start gap-3 p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 hover:bg-[var(--color-surface-2)] transition-all cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(draft.config as unknown as Partial<EndShiftsConfig>)?.autoEndUnclosedShifts !== false}
                          onChange={(e) =>
                            handleConfigChange(job.id, "autoEndUnclosedShifts", e.target.checked)
                          }
                          className="mt-1 h-4 w-4 rounded-sm border-gray-300 text-amber-600 focus:ring-amber-500"
                        />
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5">
                            <Clock size={13} className="text-amber-600 dark:text-amber-400" />
                            บังคับปิดกะที่ค้างอยู่โดยอัตโนมัติ
                          </span>
                          <p className="text-[11px] text-[var(--color-text-subtle)] leading-relaxed">
                            กะที่ยังเปิดค้างอยู่ทั้งหมดจะถูกปิดโดยอัตโนมัติเมื่อสิ้นวัน เพื่อไม่ให้ข้ามไปยังวันถัดไป
                          </p>
                        </div>
                      </label>
                    </div>
                  )}

                  {/* Case 2: daily-refrigerators */}
                  {job.id === "daily-refrigerators" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Create Daily Tasks Toggle */}
                      <label className="flex items-start gap-3 p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 hover:bg-[var(--color-surface-2)] transition-all cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(draft.config as unknown as Partial<DailyRefrigeratorsConfig>)?.createDailyTasks !== false}
                          onChange={(e) =>
                            handleConfigChange(job.id, "createDailyTasks", e.target.checked)
                          }
                          className="mt-1 h-4 w-4 rounded-sm border-gray-300 text-amber-600 focus:ring-amber-500"
                        />
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5">
                            <CalendarClock size={13} className="text-cyan-600 dark:text-cyan-400" />
                            สร้างรายการตรวจตู้แช่ประจำวันอัตโนมัติ
                          </span>
                          <p className="text-[11px] text-[var(--color-text-subtle)] leading-relaxed">
                            สร้างแถวบันทึกอุณหภูมิใหม่สำหรับวันปัจจุบันให้พนักงานสต็อกตรวจเช็คได้ทันที
                          </p>
                        </div>
                      </label>

                      {/* Mark Missed Yesterday Tasks Toggle */}
                      <label className="flex items-start gap-3 p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 hover:bg-[var(--color-surface-2)] transition-all cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(draft.config as unknown as Partial<DailyRefrigeratorsConfig>)?.markMissedYesterdayTasks !== false}
                          onChange={(e) =>
                            handleConfigChange(job.id, "markMissedYesterdayTasks", e.target.checked)
                          }
                          className="mt-1 h-4 w-4 rounded-sm border-gray-300 text-amber-600 focus:ring-amber-500"
                        />
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5">
                            <AlertTriangle size={13} className="text-amber-600 dark:text-amber-400" />
                            ทำเครื่องหมายตู้แช่ที่ขาดการตรวจสอบเมื่อวาน
                          </span>
                          <p className="text-[11px] text-[var(--color-text-subtle)] leading-relaxed">
                            ตรวจหาตู้แช่ที่ไม่มีการลงบันทึกเมื่อวาน และบันทึกสถานะว่าไม่ผ่านการตรวจสอบ พร้อมส่งแจ้งเตือน ผจก.
                          </p>
                        </div>
                      </label>
                    </div>
                  )}

                  {/* Case 3: cleanup-data */}
                  {job.id === "cleanup-data" && (
                    <div className="space-y-4">
                      {/* Retention Days Selector */}
                      <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <label
                            htmlFor={`retention-${job.id}`}
                            className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5"
                          >
                            <Calendar size={14} className="text-amber-600 dark:text-amber-400" />
                            ระยะเวลาจัดเก็บข้อมูลย้อนหลัง (Data Retention Period)
                          </label>
                          <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400">
                            ลบข้อมูลที่เก่ากว่า:{" "}
                            {Number((draft.config as unknown as Partial<CleanupDataConfig>)?.retentionDays || 14)} วัน
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {[7, 14, 30, 60, 90].map((days) => {
                            const isCurrent =
                              Number((draft.config as unknown as Partial<CleanupDataConfig>)?.retentionDays || 14) === days;
                            return (
                              <button
                                key={days}
                                type="button"
                                onClick={() => handleConfigChange(job.id, "retentionDays", days)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  isCurrent
                                    ? "bg-[var(--color-brown)] text-amber-200 dark:bg-amber-400 dark:text-amber-950 shadow-2xs"
                                    : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                                }`}
                              >
                                {days} วัน {days === 14 ? "(ค่าแนะนำ)" : ""}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[11px] text-[var(--color-text-subtle)] leading-relaxed">
                          ข้อมูลที่ถูกสร้างก่อนกำหนดนี้จะถูกล้างออกจากฐานข้อมูล เพื่อไม่ให้ฐานข้อมูลโตเกินความจำเป็น
                        </p>
                      </div>

                      {/* Entities Cleanup Toggles */}
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-[var(--color-text-muted)] block">
                          หมวดหมู่ข้อมูลที่จะทำความสะอาด:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {[
                            { key: "cleanShiftSessions", label: "ประวัติการเปิด-ปิดกะ และเช็คลิสต์งาน" },
                            { key: "cleanRefrigeratorTasks", label: "บันทึกอุณหภูมิตู้แช่เก่า" },
                            { key: "cleanNotifications", label: "การแจ้งเตือนเก่าที่พ้นระยะเวลา" },
                            { key: "cleanPointTransactions", label: "ประวัติธุรกรรมแต้มเก่า" },
                            { key: "cleanEmployeeLeaves", label: "ประวัติการลาพนักงานเก่า" },
                          ].map((item) => (
                            <label
                              key={item.key}
                              className="flex items-center gap-2.5 p-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] transition-all cursor-pointer text-xs"
                            >
                              <input
                                type="checkbox"
                                checked={(draft.config as Record<string, boolean>)?.[item.key] !== false}
                                onChange={(e) =>
                                  handleConfigChange(job.id, item.key, e.target.checked)
                                }
                                className="h-4 w-4 rounded-sm border-gray-300 text-amber-600 focus:ring-amber-500"
                              />
                              <span className="text-xs font-medium text-[var(--color-text)]">{item.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Case 4: reset-scores */}
                  {job.id === "reset-scores" && (
                    <div className="space-y-4">
                      {/* Target Roles & Scope */}
                      <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5">
                            <Award size={14} className="text-purple-600 dark:text-purple-400" />
                            ขอบเขตบทบาทที่จะรีเซ็ตคะแนน (Target Roles)
                          </span>
                          <span className="text-xs font-mono font-bold text-purple-700 dark:text-purple-400">
                            {((draft.config as unknown as Partial<ResetScoresConfig>)?.resetRoles || ["employee"]).includes("manager_assistant")
                              ? "พนักงาน และ ผู้ช่วย ผจก."
                              : "เฉพาะพนักงานทั่วไป (Employee)"}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <label className="flex items-start gap-3 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] transition-all cursor-pointer">
                            <input
                              type="checkbox"
                              checked={((draft.config as unknown as Partial<ResetScoresConfig>)?.resetRoles || ["employee"]).includes("employee")}
                              onChange={(e) => {
                                const currentRoles = (draft.config as unknown as Partial<ResetScoresConfig>)?.resetRoles || ["employee"];
                                const newRoles = e.target.checked
                                  ? Array.from(new Set([...currentRoles, "employee"]))
                                  : currentRoles.filter((r) => r !== "employee");
                                handleConfigChange(job.id, "resetRoles", newRoles);
                              }}
                              className="mt-1 h-4 w-4 rounded-sm border-gray-300 text-purple-600 focus:ring-purple-500"
                            />
                            <div className="space-y-0.5">
                              <span className="text-xs font-bold text-[var(--color-text)]">พนักงานทั่วไป (Employee)</span>
                              <p className="text-[11px] text-[var(--color-text-subtle)] leading-relaxed">
                                พนักงานประจำสาขา (Cashier, Stock) ที่สะสมคะแนนจากเช็คลิสต์ประจำวัน
                              </p>
                            </div>
                          </label>

                          <label className="flex items-start gap-3 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] transition-all cursor-pointer">
                            <input
                              type="checkbox"
                              checked={((draft.config as unknown as Partial<ResetScoresConfig>)?.resetRoles || ["employee"]).includes("manager_assistant")}
                              onChange={(e) => {
                                const currentRoles = (draft.config as unknown as Partial<ResetScoresConfig>)?.resetRoles || ["employee"];
                                const newRoles = e.target.checked
                                  ? Array.from(new Set([...currentRoles, "manager_assistant"]))
                                  : currentRoles.filter((r) => r !== "manager_assistant");
                                handleConfigChange(job.id, "resetRoles", newRoles);
                              }}
                              className="mt-1 h-4 w-4 rounded-sm border-gray-300 text-purple-600 focus:ring-purple-500"
                            />
                            <div className="space-y-0.5">
                              <span className="text-xs font-bold text-[var(--color-text)]">ผู้ช่วยผู้จัดการร้าน (Manager Assistant)</span>
                              <p className="text-[11px] text-[var(--color-text-subtle)] leading-relaxed">
                                รวมผู้ช่วยผู้จัดการร้านที่มีการสะสมคะแนนจากการปฏิบัติงาน
                              </p>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Operation Options */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Transaction Audit */}
                        <label className="flex items-start gap-3 p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 hover:bg-[var(--color-surface-2)] transition-all cursor-pointer">
                          <input
                            type="checkbox"
                            checked={(draft.config as unknown as Partial<ResetScoresConfig>)?.recordTransaction !== false}
                            onChange={(e) =>
                              handleConfigChange(job.id, "recordTransaction", e.target.checked)
                            }
                            className="mt-1 h-4 w-4 rounded-sm border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5">
                              <ShieldCheck size={13} className="text-purple-600 dark:text-purple-400" />
                              บันทึกประวัติธุรกรรมแต้ม (Audit Trail)
                            </span>
                            <p className="text-[11px] text-[var(--color-text-subtle)] leading-relaxed">
                              บันทึกรายการล้างคะแนนเดิมลงในตารางประวัติธุรกรรมแต้มเพื่อใช้ตรวจสอบย้อนหลัง
                            </p>
                          </div>
                        </label>

                        {/* Broadcast Notification */}
                        <label className="flex items-start gap-3 p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 hover:bg-[var(--color-surface-2)] transition-all cursor-pointer">
                          <input
                            type="checkbox"
                            checked={(draft.config as unknown as Partial<ResetScoresConfig>)?.notifyEmployees !== false}
                            onChange={(e) =>
                              handleConfigChange(job.id, "notifyEmployees", e.target.checked)
                            }
                            className="mt-1 h-4 w-4 rounded-sm border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5">
                              <Bell size={13} className="text-purple-600 dark:text-purple-400" />
                              ส่งแจ้งเตือนเริ่มรอบเดือนใหม่
                            </span>
                            <p className="text-[11px] text-[var(--color-text-subtle)] leading-relaxed">
                              แจ้งเตือนพนักงานทุกคนว่าคะแนนสะสมเริ่มรอบใหม่แล้ว เพื่อกระตุ้นการมีส่วนร่วม
                            </p>
                          </div>
                        </label>

                        {/* Reset Streaks Option */}
                        <label className="flex items-start gap-3 p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 hover:bg-[var(--color-surface-2)] transition-all cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean((draft.config as unknown as Partial<ResetScoresConfig>)?.resetStreaks)}
                            onChange={(e) =>
                              handleConfigChange(job.id, "resetStreaks", e.target.checked)
                            }
                            className="mt-1 h-4 w-4 rounded-sm border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5">
                              <Activity size={13} className="text-purple-600 dark:text-purple-400" />
                              รีเซ็ตสตรีคความต่อเนื่อง (Streak)
                            </span>
                            <p className="text-[11px] text-[var(--color-text-subtle)] leading-relaxed">
                              ค่าเริ่มต้นคือปิดไว้ (คงสตรีคไว้เพื่อวัดความต่อเนื่องข้ามเดือน หากเปิดจะล้างสตรีคเป็น 0 ด้วย)
                            </p>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Strip: Last Execution Logs & Actions */}
                <div className="pt-4 border-t border-[var(--color-border)] flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Status & Last Run info */}
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-[var(--color-text-muted)]">
                        ประมวลผลล่าสุด:
                      </span>
                      <span className="text-xs font-mono font-medium text-[var(--color-text)]">
                        {formatThaiDate(job.last_run_at)}
                      </span>

                      {job.last_run_status && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            job.last_run_status === "success"
                              ? "bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800"
                              : job.last_run_status === "skipped"
                              ? "bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800"
                              : "bg-rose-50 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-800"
                          }`}
                        >
                          {job.last_run_status === "success" && "สำเร็จ (Success)"}
                          {job.last_run_status === "skipped" && "ข้าม (Skipped / Disabled)"}
                          {job.last_run_status === "failed" && "ผิดพลาด (Failed)"}
                        </span>
                      )}
                    </div>

                    {job.last_run_message && (
                      <p className="text-[11px] text-[var(--color-text-subtle)] truncate max-w-xl font-mono" title={job.last_run_message}>
                        {job.last_run_message}
                      </p>
                    )}
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-2.5 shrink-0 self-end md:self-auto">
                    {/* Run Now Button */}
                    <button
                      type="button"
                      onClick={() => handleRunNow(job, !draft.enabled)}
                      disabled={isRunning || isSaving}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold border border-[var(--color-border)] hover:border-amber-500/50 hover:bg-amber-50/50 dark:hover:bg-amber-950/30 text-[var(--color-text)] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                      title={!draft.enabled ? "ทดสอบรันทันที (จะรันแบบ Force Execution แม้สถานะถูกปิด)" : "สั่งรันงานนี้ทันที"}
                    >
                      {isRunning ? (
                        <>
                          <Loader2 size={13} className="animate-spin text-amber-600" />
                          <span>กำลังประมวลผล...</span>
                        </>
                      ) : (
                        <>
                          <Play size={13} className="text-amber-600 fill-amber-600" />
                          <span>ทดสอบรันทันที</span>
                        </>
                      )}
                    </button>

                    {/* Save Config Button */}
                    <button
                      type="button"
                      onClick={() => handleSaveJob(job.id)}
                      disabled={isSaving || isRunning}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--color-brown)] text-amber-200 hover:bg-[var(--color-primary-dim)] dark:bg-amber-400 dark:text-amber-950 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>กำลังบันทึก...</span>
                        </>
                      ) : (
                        <>
                          <Save size={13} />
                          <span>บันทึกการตั้งค่า</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Security & Architecture Note Strip ─────────────────────────── */}
      <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-2xl p-5 text-xs text-[var(--color-text-muted)] space-y-2">
        <div className="flex items-center gap-2 font-bold text-[var(--color-text)]">
          <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
          <span>การทำงานและสิทธิ์ความปลอดภัย</span>
        </div>
        <p className="leading-relaxed text-[var(--color-text-subtle)]">
          • เมื่อ Vercel Cron หรือ External Scheduler ยิงคำขอมาที่ API Endpoint ระบบจะดึงการตั้งค่าจากฐานข้อมูลนี้มาตรวจสอบก่อนเสมอ หากสถานะถูกตั้งเป็น <strong>&quot;ปิดการทำงาน&quot;</strong> ระบบจะข้ามขั้นตอนโดยไม่แก้ไขข้อมูลใดๆ
        </p>
        <p className="leading-relaxed text-[var(--color-text-subtle)]">
          • การกดปุ่ม <strong>&quot;ทดสอบรันทันที&quot;</strong> จะทำงานผ่าน Server Action ที่ตรวจสอบสิทธิ์ผู้ดูแลระบบ (Admin) โดยตรง สามารถใช้ตรวจเช็คผลการทำงานได้ทันทีโดยไม่ต้องรอรอบเวลาอัตโนมัติ
        </p>
      </div>

      {/* ─── Execution Result Modal ──────────────────────────────────────── */}
      {runResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2">
                {runResultModal.success ? (
                  <CheckCircle2 size={20} className="text-emerald-500" />
                ) : (
                  <AlertTriangle size={20} className="text-rose-500" />
                )}
                <h3 className="text-sm font-extrabold text-[var(--color-text)]">
                  ผลการทดสอบ: {runResultModal.jobName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRunResultModal(null)}
                className="text-[var(--color-text-subtle)] hover:text-[var(--color-text)] text-xs font-bold px-2 py-1 rounded-lg cursor-pointer"
              >
                ✕ ปิด
              </button>
            </div>

            <div className="space-y-2">
              <div
                className={`p-3.5 rounded-xl border text-xs font-medium leading-relaxed ${
                  runResultModal.success
                    ? runResultModal.skipped
                      ? "bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200"
                      : "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                    : "bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200"
                }`}
              >
                {runResultModal.message}
              </div>

              {runResultModal.result && (
                <div className="mt-3">
                  <span className="text-[11px] font-bold text-[var(--color-text-muted)] block mb-1">
                    รายละเอียดข้อมูลที่ประมวลผล (Execution Data):
                  </span>
                  <pre className="p-3 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl text-[11px] font-mono text-[var(--color-text)] overflow-x-auto max-h-48">
                    {JSON.stringify(runResultModal.result, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setRunResultModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--color-brown)] text-amber-200 dark:bg-amber-400 dark:text-amber-950 cursor-pointer shadow-xs"
              >
                รับทราบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
