import { ShiftType } from "../../types";

export function Badge({
  children,
  color = "muted",
  dot = true,
}: {
  children: React.ReactNode;
  color?: "green" | "amber" | "blue" | "muted" | "red";
  dot?: boolean;
}) {
  const styles = {
    green: {
      wrap: "bg-emerald-50/90 text-emerald-900 border-emerald-200/90 font-semibold",
      dot: "bg-emerald-600",
    },
    amber: {
      wrap: "bg-amber-50/90 text-amber-950 border-amber-200/90 font-semibold",
      dot: "bg-amber-600",
    },
    blue: {
      wrap: "bg-sky-50/90 text-sky-950 border-sky-200/90 font-semibold",
      dot: "bg-sky-600",
    },
    muted: {
      wrap: "bg-slate-100 text-slate-700 border-slate-200 font-medium",
      dot: "bg-slate-500",
    },
    red: {
      wrap: "bg-rose-50/90 text-rose-900 border-rose-200/90 font-semibold",
      dot: "bg-rose-600",
    },
  }[color];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs border font-mono tracking-tight ${styles.wrap}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${styles.dot}`} aria-hidden="true" />}
      {children}
    </span>
  );
}

export function getShiftBadge(shift: ShiftType) {
  if (shift === "morning") return <Badge color="amber">กะเช้า</Badge>;
  if (shift === "afternoon") return <Badge color="blue">กะบ่าย</Badge>;
  return <Badge color="muted">กะควบ</Badge>;
}

export function getShiftName(shift: ShiftType) {
  if (shift === "morning") return "กะเช้า";
  if (shift === "afternoon") return "กะบ่าย";
  return "กะควบ";
}

export function Divider() {
  return <div className="h-px bg-slate-200/80 w-full" />;
}
