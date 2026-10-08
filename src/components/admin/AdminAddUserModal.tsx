import { useState } from "react";
import { User, Role } from "../../types";
import { DashboardBranch as Branch } from "../../actions/branch";
import { registerAction } from "../../actions/auth";
import { useModalFocusTrap } from "../common/ModalFocusTrap";
import { UserPlus, Eye, EyeOff, ShieldCheck, Building2, AlertCircle } from "lucide-react";

interface AdminAddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  branches: Branch[];
  onUserCreated: (user: User) => void;
}

export function AdminAddUserModal({
  isOpen,
  onClose,
  branches,
  onUserCreated,
}: AdminAddUserModalProps) {
  const [form, setForm] = useState<{
    name: string;
    username: string;
    password: string;
    role: Role;
    branchId: string;
  }>({
    name: "",
    username: "",
    password: "",
    role: "employee",
    branchId: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const { dialogRef, handleKeyDown } = useModalFocusTrap(isOpen, onClose);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const cleanName = form.name.trim();
    const cleanUsername = form.username.trim().toLowerCase();
    const cleanPassword = form.password.trim();

    if (!cleanName) {
      setError("กรุณากรอกชื่อ-นามสกุล");
      return;
    }

    if (!cleanUsername) {
      setError("กรุณากรอกชื่อผู้ใช้ (Username)");
      return;
    }

    if (cleanUsername.length < 3) {
      setError("ชื่อผู้ใช้ต้องมีความยาวอย่างน้อย 3 ตัวอักษร");
      return;
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
      setError("ชื่อผู้ใช้ต้องเป็นตัวอักษรภาษาอังกฤษ ตัวเลข ขีดล่าง หรือจุดเท่านั้น");
      return;
    }

    if (!cleanPassword) {
      setError("กรุณากรอกรหัสผ่านเริ่มต้น");
      return;
    }

    if (cleanPassword.length < 3) {
      setError("รหัสผ่านต้องมีความยาวอย่างน้อย 3 ตัวอักษร");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await registerAction({
        name: cleanName,
        username: cleanUsername,
        password: cleanPassword,
        role: form.role,
        branchId: form.branchId || undefined,
      });

      if (!res.success || !res.user) {
        setError(res.error || "ไม่สามารถสร้างบัญชีผู้ใช้ได้ กรุณาลองใหม่อีกครั้ง");
        setIsSubmitting(false);
        return;
      }

      onUserCreated(res.user);
      onClose();
    } catch (err: unknown) {
      console.error("AdminAddUserModal submit error:", err);
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล กรุณาลองใหม่อีกครั้ง");
      setIsSubmitting(false);
    }
  }

  function generateRandomPassword() {
    const chars = "abcdefghjkmnpqrstuvwxyz23456789";
    let pass = "";
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setForm((prev) => ({ ...prev, password: pass }));
    setShowPassword(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-user-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-in text-[var(--color-text)] max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-surface-2)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 flex items-center justify-center">
              <UserPlus size={18} />
            </div>
            <div>
              <h3 id="add-user-title" className="font-bold text-[var(--color-text)] text-base">
                เพิ่มผู้ใช้งานใหม่เข้าระบบ
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                สร้างบัญชีผู้ใช้งาน สิทธิ์ และสังกัดสาขา
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div
              role="alert"
              className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2"
            >
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Full Name */}
          <div>
            <label
              htmlFor="add-user-name"
              className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1"
            >
              ชื่อ-นามสกุล <span className="text-rose-500">*</span>
            </label>
            <input
              id="add-user-name"
              type="text"
              required
              placeholder="เช่น สมพร บุญมี"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:outline-none focus:border-amber-400 transition-colors"
            />
          </div>

          {/* Username */}
          <div>
            <label
              htmlFor="add-user-username"
              className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1"
            >
              ชื่อผู้ใช้ (Username) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-[var(--color-text-muted)] font-mono">
                @
              </span>
              <input
                id="add-user-username"
                type="text"
                required
                placeholder="somporn (ตัวอักษรพิมพ์เล็ก ตัวเลข หรือขีดล่าง)"
                value={form.username}
                onChange={(e) =>
                  setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s+/g, "") })
                }
                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl pl-8 pr-3.5 py-2.5 text-xs text-[var(--color-text)] font-mono placeholder:text-[var(--color-text-subtle)] focus:outline-none focus:border-amber-400 transition-colors"
              />
            </div>
            <p className="text-[11px] text-[var(--color-text-subtle)] mt-1">
              ใช้สำหรับเข้าสู่ระบบ Eater Egg Fresh Mart
            </p>
          </div>

          {/* Password */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label
                htmlFor="add-user-password"
                className="block text-xs font-semibold text-[var(--color-text-muted)]"
              >
                รหัสผ่านเริ่มต้น <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={generateRandomPassword}
                className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline font-semibold cursor-pointer"
              >
                สุ่มรหัสผ่าน
              </button>
            </div>
            <div className="relative">
              <input
                id="add-user-password"
                type={showPassword ? "text" : "password"}
                required
                placeholder="ระบุรหัสผ่านเข้าสู่ระบบ"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-[var(--color-text)] font-mono placeholder:text-[var(--color-text-subtle)] focus:outline-none focus:border-amber-400 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-2 p-1 text-[var(--color-text-subtle)] hover:text-[var(--color-text)] rounded cursor-pointer"
                title={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Role & Branch (2 Columns) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            {/* Role */}
            <div>
              <label
                htmlFor="add-user-role"
                className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1 flex items-center gap-1.5"
              >
                <ShieldCheck size={14} className="text-amber-600" />
                <span>บทบาทในระบบ (Role)</span>
              </label>
              <select
                id="add-user-role"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-3 py-2.5 text-xs text-[var(--color-text)] focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                <option value="employee">Staff (พนักงานประจำกะ)</option>
                <option value="manager_assistant">Assistant (ผู้ช่วยผู้จัดการร้าน)</option>
                <option value="manager">Store Manager (ผู้จัดการร้าน)</option>
                <option value="general_manager">General Manager (ผู้จัดการทั่วไป)</option>
                <option value="committee">Committee (กรรมการบริหาร)</option>
                <option value="admin">Admin (ผู้ดูแลระบบส่วนกลาง)</option>
              </select>
            </div>

            {/* Branch Assignment */}
            <div>
              <label
                htmlFor="add-user-branch"
                className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1 flex items-center gap-1.5"
              >
                <Building2 size={14} className="text-amber-600" />
                <span>สาขาที่สังกัด</span>
              </label>
              <select
                id="add-user-branch"
                value={form.branchId}
                onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-3 py-2.5 text-xs text-[var(--color-text)] focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                <option value="">-- ยังไม่สังกัดสาขา --</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>



          {/* Modal Footer Buttons */}
          <div className="flex gap-3 pt-3 border-t border-[var(--color-border)]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-[var(--color-surface-2)] hover:bg-[var(--color-border-subtle)] text-[var(--color-text-muted)] border border-[var(--color-border)] rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-[var(--color-brown)] hover:bg-[var(--color-brown-light)] disabled:opacity-50 text-amber-300 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <span>กำลังบันทึกข้อมูล...</span>
              ) : (
                <>
                  <UserPlus size={14} />
                  <span>บันทึกผู้ใช้ใหม่</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
