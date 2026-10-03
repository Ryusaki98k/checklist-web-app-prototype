"use client";

import { useState } from "react";
import { useApp } from "../../context/AppContext";
import { getUserByIdAction } from "../../actions/auth";
import { Store, RotateCw, LogOut, AlertCircle, Sparkles } from "lucide-react";
import { BrandLogo } from "../../components/common/BrandLogo";
import { ThemeToggle } from "../../components/common/ThemeToggle";

export default function AwaitingAssignmentPage() {
    const { logout, currentUser, login } = useApp();
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    async function handleRefresh() {
        if (!currentUser) return;
        setLoading(true);
        setErrorMsg("");
        try {
            const res = await getUserByIdAction(currentUser.id);
            if (res.success && res.user) {
                if (res.user.branchName) {
                    login(res.user);
                } else {
                    setErrorMsg("บัญชีของคุณยังไม่ได้รับการอนุมัติสาขา");
                }
            } else {
                setErrorMsg(res.error || "ดึงข้อมูลผู้ใช้สำเร็จ แต่ยังไม่ได้รับกำหนดสาขา");
            }
        } catch (err) {
            console.error("Refresh error:", err);
            setErrorMsg("ตรวจสอบข้อมูลการมอบหมายไม่สำเร็จ กรุณากดโหลดใหม่อีกครั้ง");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] flex flex-col items-center justify-center p-4 font-sans relative">
            <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
                <ThemeToggle />
            </div>
            <div className="w-full max-w-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-7 sm:p-9 shadow-xl shadow-amber-900/5 text-center space-y-5">
                <header className="flex flex-col items-center">
                    <BrandLogo size={44} showText={false} isDark={false} />
                    <div className="w-14 h-14 rounded-2xl bg-[var(--color-amber-glow)] border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-300 flex items-center justify-center my-4 shadow-2xs">
                        <Store size={26} strokeWidth={2.2} />
                    </div>
                    <h1 className="text-xl font-bold text-[var(--color-text)] tracking-tight">
                        รอการกำหนดสาขา
                    </h1>
                </header>

                <p className="text-xs sm:text-sm text-[var(--color-text-muted)] leading-relaxed">
                    สวัสดีคุณ <strong className="text-[var(--color-text)]">{currentUser?.name || "พนักงาน"}</strong> บัญชีของคุณยังไม่ได้ถูกกำหนดสาขาประจำการ กรุณาแจ้งผู้จัดการร้านหรือผู้ดูแลระบบ (Admin) เพื่อทำการกำหนดสาขา
                </p>

                {errorMsg && (
                    <div role="alert" className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs rounded-xl font-semibold flex items-center justify-center gap-1.5">
                        <AlertCircle size={14} className="shrink-0 text-rose-700 dark:text-rose-400" />
                        <span>{errorMsg}</span>
                    </div>
                )}

                <div className="flex flex-col gap-2.5 pt-2">
                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={loading}
                        className="w-full py-3 px-4 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-amber-950 shadow-xs disabled:opacity-60 transition-colors cursor-pointer flex items-center justify-center gap-2 min-h-[44px] focus-visible:outline-2 focus-visible:outline-amber-500"
                    >
                        <RotateCw size={16} className={loading ? "animate-spin" : ""} />
                        <span>{loading ? "กำลังตรวจสอบข้อมูล..." : "ตรวจสอบสถานะใหม่"}</span>
                    </button>
                    
                    <button
                        type="button"
                        onClick={() => logout()}
                        disabled={loading}
                        className="w-full py-2.5 px-4 rounded-xl font-semibold bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-text)] border border-[var(--color-border)] disabled:opacity-60 transition-colors cursor-pointer flex items-center justify-center gap-1.5 min-h-[44px] focus-visible:outline-2 focus-visible:outline-amber-500"
                    >
                        <LogOut size={15} />
                        <span>กลับสู่หน้าเข้าสู่ระบบ</span>
                    </button>
                </div>
            </div>
        </main>
    );
}
