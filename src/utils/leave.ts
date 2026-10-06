import { LeaveType } from "../types";

export function isPaidLeave(type?: string | null): boolean {
  if (!type) return false;
  return type === "paid" || type === "ลาเเบบได้เงิน" || type === "ลาแบบได้เงิน";
}

export function isUnpaidLeave(type?: string | null): boolean {
  if (!type) return false;
  return type === "unpaid" || type === "ลาเเบบไม่ได้รับเงิน" || type === "ลาแบบไม่ได้รับเงิน";
}

export function getLeaveTypeLabel(type?: string | null): string {
  if (isPaidLeave(type)) return "ลาเเบบได้เงิน";
  if (isUnpaidLeave(type)) return "ลาเเบบไม่ได้รับเงิน";
  return "ลาเเบบได้เงิน";
}

/**
 * Ensures any input leave type (Thai string or English) is cleanly mapped to
 * the exact PostgreSQL enum value ('paid' | 'unpaid') for database persistence.
 */
export function toDbLeaveType(type?: string | null): "paid" | "unpaid" {
  if (isUnpaidLeave(type)) return "unpaid";
  return "paid";
}

export const LEAVE_TYPE_OPTIONS: Array<{ value: LeaveType; label: string; desc: string; badge: string }> = [
  {
    value: "paid",
    label: "ลาเเบบได้เงิน",
    desc: "ได้รับค่าจ้างตามปกติ เช่น ลาป่วยมีใบรับรอง, ลาพักร้อนประจำปี",
    badge: "ได้รับค่าจ้าง",
  },
  {
    value: "unpaid",
    label: "ลาเเบบไม่ได้รับเงิน",
    desc: "ไม่ได้รับค่าจ้าง (Leave without pay) เช่น ลากิจส่วนตัว, ลาไม่มีค่าจ้าง",
    badge: "ไม่ได้รับค่าจ้าง",
  },
];
