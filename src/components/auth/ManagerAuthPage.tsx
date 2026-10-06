"use client";

import { useState } from "react";
import { User, ShiftType } from "../../types";
import { getUsers, saveUsers } from "../../data/storage";
import { BrandLogo } from "../common/BrandLogo";
import { ThemeToggle } from "../common/ThemeToggle";
import { loginAction } from "../../actions/auth";
import { ForgotPasswordModal } from "./ForgotPasswordModal";
import Link from "next/link";

export function ManagerAuthPage({
    onLogin,
}: {
    onLogin: (user: User, shift?: ShiftType, redirectPath?: string) => void;
}) {
    const [form, setForm] = useState({
        username: "",
        password: "",
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showForgotModal, setShowForgotModal] = useState(false);

    async function handleLogin(e?: React.FormEvent) {
        if (e) e.preventDefault();
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

            const role = res.user.role;
            if (role !== "manager" && role !== "manager_assistant") {
                if (role === "employee") {
                    setError("บัญชีนี้มีสิทธิ์ระดับพนักงาน กรุณาเข้าสู่ระบบผ่านหน้าพนักงานสาขา (Floor Staff)");
                } else {
                    setError("บัญชีนี้มีสิทธิ์ระดับบริหาร กรุณาเข้าสู่ระบบผ่านหน้าฝ่ายบริหาร (Executive Portal)");
                }
                setLoading(false);
                return;
            }

            onLogin(res.user, undefined, "/manager/dashboard");
        } catch (err: unknown) {
            console.error("Login error:", err);
            const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล กรุณาลองใหม่อีกครั้ง";
            setError(msg);
            setLoading(false);
        }
    }

    const inp =
        "w-full bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-2)] focus:bg-[var(--color-surface)] border border-[var(--color-border)] focus:border-amber-400 rounded-xl px-4 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus-visible:outline-none focus:ring-2 focus:ring-amber-400/40 transition-all";

    return (
        <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] flex flex-col items-center justify-center px-4 py-8 sm:py-12 relative font-sans">
            <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
                <ThemeToggle />
            </div>
            <div className="w-full max-w-[420px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 sm:p-8 shadow-xl shadow-amber-900/5 space-y-5 relative z-10 font-sans">
                <header className="mb-2 text-center flex flex-col items-center">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-[var(--color-text)] text-xs font-extrabold border border-amber-500/30 mb-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true" />
                        <span>ระบบผู้จัดการและผู้ช่วยผู้จัดการร้าน (Store Management)</span>
                    </div>
                    <BrandLogo size={48} showText={true} isDark={false} />
                    <p className="text-xs text-[var(--color-text-muted)] mt-2">
                        สำหรับผู้จัดการร้าน และผู้ช่วยผู้จัดการร้าน เข้าตรวจรับรองและดูแลสาขา
                    </p>
                </header>

                <form onSubmit={handleLogin} className="space-y-4 pt-1 focus-visible:outline-none">
                    <div>
                        <label htmlFor="mgr-username" className="block text-xs font-semibold text-[var(--color-text)] mb-1.5">
                            ชื่อผู้ใช้ (Username)
                        </label>
                        <input
                            id="mgr-username"
                            className={inp}
                            placeholder="เช่น manager หรือ assistant"
                            type="text"
                            autoComplete="username"
                            value={form.username}
                            onChange={(e) => setForm({ ...form, username: e.target.value })}
                        />
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label htmlFor="mgr-password" className="block text-xs font-semibold text-[var(--color-text)]">
                                รหัสผ่าน
                            </label>
                            <button
                                type="button"
                                disabled={loading}
                                onClick={() => setShowForgotModal(true)}
                                className="text-xs text-amber-700 dark:text-amber-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-medium"
                            >
                                ลืมรหัสผ่าน?
                            </button>
                        </div>
                        <input
                            id="mgr-password"
                            className={inp}
                            placeholder="••••••••"
                            type="password"
                            autoComplete="current-password"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                        />
                    </div>

                    {error && (
                        <div role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 text-center font-semibold">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full min-h-[44px] py-2.5 text-amber-100 text-sm font-bold rounded-xl shadow-md transition-all mt-3 cursor-pointer flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 bg-[var(--color-brown)] hover:bg-[var(--color-brown-light)] active:bg-[#1f0d0c] shadow-amber-950/20 ${
                            loading ? "opacity-70 cursor-not-allowed" : ""
                        }`}
                    >
                        <span>{loading ? "กำลังตรวจสอบข้อมูล..." : "เข้าสู่ระบบผู้จัดการสาขา →"}</span>
                    </button>
                </form>

                <div className="mt-5 pt-4 border-t border-[var(--color-border)] text-center flex flex-col gap-1.5">
                    <Link href="/login/employee" className="inline-flex items-center justify-center min-h-[36px] text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] font-semibold transition-colors">
                        สำหรับพนักงานหน้าร้านสาขา (Floor Staff) →
                    </Link>
                    <Link href="/login/executive" className="inline-flex items-center justify-center min-h-[36px] text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] font-semibold transition-colors">
                        สำหรับฝ่ายบริหารและกรรมการ (Executive & GM) →
                    </Link>
                    <Link href="/" className="inline-flex items-center justify-center min-h-[36px] text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] font-semibold transition-colors">
                        ← กลับสู่หน้าหลักเลือกช่องทางเข้างาน
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
