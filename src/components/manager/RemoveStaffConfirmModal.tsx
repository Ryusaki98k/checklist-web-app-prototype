"use client";

import { useState } from "react";
import { User } from "../../types";
import { BranchEmployeeStatus, removeEmployeeFromBranchAction } from "../../actions/manager";
import { useModalFocusTrap } from "../common/ModalFocusTrap";
import {
  UserX,
  AlertTriangle,
  RotateCw,
  X,
  ShieldAlert,
  Info,
} from "lucide-react";

interface RemoveStaffConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: BranchEmployeeStatus | null;
  branchId: string;
  branchName: string;
  currentUser: User;
  onStaffRemoved: () => void;
}

export function RemoveStaffConfirmModal({
  isOpen,
  onClose,
  employee,
  branchId,
  branchName,
  currentUser,
  onStaffRemoved,
}: RemoveStaffConfirmModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { dialogRef, handleKeyDown } = useModalFocusTrap(isOpen, onClose);

  if (!isOpen || !employee) return null;

  async function handleConfirmRemove() {
    if (!employee) return;
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const res = await removeEmployeeFromBranchAction({
        managerId: currentUser.id,
        branchId,
        targetUserId: employee.id,
      });

      if (res.success) {
        onStaffRemoved();
        onClose();
      } else {
        setErrorMsg(res.error || "ไม่สามารถนำพนักงานออกจากสาขาได้");
      }
    } catch (err: any) {
      console.error("Remove staff error:", err);
      setErrorMsg("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-staff-modal-title"
        tabIndex={-1}
        className="w-full max-w-md bg-[var(--color-surface)] border border-rose-300 dark:border-rose-900/60 rounded-2xl shadow-2xl p-5 sm:p-7 text-[var(--color-text)] flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-300 flex items-center justify-center shadow-xs shrink-0 border border-rose-200 dark:border-rose-800">
              <UserX size={24} strokeWidth={2.2} />
            </div>
            <div>
              <h2 id="remove-staff-modal-title" className="text-base sm:text-lg font-bold text-[var(--color-text)] leading-tight">
                นำพนักงานออกจากสาขา
              </h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                ปลดพนักงานและริบคืนสิทธิ์ประจำสาขา
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Employee Info Card */}
        <div className="p-3.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-surface)] text-[var(--color-text)] flex items-center justify-center font-bold text-xs border border-[var(--color-border)] shrink-0">
              {employee.name.slice(0, 2)}
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold text-[var(--color-text)] truncate">{employee.name}</p>
              <p className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-1.5">
                <span>@{employee.username || "-"}</span>
                <span>•</span>
                <span>{employee.position || "พนักงานสาขา"}</span>
              </p>
            </div>
          </div>

          <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 shrink-0">
            สาขา {branchName}
          </span>
        </div>

        {/* Policy Explanation Banner */}
        <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-300/70 dark:border-amber-800/60 text-amber-950 dark:text-amber-200 text-xs space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-300">
            <ShieldAlert size={15} className="shrink-0" />
            <span>ผลของการดำเนินการ:</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-[11px] sm:text-xs text-amber-900/90 dark:text-amber-300/90 pl-1 leading-relaxed">
            <li>พนักงานจะถูกปลดออกจากสาขา {branchName} โดยทันที</li>
            <li>สิทธิ์และบทบาทที่เคยมีจะถูกริบคืน</li>
            <li>
              <strong>บัญชีผู้ใช้จะยังคงอยู่ในระบบ</strong> สามารถล็อกอินได้ แต่จะไม่สามารถเข้าปฏิบัติงาน ตรวจเช็คลิสต์ หรือทำรายการใดๆ ได้จนกว่าจะได้รับการกำหนดสาขาใหม่
            </li>
            <li>หากมีกะการทำงานที่เปิดค้างอยู่ในวันนี้ จะถูกปิดกะโดยอัตโนมัติ</li>
          </ul>
        </div>

        {/* Error alert */}
        {errorMsg && (
          <div role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 py-2.5 px-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>

          <button
            type="button"
            onClick={handleConfirmRemove}
            disabled={isSubmitting}
            className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
          >
            {isSubmitting ? (
              <>
                <RotateCw size={14} className="animate-spin" />
                <span>กำลังดำเนินการ...</span>
              </>
            ) : (
              <>
                <UserX size={14} />
                <span>ยืนยันปลดออกจากสาขา</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
