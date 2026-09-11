export function BrandLogo({
  size = 36,
  showText = false,
  subtitle = "",
}: {
  size?: number;
  showText?: boolean;
  subtitle?: string;
}) {
  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      <div
        style={{ width: size, height: size }}
        className="rounded-xl bg-slate-950 text-white flex items-center justify-center shadow-xs ring-1 ring-white/10 shrink-0 relative overflow-hidden"
      >
        <svg
          width={Math.round(size * 0.62)}
          height={Math.round(size * 0.62)}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          {/* Stylized Egg Outline */}
          <path
            d="M12 2C7.5 2 4 6.5 4 13.5C4 18.2 7.6 22 12 22C16.4 22 20 18.2 20 13.5C20 6.5 16.5 2 12 2Z"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Golden Yolk Core */}
          <circle cx="12" cy="14" r="3.5" fill="#F59E0B" />
          {/* Fresh Leaf Accent */}
          <path
            d="M12 2C13.5 4 16 5 16 5"
            stroke="#10B981"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
      {showText && (
        <div className="text-left">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold tracking-tight text-slate-900 text-sm sm:text-base">
              Eater Egg
            </span>
            <span className="text-xs font-bold text-amber-600 tracking-wide uppercase px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200/80">
              Fresh Mart
            </span>
          </div>
          {subtitle ? (
            <p className="text-[11px] text-slate-500 font-medium">{subtitle}</p>
          ) : (
            <p className="text-[11px] text-slate-500 font-medium">
              ระบบบริหารและบันทึกการปฏิบัติงานประจำกะ
            </p>
          )}
        </div>
      )}
    </div>
  );
}
