import { ShiftSession } from "../../types";
import { fmtDate, fmtTime } from "../../data/storage";
import { Badge, Divider, getShiftBadge } from "../common/Badge";
import { useModalFocusTrap } from "../common/ModalFocusTrap";

export function SessionDetailModal({
  session,
  onClose,
}: {
  session: ShiftSession | null;
  onClose: () => void;
}) {
  const { dialogRef, handleKeyDown } = useModalFocusTrap(Boolean(session), onClose);

  if (!session) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 px-4"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-detail-title"
        tabIndex={-1}
        className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl p-6 sm:p-8 focus-visible:outline-2 focus-visible:outline-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 id="session-detail-title" className="text-base font-bold text-slate-900">
                {session.userName}
              </h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {session.userPosition && <Badge color="muted">{session.userPosition}</Badge>}
                {getShiftBadge(session.shift)}
                <span className="text-xs font-mono text-slate-500">{fmtDate(session.startedAt)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดรายละเอียดกะ"
              className="p-2 -mr-2 text-slate-500 hover:text-slate-800 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center focus-visible:outline-2 focus-visible:outline-slate-900"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <Divider />
          <div className="mt-4 space-y-2.5">
            {session.items.map((item, idx) => {
              const prevItem = idx > 0 ? session.items[idx - 1] : null;
              const showCat = item.category && (!prevItem || prevItem.category !== item.category);
              return (
                <div key={item.id} className="space-y-1.5">
                  {showCat && (
                    <p className="text-[11px] font-bold text-slate-700 pt-2 pb-0.5">{item.category}</p>
                  )}
                  <div
                    className={`flex items-start gap-3 p-3 rounded-xl border ${
                      item.completedAt ? "bg-emerald-50/40 border-emerald-200" : "bg-white border-slate-200"
                    }`}
                  >
                    <div
                      className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                        item.completedAt ? "border-emerald-600 bg-emerald-600" : "border-slate-300 bg-white"
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
                      <div className="flex gap-2">
                        <span className="text-[10px] font-mono text-slate-400">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <p className="text-xs font-medium text-slate-900">{item.label}</p>
                      </div>
                      {item.completedAt && (
                        <p className="text-[10px] font-mono text-emerald-800 font-semibold mt-0.5">
                          {fmtTime(item.completedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
