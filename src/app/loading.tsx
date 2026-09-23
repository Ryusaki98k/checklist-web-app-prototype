import { BrandLogo } from "../components/common/BrandLogo";

export function LoadingSpinner({
  text = "กำลังโหลด Eater Egg Fresh Mart...",
  subtitle = "กรุณารอสักครู่ ระบบกำลังประมวลผลข้อมูล",
  compact = false,
}: {
  text?: string;
  subtitle?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-4 text-[var(--color-text)]">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        <p className="text-xs font-semibold text-[var(--color-text)]">{text}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] text-[var(--color-text)] font-sans relative overflow-hidden select-none p-4">
      {/* Subtle Ambient Glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/15 dark:bg-amber-500/10 rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      <div className="flex flex-col items-center gap-4 p-7 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-xl relative z-10 max-w-xs text-center">
        {/* Animated Brand Emblem */}
        <div className="relative">
          <div className="absolute -inset-2 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
          <BrandLogo size={42} showText={false} />
        </div>

        {/* Text */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-500 border-t-transparent shrink-0" />
            <p className="text-sm sm:text-base font-bold text-[var(--color-text)]">{text}</p>
          </div>
          {subtitle && (
            <p className="text-xs text-[var(--color-text-muted)] font-medium">{subtitle}</p>
          )}
        </div>

        {/* Animated bounce dots */}
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce [animation-delay:-0.3s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce [animation-delay:-0.15s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" />
        </div>
      </div>
    </div>
  );
}

export default function Loading() {
  return <LoadingSpinner />;
}
