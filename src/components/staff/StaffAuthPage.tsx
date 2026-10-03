import { useState } from "react";
import { User } from "../../types";
import { STAFF_POSITIONS } from "../../types";
import { getUsers, saveUsers } from "../../data/storage";
import { BrandLogo } from "../common/BrandLogo";
import { ThemeToggle } from "../common/ThemeToggle";
import { loginAction, registerAction } from "../../actions/auth";
import Link from "next/link";

type AuthTab = "staff" | "manager" | "register";

export function StaffAuthPage({
  onLogin,
}: {
  onLogin: (user: User, shift?: any, redirectPath?: string) => void;
}) {
  const [tab, setTab] = useState<AuthTab>("staff");
  const [form, setForm] = useState({
    name: "",
    username: "",
    password: "",
    role: "employee" as 'employee' | 'manager' | 'committee' | 'manager_assistant',
    position: STAFF_POSITIONS[0],
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!form.username.trim() || !form.password.trim()) {
      setError("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await loginAction(form.username, form.password);
      if (!res.success || !res.user) {
        setError(res.error || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
        setLoading(false);
        return;
      }
      const localUsers = getUsers();
      if (!localUsers.some((u) => u.id === res.user!.id)) {
        saveUsers([...localUsers, res.user]);
      }
      // If logging in from manager tab, redirect directly to /manager/dashboard
      if (tab === "manager") {
        const isExec = res.user.role !== "employee";
        if (!isExec) {
          setError("บัญชีนี้เป็นบัญชีพนักงานทั่วไป กรุณาเข้าสู่ระบบผ่านแท็บ 'เข้าสู่ระบบพนักงาน'");
          setLoading(false);
          return;
        }
        onLogin(res.user, undefined, "/manager/dashboard");
      } else {
        onLogin(res.user);
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err?.message || "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล กรุณาลองใหม่อีกครั้ง");
      setLoading(false);
    }
  }

  async function handleRegister() {
    if (!form.name.trim() || !form.username.trim() || !form.password.trim()) {
      setError("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await registerAction({
        name: form.name,
        username: form.username,
        password: form.password,
        role: form.role,
        position: form.position,
      });
      if (!res.success || !res.user) {
        setError(res.error || "ไม่สามารถสมัครสมาชิกได้");
        setLoading(false);
        return;
      }
      const localUsers = getUsers();
      saveUsers([...localUsers, res.user]);
      if (res.user.role !== "employee") {
        onLogin(res.user, undefined, "/manager/dashboard");
      } else {
        onLogin(res.user);
      }
    } catch (err: any) {
      console.error("Register error:", err);
      setError(err?.message || "เกิดข้อผิดพลาดในการสมัครสมาชิก กรุณาลองใหม่อีกครั้ง");
      setLoading(false);
    }
  }

  const inp =
    "w-full bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-2)] focus:bg-[var(--color-surface)] border border-[var(--color-border)] focus:border-amber-400 rounded-xl px-4 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus-visible:outline-hidden focus:ring-2 focus:ring-amber-400/40 transition-all";

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] flex flex-col items-center justify-center px-4 py-8 sm:py-12 relative font-sans">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-[420px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-7 sm:p-8 shadow-xl shadow-amber-900/5 space-y-5 relative z-10">
        {/* Brand Header */}
        <header className="mb-4 text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-amber-glow)] text-[var(--color-text)] text-xs font-bold border border-amber-300 dark:border-amber-800 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true" />
            <span>เข้าสู่ระบบปฏิบัติงานพนักงานสาขา</span>
          </div>
          <BrandLogo size={48} showText={true} isDark={false} subtitle="ระบบบันทึกและตรวจสอบเช็คลิสต์พนักงาน" />
        </header>

        {/* Login / Register Tabs */}
        <div
          role="tablist"
          aria-label="ตัวเลือกการเข้าสู่ระบบ"
          className="flex bg-[var(--color-surface-2)] p-1 rounded-xl mb-4 border border-[var(--color-border)] gap-1"
        >
          {[
            { id: "staff" as AuthTab, label: "พนักงานสาขา" },
            { id: "manager" as AuthTab, label: "ฝ่ายบริหาร" },
            { id: "register" as AuthTab, label: "สมัครสมาชิก" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              aria-selected={tab === t.id}
              onClick={() => {
                setTab(t.id);
                setError("");
              }}
              className={`flex-1 py-2 min-h-[36px] text-xs font-semibold rounded-lg transition-all cursor-pointer text-center ${
                tab === t.id
                  ? "bg-[var(--color-brown)] text-amber-100 shadow-2xs font-bold"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Manager Mode Banner Notification */}
        {tab === "manager" && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-xs text-[var(--color-text)] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span>เข้าสู่ระบบเพื่อไปยัง <strong>Manager Dashboard</strong> (ผู้ช่วยฯ, ผู้จัดการ, กรรมการ)</span>
          </div>
        )}

        {/* Form Panel */}
        <div role="tabpanel" id={`tab-${tab}-panel`} tabIndex={0} className="space-y-4 focus-visible:outline-hidden">
          {tab === "register" && (
            <div>
              <label htmlFor="staff-name" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
                ชื่อ-นามสกุล
              </label>
              <input
                id="staff-name"
                className={inp}
                placeholder="ระบุชื่อ-นามสกุล"
                autoComplete="name"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "staff-auth-error" : undefined}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
          )}

          <div>
            <label htmlFor="staff-username" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
              ชื่อผู้ใช้ (Username)
            </label>
            <input
              id="staff-username"
              className={inp}
              placeholder="เช่น cashier หรือ manager"
              type="text"
              autoComplete="username"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "staff-auth-error" : undefined}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="staff-password" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
              รหัสผ่าน
            </label>
            <input
              id="staff-password"
              className={inp}
              placeholder="••••••••"
              type="password"
              autoComplete={tab === "register" ? "new-password" : "current-password"}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "staff-auth-error" : undefined}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && (tab === "register" ? handleRegister() : handleLogin())}
            />
          </div>

          {tab === "register" && (
            <div>
              <label htmlFor="staff-role-select" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
                บทบาท / ตำแหน่ง
              </label>
              <select
                id="staff-role-select"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as any })}
                className={inp}
              >
                <option value="employee">พนักงานทั่วไป (แคชเชียร์ / สต็อก)</option>
                <option value="manager_assistant">ผู้ช่วยผู้จัดการร้าน (Assistant Manager)</option>
                <option value="manager">ผู้จัดการร้าน (Store Manager)</option>
                <option value="committee">กรรมการบริหาร (Executive Committee)</option>
              </select>
            </div>
          )}

          {error && (
            <div id="staff-auth-error" role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 text-center font-semibold my-2 flex items-center justify-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="button"
            disabled={loading}
            onClick={tab === "register" ? handleRegister : handleLogin}
            className={`w-full py-3 min-h-[44px] text-amber-950 text-sm font-bold rounded-xl shadow-sm transition-all mt-3 cursor-pointer flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-500 active:bg-amber-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${loading ? "opacity-70 cursor-not-allowed" : ""}`}
          >
            <span>
              {loading
                ? "กำลังตรวจสอบข้อมูล..."
                : tab === "manager"
                  ? "เข้าสู่ระบบฝ่ายบริหาร (Manager) →"
                  : tab === "register"
                    ? "ยืนยันการสมัครสมาชิก"
                    : "เข้าสู่ระบบพนักงาน →"}
            </span>
            {!loading && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </div>

        {/* Link to Admin Portal */}
        <div className="mt-5 pt-4 border-t border-[var(--color-border)] text-center">
          <Link
            href="/admin"
            className="text-xs text-[var(--color-text-muted)] hover:text-amber-950 dark:hover:text-amber-200 font-medium transition-colors inline-flex items-center gap-1 cursor-pointer min-h-[44px] sm:min-h-[32px] px-2 rounded-lg"
          >
            <span>สำหรับผู้ดูแลระบบส่วนกลาง (Admin Portal) →</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
