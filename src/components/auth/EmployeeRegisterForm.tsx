"use client";

import { useState, useEffect } from "react";
import { User } from "../../types";
import { getUsers, saveUsers } from "../../data/storage";
import { registerAction } from "../../actions/auth";
import { DashboardBranch } from "../../actions/branch";
import { fetchBranchesWithCache } from "../../utils/cache";
import { useApp } from "../../context/AppContext";
import { useRouter } from "next/navigation";
import { UserPlus, Building2, AtSign, Lock, CheckCircle2, AlertCircle } from "lucide-react";

interface EmployeeRegisterFormProps {
  onSuccess?: (user: User) => void;
  className?: string;
  isMainPage?: boolean;
}

export function EmployeeRegisterForm({
  onSuccess,
  className = "",
  isMainPage = false,
}: EmployeeRegisterFormProps) {
  const router = useRouter();
  const { login } = useApp();
  const [branches, setBranches] = useState<DashboardBranch[]>([]);
  const [form, setForm] = useState({
    name: "",
    username: "",
    password: "",
    confirmPassword: "",
    branchId: "",
  });
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchBranchesWithCache({ intervalMs: 60000 })
      .then((res) => {
        if (res.success && res.branches) {
          setBranches(res.branches);
        }
      })
      .catch(console.error);
  }, []);

  async function handleRegister(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!form.name.trim() || !form.username.trim() || !form.password.trim() || !form.confirmPassword.trim()) {
      setError("กรุณากรอกชื่อ-นามสกุล, ชื่อผู้ใช้ และรหัสผ่านให้ครบถ้วน");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }
    if (form.password.length < 3) {
      setError("รหัสผ่านต้องมีความยาวอย่างน้อย 3 ตัวอักษร");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const res = await registerAction({
        name: form.name.trim(),
        username: form.username.trim().toLowerCase(),
        password: form.password,
        role: "employee",
        branchId: form.branchId || undefined,
      });

      if (!res.success || !res.user) {
        setError(res.error || "ไม่สามารถลงทะเบียนได้ กรุณาลองใหม่อีกครั้ง");
        setLoading(false);
        return;
      }

      const localUsers = getUsers();
      saveUsers([...localUsers, res.user]);
      setSuccessMsg(`ลงทะเบียนพนักงาน "${res.user.name}" สำเร็จ! กำลังเข้าสู่ระบบ...`);

      setTimeout(() => {
        if (onSuccess) {
          onSuccess(res.user!);
        } else {
          login(res.user!);
          if (!res.user!.branchId) {
            router.push("/awaiting-assignment");
          } else {
            router.push("/position");
          }
        }
      }, 1200);
    } catch (err: unknown) {
      console.error("Register error:", err);
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการสมัครสมาชิก กรุณาลองใหม่อีกครั้ง";
      setError(msg);
      setLoading(false);
    }
  }

  const inputClass =
    "w-full bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-2)] focus:bg-[var(--color-surface)] border border-[var(--color-border)] focus:border-amber-400 rounded-xl px-4 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus-visible:outline-none focus:ring-2 focus:ring-amber-400/40 transition-all";

  return (
    <form onSubmit={handleRegister} className={`space-y-4 ${className}`}>
      {isMainPage && (
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[var(--color-border)]">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
            <UserPlus size={18} />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-[var(--color-text)]">
              ลงทะเบียนพนักงานใหม่ (New Employee Registration)
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              สำหรับพนักงานประจำสาขา (แคชเชียร์, สต็อก, พนักงานทั่วไป)
            </p>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="reg-name" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
          ชื่อ-นามสกุลพนักงาน <span className="text-rose-500">*</span>
        </label>
        <input
          id="reg-name"
          className={inputClass}
          placeholder="เช่น สมศรี ใจดี"
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
      </div>

      <div>
        <label htmlFor="reg-branch" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
          สาขาประจำการ
        </label>
        <div className="relative">
          <select
            id="reg-branch"
            className={`${inputClass} appearance-none cursor-pointer pr-10`}
            value={form.branchId}
            onChange={(e) => setForm({ ...form, branchId: e.target.value })}
          >
            <option value="">-- เลือกสาขาประจำการ (หรือข้ามเพื่อกำหนดภายหลัง) --</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <Building2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
        </div>
      </div>

      <div>
        <label htmlFor="reg-username" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
          ชื่อผู้ใช้สำหรับเข้าสู่ระบบ (Username) <span className="text-rose-500">*</span>
        </label>
        <div className="relative">
          <input
            id="reg-username"
            className={inputClass}
            placeholder="เช่น somchai123 หรือ cashier01"
            type="text"
            autoComplete="username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
          <AtSign size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="reg-password" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
            รหัสผ่าน <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              id="reg-password"
              className={inputClass}
              placeholder="••••••••"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            <Lock size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
          </div>
        </div>

        <div>
          <label htmlFor="reg-confirm-password" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
            ยืนยันรหัสผ่าน <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              id="reg-confirm-password"
              className={inputClass}
              placeholder="••••••••"
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              required
            />
            <Lock size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 font-semibold flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div role="status" className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 font-semibold flex items-center gap-2">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className={`w-full min-h-[44px] py-2.5 text-amber-100 text-sm font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 bg-[var(--color-brown)] hover:bg-[var(--color-brown-light)] active:bg-[#1f0d0c] shadow-amber-950/20 ${
          loading ? "opacity-70 cursor-not-allowed" : ""
        }`}
      >
        <UserPlus size={16} />
        <span>{loading ? "กำลังบันทึกข้อมูล..." : "ลงทะเบียนและเริ่มงานพนักงานสาขา"}</span>
      </button>
    </form>
  );
}
