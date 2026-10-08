/**
 * Thailand (Asia/Bangkok) Date Utilities
 * Ensures consistent day-boundary and today-comparison logic across Client and Server.
 */

export function getThaiDateString(baseDate: Date | string | number = new Date()): string {
  try {
    const d = typeof baseDate === "string" || typeof baseDate === "number" ? new Date(baseDate) : baseDate;
    if (isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(d);
  } catch {
    return "";
  }
}

export function isTodayThai(dateInput: Date | string | number | null | undefined): boolean {
  if (!dateInput) return false;
  try {
    const today = getThaiDateString();
    const target = getThaiDateString(dateInput);
    return Boolean(today && target && today === target);
  } catch {
    return false;
  }
}

export function getThaiStartAndEndOfDay(baseDate: Date | string | number = new Date()) {
  const d = typeof baseDate === "string" || typeof baseDate === "number" ? new Date(baseDate) : baseDate;
  const yElement = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric" }).format(d);
  const mElement = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", month: "2-digit" }).format(d);
  const dElement = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", day: "2-digit" }).format(d);

  const startStr = `${yElement}-${mElement}-${dElement}T00:00:00+07:00`;
  const endStr = `${yElement}-${mElement}-${dElement}T23:59:59.999+07:00`;

  return {
    startOfDay: new Date(startStr),
    endOfDay: new Date(endStr),
    dateStr: `${yElement}-${mElement}-${dElement}`,
  };
}

export function getThaiWeekRange(baseDate: Date | string | number = new Date()): {
  weekStartDate: string; // YYYY-MM-DD of Monday
  weekEndDate: string;   // YYYY-MM-DD of Sunday
} {
  try {
    const d = typeof baseDate === "string" || typeof baseDate === "number" ? new Date(baseDate) : baseDate;
    const thaiDateStr = getThaiDateString(d);
    if (!thaiDateStr) {
      return { weekStartDate: "", weekEndDate: "" };
    }
    const [year, month, day] = thaiDateStr.split("-").map(Number);
    const utcDate = new Date(Date.UTC(year, month - 1, day));
    const dayOfWeek = utcDate.getUTCDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday

    // Distance to Monday: If Sunday (0), Monday was 6 days ago (-6). Otherwise, 1 - dayOfWeek.
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(utcDate);
    monday.setUTCDate(utcDate.getUTCDate() + diffToMonday);

    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);

    const formatYmd = (dateObj: Date) => {
      const y = dateObj.getUTCFullYear();
      const m = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
      const dayStr = String(dateObj.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${dayStr}`;
    };

    return {
      weekStartDate: formatYmd(monday),
      weekEndDate: formatYmd(sunday),
    };
  } catch {
    return { weekStartDate: "", weekEndDate: "" };
  }
}

