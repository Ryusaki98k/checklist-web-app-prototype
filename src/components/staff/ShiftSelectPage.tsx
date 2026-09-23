import { useState, useEffect } from "react";
import { ShiftSession, ShiftType, User } from "../../types";
import { BrandLogo } from "../common/BrandLogo";
import { getSessions } from "../../data/storage";
import { getPositionShiftsStatusAction, resetTodayChecklistDataAction } from "../../actions/checklist";
import { secureSetItem, secureRemoveItem } from "../../utils/crypto";
import { Confetti } from "../common/Confetti";
import { NotificationCenter } from "../common/NotificationCenter";
import { PointStreakBadge } from "../common/PointStreakBadge";
import { ThemeToggle } from "../common/ThemeToggle";
import { LogOut, Store } from "lucide-react";

export function ShiftSelectPage({
  user,
  sessions: propSessions,
  onSelect,
  onBack,
  onLogout,
}: {
  user: User;
  sessions?: ShiftSession[];
  onSelect: (shift: ShiftType) => void;
  onBack?: () => void;
  onLogout: () => void;
}) {
  const [internalSessions, setInternalSessions] = useState<ShiftSession[]>([]);
  const [dbStatuses, setDbStatuses] = useState<Record<
    ShiftType,
    { status: "completed" | "incomplete" | "none"; total: number; done: number }
  > | null>(null);

  const [chosenShift, setChosenShift] = useState<ShiftType | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isLoadingStatuses, setIsLoadingStatuses] = useState(true);
  const [isStartingShift, setIsStartingShift] = useState(false);

  useEffect(() => {
    const rawSessions = getSessions();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInternalSessions(rawSessions.filter((s) => s.userId === user.id));
  }, [user.id]);

  useEffect(() => {
    if (user.position) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoadingStatuses(true);
      setDbStatuses(null);
      setChosenShift(null);
      getPositionShiftsStatusAction(user.position, user.id)
        .then((res) => {
          if (res.success && res.statuses) {
            setDbStatuses(res.statuses);

            // Auto-select next available shift once validated
            const mornDone = res.statuses['morning'].status === "completed";
            const aftDone = res.statuses['afternoon'].status === "completed";

            if (mornDone || aftDone) {
              setShowConfetti(true);
            }

            if (!mornDone) {
              setChosenShift("morning");
            } else if (!aftDone) {
              setChosenShift("afternoon");
            }
          }
        })
        .catch(console.error)
        .finally(() => {
          setIsLoadingStatuses(false);
        });
    } else {
      setIsLoadingStatuses(false);
    }
  }, [user.position, user.id]);

  const sessions =
    propSessions && propSessions.length > 0
      ? propSessions
      : internalSessions.length > 0
        ? internalSessions
        : typeof window !== "undefined"
          ? getSessions()
          : [];

  const now = new Date();
  const hour = now.getHours();

  const shifts: {
    id: ShiftType;
    title: string;
    subTitle: string;
    time: string;
    tagline: string;
    isCurrent: boolean;
  }[] = [
      {
        id: "morning",
        title: "กะเช้า",
        subTitle: "งานประจำกะเช้า",
        time: "06:00 - 16:30",
        tagline: "เปิดร้าน รับสินค้า ตรวจนับสต็อก และบริการลูกค้าช่วงเช้า",
        isCurrent: hour >= 6 && hour < 16,
      },
      {
        id: "afternoon",
        title: "กะบ่าย",
        subTitle: "งานประจำกะบ่าย",
        time: "10:00 - 20:30",
        tagline: "ดูแลลูกค้าหน้าร้าน เติมสต็อก สรุปยอดเงิน และปิดร้าน",
        isCurrent: hour >= 10 && hour < 21,
      },
    ];

  const handleStartWork = () => {
    if (chosenShift && !isStartingShift && !isLoadingStatuses) {
      setIsStartingShift(true);
      if (typeof window !== "undefined") {
        secureRemoveItem("app_selected_shifts");
      }
      onSelect(chosenShift);
    }
  };

  const hasSelection = chosenShift !== null && !isLoadingStatuses && !isStartingShift;

  return (
    <main className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] flex flex-col justify-between px-3 sm:px-4 py-4 sm:py-10 pb-[max(1rem,env(safe-area-inset-bottom))] font-sans">
      {showConfetti && <Confetti />}

      {/* Unified Top Header Bar */}
      <header className="w-full max-w-5xl mx-auto mb-6 flex items-center justify-between gap-2 sm:gap-4 p-2.5 sm:p-3.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-xs">
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] flex items-center justify-center text-[var(--color-text)] transition-all cursor-pointer shrink-0"
              title="ย้อนกลับไปเลือกตำแหน่ง"
              aria-label="ย้อนกลับไปเลือกตำแหน่ง"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
              </svg>
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
                {user.position && (
                  <span className="text-[10px] font-bold text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/80 px-1.5 py-0.5 rounded-full border border-amber-300 dark:border-amber-700 leading-none shrink-0 truncate max-w-[110px]">
                    {user.position}
                  </span>
                )}
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

      {/* Main Area: Clean Header & 2 Shift Cards */}
      <div className="w-full max-w-3xl mx-auto flex-1 flex flex-col items-center justify-center py-4">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-text)] tracking-tight">
            เลือกกะการทำงาน
          </h1>
          <p className="text-sm sm:text-base text-[var(--color-text-muted)] mt-2 max-w-md mx-auto leading-relaxed font-medium">
            ติ๊กเลือกกะที่ต้องการปฏิบัติงานสำหรับตำแหน่ง <span className="font-extrabold text-[var(--color-text)] underline decoration-amber-500/50 underline-offset-4">{user.position || "พนักงาน"}</span>
          </p>
        </div>

        {/* 2 Shift Cards with Multi-select Checkboxes */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
          {shifts.map((s) => {
            const isMorn = s.id === "morning";
            // Find session specifically for this user's currently selected position
            const todayStr = new Date().toDateString();
            const positionSessions = sessions.filter(
              (sess) =>
                sess.shift === s.id &&
                sess.userPosition?.trim() === user.position?.trim() &&
                sess.userId === user.id
            );

            const todaySession = positionSessions.find(
              (sess) =>
                new Date(sess.startedAt).toDateString() === todayStr ||
                (sess.completedAt ? new Date(sess.completedAt).toDateString() === todayStr : false)
            );

            const shiftSession =
              todaySession ||
              positionSessions.sort(
                (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
              )[0];

            const dbStatus = dbStatuses ? dbStatuses[s.id] : null;
            const hasDbData = Boolean(dbStatus && dbStatus.total > 0);

            const totalItems = hasDbData ? dbStatus!.total : shiftSession ? shiftSession.items.length : 0;
            const doneItems = hasDbData ? dbStatus!.done : shiftSession ? shiftSession.items.filter((i) => i.completedAt !== null).length : 0;
            const isAllDone = totalItems > 0 && doneItems === totalItems;
            const isEnded = Boolean(shiftSession && shiftSession.completedAt);
            const hasActivity = Boolean(
              (hasDbData && dbStatus!.status !== "none") ||
              (shiftSession && (doneItems > 0 || isEnded))
            );

            const checkStatus: "completed" | "incomplete" | "none" =
              hasDbData && dbStatus!.status !== "none"
                ? dbStatus!.status
                : !hasActivity
                  ? "none"
                  : isAllDone
                    ? "completed"
                    : "incomplete";

            const isLoading = dbStatuses === null;
            const isDisabled = isLoading;
            const isChecked = isDisabled ? false : chosenShift === s.id;

            const toggleSelect = () => {
              if (isDisabled) return;
              setChosenShift(s.id as ShiftType);
            };

            const containerTheme = isLoading
              ? "border-2 border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] opacity-60"
              : isChecked
                ? isMorn
                  ? "border-2 border-amber-500 bg-[var(--color-surface)] shadow-sm ring-2 ring-amber-400/50"
                  : "border-2 border-orange-500 bg-[var(--color-surface)] shadow-sm ring-2 ring-orange-400/50"
                : checkStatus === "completed"
                  ? "border-2 border-emerald-400 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-950/20 hover:border-emerald-500"
                  : isMorn
                    ? "border-2 border-amber-300 hover:border-amber-500 bg-[var(--color-surface)] dark:border-amber-700 dark:hover:border-amber-500"
                    : "border-2 border-orange-300 hover:border-orange-500 bg-[var(--color-surface)] dark:border-orange-700 dark:hover:border-orange-500";

            return (
              <div
                key={s.id}
                role="checkbox"
                aria-checked={isChecked}
                tabIndex={isDisabled ? -1 : 0}
                onClick={toggleSelect}
                onKeyDown={(e) => {
                  if (isDisabled) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleSelect();
                  }
                }}
                className={`group border rounded-2xl p-6 sm:p-7 shadow-xs hover:shadow-md ${containerTheme} focus-visible:outline-none focus:ring-2 focus:ring-amber-400/50 ${isDisabled ? "cursor-not-allowed" : "cursor-pointer active:scale-[0.99]"} transition-all duration-150 flex flex-col justify-between relative overflow-hidden`}
              >
                <div>
                  {/* Top Header inside Card: Checkbox & Shift Icon / Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 mb-4 sm:mb-5">
                    {/* Checkbox indicator */}
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                      <div
                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors duration-150 shrink-0 ${
                          isChecked
                            ? isMorn
                              ? "bg-amber-500 border-amber-500 text-amber-950 shadow-xs"
                              : "bg-orange-500 border-orange-500 text-white shadow-xs"
                            : isDisabled && checkStatus === "completed"
                              ? "bg-emerald-600 border-emerald-500 text-white shadow-2xs"
                              : "bg-[var(--color-surface)] border-[var(--color-border)] group-hover:border-amber-400"
                        }`}
                      >
                        {(isChecked || (isDisabled && checkStatus === "completed")) && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-xs sm:text-sm font-bold transition-colors truncate ${isChecked ? "text-[var(--color-text)]" : isDisabled ? (checkStatus === "completed" ? "text-emerald-800 dark:text-emerald-300 font-extrabold" : "text-[var(--color-text-muted)] font-bold") : "text-[var(--color-text)] font-semibold"}`}>
                        {isChecked ? "เลือกกะนี้แล้ว" : isDisabled ? (checkStatus === "completed" ? "ตรวจครบทุกข้อแล้ว" : isLoading ? "กำลังตรวจสอบข้อมูล..." : "ไม่สามารถเลือกได้") : "แตะเพื่อเลือกกะนี้"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
                      {checkStatus === "completed" ? (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-800 flex items-center gap-1 shadow-2xs">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>เสร็จสมบูรณ์</span>
                        </span>
                      ) : checkStatus === "incomplete" ? (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-950 border border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-800 flex items-center gap-1 shadow-2xs">
                          <span>ค้าง {totalItems - doneItems} ข้อ</span>
                        </span>
                      ) : null}

                      {s.isCurrent && (
                        <span
                          className={`text-xs font-extrabold px-2.5 py-1 rounded-full border font-mono shadow-2xs flex items-center gap-1.5 ${
                            isMorn
                              ? "bg-amber-200 text-amber-950 border-amber-400 dark:bg-amber-900/80 dark:text-amber-200 dark:border-amber-700"
                              : "bg-orange-200 text-orange-950 border-orange-400 dark:bg-orange-900/80 dark:text-orange-200 dark:border-orange-700"
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${isMorn ? "bg-amber-600" : "bg-orange-600"}`}
                            aria-hidden="true"
                          />
                          เวลานี้
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Icon Header */}
                  <div className="flex items-start gap-3.5 mb-3">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 group-hover:scale-105 shadow-xs ${
                        isMorn
                          ? "bg-amber-500 text-amber-950 dark:bg-amber-400 dark:text-amber-950"
                          : "bg-orange-500 text-white dark:bg-orange-500 dark:text-white"
                      }`}
                    >
                      {isMorn ? (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="4" />
                          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                        </svg>
                      ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                        </svg>
                      )}
                    </div>

                    <div>
                      <h3 className="text-xl sm:text-2xl font-extrabold text-[var(--color-text)] tracking-tight flex items-center gap-2">
                        {s.title}
                      </h3>
                      <p className="text-xs sm:text-sm font-bold text-[var(--color-text)] mt-1 font-mono flex items-center gap-1.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span>{s.time}</span>
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-[var(--color-text)] mt-3 leading-relaxed font-normal">
                    {s.tagline}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-xs sm:text-sm text-[var(--color-text)] font-semibold">
                  <span>{s.subTitle}</span>
                  {isLoadingStatuses ? (
                    <span className="text-[var(--color-text-muted)] font-mono text-xs flex items-center gap-1.5 font-medium">
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                      กำลังตรวจสถานะ...
                    </span>
                  ) : (
                    <>
                      {checkStatus === "completed" && (
                        <span className="text-emerald-900 dark:text-emerald-200 font-mono text-xs font-bold">เช็คแล้ว ({doneItems}/{totalItems})</span>
                      )}
                      {checkStatus === "incomplete" && (
                        <span className="text-amber-950 dark:text-amber-200 font-mono text-xs font-bold">ค้าง ({totalItems - doneItems})</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Shifts Summary Text */}
        <div className="w-full text-center mb-6 min-h-[36px] flex items-center justify-center">
          {isLoadingStatuses ? (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] font-medium text-xs sm:text-sm">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
              <span>กำลังตรวจสอบสถานะกะจากฐานข้อมูล...</span>
            </div>
          ) : chosenShift === "morning" ? (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-200 text-xs sm:text-sm font-bold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-amber-600" aria-hidden="true" />
              <span>เลือกปฏิบัติงาน: กะเช้า (06:00 – 16:30)</span>
            </div>
          ) : chosenShift === "afternoon" ? (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-100 dark:bg-orange-950/80 border border-orange-300 dark:border-orange-700 text-orange-950 dark:text-orange-200 text-xs sm:text-sm font-bold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-orange-600" aria-hidden="true" />
              <span>เลือกปฏิบัติงาน: กะบ่าย (10:00 – 20:30)</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] font-semibold text-xs sm:text-sm">
              <span>แตะเลือกกะที่ท่านปฏิบัติงานในวันนี้</span>
            </div>
          )}
        </div>

        {/* Big Main Action Button */}
        <div className="w-full max-w-sm">
          <button
            type="button"
            disabled={!hasSelection}
            onClick={handleStartWork}
            className={`w-full py-3.5 px-6 rounded-xl font-extrabold text-sm sm:text-base shadow-xs hover:shadow-sm transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer ${
              hasSelection
                ? chosenShift === "morning"
                  ? "bg-amber-500 hover:bg-amber-600 text-amber-950 border border-amber-600 shadow-xs"
                  : "bg-orange-600 hover:bg-orange-700 text-white border border-orange-700 shadow-xs"
                : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] font-bold border border-[var(--color-border)] cursor-not-allowed"
            }`}
          >
            {isLoadingStatuses ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
                <span>กำลังโหลดข้อมูลสถานะกะ...</span>
              </>
            ) : isStartingShift ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-950 border-t-transparent" />
                <span>กำลังเริ่มตรวจเช็คลิสต์...</span>
              </>
            ) : (
              <>
                <span>{hasSelection ? `เริ่มตรวจเช็คลิสต์ ${chosenShift === "morning" ? "กะเช้า" : "กะบ่าย"}` : "เลือกกะการทำงานเพื่อเริ่มตรวจงาน"}</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        </div>

        {/* Bottom Actions */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-center">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="text-sm text-[var(--color-text)] hover:text-amber-600 font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer p-2 rounded-xl"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span>ต้องการเปลี่ยนตำแหน่ง? ย้อนกลับไปเลือกตำแหน่ง</span>
            </button>
          )}

          {onBack && <span className="text-[var(--color-border)] hidden sm:inline" aria-hidden="true">•</span>}

          <button
            type="button"
            onClick={async () => {
              if (confirm("ต้องการล้างข้อมูลเช็คลิสต์ประจำวันในกะนี้เพื่อเริ่มต้นใหม่ใช่หรือไม่? (ข้อมูลผลการตรวจที่บันทึกไว้ในวันนี้จะถูกลบออกจากระบบเพื่อเริ่มรอบใหม่)")) {
                await resetTodayChecklistDataAction(user.position);
                secureSetItem("app_sessions", "[]");
                secureRemoveItem("app_active_session");
                secureRemoveItem("app_queue_afternoon");
                window.location.reload();
              }
            }}
            className="text-xs sm:text-sm text-[var(--color-text-muted)] hover:text-rose-700 font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer p-1.5 rounded-lg"
            title="ล้างข้อมูลเช็คลิสต์ทั้งหมดเพื่อเริ่มทดสอบใหม่"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            <span>รีเซ็ตข้อมูลเช็คลิสต์</span>
          </button>
        </div>
      </div>

      <footer className="text-center text-xs sm:text-sm text-[var(--color-text-muted)] font-medium py-3 relative z-10">
        {user.branchName || "Eater Egg Fresh Mart"} • Checklist System
      </footer>
    </main>
  );
}
