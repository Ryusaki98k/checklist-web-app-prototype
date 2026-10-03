import { Notification, Position, ShiftSession, ShiftType, User, EmployeeLeave } from "../types";
import { DEFAULT_POSITIONS } from "../types";
import { secureGetItem, secureSetItem, secureRemoveItem } from "../utils/crypto";
import { getThaiDateString, isTodayThai } from "../utils/date";

export { getThaiDateString, isTodayThai };


export function getPositions(): Position[] {
  if (typeof window === "undefined") return DEFAULT_POSITIONS;
  try {
    const raw = secureGetItem("app_positions_v3");
    if (!raw) {
      secureSetItem("app_positions_v3", JSON.stringify(DEFAULT_POSITIONS));
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
      secureSetItem("app_positions_v3", JSON.stringify(current));
    }
    return current;
  } catch {
    return DEFAULT_POSITIONS;
  }
}

export function savePositions(positions: Position[]) {
  if (typeof window === "undefined") return;
  secureSetItem("app_positions_v3", JSON.stringify(positions));
}

export function getUsers(): User[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(secureGetItem("app_users") ?? "[]");
  } catch {
    return [];
  }
}

export function saveUsers(users: User[]) {
  if (typeof window === "undefined") return;
  secureSetItem("app_users", JSON.stringify(users));
}

export function getSessions(): ShiftSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = secureGetItem("app_sessions");
    if (!raw) return [];
    const list: ShiftSession[] = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    const todaySessions = list.filter((s) => s && s.startedAt && isTodayThai(s.startedAt));
    if (todaySessions.length !== list.length) {
      secureSetItem("app_sessions", JSON.stringify(todaySessions));
    }
    return todaySessions;
  } catch {
    return [];
  }
}

export function saveSessions(sessions: ShiftSession[]) {
  if (typeof window === "undefined") return;
  secureSetItem("app_sessions", JSON.stringify(sessions));
}

export function getNotifications(): Notification[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(secureGetItem("app_notifications") ?? "[]");
  } catch {
    return [];
  }
}

export function saveNotifications(notifs: Notification[]) {
  if (typeof window === "undefined") return;
  secureSetItem("app_notifications", JSON.stringify(notifs));
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
  return;
  let users = getUsers();
  let sessions = getSessions();
  let notifs = getNotifications();

  const hasDirtyUsers = users.some((u) => u.name === "sdsd" || u.name === "ผู้จัดการร้าน");
  const needsUsers = force || hasDirtyUsers || users.length < 5 || !users.some((u) => u.username === "admin");

  if (needsUsers) {
    users = [
      { id: "u-admin", name: "คุณสมเกียรติ บริหารกิจ", username: "admin", password: "admin123", role: "admin", position: "ผู้ดูแลระบบส่วนกลาง" },
      { id: "u-manager", name: "คุณวิภาดา สุขเจริญ", username: "manager", password: "manager123", role: "manager", position: "ผู้จัดการร้าน" },
      { id: "u-asst", name: "คุณธนากร เกียรติไพบูลย์", username: "assistant", password: "123", role: "manager_assistant", position: "ผู้ช่วยผู้จัดการร้าน" },
      { id: "u-director", name: "คุณกิตติศักดิ์ พัฒนกิจ", username: "director", password: "director123", role: "committee", position: "กรรมการ" },
      { id: "u-cashier", name: "สมศรี ใจดี", username: "cashier", password: "123", role: "employee", position: "แคชเชียร์" },
      { id: "u-stock", name: "สมชาย มั่นคง", username: "stock", password: "123", role: "employee", position: "พนักงานสต็อก/จัดเรียง" },
      { id: "u-qc", name: "กัญญาภัทร พิมพา", username: "kanya", password: "123", role: "employee", position: "แคชเชียร์" },
      { id: "u-tech", name: "ศุภชัย มีสุข", username: "suphachai", password: "123", role: "employee" },
    ];
    saveUsers(users);
  }

  const hasSessionsKey = secureGetItem("app_sessions") !== null;
  const needsSessions = force || !hasSessionsKey;

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



    sessions = [
      {
        id: "sess-sample-1",
        userId: "u-cashier",
        userName: "สมศรี ใจดี",
        userPosition: "แคชเชียร์",
        shift: "morning",
        startedAt: morningStart.toISOString(),
        completedAt: morningEnd.toISOString(),
        items: [],
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
        items: [],
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
        items: [],
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
        title: "ส่งมอบงานกะเช้าสำเร็จ",
        message: "สมศรี ใจดี ได้ส่งมอบงานกะเช้าเรียบร้อยแล้ว",
        type: "shift_submitted",
        shiftSessionId: "sess-sample-1",
        userName: "สมศรี ใจดี",
        userPosition: "แคชเชียร์",
        shift: "morning",
        completedAt: new Date(now.getTime() - 15 * 60000).toISOString(),
        createdAt: new Date(now.getTime() - 15 * 60000).toISOString(),
        read: false,
      },
      {
        id: "notif-2",
        title: "ส่งมอบงานกะเช้าสำเร็จ",
        message: "คุณธนากร เกียรติไพบูลย์ ได้ส่งมอบงานกะเช้าเรียบร้อยแล้ว",
        type: "shift_submitted",
        shiftSessionId: "sess-sample-3",
        userName: "คุณธนากร เกียรติไพบูลย์",
        userPosition: "ผู้ช่วยผู้จัดการร้าน",
        shift: "morning",
        completedAt: new Date(now.getTime() - 24 * 3600000).toISOString(),
        createdAt: new Date(now.getTime() - 24 * 3600000).toISOString(),
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
    const raw = secureGetItem("app_current_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveCurrentUser(user: User | null) {
  if (typeof window === "undefined") return;
  if (user) {
    secureSetItem("app_current_user", JSON.stringify(user));
  } else {
    secureRemoveItem("app_current_user");
  }
}

export function getSelectedShift(): ShiftType | null {
  if (typeof window === "undefined") return null;
  return (secureGetItem("app_selected_shift") as ShiftType) || null;
}

export function saveSelectedShift(shift: ShiftType | null) {
  if (typeof window === "undefined") return;
  if (shift) {
    secureSetItem("app_selected_shift", shift);
  } else {
    secureRemoveItem("app_selected_shift");
  }
}



export function getActiveSession(): ShiftSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = secureGetItem("app_active_session");
    if (!raw) return null;
    const parsed: ShiftSession = JSON.parse(raw);
    if (!parsed || !parsed.startedAt || !isTodayThai(parsed.startedAt)) {
      secureRemoveItem("app_active_session");
      secureRemoveItem("app_selected_shift");
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function evictDailyCache() {
  if (typeof window === "undefined") return;
  const keys = [
    "app_sessions",
    "app_active_session",
    "app_selected_shift",
    "app_queue_afternoon",
    "app_manager_read_notifs",
    "app_notifications",
    "cached_branches",
    "branch_last_update",
    "branches_last_checked_at",
  ];
  keys.forEach((k) => secureRemoveItem(k));
}

export function saveActiveSession(session: ShiftSession | null) {
  if (typeof window === "undefined") return;
  if (session) {
    secureSetItem("app_active_session", JSON.stringify(session));
  } else {
    secureRemoveItem("app_active_session");
  }
}

export function getLocalLeaves(): EmployeeLeave[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = secureGetItem("app_leaves");
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveLocalLeaves(leaves: EmployeeLeave[]) {
  if (typeof window === "undefined") return;
  secureSetItem("app_leaves", JSON.stringify(leaves));
}

