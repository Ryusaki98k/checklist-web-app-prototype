"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { ShiftType, User, LeaveQuotaInfo } from "../../types";
import { MANAGEMENT_POSITIONS, STAFF_POSITIONS } from "../../types";
import { ThemeToggle } from "../common/ThemeToggle";
import { BrandLogo } from "../common/BrandLogo";
import { PointStreakBadge } from "../common/PointStreakBadge";
import { NotificationCenter } from "../common/NotificationCenter";
import { 
  CreditCard, 
  Package, 
  ArrowLeft, 
  LogOut, 
  Store, 
  CalendarOff, 
  CheckCircle2, 
  AlertCircle, 
  X
} from "lucide-react";
import { getEmployeeLeaveQuotaAction, requestEmployeeLeaveAction } from "../../actions/manager";

export function PositionSelectPage({
  user,
  shift,
  onSelectPosition,
  onBack,
  onLogout,
}: {
  user: User;
  shift?: ShiftType;
  onSelectPosition: (position: string) => void;
  onBack?: () => void;
  onLogout: () => void;
}) {
  const isMorning = shift === "morning";
  const isAfternoon = shift === "afternoon";
  const shiftTitle = shift ? (isMorning ? "กะเช้า" : isAfternoon ? "กะบ่าย" : "กะควบ (2 กะ)") : null;
  const shiftHours = shift ? (isMorning ? "06:00 – 16:30" : isAfternoon ? "10:00 – 20:30" : "06:00 – 20:30") : null;

  const availablePositions = user.role === "manager" ? MANAGEMENT_POSITIONS : STAFF_POSITIONS;

  // Leave Modal State
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [quota, setQuota] = useState<LeaveQuotaInfo | null>(null);
  const [leaveReason, setLeaveReason] = useState("");
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [leaveSuccess, setLeaveSuccess] = useState<string | null>(null);
  const [autoApproved, setAutoApproved] = useState(false);

  // Today in YYYY-MM-DD (Asia/Bangkok)
  const todayStr = useMemo(() => {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  }, []);

  const todayFormatted = useMemo(() => {
    return new Intl.DateTimeFormat("th-TH", {
      timeZone: "Asia/Bangkok",
      dateStyle: "full",
    }).format(new Date());
  }, []);

  // Fetch employee quota
  const loadQuota = useCallback(async () => {
    if (!user.id) return;
    try {
      const res = await getEmployeeLeaveQuotaAction({ userId: user.id, branchId: user.branchId });
      if (res.success && res.quota) {
        setQuota(res.quota);
      }
    } catch (e) {
      console.error("Error loading leave quota:", e);
    }
  }, [user.id, user.branchId]);

  useEffect(() => {
    let ignore = false;
    getEmployeeLeaveQuotaAction({ userId: user.id, branchId: user.branchId }).then((res) => {
      if (!ignore && res.success && res.quota) {
        setQuota(res.quota);
      }
    }).catch(console.error);
    return () => {
      ignore = true;
    };
  }, [user.id, user.branchId]);

  const handleOpenLeaveModal = () => {
    setLeaveError(null);
    setLeaveSuccess(null);
    setLeaveReason("");
    setIsLeaveModalOpen(true);
    loadQuota();
  };

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveReason.trim()) {
      setLeaveError("กรุณาระบุเหตุผลการขอลางาน");
      return;
    }

    if (!user.branchId) {
      setLeaveError("ไม่พบรหัสสาขาของคุณ กรุณาติดต่อผู้ดูแลระบบ");
      return;
    }

    if (quota && quota.remainingDays <= 0) {
      setLeaveError("โควตาการลาของคุณหมดแล้ว ไม่สามารถส่งคำขอเพิ่มได้");
      return;
    }

    setIsSubmittingLeave(true);
    setLeaveError(null);

    try {
      const isManager = user.role === "manager" || user.role === "general_manager" || user.role === "committee";
      const res = await requestEmployeeLeaveAction({
        userId: user.id,
        branchId: user.branchId,
        leaveType: "ลาเเบบได้เงิน",
        startDate: todayStr,
        endDate: todayStr,
        reason: leaveReason.trim(),
        requestedBy: user.id,
        preserveStreak: true,
        isManagerRole: isManager,
      });

      if (!res.success) {
        setLeaveError(res.error || "เกิดข้อผิดพลาดในการส่งคำขอลางาน");
        return;
      }

      setAutoApproved(!!res.autoApproved);
      setLeaveSuccess(
        res.autoApproved
          ? "บันทึกการลางานสำหรับวันนี้เรียบร้อยแล้ว (อนุมัติอัตโนมัติ)"
          : "ส่งคำขอลางานวันนี้เรียบร้อยแล้ว กรุณารอผู้จัดการร้านหรือผู้ช่วยผู้จัดการร้านอนุมัติ"
      );
      loadQuota();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการส่งคำขอ";
      setLeaveError(msg);
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] flex flex-col justify-between px-3 sm:px-4 py-4 sm:py-10 pb-[max(1rem,env(safe-area-inset-bottom))] font-sans">
      {/* Unified Top Header Bar */}
      <header className="w-full max-w-5xl mx-auto mb-6 flex items-center justify-between gap-2 sm:gap-4 p-2.5 sm:p-3.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-xs">
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] flex items-center justify-center text-[var(--color-text)] transition-all cursor-pointer shrink-0"
              title="ย้อนกลับ"
              aria-label="ย้อนกลับ"
            >
              <ArrowLeft size={18} strokeWidth={2.5} />
            </button>
          )}
          <BrandLogo size={32} showText={true} hideTextOnMobile={true} isDark={false} />
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <PointStreakBadge />
          <NotificationCenter />
          <ThemeToggle />

          {/* User Profile Block */}
          <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-[var(--color-border)]">
            <div className="text-right hidden lg:block">
              <p className="text-xs sm:text-sm font-extrabold text-[var(--color-text)] leading-tight truncate max-w-[150px]">
                {user.name}
              </p>
              <div className="flex items-center justify-end gap-1 mt-0.5">
                {user.branchName && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--color-text-muted)] bg-[var(--color-surface-2)] px-1.5 py-0.5 rounded-full border border-[var(--color-border)] leading-none shrink-0">
                    <Store size={10} className="text-amber-600 dark:text-amber-400 shrink-0" />
                    {user.branchName}
                  </span>
                )}
                <span className="text-[10px] font-semibold text-[var(--color-text-muted)] bg-[var(--color-surface-2)] px-1.5 py-0.5 rounded-full border border-[var(--color-border)] leading-none shrink-0">
                  เลือกตำแหน่ง
                </span>
              </div>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[var(--color-brown)] text-amber-100 font-extrabold flex items-center justify-center text-xs shadow-xs shrink-0 ring-1 ring-[var(--color-border)]" title={user.name}>
              {user.name.slice(0, 2)}
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            title="ออกจากระบบ"
            aria-label="ออกจากระบบ"
            className="text-xs sm:text-sm text-[var(--color-text)] hover:text-rose-700 hover:bg-rose-50 hover:border-rose-300 dark:hover:bg-rose-950/40 dark:hover:border-rose-700 transition-all p-2 sm:px-2.5 sm:py-2 rounded-xl border border-[var(--color-border)] font-bold cursor-pointer min-h-[36px] min-w-[36px] inline-flex items-center justify-center gap-1.5 shrink-0"
          >
            <LogOut size={15} />
            <span className="hidden xl:inline">ออกจากระบบ</span>
          </button>
        </div>
      </header>

      {/* Main Section */}
      <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col items-center justify-center py-4">
        {/* Title */}
        <div className="text-center mb-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-text)] tracking-tight">
            เลือกตำแหน่งงานประจำวัน
          </h2>
          <p className="text-sm sm:text-base text-[var(--color-text-muted)] mt-2 max-w-lg mx-auto leading-relaxed font-medium">
            เลือกหน้าที่ที่คุณปฏิบัติงาน เพื่อดำเนินการเลือกกะการทำงานในขั้นตอนถัดไป หรือส่งคำขอลางานหากไม่สะดวกปฏิบัติงานวันนี้
          </p>
        </div>

        {/* Position Cards Grid - Clean, un-nested cards with clear contrast and readable body typography */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
          {availablePositions.map((pos) => {
            const isCashier = pos === "แคชเชียร์";

            return (
              <div
                key={pos}
                role="button"
                tabIndex={0}
                aria-label={`เลือกหน้าที่ ${pos}`}
                onClick={() => onSelectPosition(pos)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectPosition(pos);
                  }
                }}
                className={`group rounded-2xl p-6 sm:p-7 shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-3 transition-all duration-150 flex flex-col justify-between cursor-pointer active:scale-[0.99] bg-[var(--color-surface)] border-2 ${
                  isCashier
                    ? "border-amber-400 hover:border-amber-500 dark:border-amber-600 dark:hover:border-amber-500 focus-visible:ring-amber-400/50"
                    : "border-emerald-500 hover:border-emerald-600 dark:border-emerald-600 dark:hover:border-emerald-500 focus-visible:ring-emerald-400/50"
                }`}
              >
                <div>
                  {/* Card Header: Icon + Category Badge */}
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-105 shadow-xs ${
                        isCashier
                          ? "bg-amber-500 text-amber-950 dark:bg-amber-400 dark:text-amber-950"
                          : "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950"
                      }`}
                    >
                      {isCashier ? (
                        <CreditCard size={24} strokeWidth={2.3} />
                      ) : (
                        <Package size={24} strokeWidth={2.3} />
                      )}
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-extrabold tracking-wide px-3 py-1 rounded-full border shadow-xs transition-colors ${
                        isCashier
                          ? "bg-amber-500 text-amber-950 border-amber-600 dark:bg-amber-400 dark:text-amber-950 dark:border-amber-300"
                          : "bg-emerald-500 text-emerald-950 border-emerald-600 dark:bg-emerald-400 dark:text-emerald-950 dark:border-emerald-300"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isCashier ? "bg-amber-950" : "bg-emerald-950"}`} aria-hidden="true" />
                      {isCashier ? "จุดชำระเงิน & บริการ" : "สินค้าสด & ตู้แช่"}
                    </span>
                  </div>

                  {/* Position Title */}
                  <h3 className="text-xl sm:text-2xl font-extrabold text-[var(--color-text)] tracking-tight mb-3">
                    {pos}
                  </h3>

                  {/* Body description */}
                  <p className="text-sm sm:text-base text-[var(--color-text)] leading-relaxed mb-5 font-normal">
                    {isCashier
                      ? "รับผิดชอบงานจุดชำระเงิน ตรวจสอบระบบแคชเชียร์ นับเงินทอน และดูแลบริการลูกค้าหน้าร้าน"
                      : "รับผิดชอบการจัดเรียงสินค้า ตรวจนับสต็อก เติมสินค้าตู้แช่ และตรวจสอบความสดใหม่"}
                  </p>

                  {/* Key Tasks */}
                  <div className="space-y-2.5 pt-4 pb-2 border-t border-[var(--color-border-subtle)] text-sm text-[var(--color-text)]">
                    {isCashier ? (
                      <>
                        <div className="flex items-start gap-2.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1.5" aria-hidden="true" />
                          <span className="font-medium">ตรวจเงินสด ลิ้นชัก และอุปกรณ์รับชำระ</span>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1.5" aria-hidden="true" />
                          <span className="font-medium">ดูแลความสะอาดรอบจุดเคาน์เตอร์บริการ</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-start gap-2.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0 mt-1.5" aria-hidden="true" />
                          <span className="font-medium">ตรวจรับสินค้าสดและเติมตู้แช่ตามมาตรฐาน</span>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0 mt-1.5" aria-hidden="true" />
                          <span className="font-medium">ตรวจเช็คป้ายราคา ป้ายโปรโมชั่น และวันหมดอายุ</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Direct Action Affordance */}
                <div className="mt-6 pt-4 border-t border-[var(--color-border-subtle)] flex items-center justify-end">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border font-mono transition-all ${
                    isCashier
                      ? "bg-[var(--color-surface-2)] text-[var(--color-text)] border-[var(--color-border)] group-hover:bg-amber-500 group-hover:text-amber-950 group-hover:border-amber-600"
                      : "bg-[var(--color-surface-2)] text-[var(--color-text)] border-[var(--color-border)] group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-700"
                  }`}>
                    เลือก ↵
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Button Next to Job Selection: Request Leave For Today */}
        <div className="w-full mt-6 bg-[var(--color-surface)] border-2 border-rose-300 dark:border-rose-900/60 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm hover:border-rose-400 transition-all">
          <div className="flex items-center gap-3.5 w-full sm:w-auto">
            <div className="w-12 h-12 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CalendarOff size={24} strokeWidth={2.3} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-base font-extrabold text-[var(--color-text)]">
                  ขอลางานสำหรับวันนี้
                </h4>
                {quota ? (
                  <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border shadow-2xs ${
                    quota.remainingDays <= 3
                      ? "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800"
                      : "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800"
                  }`}>
                    คงเหลือ {quota.remainingDays} วัน (ใช้แล้ว {quota.usedDays}/{quota.allocatedQuota})
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-[var(--color-text-muted)]">
                    โควตา 3 วัน/ปี
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-0.5 leading-relaxed">
                {user.role === "manager"
                  ? "บันทึกการลางานสำหรับวันนี้ (ผู้จัดการบันทึกและอนุมัติอัตโนมัติ)"
                  : "ไม่สะดวกปฏิบัติงานวันนี้? ส่งคำขอลางานเพื่อรอผู้จัดการร้านหรือผู้ช่วยผู้จัดการร้านอนุมัติ"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenLeaveModal}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs sm:text-sm font-extrabold shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 border border-rose-700"
          >
            <CalendarOff size={16} />
            <span>ขอลางานวันนี้ (Request Leave)</span>
          </button>
        </div>

        {/* Back link */}
        {onBack && (
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={onBack}
              className="text-sm text-[var(--color-text)] hover:text-amber-600 font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer p-2 rounded-xl"
            >
              <ArrowLeft size={16} />
              <span>ย้อนกลับไปหน้าเลือกช่องทางเข้างาน</span>
            </button>
          </div>
        )}
      </div>

      {/* Leave Request Modal */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-scale-up flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-surface-2)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <CalendarOff size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[var(--color-text)]">
                    ส่งคำขอลางานสำหรับวันนี้
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)] font-medium">
                    {todayFormatted}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLeaveModalOpen(false)}
                className="w-8 h-8 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-border)] flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs sm:text-sm">
              {/* Success Message Banner */}
              {leaveSuccess ? (
                <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-center space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 size={28} />
                  </div>
                  <h4 className="text-base font-extrabold text-emerald-900 dark:text-emerald-200">
                    {autoApproved ? "อนุมัติการลาเรียบร้อยแล้ว" : "ส่งคำขอสำเร็จ"}
                  </h4>
                  <p className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 font-medium leading-relaxed">
                    {leaveSuccess}
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setIsLeaveModalOpen(false)}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-all cursor-pointer"
                    >
                      ตกลงและปิดหน้าต่าง
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmitLeave} className="space-y-5">
                  {/* Quota Overview Card */}
                  <div className="p-4 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[var(--color-text)]">สิทธิการลาของพนักงาน</span>
                      <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                        {quota ? `คงเหลือ ${quota.remainingDays} วัน` : "กำลังโหลด..."}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    {quota && (
                      <>
                        <div className="w-full h-2 rounded-full bg-[var(--color-border)] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              quota.remainingDays <= 3 ? "bg-rose-500" : "bg-emerald-500"
                            }`}
                            style={{
                              width: `${Math.min(100, (quota.usedDays / Math.max(1, quota.allocatedQuota)) * 100)}%`,
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)] pt-1">
                          <span>ใช้ไปแล้ว: <strong className="text-[var(--color-text)]">{quota.usedDays}</strong> วัน</span>
                          {quota.pendingDays > 0 && (
                            <span className="text-amber-600 dark:text-amber-400">
                              รออนุมัติ: <strong>{quota.pendingDays}</strong> วัน
                            </span>
                          )}
                          <span>สิทธิทั้งหมด: <strong className="text-[var(--color-text)]">{quota.allocatedQuota}</strong> วัน/ปี</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Reason Textarea */}
                  <div>
                    <label htmlFor="leave-reason" className="block text-xs font-bold text-[var(--color-text)] mb-2">
                      ระบุเหตุผลการลา <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      id="leave-reason"
                      rows={3}
                      value={leaveReason}
                      onChange={(e) => setLeaveReason(e.target.value)}
                      placeholder="ระบุเหตุผลการลา เช่น ไม่สบาย มีไข้สูง, ติดธุระด่วนทางครอบครัว ฯลฯ"
                      className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl p-3 text-xs sm:text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400/50 resize-none"
                      required
                    />
                  </div>

                  {/* Role Confirmation Notice */}
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                    <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      {user.role === "manager" ? (
                        <span>
                          <strong>อนุมัติอัตโนมัติ:</strong> คุณอยู่ในตำแหน่งผู้จัดการร้าน เมื่อกดยืนยัน ระบบจะทำการบันทึกและอนุมัติการลาทันที
                        </span>
                      ) : (
                        <span>
                          <strong>ขั้นตอนการอนุมัติ:</strong> เมื่อส่งคำขอแล้ว ผู้จัดการร้านจะเป็นผู้พิจารณากำหนดประเภทการลา (ได้เงิน / ไม่ได้รับเงิน) และอนุมัติการลาให้โดยตรง
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Error Message */}
                  {leaveError && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                      <AlertCircle size={16} className="shrink-0" />
                      <span>{leaveError}</span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-2 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsLeaveModalOpen(false)}
                      disabled={isSubmittingLeave}
                      className="px-4 py-2.5 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] text-xs font-bold transition-all cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingLeave || !leaveReason.trim() || (quota !== null && quota.remainingDays <= 0)}
                      className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer flex items-center gap-2"
                    >
                      {isSubmittingLeave ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>กำลังส่งคำขอ...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={16} />
                          <span>ยืนยันการขอลางาน</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      <footer className="text-center text-xs sm:text-sm text-[var(--color-text-muted)] font-medium py-3">
        {user.branchName || "Eater Egg Fresh Mart"} • Checklist System
      </footer>
    </main>
  );
}

