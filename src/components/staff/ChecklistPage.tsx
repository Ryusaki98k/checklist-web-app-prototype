import { useState } from "react";
import { ShiftSession } from "../../types";
import { fmtTime, getNotifications, saveNotifications, uid } from "../../data/storage";
import { getShiftBadge } from "../common/Badge";
import { useModalFocusTrap } from "../common/ModalFocusTrap";

export function ChecklistPage({
  session,
  onUpdate,
  onEndShift,
  onOpenDashboard,
}: {
  session: ShiftSession;
  onUpdate: (s: ShiftSession) => void;
  onEndShift: () => void;
  onOpenDashboard?: () => void;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");
  const { dialogRef: confirmDialogRef, handleKeyDown: handleConfirmKeyDown } = useModalFocusTrap(showConfirm, () => setShowConfirm(false));

  const total = session.items.length;
  const done = session.items.filter((i) => i.completedAt).length;
  const allDone = done === total;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  const filteredItems = session.items.filter((i) => {
    if (filter === "pending") return !i.completedAt;
    if (filter === "done") return !!i.completedAt;
    return true;
  });

  function toggleItem(id: string) {
    if (session.completedAt) return;
    const updated = session.items.map((item) =>
      item.id === id ? { ...item, completedAt: item.completedAt ? null : new Date().toISOString() } : item
    );
    const allComplete = updated.every((i) => i.completedAt);
    let updatedSession = { ...session, items: updated };
    if (allComplete && !session.notified) {
      const completedAt = new Date().toISOString();
      updatedSession = { ...updatedSession, completedAt, notified: true };
      const notifs = getNotifications();
      notifs.push({
        id: uid(),
        shiftSessionId: session.id,
        userName: session.userName,
        userPosition: session.userPosition,
        shift: session.shift,
        completedAt,
        read: false,
      });
      saveNotifications(notifs);
    }
    onUpdate(updatedSession);
  }

  function endShift() {
    setShowConfirm(false);
    onEndShift();
  }

  return (
    <div className="min-h-screen bg-slate-50/60 flex flex-col items-center px-4 py-6 sm:py-10">
      {/* Off-screen live status update for assistive tech (SC 4.1.3) */}
      <div aria-live="polite" className="sr-only">
        ความคืบหน้างาน {done} จาก {total} รายการ ({progress}%)
      </div>

      <div className="w-full max-w-2xl space-y-4">
        {/* Header Card */}
        <header className="bg-white/95 backdrop-blur-sm border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs">
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200/80">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {getShiftBadge(session.shift)}
                {session.userPosition && (
                  <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                    {session.userPosition}
                  </span>
                )}
                {allDone && (
                  <span className="text-xs font-bold font-mono text-emerald-900 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-300 shadow-2xs flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>ครบถ้วน 100%</span>
                  </span>
                )}
              </div>
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">{session.userName}</h1>
              <p className="text-xs text-slate-500 font-mono mt-0.5">เริ่มงานเวลา {fmtTime(session.startedAt)}</p>
            </div>

            <div className="flex items-center gap-2">
              {onOpenDashboard && (
                <button
                  type="button"
                  onClick={onOpenDashboard}
                  className="text-xs px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 hover:bg-slate-200 hover:text-slate-950 transition-colors font-semibold flex items-center gap-1.5 min-h-[36px] cursor-pointer shadow-2xs"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                  แดชบอร์ด
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                className="text-xs px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:border-rose-300 hover:text-rose-700 hover:bg-rose-50/50 transition-colors min-h-[36px] inline-flex items-center font-semibold cursor-pointer shadow-2xs"
              >
                จบกะงาน
              </button>
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="pt-4">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-slate-700">
                ความคืบหน้า: <span className="font-mono font-bold text-slate-900">{done}/{total}</span> รายการ
              </span>
              <span className={`font-mono font-bold ${allDone ? "text-emerald-700" : "text-slate-900"}`}>{progress}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60 p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-300 ease-out ${
                  allDone ? "bg-emerald-600" : "bg-slate-900"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </header>

        {/* Filter Tabs */}
        <div className="flex items-center justify-between gap-2 px-1">
          <div
            role="tablist"
            aria-label="กรองรายการเช็คลิสต์"
            onKeyDown={(e) => {
              const filterTabs: Array<"all" | "pending" | "done"> = ["all", "pending", "done"];
              const currentIndex = filterTabs.indexOf(filter);
              if (e.key === "ArrowRight") {
                e.preventDefault();
                setFilter(filterTabs[(currentIndex + 1) % filterTabs.length]);
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                setFilter(filterTabs[(currentIndex - 1 + filterTabs.length) % filterTabs.length]);
              }
            }}
            className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold gap-1 border border-slate-200/70"
          >
            {(["all", "pending", "done"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={filter === t}
                tabIndex={filter === t ? 0 : -1}
                onClick={() => setFilter(t)}
                className={`px-3 py-1.5 min-h-[32px] rounded-lg transition-all cursor-pointer ${
                  filter === t ? "bg-white text-slate-900 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t === "all" ? `ทั้งหมด (${total})` : t === "pending" ? `ที่ต้องทำ (${total - done})` : `เสร็จแล้ว (${done})`}
              </button>
            ))}
          </div>

          {allDone && (
            <span className="hidden sm:inline-flex text-xs font-bold font-mono text-emerald-900 bg-emerald-50 border border-emerald-300 px-3 py-1 rounded-full shadow-2xs">
              ตรวจครบทุกข้อแล้ว
            </span>
          )}
        </div>

        {/* Checklist Items */}
        <div className="space-y-2.5" role="group" aria-label="รายการตรวจสอบประจำกะ">
          {filteredItems.map((item, idx) => {
            const isDone = !!item.completedAt;
            const originalIndex = session.items.findIndex((i) => i.id === item.id);
            const prevItem = idx > 0 ? filteredItems[idx - 1] : null;
            const showCategoryHeader = item.category && (!prevItem || prevItem.category !== item.category);

            return (
              <div key={item.id} className="space-y-2">
                {showCategoryHeader && (
                  <div className="pt-3 pb-1 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true" />
                    <h2 className="text-xs font-bold text-slate-700 tracking-wide">{item.category}</h2>
                  </div>
                )}
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isDone}
                  onClick={() => toggleItem(item.id)}
                  className={`w-full flex items-start gap-3.5 p-4 rounded-2xl border text-left transition-all duration-150 focus-visible:outline-none focus:ring-3 focus:ring-slate-950/10 shadow-2xs cursor-pointer ${
                    isDone
                      ? "bg-emerald-50/30 border-emerald-200/80 hover:border-emerald-300"
                      : "bg-white border-slate-200 hover:border-slate-400 hover:shadow-xs"
                  }`}
                >
                  <div
                    className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      isDone
                        ? "border-emerald-600 bg-emerald-600 text-white shadow-2xs"
                        : "border-slate-400 bg-white hover:border-slate-800"
                    }`}
                  >
                    {isDone && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                        <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <span className={`text-xs font-mono font-semibold pt-0.5 select-none ${isDone ? "text-emerald-700" : "text-slate-400"}`} aria-hidden="true">
                        {String(originalIndex + 1).padStart(2, "0")}
                      </span>
                      <p className={`text-sm leading-relaxed ${isDone ? "text-slate-500 line-through" : "text-slate-900 font-medium"}`}>
                        {item.label}
                      </p>
                    </div>
                    {isDone && item.completedAt && (
                      <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-mono text-emerald-800 pl-6 font-medium">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span>เสร็จเมื่อ {fmtTime(item.completedAt)}</span>
                      </div>
                    )}
                  </div>
                </button>
              </div>
            );
          })}

          {filteredItems.length === 0 && (
            <div className="p-8 text-center bg-white border border-slate-200/90 rounded-2xl">
              <p className="text-sm font-semibold text-slate-700">ไม่มีรายการในหมวดนี้</p>
              <p className="text-xs text-slate-600 mt-1 font-medium">
                {filter === "pending" ? "คุณทำครบทุกรายการแล้ว" : "ยังไม่มีรายการที่เสร็จสมบูรณ์"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center z-50 px-4"
          onClick={() => setShowConfirm(false)}
          onKeyDown={handleConfirmKeyDown}
        >
          <div
            ref={confirmDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-shift-title"
            tabIndex={-1}
            className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 w-full max-w-sm focus-visible:outline-2 focus-visible:outline-slate-900 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-shift-title" className="text-base font-bold text-slate-900 mb-2">
              ยืนยันการจบกะงาน?
            </h2>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              {allDone
                ? "คุณได้ทำการตรวจสอบครบถ้วนทั้ง 100% แล้ว ต้องการบันทึกและจบกะงานใช่หรือไม่?"
                : `ยังมีรายการที่ยังไม่เสร็จอีก ${total - done} รายการ คุณต้องการจบกะงานตอนนี้เลยหรือไม่?`}
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={endShift}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs cursor-pointer"
              >
                จบกะงาน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
