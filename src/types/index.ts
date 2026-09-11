export type Role = "employee" | "manager";
export type ShiftType = "morning" | "afternoon" | "both";

export interface Position {
  id: string;
  name: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: Role;
  position?: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  category?: string;
  completedAt: string | null;
}

export interface ShiftSession {
  id: string;
  userId: string;
  userName: string;
  userPosition?: string;
  shift: ShiftType;
  startedAt: string;
  completedAt: string | null;
  items: ChecklistItem[];
  notified: boolean;
}

export interface Notification {
  id: string;
  shiftSessionId: string;
  userName: string;
  userPosition?: string;
  shift: ShiftType;
  completedAt: string;
  read: boolean;
}
