"use client";

import React, { useState, useEffect } from "react";
import { useModalFocusTrap } from "./ModalFocusTrap";

interface LateReasonModalProps {
  isOpen: boolean;
  taskLabel: string;
  deadlineText?: string;
  onSubmit: (reason: string) => void;
  onCancel: () => void;
}

const COMMON_REASONS = [
  "ลืมตรวจเช็ครายการงาน (Forgot to Check)",
  "ลูกค้าหน้าร้านหนาแน่น",
  "รอสินค้าเข้าเติม / สินค้าขาดสต็อก",
  "ระบบเครื่องจักรหรืออุปกรณ์ขัดข้อง",
  "ติดภารกิจเร่งด่วนอื่นที่ได้รับมอบหมาย",
];

export function LateReasonModal({
  isOpen,
  taskLabel,
  deadlineText,
  onSubmit,
  onCancel,
}: LateReasonModalProps) {
  const [reason, setReason] = useState("");
  const { dialogRef, handleKeyDown } = useModalFocusTrap(isOpen, onCancel);

  useEffect(() => {
    if (isOpen) {
      setReason("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    onSubmit(reason.trim());
  };

  const handleSelectQuickReason = (selected: string) => {
    if (!reason) {
      setReason(selected);
    } else if (!reason.includes(selected)) {
      setReason(`${reason}, ${selected}`);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-[var(--color-brown)]/40 backdrop-blur-xs flex items-center justify-center z-50 px-3 sm:px-4"
      onClick={onCancel}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="late-reason-title"
        tabIndex={-1}
        className="bg-[var(--color-surface)] border border-rose-200 dark:border-rose-900/50 rounded-2xl w-full max-w-md shadow-2xl p-5 sm:p-6 text-[var(--color-text)] flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-100 dark:border-rose-900/30">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div>
              <h2 id="late-reason-title" className="text-base font-bold text-rose-900 dark:text-rose-200">
                ระบุเหตุผลการส่งงานล่าช้า
              </h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                งานนี้ส่งเกินกำหนดเวลาที่กำหนด กรุณาระบุเหตุผล
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="ยกเลิก"
            className="p-1.5 -mr-1.5 -mt-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] rounded-lg transition-colors cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="6" />
            </svg>
          </button>
        </div>

        {/* Task Info Box */}
        <div className="p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs space-y-1">
          <div className="font-semibold text-[var(--color-text)] line-clamp-2">
            {taskLabel}
          </div>
          {deadlineText && (
            <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium text-[11px]">
              <span>กำหนดเวลา:</span>
              <span className="font-mono">{deadlineText}</span>
              <span className="bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 px-1.5 py-0.2 rounded text-[10px]">
                เกินเวลา
              </span>
            </div>
          )}
        </div>

        {/* Quick Reason Suggestions */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--color-text-muted)]">
            เลือกเหตุผลเบื้องต้น:
          </label>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_REASONS.map((cr) => (
              <button
                key={cr}
                type="button"
                onClick={() => handleSelectQuickReason(cr)}
                className="text-xs px-2.5 py-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:border-rose-300 dark:hover:border-rose-800 text-[var(--color-text-secondary)] hover:text-rose-700 dark:hover:text-rose-300 transition-colors text-left cursor-pointer"
              >
                + {cr}
              </button>
            ))}
          </div>
        </div>

        {/* Reason Text Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="late-reason-input" className="text-xs font-semibold text-[var(--color-text)] flex justify-between">
              <span>เหตุผลที่ส่งงานล่าช้า <span className="text-rose-500">*</span></span>
              <span className="text-[10px] text-[var(--color-text-muted)] font-normal">จำเป็นต้องระบุ</span>
            </label>
            <textarea
              id="late-reason-input"
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="กรุณากรอกเหตุผลที่ต้องส่งงานล่าช้า..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 resize-none transition-all"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-[var(--color-border)]">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] rounded-xl transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={!reason.trim()}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              ยืนยันการส่งงาน
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
