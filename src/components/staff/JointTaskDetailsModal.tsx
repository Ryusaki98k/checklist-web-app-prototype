"use client";

import { useEffect, useState } from "react";
import { X, Users, CheckCircle2, Calendar, AlertCircle } from "lucide-react";
import { getJointTaskDaySummaryAction } from "../../actions/jointTask";
import { ShiftType } from "../../types";

interface JointTaskDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchId: string;
  dateStr: string;
  shift?: ShiftType;
}

export function JointTaskDetailsModal({
  isOpen,
  onClose,
  branchId,
  dateStr,
  shift,
}: JointTaskDetailsModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    date: string;
    shift?: ShiftType;
    branchName?: string;
    onDutyStaff: Array<{ id: string; name: string; position?: string; role: string }>;
    participants: Array<{ id: string; name: string; completedCount: number }>;
    items: Array<any>;
    refrigerators: Array<any>;
    assistantApproved: boolean;
    managerApproved: boolean;
  } | null>(null);

  useEffect(() => {
    if (!isOpen || !branchId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    async function fetchSummary() {
      try {
        const res = await getJointTaskDaySummaryAction({ branchId, dateStr, shift });
        if (isMounted) {
          if (res.success && res.summary) {
            setSummary(res.summary);
          } else {
            setError(res.error || "ไม่สามารถโหลดข้อมูลสรุปงานส่วนกลางได้");
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void fetchSummary();
    return () => {
      isMounted = false;
    };
  }, [isOpen, branchId, dateStr, shift]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Users size={22} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)]">
                รายละเอียดผู้ร่วมงานส่วนกลาง
              </h2>
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] font-medium mt-0.5">
                <span className="flex items-center gap-1">
                  <Calendar size={13} />
                  {dateStr}
                </span>
                {shift && (
                  <span className="px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold">
                    {shift === "morning" ? "รอบเช้า" : shift === "afternoon" ? "รอบบ่าย" : shift}
                  </span>
                )}
                {summary?.branchName && <span>• สาขา: {summary.branchName}</span>}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {loading ? (
            <div className="py-12 text-center text-sm text-[var(--color-text-muted)]">
              กำลังโหลดข้อมูลผู้ร่วมงาน...
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 flex items-start gap-3 text-sm">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : summary ? (
            <>
              {/* Approval status banner */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${summary.assistantApproved ? "bg-emerald-500" : "bg-amber-500"}`} />
                  <span className="text-[var(--color-text-muted)]">ผู้ช่วยผู้จัดการ:</span>
                  <span className="font-bold text-[var(--color-text)]">
                    {summary.assistantApproved ? "อนุมัติแล้ว" : "รอการตรวจ"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${summary.managerApproved ? "bg-emerald-500" : "bg-amber-500"}`} />
                  <span className="text-[var(--color-text-muted)]">ผู้จัดการร้าน:</span>
                  <span className="font-bold text-[var(--color-text)]">
                    {summary.managerApproved ? "อนุมัติแล้ว" : "รอการตรวจ"}
                  </span>
                </div>
              </div>

              {/* 1. On Duty Staff */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2.5">
                  พนักงานที่เข้ากะวันนี้ ({summary.onDutyStaff.length} คน)
                </h3>
                {summary.onDutyStaff.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-muted)] italic">ยังไม่มีบันทึกพนักงานเข้ากะในระบบสำหรับวันนี้</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {summary.onDutyStaff.map((staff) => (
                      <div
                        key={staff.id}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-xs"
                      >
                        <span className="font-bold text-[var(--color-text)]">{staff.name}</span>
                        <span className="px-2 py-0.5 rounded-md bg-[var(--color-surface-2)] text-[var(--color-text-muted)] font-medium">
                          {staff.position || staff.role}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Active Participants */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2.5">
                  ผู้มีส่วนร่วมในการตรวจเช็ค ({summary.participants.length} คน)
                </h3>
                {summary.participants.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-muted)] italic">ยังไม่มีใครทำการตรวจเช็คงานส่วนกลางในวันนี้</p>
                ) : (
                  <div className="space-y-2">
                    {summary.participants.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/20 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                          <span className="font-bold text-[var(--color-text)]">{p.name}</span>
                        </div>
                        <span className="font-bold text-emerald-700 dark:text-emerald-300">
                          ช่วยเช็คแล้ว {p.completedCount} รายการ
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Joint Items Breakdown */}
              {summary.items.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2.5">
                    รายการงานส่วนกลาง ({summary.items.length} รายการ)
                  </h3>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {summary.items.map((item) => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-xs flex items-center justify-between"
                      >
                        <div>
                          <p className="font-bold text-[var(--color-text)]">{item.name || item.taskName}</p>
                          {item.completed && item.completedByUserName && (
                            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                              เช็คแล้วโดย: {item.completedByUserName}
                              {item.completedAt && ` • ${new Date(item.completedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`}
                            </p>
                          )}
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                            item.completed
                              ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300"
                              : "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300"
                          }`}
                        >
                          {item.completed ? "เสร็จสิ้น" : "รอดำเนินการ"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-[var(--color-border)] bg-[var(--color-surface-2)] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-xs sm:text-sm font-bold text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}
