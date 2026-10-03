import { useState } from "react";
import { Position, User } from "../../types";
import { getUsers, saveUsers, uid } from "../../data/storage";
import { useModalFocusTrap } from "../common/ModalFocusTrap";

export function AddStaffModal({
  isOpen,
  onClose,
  positions,
  canManagePositions,
  onStaffAdded,
}: {
  isOpen: boolean;
  onClose: () => void;
  positions: Position[];
  canManagePositions: boolean;
  onStaffAdded: (user: User) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    username: "",
    password: "",
    position: "",
  });
  const [error, setError] = useState("");
  const { dialogRef, handleKeyDown } = useModalFocusTrap(isOpen, onClose);

  if (!isOpen) return null;

  function handleAddStaff() {
    if (!form.name.trim() || !form.username.trim() || !form.password.trim()) {
      setError("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    const users = getUsers();
    if (users.find((u) => (u.username || u.name).toLowerCase() === form.username.trim().toLowerCase())) {
      setError("ชื่อผู้ใช้นี้มีผู้ใช้งานแล้วในระบบ");
      return;
    }
    const newUser: User = {
      id: uid(),
      name: form.name.trim(),
      username: form.username.trim().toLowerCase(),
      password: form.password.trim(),
      role: "employee",
      position: form.position || undefined,
    };
    saveUsers([...users, newUser]);
    onStaffAdded(newUser);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 px-4"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-staff-modal-title"
        tabIndex={-1}
        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl p-5 sm:p-7 space-y-4 text-[var(--color-text)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
          <h2 id="add-staff-modal-title" className="text-base font-bold text-[var(--color-text)]">
            เพิ่มพนักงานใหม่เข้าร้าน
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {error && (
          <p role="alert" className="text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 p-2 rounded-lg">
            {error}
          </p>
        )}

        <div className="space-y-3">
          <div>
            <label htmlFor="new-staff-name" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
              ชื่อ-นามสกุล
            </label>
            <input
              id="new-staff-name"
              type="text"
              placeholder="เช่น สมศรี ใจดี"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-3.5 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="new-staff-username" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
              ชื่อผู้ใช้ (Username)
            </label>
            <input
              id="new-staff-username"
              type="text"
              placeholder="เช่น somjai หรือ emp01"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-3.5 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="new-staff-password" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
              รหัสผ่านเริ่มต้น
            </label>
            <input
              id="new-staff-password"
              type="password"
              placeholder="รหัสผ่านเข้าสู่ระบบ"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-3.5 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="new-staff-position" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
              กำหนดตำแหน่งงาน
            </label>
            {canManagePositions ? (
              <select
                id="new-staff-position"
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-3.5 py-2 text-sm text-[var(--color-text)] focus:border-amber-400 focus:outline-none cursor-pointer"
              >
                <option value="">-- ยังไม่กำหนดตำแหน่ง (กำหนดภายหลังได้) --</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-3.5 py-2 text-xs text-[var(--color-text-muted)] flex items-center justify-between">
                <span>รอผู้จัดการกำหนดตำแหน่ง</span>
                <span className="text-xs text-[var(--color-text)] font-semibold bg-[var(--color-amber-glow)] border border-[var(--color-amber)] px-1.5 py-0.5 rounded font-mono">
                  ผู้ช่วยไม่สามารถเลือกตำแหน่งได้
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 pt-3 border-t border-[var(--color-border)]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] hover:bg-[var(--color-border-subtle)] text-xs font-semibold text-[var(--color-text-muted)] transition-colors cursor-pointer flex items-center justify-center"
          >
            ยกเลิกการเพิ่มพนักงาน
          </button>
          <button
            type="button"
            onClick={handleAddStaff}
            className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-[var(--color-brown)] hover:bg-[var(--color-brown-light)] text-amber-100 text-xs font-bold shadow-sm transition-colors cursor-pointer flex items-center justify-center"
          >
            บันทึกพนักงาน
          </button>
        </div>
      </div>
    </div>
  );
}
