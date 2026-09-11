import { ShiftType, User } from "../../types";
import { MANAGEMENT_POSITIONS, STAFF_POSITIONS, getChecklistTemplate } from "../../data/checklists";
import { Badge } from "../common/Badge";

export function PositionSelectPage({
  user,
  shift,
  onSelectPosition,
  onBack,
  onLogout,
}: {
  user: User;
  shift: ShiftType;
  onSelectPosition: (position: string) => void;
  onBack: () => void;
  onLogout: () => void;
}) {
  const isMorning = shift === "morning";
  const isAfternoon = shift === "afternoon";
  const shiftTitle = isMorning ? "กะเช้า" : isAfternoon ? "กะบ่าย" : "กะควบ (2 กะ)";
  const shiftHours = isMorning ? "08:00 – 16:00" : isAfternoon ? "16:00 – 00:00" : "08:00 – 00:00";

  const availablePositions = user.role === "manager" ? MANAGEMENT_POSITIONS : STAFF_POSITIONS;

  return (
    <div className="min-h-screen bg-slate-50/60 flex flex-col justify-between px-4 py-6 sm:py-10">
      {/* Top Header Card */}
      <header className="w-full max-w-4xl mx-auto mb-6 flex items-center justify-between gap-4 p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="w-9 h-9 rounded-xl border border-slate-300 hover:border-slate-500 hover:bg-slate-50 flex items-center justify-center text-slate-700 transition-all cursor-pointer"
            title="ย้อนกลับไปเลือกกะ"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-slate-900">{user.name}</h1>
            <p className="text-[11px] text-slate-600 font-medium">
              กะที่เลือก: <span className="font-bold text-slate-900">{shiftTitle} ({shiftHours})</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="text-xs text-slate-600 hover:text-red-700 transition-colors px-3 py-1.5 rounded-xl border border-slate-300 hover:border-red-300 hover:bg-red-50/40 font-semibold cursor-pointer"
        >
          ออกจากระบบ
        </button>
      </header>

      {/* Main Section */}
      <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col items-center justify-center py-4">
        {/* Step Indicator & Title */}
        <div className="text-center mb-8">
          <span className="inline-block text-[11px] font-bold text-slate-700 tracking-wider uppercase bg-slate-100 border border-slate-300 px-3 py-1 rounded-full mb-3">
            ขั้นตอนที่ 2 จาก 2 • เลือกตำแหน่งหน้าที่
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            เลือกตำแหน่งงาน
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-md mx-auto">
            เลือกหน้าที่ที่คุณปฏิบัติงานในกะนี้ เพื่อเริ่มต้นตรวจเช็คงาน
          </p>
        </div>

        {/* Position Cards Grid */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
          {availablePositions.map((pos) => {
            const isCashier = pos === "แคชเชียร์";
            const itemCount = getChecklistTemplate(pos, shift).length;
            const cardTheme = isCashier
              ? {
                  hoverBorder: "hover:border-emerald-300 hover:shadow-[0_12px_28px_-6px_rgba(16,185,129,0.15)]",
                  iconBox: "bg-emerald-50 border-emerald-200/80 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-600",
                  btnHover: "group-hover:bg-emerald-600",
                  badgeColor: "green" as const,
                }
              : {
                  hoverBorder: "hover:border-sky-300 hover:shadow-[0_12px_28px_-6px_rgba(2,132,199,0.15)]",
                  iconBox: "bg-sky-50 border-sky-200/80 text-sky-700 group-hover:bg-sky-600 group-hover:text-white group-hover:border-sky-600",
                  btnHover: "group-hover:bg-sky-600",
                  badgeColor: "blue" as const,
                };

            return (
              <div
                key={pos}
                role="button"
                tabIndex={0}
                aria-label={`เลือกหน้าที่ ${pos} (${itemCount} รายการเช็คลิสต์)`}
                onClick={() => onSelectPosition(pos)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectPosition(pos);
                  }
                }}
                className={`group bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs ${cardTheme.hoverBorder} focus-visible:outline-none focus:ring-3 focus:ring-slate-950/10 hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between cursor-pointer`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center transition-all ${cardTheme.iconBox}`}>
                      {isCashier ? (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="2" y="4" width="20" height="16" rx="2" />
                          <line x1="2" y1="10" x2="22" y2="10" />
                          <circle cx="7" cy="15" r="1" />
                          <circle cx="12" cy="15" r="1" />
                          <circle cx="17" cy="15" r="1" />
                        </svg>
                      ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                          <line x1="12" y1="22.08" x2="12" y2="12" />
                        </svg>
                      )}
                    </div>

                    <Badge color={cardTheme.badgeColor}>
                      {itemCount} รายการเช็คลิสต์
                    </Badge>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-2">
                    {pos}
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                    {isCashier
                      ? "รับผิดชอบงานจุดชำระเงิน ตรวจสอบระบบแคชเชียร์ นับเงินทอน และดูแลบริการลูกค้าหน้าร้าน"
                      : "รับผิดชอบการจัดเรียงสินค้า ตรวจนับสต็อก เติมสินค้าตู้แช่ และตรวจสอบความสดใหม่"}
                  </p>

                  <div className="space-y-2 py-3 border-t border-slate-100 text-xs text-slate-700">
                    {isCashier ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                          <span>ตรวจเงินสด ลิ้นชัก และอุปกรณ์รับชำระ</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                          <span>ดูแลความสะอาดรอบจุดเคาน์เตอร์</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-500" aria-hidden="true" />
                          <span>ตรวจรับสินค้าสดและเติมตู้แช่</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-500" aria-hidden="true" />
                          <span>ตรวจเช็คป้ายราคาและวันหมดอายุ</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Bottom Action Indicator */}
                <div className="mt-6 pt-4 border-t border-slate-100">
                  <div
                    aria-hidden="true"
                    className={`w-full py-2.5 px-4 rounded-xl bg-slate-900 ${cardTheme.btnHover} active:bg-black text-white text-xs sm:text-sm font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_1px_2px_rgba(0,0,0,0.1)] transition-all flex items-center justify-center gap-2 select-none`}
                  >
                    <span>เลือกหน้าที่{pos}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-1 transition-transform">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Back link */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-slate-600 hover:text-slate-900 font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span>ต้องการเปลี่ยนกะ? กลับไปเลือกกะ</span>
          </button>
        </div>
      </div>

      <footer className="text-center text-[11px] text-slate-500 font-medium py-2">
        Eater Egg Fresh Mart • Checklist System
      </footer>
    </div>
  );
}
