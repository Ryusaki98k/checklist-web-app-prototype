import { useState, useEffect, useRef } from "react";
import { User, ShiftType, ActiveRole } from "../../types";
import { getUsers, saveUsers } from "../../data/storage";
import { BrandLogo } from "../common/BrandLogo";
import { loginAction, registerAction, uploadProfileImageAction } from "../../actions/auth";
import { DashboardBranch } from "../../actions/branch";
import { fetchBranchesWithCache } from "../../utils/cache";
import { ThemeToggle } from "../common/ThemeToggle";
import { ForgotPasswordModal } from "./ForgotPasswordModal";
import { ProfileImageCropperModal } from "../common/ProfileImageCropperModal";
import { Camera, Trash2 } from "lucide-react";
import Link from "next/link";

export function EmployeeAuthPage({
    onLogin,
}: {
    onLogin: (user: User, shift?: ShiftType, redirectPath?: string, roleToActivate?: ActiveRole) => void;
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

    // Profile image upload state
    const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
    const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
    const [isCropperOpen, setIsCropperOpen] = useState(false);
    const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            setError("กรุณาเลือกไฟล์รูปภาพ (PNG, JPG, หรือ WebP)");
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            setError("ขนาดรูปภาพต้องไม่เกิน 10MB");
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setRawImageSrc(reader.result as string);
            setIsCropperOpen(true);
            setError("");
        };
        reader.readAsDataURL(file);
        e.target.value = "";
    };

    const handleCropComplete = (blob: Blob, previewUrl: string) => {
        setAvatarBlob(blob);
        setAvatarPreviewUrl(previewUrl);
    };

    const handleRemoveAvatar = () => {
        setAvatarBlob(null);
        setAvatarPreviewUrl(null);
    };

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

            // All users can perform employee tasks
            const employeeUser: User = {
                ...res.user,
                activeRole: "employee",
                role: "employee",
                position: undefined,
            };

            onLogin(employeeUser, undefined, undefined, "employee");
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
            let uploadedProfileId: string | null = null;
            if (avatarBlob) {
                const formData = new FormData();
                formData.append("file", avatarBlob, "profile_avatar.webp");
                const uploadRes = await uploadProfileImageAction(formData);
                if (!uploadRes.success || !uploadRes.profile_id) {
                    throw new Error(uploadRes.error || "อัปโหลดรูปโปรไฟล์ไม่สำเร็จ");
                }
                uploadedProfileId = uploadRes.profile_id;
            }

            const res = await registerAction({
                name: form.name,
                username: form.username,
                password: form.password,
                role: "employee",
                branchId: form.branchId || undefined,
                profile_id: uploadedProfileId,
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
                            {/* Profile Picture Upload at top of Register Tab */}
                            <div className="p-3.5 sm:p-4 bg-[var(--color-surface-2)]/80 border border-[var(--color-border)] rounded-2xl flex flex-col items-center justify-center space-y-2.5 shadow-2xs">
                                <div className="relative group">
                                    {avatarPreviewUrl ? (
                                        <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full overflow-hidden shadow-md ring-3 ring-amber-500/30 border-2 border-amber-500">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={avatarPreviewUrl}
                                                alt="รูปโปรไฟล์ที่เลือก"
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-[var(--color-surface)] border-2 border-dashed border-[var(--color-border)] flex flex-col items-center justify-center text-[var(--color-text-muted)] group-hover:border-amber-400 group-hover:text-amber-600 transition-colors shadow-2xs">
                                            <Camera size={22} strokeWidth={1.8} />
                                            <span className="text-[9px] font-bold mt-0.5">1:1 รูปถ่าย</span>
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-amber-500 hover:bg-amber-600 text-amber-950 shadow-md border-2 border-[var(--color-surface)] transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                                        title="อัปโหลดและตัดรูปโปรไฟล์"
                                        aria-label="อัปโหลดและตัดรูปโปรไฟล์"
                                    >
                                        <Camera size={13} strokeWidth={2.4} />
                                    </button>
                                </div>

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp,image/gif"
                                    onChange={handleFileSelected}
                                    className="hidden"
                                />

                                <div className="flex items-center gap-1.5 flex-wrap justify-center">
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="px-3 py-1 rounded-xl bg-[var(--color-surface)] hover:bg-[var(--color-border-subtle)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-text)] transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                    >
                                        <Camera size={12} className="text-amber-600 dark:text-amber-400" />
                                        <span>{avatarPreviewUrl ? "เปลี่ยนรูป" : "อัปโหลดรูป (1:1)"}</span>
                                    </button>

                                    {avatarPreviewUrl && (
                                        <button
                                            type="button"
                                            onClick={handleRemoveAvatar}
                                            className="px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-xs font-bold text-rose-700 dark:text-rose-300 transition-colors cursor-pointer flex items-center gap-1"
                                        >
                                            <Trash2 size={12} />
                                            <span>ลบ</span>
                                        </button>
                                    )}
                                </div>
                            </div>

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

            <ProfileImageCropperModal
                isOpen={isCropperOpen}
                imageSrc={rawImageSrc}
                onClose={() => {
                    setIsCropperOpen(false);
                    setRawImageSrc(null);
                }}
                onCropComplete={handleCropComplete}
            />
        </div>
    );
}
