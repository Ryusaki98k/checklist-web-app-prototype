"use client";

import React, { useState } from "react";
import { User, ManagerType, ExecutiveType, Role, ActiveRole } from "../../types";
import { updateUserPermissionsAction } from "../../actions/auth";
import { useModalFocusTrap } from "../common/ModalFocusTrap";
import { ShieldCheck, Briefcase, Landmark, Users, Check, AlertCircle, Sparkles } from "lucide-react";
import { UserAvatar } from "../common/UserAvatar";

interface AdminUserPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: User | null;
  currentAdminId: string;
  onPermissionsUpdated: (updatedUser: User) => void;
  showToast: (msg: string) => void;
}

export function AdminUserPermissionsModal({
  isOpen,
  onClose,
  targetUser,
  currentAdminId,
  onPermissionsUpdated,
  showToast,
}: AdminUserPermissionsModalProps) {
  const [managerType, setManagerType] = useState<ManagerType>("none");
  const [executiveType, setExecutiveType] = useState<ExecutiveType>("none");
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const { dialogRef, handleKeyDown } = useModalFocusTrap(isOpen, onClose);

  // Sync state whenever targetUser changes or modal opens
  React.useEffect(() => {
    if (targetUser) {
      setManagerType(targetUser.managerType || (targetUser.role === "manager" ? "store" : targetUser.role === "manager_assistant" ? "assistant" : "none"));
      setExecutiveType(targetUser.executiveType || (targetUser.role === "committee" ? "committee" : targetUser.role === "general_manager" ? "executive" : "none"));
      setIsAdmin(Boolean(targetUser.isAdmin ?? (targetUser.role === "admin")));
      setError("");
    }
  }, [targetUser, isOpen]);

  if (!isOpen || !targetUser) return null;

  const isSelf = targetUser.id === currentAdminId;

  // Presets applicator
  const applyPreset = (preset: "staff" | "asst" | "mgr" | "committee" | "gm" | "admin") => {
    switch (preset) {
      case "staff":
        setManagerType("none");
        setExecutiveType("none");
        if (!isSelf) setIsAdmin(false);
        break;
      case "asst":
        setManagerType("assistant");
        setExecutiveType("none");
        if (!isSelf) setIsAdmin(false);
        break;
      case "mgr":
        setManagerType("store");
        setExecutiveType("none");
        if (!isSelf) setIsAdmin(false);
        break;
      case "committee":
        setManagerType("none");
        setExecutiveType("committee");
        if (!isSelf) setIsAdmin(false);
        break;
      case "gm":
        setManagerType("none");
        setExecutiveType("executive");
        if (!isSelf) setIsAdmin(false);
        break;
      case "admin":
        setManagerType("store");
        setExecutiveType("executive");
        setIsAdmin(true);
        break;
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetUser) return;

    if (isSelf && !isAdmin) {
      setError("ไม่สามารถปิดสิทธิ์แอดมินของตนเองได้");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const res = await updateUserPermissionsAction(targetUser.id, {
        managerType,
        executiveType,
        isAdmin,
      });

      if (res.success) {
        showToast(`อัปเดตสิทธิ์ของ ${targetUser.name} เรียบร้อยแล้ว`);
        onPermissionsUpdated({
          ...targetUser,
          managerType,
          executiveType,
          isAdmin,
        });
        onClose();
      } else {
        setError(res.error || "ไม่สามารถอัปเดตสิทธิ์ได้");
      }
    } catch (err: any) {
      setError(err?.message || "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="perm-modal-title"
    >
      <div
        ref={dialogRef}
        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-surface-2)]">
          <div className="flex items-center gap-3">
            <UserAvatar user={targetUser} size="md" className="shrink-0 shadow-xs" />
            <div>
              <h3 id="perm-modal-title" className="font-bold text-[var(--color-text)] text-base">
                จัดการสิทธิ์ผู้ใช้งาน (Multi-role Permissions)
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                {targetUser.name} <span className="font-mono text-[11px]">(@{targetUser.username})</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-[var(--color-surface)] transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Presets */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-2 flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-500" />
              <span>ทางลัดกำหนดบทบาท (Quick Presets)</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => applyPreset("staff")}
                className="px-2 py-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] hover:bg-amber-500/10 hover:border-amber-400 text-xs font-medium text-[var(--color-text)] transition-colors cursor-pointer"
              >
                พนักงานสาขา
              </button>
              <button
                type="button"
                onClick={() => applyPreset("asst")}
                className="px-2 py-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] hover:bg-emerald-500/10 hover:border-emerald-400 text-xs font-medium text-[var(--color-text)] transition-colors cursor-pointer"
              >
                ผู้ช่วยผู้จัดการ
              </button>
              <button
                type="button"
                onClick={() => applyPreset("mgr")}
                className="px-2 py-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] hover:bg-emerald-500/10 hover:border-emerald-400 text-xs font-medium text-[var(--color-text)] transition-colors cursor-pointer"
              >
                ผู้จัดการร้าน
              </button>
              <button
                type="button"
                onClick={() => applyPreset("committee")}
                className="px-2 py-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] hover:bg-blue-500/10 hover:border-blue-400 text-xs font-medium text-[var(--color-text)] transition-colors cursor-pointer"
              >
                กรรมการ
              </button>
              <button
                type="button"
                onClick={() => applyPreset("gm")}
                className="px-2 py-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] hover:bg-blue-500/10 hover:border-blue-400 text-xs font-medium text-[var(--color-text)] transition-colors cursor-pointer"
              >
                ผู้จัดการทั่วไป (GM)
              </button>
              <button
                type="button"
                onClick={() => applyPreset("admin")}
                className="px-2 py-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] hover:bg-purple-500/10 hover:border-purple-400 text-xs font-medium text-[var(--color-text)] transition-colors cursor-pointer"
              >
                Admin ส่วนกลาง
              </button>
            </div>
          </div>

          {/* Granular Section 1: Base Employee Capability */}
          <div className="p-3.5 bg-amber-500/10 border border-amber-300 dark:border-amber-800/60 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-amber-950 flex items-center justify-center shrink-0">
                <Users size={16} />
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--color-text)]">
                  พนักงานสาขา (Floor Staff)
                </p>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  ทุกบัญชีผู้ใช้ในระบบสามารถตรวจเช็คลิสต์และปฏิบัติหน้าที่ประจำกะได้
                </p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/30 shrink-0 flex items-center gap-1">
              <Check size={12} strokeWidth={3} />
              เปิดใช้งานถาวร
            </span>
          </div>

          {/* Granular Section 2: Store Management Type */}
          <div className="p-4 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-2xl space-y-2">
            <label className="block text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5">
              <Briefcase size={16} className="text-emerald-600 dark:text-emerald-400" />
              <span>ระดับการบริหารร้านสาขา (Manager Type)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["none", "assistant", "store"] as ManagerType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setManagerType(type)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    managerType === type
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                      : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-emerald-400"
                  }`}
                >
                  {type === "none" && "ไม่มีสิทธิ์"}
                  {type === "assistant" && "ผู้ช่วยผู้จัดการ"}
                  {type === "store" && "ผู้จัดการร้าน"}
                </button>
              ))}
            </div>
          </div>

          {/* Granular Section 3: Executive Type */}
          <div className="p-4 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-2xl space-y-2">
            <label className="block text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5">
              <Landmark size={16} className="text-blue-600 dark:text-blue-400" />
              <span>ระดับผู้บริหาร & กรรมการ (Executive Type)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["none", "committee", "executive"] as ExecutiveType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setExecutiveType(type)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    executiveType === type
                      ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                      : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-blue-400"
                  }`}
                >
                  {type === "none" && "ไม่มีสิทธิ์"}
                  {type === "committee" && "กรรมการบริหาร"}
                  {type === "executive" && "ผู้จัดการทั่วไป / GM"}
                </button>
              ))}
            </div>
          </div>

          {/* Granular Section 4: Central Administrator */}
          <div className="p-4 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
                <ShieldCheck size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--color-text)]">
                  ผู้ดูแลระบบส่วนกลาง (Central Administrator)
                </p>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  สิทธิ์เต็มในการจัดการงาน สาขา ผู้ใช้ และระบบอัตโนมัติ
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isAdmin}
                disabled={isSelf}
                onChange={(e) => setIsAdmin(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {/* Resulting Roles Preview */}
          <div className="p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--color-text-muted)]">
              สิทธิ์ที่บัญชีนี้จะได้รับ:
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-300">
                พนักงานสาขา
              </span>
              {managerType === "assistant" && (
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-400">
                  ผู้ช่วยผู้จัดการ
                </span>
              )}
              {managerType === "store" && (
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-600 text-white">
                  ผู้จัดการร้าน
                </span>
              )}
              {executiveType === "committee" && (
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-blue-500/15 text-blue-800 dark:text-blue-300 border border-blue-400">
                  กรรมการ
                </span>
              )}
              {executiveType === "executive" && (
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-blue-600 text-white">
                  ผู้บริหาร GM
                </span>
              )}
              {isAdmin && (
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-purple-600 text-white">
                  Admin
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? "กำลังบันทึก..." : "บันทึกการตั้งค่าสิทธิ์"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
