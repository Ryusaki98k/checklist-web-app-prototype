import { ShiftSession } from "../../types";
import { fmtDate, fmtTime } from "../../data/storage";
import { Badge, Divider, getShiftBadge } from "../common/Badge";
import { useModalFocusTrap } from "../common/ModalFocusTrap";
import { AlertCircle } from "lucide-react";

export function SessionDetailModal({
  session,
  onClose,
  canApprove = false,
  isApproved = false,
  onApprove,
  approveRoleTitle = "ผู้จัดการ",
}: {
  session: ShiftSession | null;
  onClose: () => void;
  canApprove?: boolean;
  isApproved?: boolean;
  onApprove?: (sessionId: string) => void;
  approveRoleTitle?: string;
}) {
  const { dialogRef, handleKeyDown } = useModalFocusTrap(Boolean(session), onClose);

  if (!session) return null;

  const total = session.items.length;
  const done = session.items.filter((i) => i.completedAt).length;

  return (
    <div
      className="fixed inset-0 bg-[var(--color-brown)]/40 backdrop-blur-xs flex items-center justify-center z-50 px-3 sm:px-4"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-detail-title"
        tabIndex={-1}
        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl w-full max-w-lg max-h-[90vh] sm:max-h-[85vh] overflow-y-auto shadow-2xl p-4 sm:p-6 focus-visible:outline-2 focus-visible:outline-amber-400 flex flex-col justify-between text-[var(--color-text)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 id="session-detail-title" className="text-base font-bold text-[var(--color-text)]">
                {session.userName}
              </h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {session.userPosition && <Badge color="muted">{session.userPosition}</Badge>}
                {getShiftBadge(session.shift)}
                <span className="text-xs font-mono text-[var(--color-text-muted)]">{fmtDate(session.startedAt)}</span>
                {isApproved ? (
                  <span className="text-xs font-bold text-emerald-900 bg-emerald-100 dark:bg-emerald-950/80 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 px-2.5 py-0.5 rounded-full">
                    ✓ รับรองผลเรียบร้อยแล้ว
                  </span>
                ) : (
                  <span className="text-xs font-bold text-amber-950 bg-amber-100 dark:bg-amber-950/80 dark:text-amber-200 border border-amber-300 dark:border-amber-800 px-2.5 py-0.5 rounded-full">
                    รอการตรวจสอบและรับรอง
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดรายละเอียดกะ"
              className="p-2 -mr-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] rounded-xl min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center focus-visible:outline-2 focus-visible:outline-amber-400 cursor-pointer"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="p-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] mb-4 flex items-center justify-between text-xs font-semibold text-[var(--color-text-muted)]">
            <span>ความคืบหน้างาน: {done}/{total} ข้อ</span>
            <span className="font-mono font-bold text-[var(--color-text)]">{total > 0 ? Math.round((done / total) * 100) : 0}%</span>
          </div>

          {/* Late Tasks Alert Summary */}
          {(() => {
            const lateItems = session.items.filter((item) => {
              if (item.isLate || item.comment) return true;
              if (item.completedAt && item.category) {
                const match = item.category.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
                if (match) {
                  const [endHr, endMin] = match[2].split(':').map(Number);
                  const completedDate = new Date(item.completedAt);
                  const deadlineDate = new Date(session.startedAt);
                  deadlineDate.setHours(endHr, endMin, 0, 0);
                  if (completedDate > deadlineDate) return true;
                }
              }
              return false;
            });

            if (lateItems.length === 0) return null;

            return (
              <div className="p-3 mb-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 flex items-start gap-2.5 text-xs text-rose-950 dark:text-rose-200">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">กะนี้มีรายการเช็คลิสต์ล่าช้า {lateItems.length} รายการ</span>
                  <p className="text-[11px] text-rose-800 dark:text-rose-300 mt-0.5">
                    โปรดตรวจสอบเหตุผลการปฏิบัติงานล่าช้าที่ระบุไว้ในแต่ละข้อด้านล่างก่อนอนุมัติ
                  </p>
                </div>
              </div>
            );
          })()}

          <Divider />
          <div className="mt-4 space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
            {session.items.map((item, idx) => {
              const prevItem = idx > 0 ? session.items[idx - 1] : null;
              const showCat = item.category && (!prevItem || prevItem.category !== item.category);

              let isLate = item.isLate ?? false;
              if (!isLate && item.completedAt && item.category) {
                const match = item.category.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
                if (match) {
                  const endStr = match[2];
                  const [endHr, endMin] = endStr.split(':').map(Number);
                  const completedDate = new Date(item.completedAt);
                  const deadlineDate = new Date(session.startedAt);
                  deadlineDate.setHours(endHr, endMin, 0, 0);
                  if (completedDate > deadlineDate) {
                    isLate = true;
                  }
                }
              }
              if (item.comment) {
                isLate = true;
              }

              return (
                <div key={item.id} className="space-y-1.5">
                  {showCat && (
                    <p className="text-xs font-bold text-[var(--color-text-muted)] pt-2 pb-0.5">{item.category}</p>
                  )}
                  <div
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                      isLate
                        ? "bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60"
                        : item.completedAt
                        ? "bg-[var(--color-amber-glow)]/50 border-[var(--color-amber)]"
                        : "bg-[var(--color-surface)] border-[var(--color-border)]"
                    }`}
                  >
                    <div
                      className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${
                        item.completedAt
                          ? isLate
                            ? "border-rose-500 bg-rose-500"
                            : "border-amber-500 bg-amber-500"
                          : "border-[var(--color-border)] bg-[var(--color-surface)]"
                      }`}
                    >
                      {item.completedAt && (
                        <svg width="8" height="8" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                          <path
                            d="M2 5l2.5 2.5L8 3"
                            stroke="white"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-[var(--color-text-subtle)]">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <p className={`text-xs font-medium ${item.completedAt ? "text-[var(--color-text-muted)] line-through" : "text-[var(--color-text)]"}`}>
                            {item.label}
                          </p>
                        </div>
                        {isLate && (
                          <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 shrink-0">
                            ⚠️ ล่าช้า
                          </span>
                        )}
                      </div>

                      {item.completedAt && (
                        <div className="mt-1 space-y-1">
                          <p className="text-[11px] font-mono text-[var(--color-text-muted)]">
                            เสร็จเมื่อ {fmtTime(item.completedAt)}
                          </p>
                          {isLate && (
                            <div className="text-xs text-rose-950 dark:text-rose-200 bg-rose-100/80 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800/80 rounded-lg p-2 mt-1 flex items-start gap-1.5 font-sans">
                              <span className="font-bold text-rose-700 dark:text-rose-400 shrink-0">เหตุผลที่ล่าช้า:</span>
                              <span className="break-words font-medium">{item.comment ? item.comment : "ผู้ปฏิบัติงานไม่ได้ระบุเหตุผล"}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Bottom Action: Approve Button */}
        {canApprove && onApprove && !isApproved && (
          <div className="mt-5 pt-4 border-t border-[var(--color-border)]">
            <button
              type="button"
              onClick={() => onApprove(session.id)}
              className="w-full min-h-[44px] py-3 sm:py-2.5 px-4 bg-[var(--color-brown)] hover:bg-[var(--color-brown-light)] text-amber-100 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2"
            >
              <span>รับรองผลการตรวจงาน ({approveRoleTitle})</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
