export type Role = "employee" | "manager" | "manager_assistant" | "committee" | "general_manager" | "admin";
export type ShiftType = "morning" | "afternoon" | "both";
export type LeaveType = "paid" | "unpaid" | "ลาเเบบได้เงิน" | "ลาเเบบไม่ได้รับเงิน" | "ลาแบบได้เงิน" | "ลาแบบไม่ได้รับเงิน" | "sick" | "personal" | "other";

export interface EmployeeLeave {
  id: string;
  userId: string;
  userName?: string;
  userPosition?: string;
  branchId: string;
  branchName?: string;
  leaveType: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason: string;
  preserveStreak: boolean;
  previousStreak?: number;
  recordedBy: string;
  recordedByName?: string;
  recordedByRole?: Role;
  status?: "pending" | "approved" | "rejected";
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface LeaveQuotaInfo {
  userId: string;
  branchId?: string;
  allocatedQuota: number;
  branchDefaultQuota: number;
  customQuota: number | null;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
}

export interface Position {
  id: string;
  name: string;
}

export interface User {
  id: string;
  name: string;
  username?: string;
  password?: string;
  role: Role;
  position?: string;
  branchName?: string;
  branchId?: string;
  leaveQuota?: number | null;
  point?: number;
  pointStreak?: number;
  pointStreakType?: "none" | "flawed" | "perfect";
  longestStreak?: number;
}

export interface ChecklistItem {
  id: string;
  label: string;
  category?: string;
  completedAt: string | null;
  completedBy?: string | null;
  completedByName?: string | null;
  taskWorkId?: string;
  isLate?: boolean;
  comment?: string | null;
  isSpecial?: boolean;
  zeroPoints?: boolean;
}

export interface ShiftSession {
  id: string;
  userId: string;
  userName: string;
  userPosition?: string;
  taskRole?: "cashier" | "stock" | "manager_assistant";
  shift: ShiftType;
  startedAt: string;
  completedAt: string | null;
  items: ChecklistItem[];
  notified: boolean;
  branchName?: string;
  incompleteReason?: string | null;
  incompleteStatus?: "none" | "pending_review" | "reviewed";
  incompleteAction?: "no_penalty" | "deduct_points" | "break_streak" | "deduct_leave_quota" | string | null;
  incompleteActionPoints?: number;
  incompleteActionNote?: string | null;
  incompleteReviewedBy?: string | null;
  incompleteReviewedByName?: string | null;
  incompleteReviewedAt?: string | null;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "shift_submitted" | "shift_approved" | "point_awarded" | "refrigerator_alert" | "system" | string;
  shiftSessionId?: string;
  userName?: string;
  userPosition?: string;
  shift?: ShiftType;
  completedAt?: string;
  createdAt: string;
  read: boolean;
  branchName?: string;
}

export interface PointTransaction {
  id: string;
  userId: string;
  points: number;
  type: "shift_completion" | "on_time_bonus" | "perfect_shift" | "streak_bonus" | "manager_award" | string;
  shiftSessionId?: string;
  description: string;
  createdAt: string;
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  role: Role;
  position?: string;
  branchName?: string;
  point: number;
  pointStreak: number;
  pointStreakType: "none" | "flawed" | "perfect";
}

export const STAFF_POSITIONS = [
  "แคชเชียร์",
  "พนักงานสต็อก/จัดเรียง",
];

export const MANAGEMENT_POSITIONS = [
  "ผู้ช่วยผู้จัดการร้าน",
  "ผู้จัดการร้าน",
  "กรรมการ",
];

export const DEFAULT_POSITIONS: Position[] = [
  { id: "pos-1", name: "แคชเชียร์" },
  { id: "pos-2", name: "พนักงานสต็อก/จัดเรียง" },
  { id: "pos-3", name: "ผู้ช่วยผู้จัดการร้าน" },
  { id: "pos-4", name: "ผู้จัดการร้าน" },
  { id: "pos-5", name: "กรรมการ" },
];
