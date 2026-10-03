"use client";

import { useEffect } from "react";
import { ShieldAlert, X, UserCheck, KeyRound } from "lucide-react";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ForgotPasswordModal({ isOpen, onClose }: ForgotPasswordModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 sm:p-7 shadow-2xl text-[var(--color-text)] font-sans space-y-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="forgot-pw-title"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
          aria-label="ปิดหน้าต่าง"
        >
          <X size={18} />
        </button>

        {/* Header with Icon */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <KeyRound size={24} />
          </div>
          <div>
            <h3 id="forgot-pw-title" className="text-lg font-bold text-[var(--color-text)]">
              ลืมรหัสผ่าน (Forgot Password)
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              ขั้นตอนการขอรับหรือรีเซ็ตรหัสผ่านสำหรับเข้าใช้งานระบบ
            </p>
          </div>
        </div>

        {/* Content Body */}
        <div className="space-y-3.5 text-xs sm:text-sm text-[var(--color-text)] leading-relaxed bg-[var(--color-surface-2)] p-4 rounded-xl border border-[var(--color-border)]">
          <div className="flex items-start gap-2.5">
            <ShieldAlert size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="font-medium">
              ระบบใช้งานเฉพาะชื่อผู้ใช้ (Username) และรหัสผ่าน (Password) เพื่อความปลอดภัยและความสะดวกของสาขา
            </p>
          </div>

          <hr className="border-[var(--color-border)] my-2" />

          <div className="space-y-2 text-xs text-[var(--color-text-muted)]">
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold flex items-center justify-center shrink-0 text-[11px]">
                1
              </span>
              <span>แจ้ง<strong>ชื่อผู้ใช้ (Username)</strong> ของคุณกับ <strong>ผู้ดูแลระบบส่วนกลาง (Central Admin)</strong> หรือผู้จัดการสาขา</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold flex items-center justify-center shrink-0 text-[11px]">
                2
              </span>
              <span>ผู้ดูแลระบบสามารถตรวจสอบและตั้งรหัสผ่านใหม่ให้ท่านได้ทันที</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-[var(--color-brown)] hover:bg-[var(--color-brown-light)] text-amber-100 text-sm font-bold rounded-xl transition-all shadow-md shadow-amber-950/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            <UserCheck size={16} />
            <span>เข้าใจแล้ว / ติดต่อผู้ดูแลระบบ</span>
          </button>
        </div>
      </div>
    </div>
  );
}
