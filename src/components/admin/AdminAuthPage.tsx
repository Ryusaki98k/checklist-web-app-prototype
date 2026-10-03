import { useState } from "react";
import { User } from "../../types";
import { loginAction } from "../../actions/auth";
import { BrandLogo } from "../common/BrandLogo";
import { ThemeToggle } from "../common/ThemeToggle";
import { ForgotPasswordModal } from "../auth/ForgotPasswordModal";
import Link from "next/link";

export function AdminAuthPage({ onLogin }: { onLogin: (user: User) => void }) {
  const [form, setForm] = useState({
    username: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  async function handleLogin() {
    if (!form.username.trim() || !form.password.trim()) {
      setError("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await loginAction(form.username, form.password);

      if (res.success && res.user) {
        if (res.user.role !== "admin") {
          setError("บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลระบบส่วนกลาง (Admin)");
        } else {
          onLogin(res.user);
        }
      } else {
        setError(res.error || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (เฉพาะผู้ดูแลระบบ)");
      }
    } catch (err) {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle =
    "w-full bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-2)] focus:bg-[var(--color-surface)] border border-[var(--color-border)] focus:border-amber-400 rounded-xl px-4 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus-visible:outline-none focus:ring-2 focus:ring-amber-400/40 transition-all";

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] flex flex-col items-center justify-center px-4 py-8 sm:py-12 relative font-sans">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-[440px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 sm:p-8 shadow-xl shadow-amber-900/5 space-y-5 relative z-10 font-sans">
        {/* Brand Header */}
        <header className="text-center space-y-2 flex flex-col items-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-amber-glow)] text-amber-900 dark:text-amber-300 text-xs font-semibold border border-amber-300 dark:border-amber-800 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true" />
            <span>Admin Portal • ระบบฝ่ายบริหาร</span>
          </div>
          <BrandLogo size={48} showText={true} isDark={false} subtitle="ระบบควบคุมและตรวจสอบเช็คลิสต์การปฏิบัติงานสาขา" />
        </header>

        {/* Form */}
        <div className="space-y-3.5 pt-4 border-t border-[var(--color-border)] focus-visible:outline-none">

          <div>
            <label htmlFor="admin-username" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
              ชื่อผู้ใช้ (Username)
            </label>
            <input
              id="admin-username"
              className={inputStyle}
              placeholder="เช่น administrator หรือ admin"
              type="text"
              autoComplete="username"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "admin-auth-error" : undefined}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="admin-password" className="block text-xs font-semibold text-[var(--color-text-muted)]">
                รหัสผ่าน
              </label>
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="text-xs text-amber-700 dark:text-amber-400 hover:underline cursor-pointer font-medium"
              >
                ลืมรหัสผ่าน?
              </button>
            </div>
            <input
              id="admin-password"
              className={inputStyle}
              placeholder="••••••••"
              type="password"
              autoComplete="current-password"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "admin-auth-error" : undefined}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>

          {error && (
            <div id="admin-auth-error" role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 text-center font-semibold flex items-center justify-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <button
            type="button"
            disabled={loading}
            onClick={handleLogin}
            className={`w-full min-h-[44px] py-2.5 bg-[var(--color-brown)] hover:bg-[var(--color-brown-light)] active:bg-[#1a0a09] text-amber-100 text-sm font-bold rounded-xl shadow-sm transition-all cursor-pointer mt-1 flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${loading ? "opacity-70 cursor-not-allowed" : ""
              }`}
          >
            <span>{loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบผู้ดูแลระบบ (Admin)"}</span>
            {!loading && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </div>

        {/* Portal Links */}
        <div className="pt-2 border-t border-[var(--color-border)] text-center text-xs text-[var(--color-text-muted)]">
          <Link
            href="/"
            className="hover:text-[var(--color-text)] font-medium transition-colors inline-flex items-center justify-center min-h-[36px] gap-1 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-500"
          >
            ← กลับไปหน้าเลือกประเภทผู้ใช้งาน
          </Link>
        </div>
      </div>

      <ForgotPasswordModal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
      />
    </div>
  );
}
