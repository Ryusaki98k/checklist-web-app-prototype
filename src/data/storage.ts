import { Notification, Position, ShiftSession, ShiftType, User } from "../types";
import { DEFAULT_POSITIONS, getChecklistTemplate } from "./checklists";

export function getPositions(): Position[] {
  if (typeof window === "undefined") return DEFAULT_POSITIONS;
  try {
    const raw = localStorage.getItem("app_positions_v3");
    if (!raw) {
      localStorage.setItem("app_positions_v3", JSON.stringify(DEFAULT_POSITIONS));
      return DEFAULT_POSITIONS;
    }
    const current: Position[] = JSON.parse(raw);
    let updated = false;
    for (const def of DEFAULT_POSITIONS) {
      if (!current.some((p) => p.name === def.name)) {
        current.push(def);
        updated = true;
      }
    }
    if (updated) {
      localStorage.setItem("app_positions_v3", JSON.stringify(current));
    }
    return current;
  } catch {
    return DEFAULT_POSITIONS;
  }
}

export function savePositions(positions: Position[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem("app_positions_v3", JSON.stringify(positions));
}

export function getUsers(): User[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("app_users") ?? "[]");
  } catch {
    return [];
  }
}

export function saveUsers(users: User[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem("app_users", JSON.stringify(users));
}

export function getSessions(): ShiftSession[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("app_sessions") ?? "[]");
  } catch {
    return [];
  }
}

export function saveSessions(sessions: ShiftSession[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem("app_sessions", JSON.stringify(sessions));
}

export function getNotifications(): Notification[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("app_notifications") ?? "[]");
  } catch {
    return [];
  }
}

export function saveNotifications(notifs: Notification[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem("app_notifications", JSON.stringify(notifs));
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}

export function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

export function seedSampleData(force = false) {
  if (typeof window === "undefined") return;
  let users = getUsers();
  let sessions = getSessions();
  let notifs = getNotifications();

  const hasDirtyUsers = users.some((u) => u.name === "sdsd" || u.name === "ผู้จัดการร้าน");
  const needsUsers = force || hasDirtyUsers || users.length < 5 || !users.some((u) => u.email === "director@factory.com");

  if (needsUsers) {
    users = [
      { id: "u-manager", name: "คุณวิภาดา สุขเจริญ", email: "manager@factory.com", password: "manager123", role: "manager", position: "ผู้จัดการร้าน" },
      { id: "u-director", name: "คุณกิตติศักดิ์ พัฒนกิจ", email: "director@factory.com", password: "director123", role: "manager", position: "กรรมการ" },
      { id: "u-asst", name: "คุณธนากร เกียรติไพบูลย์", email: "assistant@factory.com", password: "123", role: "manager", position: "ผู้ช่วยผู้จัดการร้าน" },
      { id: "u-cashier", name: "สมศรี ใจดี", email: "cashier@factory.com", password: "123", role: "employee", position: "แคชเชียร์" },
      { id: "u-stock", name: "สมชาย มั่นคง", email: "stock@factory.com", password: "123", role: "employee", position: "พนักงานสต็อก/จัดเรียง" },
      { id: "u-qc", name: "กัญญาภัทร พิมพา", email: "kanya@factory.com", password: "123", role: "employee", position: "แคชเชียร์" },
      { id: "u-tech", name: "ศุภชัย มีสุข", email: "suphachai@factory.com", password: "123", role: "employee" },
    ];
    saveUsers(users);
  }

  const hasDirtySessions = sessions.some((s) => s.userName === "sdsd" || s.userName === "ผู้จัดการร้าน");
  const needsSessions = force || hasDirtySessions || sessions.length === 0 || !sessions.some((s) => s.id === "sess-sample-1");

  if (needsSessions) {
    const now = new Date();
    const morningStart = new Date(now);
    morningStart.setHours(7, 30, 0, 0);
    const morningEnd = new Date(now);
    morningEnd.setHours(15, 30, 0, 0);

    const afternoonStart = new Date(now);
    afternoonStart.setHours(14, 0, 0, 0);

    const yesterdayStart = new Date(now.getTime() - 86400000);
    yesterdayStart.setHours(7, 0, 0, 0);
    const yesterdayEnd = new Date(now.getTime() - 86400000);
    yesterdayEnd.setHours(16, 0, 0, 0);

    const cashierTemplate = getChecklistTemplate("แคชเชียร์", "morning");
    const cashierItems = cashierTemplate.map((item, idx) => ({
      ...item,
      completedAt: new Date(morningStart.getTime() + (idx + 1) * 25 * 60000).toISOString(),
    }));

    const stockTemplate = getChecklistTemplate("พนักงานสต็อก/จัดเรียง", "afternoon");
    const stockItems = stockTemplate.map((item, idx) => ({
      ...item,
      completedAt: idx < 6 ? new Date(afternoonStart.getTime() + (idx + 1) * 20 * 60000).toISOString() : null,
    }));

    const asstTemplate = getChecklistTemplate("ผู้ช่วยผู้จัดการร้าน", "morning");
    const asstItems = asstTemplate.map((item, idx) => ({
      ...item,
      completedAt: new Date(yesterdayStart.getTime() + (idx + 1) * 30 * 60000).toISOString(),
    }));

    sessions = [
      {
        id: "sess-sample-1",
        userId: "u-cashier",
        userName: "สมศรี ใจดี",
        userPosition: "แคชเชียร์",
        shift: "morning",
        startedAt: morningStart.toISOString(),
        completedAt: morningEnd.toISOString(),
        items: cashierItems,
        notified: true,
      },
      {
        id: "sess-sample-2",
        userId: "u-stock",
        userName: "สมชาย มั่นคง",
        userPosition: "พนักงานสต็อก/จัดเรียง",
        shift: "afternoon",
        startedAt: afternoonStart.toISOString(),
        completedAt: null,
        items: stockItems,
        notified: false,
      },
      {
        id: "sess-sample-3",
        userId: "u-asst",
        userName: "คุณธนากร เกียรติไพบูลย์",
        userPosition: "ผู้ช่วยผู้จัดการร้าน",
        shift: "morning",
        startedAt: yesterdayStart.toISOString(),
        completedAt: yesterdayEnd.toISOString(),
        items: asstItems,
        notified: true,
      },
    ];
    saveSessions(sessions);
  }

  const hasDirtyNotifs = notifs.some((n) => n.userName === "sdsd" || n.userName === "ผู้จัดการร้าน");
  const needsNotifs = force || hasDirtyNotifs || notifs.length === 0 || !notifs.some((n) => n.id === "notif-1");

  if (needsNotifs) {
    const now = new Date();
    notifs = [
      {
        id: "notif-1",
        shiftSessionId: "sess-sample-1",
        userName: "สมศรี ใจดี",
        userPosition: "แคชเชียร์",
        shift: "morning",
        completedAt: new Date(now.getTime() - 15 * 60000).toISOString(),
        read: false,
      },
      {
        id: "notif-2",
        shiftSessionId: "sess-sample-3",
        userName: "คุณธนากร เกียรติไพบูลย์",
        userPosition: "ผู้ช่วยผู้จัดการร้าน",
        shift: "morning",
        completedAt: new Date(now.getTime() - 24 * 3600000).toISOString(),
        read: true,
      },
    ];
    saveNotifications(notifs);
  }
}

export function ensureDefaultManager() {
  if (typeof window === "undefined") return;
  seedSampleData(false);
  getPositions();
}

export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("app_current_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveCurrentUser(user: User | null) {
  if (typeof window === "undefined") return;
  if (user) {
    localStorage.setItem("app_current_user", JSON.stringify(user));
  } else {
    localStorage.removeItem("app_current_user");
  }
}

export function getSelectedShift(): ShiftType | null {
  if (typeof window === "undefined") return null;
  return (localStorage.getItem("app_selected_shift") as ShiftType) || null;
}

export function saveSelectedShift(shift: ShiftType | null) {
  if (typeof window === "undefined") return;
  if (shift) {
    localStorage.setItem("app_selected_shift", shift);
  } else {
    localStorage.removeItem("app_selected_shift");
  }
}

export function getActiveSession(): ShiftSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("app_active_session");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveActiveSession(session: ShiftSession | null) {
  if (typeof window === "undefined") return;
  if (session) {
    localStorage.setItem("app_active_session", JSON.stringify(session));
  } else {
    localStorage.removeItem("app_active_session");
  }
}
