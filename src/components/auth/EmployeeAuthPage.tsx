import { useState, useEffect } from "react";
import { User, ShiftType } from "../../types";
import { getUsers, saveUsers } from "../../data/storage";
import { BrandLogo } from "../common/BrandLogo";
import { loginAction, registerAction } from "../../actions/auth";
import { DashboardBranch } from "../../actions/branch";
import { fetchBranchesWithCache } from "../../utils/cache";
import { ThemeToggle } from "../common/ThemeToggle";
import { ForgotPasswordModal } from "./ForgotPasswordModal";
import Link from "next/link";

export function EmployeeAuthPage({
    onLogin,
}: {
    onLogin: (user: User, shift?: ShiftType, redirectPath?: string) => void;
}) {
    const [tab, setTab] = useState<"login" | "register">("login");
    const [branches, setBranches] = useState<DashboardBranch[]>([]);
    const [form, setForm] = useState({
        name: "",
        username: "",
        password: "",
        confirmPassword: "",
        branchId: "",
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showForgotModal, setShowForgotModal] = useState(false);

    useEffect(() => {
        if (tab === "register") {
            fetchBranchesWithCache({ intervalMs: 60000 }).then((res) => {
                if (res.success && res.branches) {
                    setBranches(res.branches);
                }
            }).catch(console.error);
        }
    }, [tab]);

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

            const role = res.user.role;
            if (role !== "employee") {
                if (role === "manager_assistant" || role === "manager") {
                    setError("บัญชีนี้มีสิทธิ์ระดับผู้จัดการ กรุณาเข้าสู่ระบบผ่านหน้าผู้จัดการและผู้ช่วยฯ (Manager Portal)");
                } else {
                    setError("บัญชีนี้มีสิทธิ์ระดับบริหาร กรุณาเข้าสู่ระบบผ่านหน้าฝ่ายบริหาร (Executive Portal)");
                }
                setLoading(false);
                return;
            }

            onLogin(res.user);
        } catch (err: unknown) {
            console.error("Login error:", err);
            const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล กรุณาลองใหม่อีกครั้ง";
            setError(msg);
            setLoading(false);
        }
    }

    async function handleRegister() {
        if (!form.name.trim() || !form.username.trim() || !form.password.trim() || !form.confirmPassword.trim()) {
            setError("กรุณากรอกชื่อ-นามสกุล, ชื่อผู้ใช้ และรหัสผ่านให้ครบถ้วน");
            return;
        }
        if (form.password !== form.confirmPassword) {
            setError("รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน");
            return;
        }
        setLoading(true);
        setError("");
        try {
            const res = await registerAction({
                name: form.name,
                username: form.username,
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

            onLogin(res.user);
        } catch (err: unknown) {
            console.error("Register error:", err);
            const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการสมัครสมาชิก กรุณาลองใหม่อีกครั้ง";
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
                        <span>ระบบพนักงานสาขา (Floor Staff)</span>
                    </div>
                    <BrandLogo size={48} showText={true} isDark={false} />
                </header>

                <div
                    role="tablist"
                    className="flex bg-[var(--color-surface-2)] p-1 rounded-xl mb-4 border border-[var(--color-border)] gap-1"
                >
                    {(["login", "register"] as const).map((t) => (
                        <button
                            key={t}
                            type="button"
                            role="tab"
                            disabled={loading}
                            aria-selected={tab === t}
                            onClick={() => {
                                setTab(t);
                                setError("");
                            }}
                            className={`flex-1 py-2.5 sm:py-2 min-h-[44px] sm:min-h-[36px] text-xs font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-center inline-flex items-center justify-center ${tab === t
                                ? "bg-[var(--color-brown)] text-amber-100 shadow-sm font-bold"
                                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                                }`}
                        >
                            {t === "login" ? "เข้าสู่ระบบพนักงาน" : "ลงทะเบียนใหม่"}
                        </button>
                    ))}
                </div>

                <div role="tabpanel" className="space-y-3.5 focus-visible:outline-none">
                    {tab === "register" && (
                        <>
                            <div>
                                <label htmlFor="reg-name" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                                    ชื่อ-นามสกุล
                                </label>
                                <input
                                    id="reg-name"
                                    className={inp}
                                    placeholder="สมศรี ใจดี"
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label htmlFor="reg-branch" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                                    สังกัดสาขา
                                </label>
                                <select
                                    id="reg-branch"
                                    className={inp}
                                    value={form.branchId}
                                    onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                                >
                                    <option value="">-- เลือกสาขาประจำการ (หรือข้ามเพื่อกำหนดภายหลัง) --</option>
                                    {branches.map((b) => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                        </>
                    )}

                    <div>
                        <label htmlFor="emp-username" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                            ชื่อผู้ใช้ (Username)
                        </label>
                        <input
                            id="emp-username"
                            className={inp}
                            placeholder="เช่น somchai หรือ cashier"
                            type="text"
                            autoComplete="username"
                            aria-invalid={Boolean(error)}
                            aria-describedby={error ? "emp-auth-error" : undefined}
                            value={form.username}
                            onChange={(e) => setForm({ ...form, username: e.target.value })}
                        />
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label htmlFor="emp-password" className="block text-xs font-semibold text-[var(--color-text-muted)]">
                                รหัสผ่าน
                            </label>
                            {tab === "login" && (
                                <button
                                    type="button"
                                    disabled={loading}
                                    onClick={() => setShowForgotModal(true)}
                                    className="text-xs text-amber-700 dark:text-amber-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-medium"
                                >
                                    ลืมรหัสผ่าน?
                                </button>
                            )}
                        </div>
                        <input
                            id="emp-password"
                            className={inp}
                            placeholder="••••••••"
                            type="password"
                            autoComplete="current-password"
                            aria-invalid={Boolean(error)}
                            aria-describedby={error ? "emp-auth-error" : undefined}
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            onKeyDown={(e) => e.key === "Enter" && (tab === "register" ? handleRegister() : handleLogin())}
                        />
                    </div>

                    {tab === "register" && (
                        <div>
                            <label htmlFor="reg-confirm-password" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                                ยืนยันรหัสผ่าน
                            </label>
                            <input
                                id="reg-confirm-password"
                                className={inp}
                                placeholder="••••••••"
                                type="password"
                                autoComplete="new-password"
                                aria-invalid={Boolean(error)}
                                aria-describedby={error ? "emp-auth-error" : undefined}
                                value={form.confirmPassword}
                                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                                onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                            />
                        </div>
                    )}

                    {error && (
                        <div id="emp-auth-error" role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 text-center font-semibold flex items-center justify-center gap-1.5">
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
                        onClick={tab === "register" ? handleRegister : handleLogin}
                        className={`w-full min-h-[44px] py-2.5 text-amber-100 text-sm font-bold rounded-xl shadow-md transition-all mt-2 cursor-pointer flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 bg-[var(--color-brown)] hover:bg-[var(--color-brown-light)] active:bg-[#1f0d0c] shadow-amber-950/20 ${loading ? "opacity-70 cursor-not-allowed" : ""
                            }`}
                    >
                        <span>{loading ? "กำลังตรวจสอบข้อมูล..." : tab === "login" ? "เข้าสู่ระบบพนักงาน →" : "บันทึกและสร้างบัญชีพนักงาน"}</span>
                    </button>
                </div>

                <div className="mt-4 pt-4 border-t border-[var(--color-border)] text-center flex flex-col gap-1.5">
                    <Link href="/login/manager" className="inline-flex items-center justify-center min-h-[36px] text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] font-semibold transition-colors">
                        สำหรับผู้จัดการและผู้ช่วยผู้จัดการร้าน →
                    </Link>
                    <Link href="/login/executive" className="inline-flex items-center justify-center min-h-[36px] text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] font-semibold transition-colors">
                        สำหรับฝ่ายบริหารและกรรมการ (Executive) →
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
