import { useState, useEffect } from "react";
import { ShiftSession } from "../../types";
import { fmtDate, fmtTime } from "../../data/storage";
import { Badge, Divider, getShiftBadge } from "../common/Badge";
import { useModalFocusTrap } from "../common/ModalFocusTrap";
import { UserAvatar } from "../common/UserAvatar";
import { AlertCircle, AlertTriangle, ShieldCheck, CheckCircle2, ShieldAlert } from "lucide-react";
import { reviewIncompleteShiftAction } from "../../actions/manager";

export function SessionDetailModal({
  session,
  onClose,
  canApprove = false,
  isApproved = false,
  onApprove,
  approveRoleTitle = "ผู้จัดการ",
  reviewerId,
  canReviewIncomplete = false,
  onReviewSuccess,
  isApproving = false,
}: {
  session: ShiftSession | null;
  onClose: () => void;
  canApprove?: boolean;
  isApproved?: boolean;
  onApprove?: (sessionId: string, isException?: boolean) => void;
  approveRoleTitle?: string;
  reviewerId?: string;
  canReviewIncomplete?: boolean;
  onReviewSuccess?: () => void;
  isApproving?: boolean;
}) {
  const [sessionOverride, setSessionOverride] = useState<Partial<ShiftSession> | null>(null);
  const [showApprovalPrompt, setShowApprovalPrompt] = useState(false);
  const [incompleteAction, setIncompleteAction] = useState<"no_penalty" | "deduct_points" | "break_streak">("no_penalty");
  const [pointsToDeduct, setPointsToDeduct] = useState<number>(5);
  const [incompleteNote, setIncompleteNote] = useState<string>("");
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);
  const [reviewFeedback, setReviewFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    setSessionOverride(null);
    setShowApprovalPrompt(false);
  }, [session?.id]);

  useEffect(() => {
    if (isApproved && showApprovalPrompt) {
      setShowApprovalPrompt(false);
    }
  }, [isApproved, showApprovalPrompt]);

  const currentSession = session ? { ...session, ...sessionOverride } : null;

  const { dialogRef, handleKeyDown } = useModalFocusTrap(Boolean(session), onClose);

  if (!currentSession) return null;

  const total = currentSession.items.length;
  const done = currentSession.items.filter((i) => i.completedAt).length;

  const isIncomplete = Boolean(
    currentSession.incompleteReason ||
    currentSession.incompleteStatus === "pending_review" ||
    currentSession.incompleteStatus === "reviewed"
  );
  const isReviewed = currentSession.incompleteStatus === "reviewed";

  const handleReviewIncomplete = async () => {
    if (!currentSession || !reviewerId) return;
    try {
      setIsSubmittingReview(true);
      setReviewFeedback(null);
      const res = await reviewIncompleteShiftAction({
        shiftSessionId: currentSession.id,
        reviewerId,
        action: incompleteAction,
        pointsToDeduct: incompleteAction === "deduct_points" ? pointsToDeduct : 0,
        note: incompleteNote.trim() || undefined,
      });

      if (res.success) {
        setReviewFeedback({ type: "success", message: "บันทึกผลการพิจารณามาตรการเรียบร้อยแล้ว" });
        setSessionOverride({
          incompleteStatus: "reviewed",
          incompleteAction,
          incompleteActionPoints: incompleteAction === "deduct_points" ? pointsToDeduct : 0,
          incompleteActionNote: incompleteNote.trim() || null,
          incompleteReviewedAt: new Date().toISOString(),
        });
        onReviewSuccess?.();
      } else {
        setReviewFeedback({ type: "error", message: res.error || "เกิดข้อผิดพลาดในการบันทึก" });
      }
    } catch {
      setReviewFeedback({ type: "error", message: "ไม่สามารถบันทึกผลการพิจารณาได้" });
    } finally {
      setIsSubmittingReview(false);
    }
  };

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
          <div className="flex items-center justify-between mb-4 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <UserAvatar
                name={currentSession.userName}
                profile_id={currentSession.userProfileId}
                role={currentSession.userRole as any}
                size="md"
                className="shrink-0 shadow-xs"
              />
              <div className="min-w-0">
                <h2 id="session-detail-title" className="text-base font-bold text-[var(--color-text)] truncate">
                  {currentSession.userName}
                </h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {currentSession.userPosition && <Badge color="muted">{currentSession.userPosition}</Badge>}
                  {getShiftBadge(currentSession.shift)}
                  <span className="text-xs font-mono text-[var(--color-text-muted)]">{fmtDate(currentSession.startedAt)}</span>
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

          {/* Incomplete Shift Alert & Review Decision Section */}
          {isIncomplete && (
            <>
              {isReviewed ? (
                <div className="p-3.5 mb-3 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span>ผลการพิจารณาจบกะงานไม่ครบ</span>
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-blue-100 dark:bg-blue-900/80 text-blue-900 dark:text-blue-100 border border-blue-300 dark:border-blue-700">
                      {currentSession.incompleteAction === "no_penalty" && "🛡️ อนุโลม (ไม่ลงโทษ)"}
                      {currentSession.incompleteAction === "deduct_points" && `🎯 หัก ${currentSession.incompleteActionPoints || 0} คะแนน`}
                      {currentSession.incompleteAction === "break_streak" && "⚡ ตัดสตรีคสะสมเป็น 0"}
                      {currentSession.incompleteAction === "deduct_leave_quota" && "📅 หักโควตาวันลา 1 วัน"}
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--color-text)] space-y-1 bg-[var(--color-surface)] p-2.5 rounded-xl border border-blue-200/60 dark:border-blue-900/60">
                    <div>
                      <span className="font-semibold text-[var(--color-text-muted)]">เหตุผลของพนักงาน:</span>{" "}
                      <span className="italic font-medium text-[var(--color-text)]">&ldquo;{currentSession.incompleteReason}&rdquo;</span>
                    </div>
                    {currentSession.incompleteActionNote && (
                      <div>
                        <span className="font-semibold text-[var(--color-text-muted)]">หมายเหตุจากผู้ตรวจ:</span>{" "}
                        <span className="font-medium text-[var(--color-text)]">{currentSession.incompleteActionNote}</span>
                      </div>
                    )}
                    {currentSession.incompleteReviewedAt && (
                      <div className="text-[10px] text-[var(--color-text-subtle)] font-mono pt-0.5">
                        พิจารณาเมื่อ {fmtDate(currentSession.incompleteReviewedAt)} {fmtTime(currentSession.incompleteReviewedAt)}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 sm:p-4 mb-4 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-800 text-xs space-y-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/60 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 flex items-center justify-center shrink-0 mt-0.5">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h3 className="font-bold text-amber-950 dark:text-amber-200 text-sm">
                          พนักงานจบกะการทำงานโดยมีรายการค้างคา
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-200 dark:bg-amber-900 text-amber-950 dark:text-amber-100 border border-amber-300 dark:border-amber-700">
                          รอพิจารณามาตรการ
                        </span>
                      </div>
                      <div className="mt-2 p-2.5 rounded-xl bg-[var(--color-surface)] border border-amber-200 dark:border-amber-900/60 text-xs">
                        <span className="font-bold text-amber-800 dark:text-amber-300 block mb-0.5">เหตุผลที่ระบุจากพนักงาน:</span>
                        <p className="font-medium text-[var(--color-text)] italic break-words">
                          &ldquo;{currentSession.incompleteReason || "ไม่ได้ระบุเหตุผล"}&rdquo;
                        </p>
                      </div>
                    </div>
                  </div>

                  {canReviewIncomplete && reviewerId ? (
                    <div className="pt-2 border-t border-amber-200/80 dark:border-amber-800/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-950 dark:text-amber-100 text-xs flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span>เลือกมาตรการสำหรับกรณีนี้ ({approveRoleTitle}):</span>
                        </span>
                      </div>

                      {/* 3 Options Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {/* 1. No Penalty */}
                        <button
                          type="button"
                          onClick={() => setIncompleteAction("no_penalty")}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            incompleteAction === "no_penalty"
                              ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs"
                              : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-emerald-300"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">🛡️</span>
                            <div className="min-w-0">
                              <span className="font-bold text-xs text-[var(--color-text)] block">
                                อนุโลม / ไม่ลงโทษ
                              </span>
                              <span className="text-[10px] text-[var(--color-text-muted)] line-clamp-1">
                                มีเหตุจำเป็น รักษาสิทธิ์และสตรีค
                              </span>
                            </div>
                          </div>
                        </button>

                        {/* 2. Deduct Points */}
                        <button
                          type="button"
                          onClick={() => setIncompleteAction("deduct_points")}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            incompleteAction === "deduct_points"
                              ? "bg-amber-50 dark:bg-amber-950/60 border-amber-500 ring-2 ring-amber-500/20 shadow-xs"
                              : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-amber-300"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">🎯</span>
                            <div className="min-w-0">
                              <span className="font-bold text-xs text-[var(--color-text)] block">
                                หักคะแนนประเมิน
                              </span>
                              <span className="text-[10px] text-[var(--color-text-muted)] line-clamp-1">
                                ตัดคะแนนสะสมของพนักงาน
                              </span>
                            </div>
                          </div>
                        </button>

                        {/* 3. Break Streak */}
                        <button
                          type="button"
                          onClick={() => setIncompleteAction("break_streak")}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            incompleteAction === "break_streak"
                              ? "bg-rose-50 dark:bg-rose-950/60 border-rose-500 ring-2 ring-rose-500/20 shadow-xs"
                              : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-rose-300"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">⚡</span>
                            <div className="min-w-0">
                              <span className="font-bold text-xs text-[var(--color-text)] block">
                                ตัดสตรีคเป็น 0
                              </span>
                              <span className="text-[10px] text-[var(--color-text-muted)] line-clamp-1">
                                รีเซ็ตสตรีคทำงานต่อเนื่อง
                              </span>
                            </div>
                          </div>
                        </button>
                      </div>

                      {/* Deduct Points input if selected */}
                      {incompleteAction === "deduct_points" && (
                        <div className="flex items-center gap-2 bg-[var(--color-surface)] p-2.5 rounded-xl border border-[var(--color-border)]">
                          <label className="text-xs font-semibold text-[var(--color-text)]">
                            จำนวนคะแนนที่ต้องการหัก:
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={pointsToDeduct}
                            onChange={(e) => setPointsToDeduct(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-20 px-2 py-1 border rounded-lg text-xs font-mono font-bold bg-[var(--color-surface-2)] text-[var(--color-text)] focus:ring-2 focus:ring-amber-400 outline-none"
                          />
                          <span className="text-xs text-[var(--color-text-muted)]">คะแนน</span>
                        </div>
                      )}

                      {/* Notes */}
                      <div>
                        <label className="text-[11px] font-semibold text-[var(--color-text)] block mb-1">
                          หมายเหตุหรือข้อความถึงพนักงาน (ไม่บังคับ):
                        </label>
                        <textarea
                          value={incompleteNote}
                          onChange={(e) => setIncompleteNote(e.target.value)}
                          placeholder="ระบุเหตุผลในการตัดสินใจ หรือข้อตักเตือนเพิ่มเติม..."
                          rows={2}
                          className="w-full text-xs p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] resize-none focus:ring-2 focus:ring-amber-400 outline-none"
                        />
                      </div>

                      {reviewFeedback && (
                        <div
                          className={`p-2.5 rounded-xl text-xs font-semibold ${
                            reviewFeedback.type === "success"
                              ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800"
                              : "bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-800"
                          }`}
                        >
                          {reviewFeedback.message}
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={isSubmittingReview}
                        onClick={handleReviewIncomplete}
                        className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-amber-950 font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        {isSubmittingReview ? (
                          <span>กำลังบันทึกผลการพิจารณา...</span>
                        ) : (
                          <>
                            <span>ยืนยันผลการพิจารณามาตรการ</span>
                            <ShieldCheck className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 italic">
                      (รอผู้จัดการร้านหรือผู้ช่วยผู้จัดการร้านดำเนินการพิจารณามาตรการ)
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Late Tasks Alert Summary */}
          {(() => {
            const lateItems = currentSession.items.filter((item) => {
              if (item.isLate || item.comment) return true;
              if (item.completedAt && item.category) {
                const match = item.category.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
                if (match) {
                  const [endHr, endMin] = match[2].split(':').map(Number);
                  const completedDate = new Date(item.completedAt);
                  const deadlineDate = new Date(currentSession.startedAt);
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
            {currentSession.items.map((item, idx) => {
              const prevItem = idx > 0 ? currentSession.items[idx - 1] : null;
              const showCat = item.category && (!prevItem || prevItem.category !== item.category);

              let isLate = item.isLate ?? false;
              if (!isLate && item.completedAt && item.category) {
                const match = item.category.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
                if (match) {
                  const endStr = match[2];
                  const [endHr, endMin] = endStr.split(':').map(Number);
                  const completedDate = new Date(item.completedAt);
                  const deadlineDate = new Date(currentSession.startedAt);
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
              disabled={isApproving}
              onClick={() => setShowApprovalPrompt(true)}
              className="w-full min-h-[44px] py-3 sm:py-2.5 px-4 bg-[var(--color-brown)] hover:bg-[var(--color-brown-light)] disabled:opacity-60 text-amber-100 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2"
            >
              {isApproving ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-amber-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <span>กำลังดำเนินการรับรองผล...</span>
                </>
              ) : (
                <>
                  <span>รับรองผลการตรวจงาน ({approveRoleTitle})</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </>
              )}
            </button>
          </div>
        )}

        {isApproved && (
          <div className="mt-5 pt-4 border-t border-[var(--color-border)]">
            <div className="w-full min-h-[44px] py-2.5 px-4 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>รับรองผลการตรวจงานเรียบร้อยแล้ว ({approveRoleTitle})</span>
            </div>
          </div>
        )}
      </div>

      {/* ─── Approval Prompt Modal (Standard vs Exception) ─── */}
      {showApprovalPrompt && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[60] px-4 animate-in fade-in duration-150"
          onClick={() => !isApproving && setShowApprovalPrompt(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="approval-prompt-title"
            className="bg-[var(--color-surface)] border-2 border-[var(--color-border)] rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 flex items-center justify-center shrink-0">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h3 id="approval-prompt-title" className="text-base font-bold text-[var(--color-text)]">
                  เลือกรูปแบบการอนุมัติกะงาน ({approveRoleTitle})
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  พนักงาน: <span className="font-semibold text-[var(--color-text)]">{currentSession.userName}</span>
                </p>
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              {/* Option 1: Standard Approval */}
              <button
                type="button"
                disabled={isApproving}
                onClick={() => {
                  setShowApprovalPrompt(false);
                  onApprove?.(currentSession.id, false);
                }}
                className="w-full text-left p-3.5 rounded-xl border border-[var(--color-border)] hover:border-amber-500 bg-[var(--color-surface-2)] hover:bg-amber-500/5 transition-all cursor-pointer group disabled:opacity-60"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--color-text)] group-hover:text-amber-600 flex items-center gap-1.5">
                    <span>✓ อนุมัติตามปกติ (Standard Approval)</span>
                  </span>
                  <span className="text-[10px] font-mono text-[var(--color-text-muted)]">เกณฑ์ปกติ</span>
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                  คำนวณคะแนนตามผลการตรวจจริง (หากมีรายการล่าช้า สตรีคจะถูกรีเซ็ตเป็น 0)
                </p>
              </button>

              {/* Option 2: Exception Approval (อนุโลม) */}
              <button
                type="button"
                disabled={isApproving}
                onClick={() => {
                  setShowApprovalPrompt(false);
                  onApprove?.(currentSession.id, true);
                }}
                className="w-full text-left p-3.5 rounded-xl border-2 border-amber-500/70 hover:border-amber-500 bg-amber-500/10 hover:bg-amber-500/15 transition-all cursor-pointer group shadow-xs disabled:opacity-60"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                    <span>🛡️ อนุมัติแบบอนุโลม (Exception Approval)</span>
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-amber-950">
                    รักษาสตรีค
                  </span>
                </div>
                <p className="text-[11px] text-amber-900 dark:text-amber-300 mt-1 leading-relaxed">
                  ให้สิทธิประโยชน์รักษาสตรีคต่อเนื่อง โดยปรับสถานะเป็น <strong className="font-bold underline">Flawed (มีข้อบกพร่อง/อนุโลม)</strong> แทนที่จะถูกตัดสตรีคเป็น 0
                </p>
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                disabled={isApproving}
                onClick={() => setShowApprovalPrompt(false)}
                className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer disabled:opacity-60"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
