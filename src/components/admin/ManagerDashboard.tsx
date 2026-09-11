import { useEffect, useState } from "react";
import { Notification, Position, ShiftSession, ShiftType, User } from "../../types";
import { getChecklistTemplate } from "../../data/checklists";
import {
  fmtDate,
  fmtTime,
  getNotifications,
  getPositions,
  getSessions,
  getUsers,
  saveNotifications,
  savePositions,
  saveSessions,
  saveUsers,
  seedSampleData,
} from "../../data/storage";
import { Badge, getShiftBadge, getShiftName } from "../common/Badge";
import { BrandLogo } from "../common/BrandLogo";
import { AddStaffModal } from "./AddStaffModal";
import { SessionDetailModal } from "./SessionDetailModal";

export function ManagerDashboard({
  user,
  onLogout,
  activeSession,
  onStartChecklist,
  onUpdateSession,
  onEndShift,
  onOpenChecklistPage,
}: {
  user: User;
  onLogout: () => void;
  activeSession: ShiftSession | null;
  onStartChecklist: (shift: ShiftType) => void;
  onUpdateSession: (session: ShiftSession) => void;
  onEndShift: () => void;
  onOpenChecklistPage: () => void;
}) {
  const [notifications, setNotifications] = useState<Notification[]>(getNotifications);
  const [sessions, setSessions] = useState<ShiftSession[]>(getSessions);
  const [positions, setPositions] = useState<Position[]>(getPositions);
  const [usersList, setUsersList] = useState<User[]>(getUsers);
  const [newPositionName, setNewPositionName] = useState("");
  const [positionMsg, setPositionMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [staffMsg, setStaffMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [resetFeedback, setResetFeedback] = useState<string | null>(null);
  const [staffSearch, setStaffSearch] = useState("");
  const [staffFilter, setStaffFilter] = useState<"all" | "unassigned" | "assigned">("all");
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);

  const isAssistant = user.position?.includes("ผู้ช่วย") || false;
  const canManagePositions = !isAssistant;

  type AdminTab = "overview" | "checklist" | "staff" | "history";
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [selectedSession, setSelectedSession] = useState<ShiftSession | null>(null);

  const unread = notifications.filter((n) => !n.read).length;
  const employees = usersList.filter((u) => u.role === "employee");
  const unassignedEmployees = employees.filter((u) => !u.position);

  useEffect(() => {
    seedSampleData(false);
    setNotifications(getNotifications());
    setSessions(getSessions());
    setPositions(getPositions());
    setUsersList(getUsers());

    const interval = setInterval(() => {
      setNotifications(getNotifications());
      setSessions(getSessions());
      setPositions(getPositions());
      setUsersList(getUsers());
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  function handleResetSampleData() {
    seedSampleData(true);
    setUsersList(getUsers());
    setSessions(getSessions());
    setNotifications(getNotifications());
    setResetFeedback("รีเซ็ตข้อมูลตัวอย่าง (พนักงาน, กะวันนี้, การแจ้งเตือน) เรียบร้อยแล้ว");
    setTimeout(() => setResetFeedback(null), 3500);
  }

  function markRead(id: string) {
    const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    saveNotifications(updated);
    setNotifications(updated);
  }

  function markAllRead() {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    saveNotifications(updated);
    setNotifications(updated);
  }

  function handleUpdateUserPosition(userId: string, newPos: string) {
    if (!canManagePositions) {
      setStaffMsg({
        text: "ผู้ช่วยผู้จัดการร้านไม่สามารถเลือกหรือเปลี่ยนตำแหน่งให้พนักงานได้",
        type: "error",
      });
      return;
    }
    const users = getUsers();
    const updated = users.map((u) => (u.id === userId ? { ...u, position: newPos || undefined } : u));
    saveUsers(updated);
    setUsersList(updated);
    const target = users.find((u) => u.id === userId);
    setStaffMsg({
      text: `อัปเดตตำแหน่งของ "${target?.name || "พนักงาน"}" เป็น "${newPos || "ยังไม่กำหนด"}" สำเร็จ`,
      type: "success",
    });
    setTimeout(() => setStaffMsg(null), 3000);
  }

  function handleDeleteStaff(userId: string) {
    if (!canManagePositions) {
      setStaffMsg({ text: "ผู้ช่วยผู้จัดการร้านไม่มีสิทธิ์ลบบัญชีพนักงาน", type: "error" });
      return;
    }
    const users = getUsers();
    const target = users.find((u) => u.id === userId);
    if (!target) return;
    if (target.id === user.id) {
      alert("ไม่สามารถลบบัญชีของตัวเองได้");
      return;
    }
    if (!confirm(`ยืนยันการลบบัญชีของ "${target.name}" หรือไม่?`)) return;
    const updated = users.filter((u) => u.id !== userId);
    saveUsers(updated);
    setUsersList(updated);
    setStaffMsg({ text: `ลบบัญชีพนักงาน "${target.name}" เรียบร้อยแล้ว`, type: "success" });
    setTimeout(() => setStaffMsg(null), 3000);
  }

  function handleAddPosition() {
    if (!canManagePositions) return;
    const trimmed = newPositionName.trim();
    if (!trimmed) return;
    if (positions.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setPositionMsg({ text: "มีชื่อตำแหน่งนี้อยู่แล้วในระบบ", type: "error" });
      return;
    }
    const updated = [...positions, { id: Date.now().toString(36), name: trimmed }];
    savePositions(updated);
    setPositions(updated);
    setNewPositionName("");
    setPositionMsg({ text: `เพิ่มตำแหน่ง "${trimmed}" เรียบร้อยแล้ว`, type: "success" });
    setTimeout(() => setPositionMsg(null), 3000);
  }

  function handleDeletePosition(posId: string) {
    if (!canManagePositions) return;
    const pos = positions.find((p) => p.id === posId);
    if (!pos) return;
    const users = getUsers();
    const assignedCount = users.filter((u) => u.position === pos.name).length;
    if (assignedCount > 0) {
      if (!confirm(`มีพนักงาน ${assignedCount} คนอยู่ในตำแหน่ง "${pos.name}" ต้องการลบตำแหน่งนี้หรือไม่?`)) {
        return;
      }
    }
    const updated = positions.filter((p) => p.id !== posId);
    savePositions(updated);
    setPositions(updated);
    setPositionMsg({ text: `ลบตำแหน่ง "${pos.name}" เรียบร้อยแล้ว`, type: "success" });
    setTimeout(() => setPositionMsg(null), 3000);
  }

  const completedSessions = sessions
    .filter((s) => s.completedAt)
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());

  const todayDate = new Date().toDateString();
  const todaySessions = sessions.filter((s) => new Date(s.startedAt).toDateString() === todayDate);
  const todayCompleted = todaySessions.filter((s) => s.completedAt);

  const allItems = sessions.flatMap((s) => s.items);
  const doneItems = allItems.filter((i) => i.completedAt);
  const completionPct = allItems.length > 0 ? Math.round((doneItems.length / allItems.length) * 100) : 100;

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
      emp.email.toLowerCase().includes(staffSearch.toLowerCase()) ||
      (emp.position && emp.position.toLowerCase().includes(staffSearch.toLowerCase()));
    if (!matchesSearch) return false;
    if (staffFilter === "unassigned") return !emp.position;
    if (staffFilter === "assigned") return Boolean(emp.position);
    return true;
  });

  const userDisplayName = user.name === "ผู้จัดการร้าน" ? "คุณวิภาดา สุขเจริญ" : user.name;

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col font-sans pb-16 relative overflow-hidden">
      {/* Subtle Ambient Brand Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-amber-200/10 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
      <div className="absolute bottom-10 left-0 w-96 h-96 bg-emerald-200/10 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />

      {/* Sticky Top Navbar */}
      <nav className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 py-2.5 transition-shadow">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BrandLogo size={34} showText={true} subtitle="ระบบบริหารและตรวจสอบการปฏิบัติงานประจำกะ" />
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-900 text-[10px] font-semibold hidden md:inline-flex" aria-label="สถานะสาขา: ออนไลน์">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" aria-hidden="true" />
              <span>สาขาหลัก 001 • ออนไลน์</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetSampleData}
              title="รีเซ็ตและโหลดข้อมูลตัวอย่างสำหรับทดสอบระบบ"
              className="text-xs px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 font-medium transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600">
                <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6l2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6l2.1-2.1"/>
              </svg>
              <span className="hidden md:inline">รีเซ็ตข้อมูลตัวอย่าง</span>
              <span className="md:hidden">รีเซ็ต</span>
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="text-xs text-slate-600 hover:text-rose-700 hover:bg-rose-50/60 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer font-medium"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6 flex-1 relative z-10">
        {/* Feedback Alert */}
        {resetFeedback && (
          <div role="status" className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-900 flex items-center justify-between shadow-2xs">
            <span className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-700">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span>{resetFeedback}</span>
            </span>
            <button
              type="button"
              onClick={() => setResetFeedback(null)}
              aria-label="ปิดการแจ้งเตือน"
              className="min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg text-emerald-700 hover:text-emerald-950 hover:bg-emerald-100/60 font-bold cursor-pointer transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        )}

        {/* Clean Hero Header Banner */}
        <div className="bg-white/95 backdrop-blur-sm border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-900" aria-hidden="true" />
                {user.position || "ผู้จัดการร้าน"}
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-500 font-medium">
                {new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              ยินดีต้อนรับ, {userDisplayName}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {isAssistant
                ? "ฝ่ายบริหารสาขา • ควบคุมเงินสด ตรวจรับสินค้า และดูแลการปฏิบัติงานประจำกะ"
                : "ภาพรวมการดำเนินงานประจำวัน การตรวจเช็คกะ และการจัดการพนักงานสาขา"}
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-center flex-wrap">
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-right hidden md:block">
              <span className="text-[11px] text-slate-500 block font-medium">รอบตรวจวันนี้</span>
              <span className="text-xs font-bold text-slate-900 font-mono">
                {todayCompleted.length}/{todaySessions.length || 2} กะเสร็จสิ้น
              </span>
            </div>
            {activeSession ? (
              <button
                type="button"
                onClick={() => setActiveTab("checklist")}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 active:bg-black text-white text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-slate-900"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>ทำเช็คลิสต์ต่อ ({activeSession.items.filter((i) => i.completedAt).length}/{activeSession.items.length}) →</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab("checklist")}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 active:bg-black text-white text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-slate-900"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3L22 4"/>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
                <span>เริ่มตรวจกะผู้จัดการ →</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4" role="region" aria-label="สรุปข้อมูลภาพรวม">
          {/* Card 1: Staff */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">พนักงานสาขา</span>
              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
            </div>
            <p className="text-2xl font-extrabold text-slate-900 tracking-tight tabular-nums font-mono">
              {employees.length} <span className="text-xs font-normal text-slate-500 font-sans">คน</span>
            </p>
            <p className="text-[11px] text-slate-500 truncate">
              {unassignedEmployees.length > 0 ? (
                <span className="text-amber-800 font-semibold font-mono">รอกำหนด {unassignedEmployees.length} คน</span>
              ) : (
                <span className="text-slate-600 font-medium">ครบทุกตำแหน่ง</span>
              )}
            </p>
          </div>

          {/* Card 2: Shifts */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs hover:border-sky-300 hover:shadow-sm transition-all space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">กะงานวันนี้</span>
              <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-700 border border-sky-100 flex items-center justify-center">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
            </div>
            <p className="text-2xl font-extrabold text-slate-900 tracking-tight tabular-nums font-mono">
              {todaySessions.length} <span className="text-xs font-normal text-slate-500 font-sans">กะ</span>
            </p>
            <p className="text-[11px] text-slate-500 truncate font-mono">
              เสร็จ {todayCompleted.length} • ตรวจ {todaySessions.length - todayCompleted.length}
            </p>
          </div>

          {/* Card 3: Completion */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs hover:border-emerald-300 hover:shadow-sm transition-all space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">ความสมบูรณ์เช็คลิสต์</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
            </div>
            <p className="text-2xl font-extrabold text-emerald-700 tracking-tight tabular-nums font-mono">
              {completionPct}%
            </p>
            <p className="text-[11px] text-slate-500 truncate font-mono">
              เสร็จ {doneItems.length}/{allItems.length} ข้อ
            </p>
          </div>

          {/* Card 4: Notifications */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs hover:border-amber-300 hover:shadow-sm transition-all space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">การแจ้งเตือน</span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </div>
            </div>
            <p className={`text-2xl font-extrabold tracking-tight tabular-nums font-mono ${unread > 0 ? "text-amber-800" : "text-slate-900"}`}>
              {unread} <span className="text-xs font-normal text-slate-500 font-sans">รายการ</span>
            </p>
            <p className="text-[11px] text-slate-500 truncate">
              {unread > 0 ? (
                <span className="text-amber-800 font-medium">มีรายงานรอตรวจสอบ</span>
              ) : (
                "ไม่มีแจ้งเตือนค้าง"
              )}
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-xs">
          <div
            role="tablist"
            aria-label="เมนูการจัดการหลัก"
            onKeyDown={(e) => {
              const tabIds: AdminTab[] = ["overview", "checklist", "staff", "history"];
              const currentIndex = tabIds.indexOf(activeTab);
              if (currentIndex === -1) return;
              if (e.key === "ArrowRight") {
                e.preventDefault();
                setActiveTab(tabIds[(currentIndex + 1) % tabIds.length]);
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                setActiveTab(tabIds[(currentIndex - 1 + tabIds.length) % tabIds.length]);
              }
            }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-1"
          >
            {[
              {
                id: "overview" as AdminTab,
                label: "ภาพรวมวันนี้",
                icon: (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                  </svg>
                ),
              },
              {
                id: "checklist" as AdminTab,
                label: "เช็คลิสต์กะผู้จัดการ",
                icon: (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                  </svg>
                ),
                pulse: !!activeSession,
              },
              {
                id: "staff" as AdminTab,
                label: isAssistant ? "ทีมงาน & ตำแหน่ง" : "จัดการทีม & ตำแหน่ง",
                icon: (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  </svg>
                ),
                badge: unassignedEmployees.length > 0 && canManagePositions ? unassignedEmployees.length : undefined,
              },
              {
                id: "history" as AdminTab,
                label: "ประวัติและรายงาน",
                icon: (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                ),
                badge: unread > 0 ? unread : undefined,
              },
            ].map((tab) => {
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`${tab.id}-tab`}
                  aria-selected={isSelected}
                  aria-controls={`${tab.id}-panel`}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2 min-h-[36px] rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none ${
                    isSelected
                      ? "bg-white text-slate-900 shadow-xs border border-slate-200/80 font-bold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                  }`}
                >
                  <span className={isSelected ? "text-slate-900" : "text-slate-500"}>{tab.icon}</span>
                  <span className="truncate">{tab.label}</span>
                  {tab.pulse && (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-900 animate-pulse" aria-hidden="true" />
                  )}
                  {tab.badge !== undefined && (
                    <span className={`text-[10px] tabular-nums px-1.5 py-0.2 rounded-full font-bold ${isSelected ? "bg-slate-900 text-white" : "bg-slate-700 text-white"}`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div
          role="tabpanel"
          id={`${activeTab}-panel`}
          aria-labelledby={`${activeTab}-tab`}
          tabIndex={0}
          className="focus-visible:outline-none scroll-mt-20"
        >
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Today's Shifts Cards */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 tracking-tight">สถานะกะการทำงานวันนี้ (Today's Shifts)</h2>
                    <p className="text-xs text-slate-500 mt-0.5">ติดตามความคืบหน้าของพนักงานแต่ละกะแบบเรียลไทม์</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetSampleData}
                    className="text-xs text-slate-500 hover:text-slate-800 underline font-medium cursor-pointer"
                  >
                    โหลดซ้ำ
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Card 1: Morning Shift */}
                  {(() => {
                    const morningSess = sessions.find((s) => s.shift === "morning" && new Date(s.startedAt).toDateString() === todayDate);
                    const doneCount = morningSess ? morningSess.items.filter((i) => i.completedAt).length : 13;
                    const totalCount = morningSess ? morningSess.items.length : 13;
                    const isDone = morningSess ? doneCount === totalCount : true;

                    return (
                      <div className="border border-slate-200/90 rounded-2xl p-4 bg-white hover:border-amber-300 hover:shadow-xs transition-all flex flex-col justify-between space-y-3">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <Badge color="amber">กะเช้า</Badge>
                            {isDone ? (
                              <Badge color="green">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                                <span>ตรวจเสร็จสิ้น</span>
                              </Badge>
                            ) : (
                              <Badge color="muted">อยู่ระหว่างกะ</Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center font-bold text-sm">
                              ส
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">
                                {morningSess ? morningSess.userName : "สมศรี ใจดี"}
                              </p>
                              <p className="text-xs text-slate-500">
                                {morningSess?.userPosition || "แคชเชียร์"}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500 font-normal">ความคืบหน้า</span>
                              <span className="font-semibold text-emerald-800 tabular-nums">{doneCount}/{totalCount} รายการ (100%)</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full bg-emerald-600 rounded-full transition-all"
                                style={{ width: `${(doneCount / totalCount) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {morningSess && (
                          <button
                            type="button"
                            onClick={() => setSelectedSession(morningSess)}
                            className="w-full py-2 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white text-xs font-semibold text-slate-800 transition-all cursor-pointer shadow-2xs"
                          >
                            ดูรายงานตรวจเช็คลิสต์ →
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* Card 2: Afternoon Shift */}
                  {(() => {
                    const afternoonSess = sessions.find((s) => s.shift === "afternoon" && new Date(s.startedAt).toDateString() === todayDate);
                    const doneCount = afternoonSess ? afternoonSess.items.filter((i) => i.completedAt).length : 6;
                    const totalCount = afternoonSess ? afternoonSess.items.length : 12;
                    const pct = Math.round((doneCount / totalCount) * 100);

                    return (
                      <div className="border border-slate-200/90 rounded-2xl p-4 bg-white hover:border-sky-300 hover:shadow-xs transition-all flex flex-col justify-between space-y-3">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <Badge color="blue">กะบ่าย</Badge>
                            <Badge color="blue" dot>
                              กำลังตรวจ ({pct}%)
                            </Badge>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 flex items-center justify-center font-bold text-sm">
                              ส
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">
                                {afternoonSess ? afternoonSess.userName : "สมชาย มั่นคง"}
                              </p>
                              <p className="text-xs text-slate-500">
                                {afternoonSess?.userPosition || "พนักงานสต็อก/จัดเรียง"}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500 font-normal">ความคืบหน้า</span>
                              <span className="font-semibold text-sky-800 tabular-nums">{doneCount}/{totalCount} รายการ ({pct}%)</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full bg-sky-600 rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {afternoonSess && (
                          <button
                            type="button"
                            onClick={() => setSelectedSession(afternoonSess)}
                            className="w-full py-2 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-800 transition-all cursor-pointer shadow-2xs"
                          >
                            ดูความคืบหน้าเรียลไทม์ →
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* Card 3: Manager Shift */}
                  <div className="border border-slate-200/90 rounded-2xl p-4 bg-white hover:border-slate-300 hover:shadow-xs transition-all flex flex-col justify-between space-y-3">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge color="muted">กะของผู้บริหาร</Badge>
                        {activeSession ? (
                          <Badge color="amber" dot>กำลังทำอยู่</Badge>
                        ) : (
                          <Badge color="muted">พร้อมเริ่มงาน</Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-900 text-white flex items-center justify-center font-bold text-sm">
                          {userDisplayName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{userDisplayName}</p>
                          <p className="text-xs text-slate-500">{user.position || "ผู้จัดการร้าน"}</p>
                        </div>
                      </div>

                      <p className="text-xs text-slate-500">
                        {activeSession
                          ? `ดำเนินการแล้ว ${activeSession.items.filter((i) => i.completedAt).length}/${activeSession.items.length} รายการ`
                          : "ตรวจนับเงินสดรอบเปิดร้าน ควบคุมคุณภาพ และตรวจปิดรอบสาขา"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTab("checklist")}
                      className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 active:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer text-center ring-1 ring-white/10 focus-visible:outline-2 focus-visible:outline-slate-900"
                    >
                      {activeSession ? "ทำเช็คลิสต์ต่อ →" : "เริ่มทำเช็คลิสต์ประจำกะ →"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Clean Recent Activity Audit Feed */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 tracking-tight">แจ้งเตือนและกิจกรรมล่าสุด (Recent Activity)</h2>
                    <p className="text-xs text-slate-500 mt-0.5">รายงานการปฏิบัติงานที่ส่งเข้ามาจากพนักงานประจำกะ</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {unread > 0 && (
                      <button
                        type="button"
                        onClick={markAllRead}
                        className="text-xs px-2.5 py-1 rounded-lg border border-slate-300 bg-slate-900 hover:bg-slate-800 text-white font-medium cursor-pointer transition-colors shadow-2xs"
                      >
                        อ่านทั้งหมด ({unread})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveTab("history")}
                      className="text-xs text-slate-800 hover:text-slate-900 hover:underline font-semibold cursor-pointer"
                    >
                      ดูประวัติทั้งหมด →
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {notifications.slice(0, 4).map((notif) => (
                    <div key={notif.id} className="py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/50 px-2 rounded-xl transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {!notif.read && (
                              <Badge color="amber">ใหม่</Badge>
                            )}
                            <p className="text-xs font-bold text-slate-900">
                              {notif.userName}
                            </p>
                            {notif.userPosition && (
                              <span className="text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.2 rounded font-mono">
                                {notif.userPosition}
                              </span>
                            )}
                            <span className="text-[11px] text-slate-500">
                              ส่งรายงานตรวจเช็คลิสต์ประจำกะ ครบ 100% เรียบร้อยแล้ว
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 mt-0.5 block font-mono">
                            {fmtDate(notif.completedAt)} • {fmtTime(notif.completedAt)}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const s = sessions.find((item) => item.id === notif.shiftSessionId);
                          if (s) setSelectedSession(s);
                          markRead(notif.id);
                        }}
                        className="text-xs text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 font-medium whitespace-nowrap cursor-pointer shadow-2xs transition-all"
                      >
                        ดูผลตรวจ →
                      </button>
                    </div>
                  ))}
                  {notifications.length === 0 && (
                    <p className="text-xs text-slate-500 py-6 text-center">ไม่มีกิจกรรมล่าสุดในขณะนี้</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CHECKLIST (MANAGER'S SHIFT CHECKLIST) */}
          {activeTab === "checklist" && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">เช็คลิสต์ประจำกะของผู้บริหาร / ผู้จัดการ</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      ตรวจสอบขั้นตอนการเปิดร้าน การตรวจนับสต็อก และการควบคุมเงินสดประจำวัน
                    </p>
                  </div>
                  {activeSession ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={onOpenChecklistPage}
                        className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>เปิดตรวจเต็มจอ ↗</span>
                      </button>
                      <button
                        type="button"
                        onClick={onEndShift}
                        className="px-3.5 py-1.5 border border-red-200 hover:bg-red-50 text-red-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                      >
                        จบกะนี้
                      </button>
                    </div>
                  ) : null}
                </div>

                {activeSession ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 bg-slate-100 border border-slate-300 rounded-xl">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-slate-900 animate-pulse" aria-hidden="true" />
                        <span className="text-xs font-bold text-slate-900">
                          กะที่กำลังทำงาน: {getShiftName(activeSession.shift)}
                        </span>
                        <span className="text-xs font-bold bg-white text-slate-800 border border-slate-300 px-2.5 py-0.5 rounded-full font-mono">
                          {activeSession.items.filter((i) => i.completedAt).length} / {activeSession.items.length} ข้อ
                        </span>
                      </div>
                      <span className="text-xs font-mono text-slate-700 font-semibold">
                        เริ่มเข้ากะ: {fmtTime(activeSession.startedAt)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500">
                      คลิกที่รายการด้านล่างเพื่อทำเครื่องหมายว่าตรวจสอบเรียบร้อยแล้ว:
                    </p>

                    <div className="space-y-2">
                      {activeSession.items.map((item, idx) => {
                        const isDone = Boolean(item.completedAt);
                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              const now = new Date().toISOString();
                              const updatedItems = activeSession.items.map((it) =>
                                it.id === item.id ? { ...it, completedAt: it.completedAt ? null : now } : it
                              );
                              const updatedSess = { ...activeSession, items: updatedItems };
                              onUpdateSession(updatedSess);
                              const all = getSessions().map((s) => (s.id === updatedSess.id ? updatedSess : s));
                              saveSessions(all);
                              setSessions(all);
                            }}
                            className={`flex items-center justify-between p-3 rounded-xl border text-xs transition-all cursor-pointer select-none ${
                              isDone
                                ? "bg-slate-100/70 border-slate-300 hover:bg-slate-100"
                                : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                role="checkbox"
                                aria-checked={isDone}
                                aria-label={`สถานะ: ${item.label}`}
                                className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors flex-shrink-0 ${
                                  isDone
                                    ? "bg-emerald-600 border-emerald-600 text-white shadow-2xs"
                                    : "border-slate-300 bg-white hover:border-slate-900"
                                }`}
                              >
                                {isDone && (
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <polyline points="20 6 9 17 4 12"/>
                                  </svg>
                                )}
                              </button>
                              <div>
                                <span className="text-slate-400 font-mono text-[11px] mr-2">
                                  {String(idx + 1).padStart(2, "0")}
                                </span>
                                <span className={isDone ? "line-through text-slate-400" : "font-semibold text-slate-900"}>
                                  {item.label}
                                </span>
                                {item.category && (
                                  <span className="ml-2 text-[10px] text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono">
                                    {item.category}
                                  </span>
                                )}
                              </div>
                            </div>

                            {isDone ? (
                              <span className="text-[11px] font-mono font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex-shrink-0 flex items-center gap-1">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                                <span>{fmtTime(item.completedAt!)}</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 flex-shrink-0 font-mono">
                                คลิกเพื่อตรวจ
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-600">
                      คุณยังไม่ได้เริ่มเข้ากะงาน เลือกกะที่ต้องการเพื่อเริ่มต้นทำเช็คลิสต์:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {[
                        {
                          shift: "morning" as ShiftType,
                          name: "กะเช้า (Morning)",
                          time: "08:00 - 16:00",
                          desc: "เปิดร้าน ตรวจนับเงินสดรอบแรก และเช็คสต็อกรับเข้า",
                          icon: (
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <circle cx="12" cy="12" r="4" />
                              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                            </svg>
                          ),
                        },
                        {
                          shift: "afternoon" as ShiftType,
                          name: "กะบ่าย (Afternoon)",
                          time: "14:00 - 22:00",
                          desc: "ดูแลลูกค้าหน้าร้าน ตรวจเติมสินค้า และเตรียมส่งกะ",
                          icon: (
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                            </svg>
                          ),
                        },
                        {
                          shift: "night" as ShiftType,
                          name: "กะดึก (Night)",
                          time: "22:00 - 06:00",
                          desc: "ปิดรอบบัญชี สรุปยอดขาย และปิดระบบความปลอดภัย",
                          icon: (
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                            </svg>
                          ),
                        },
                      ].map((s) => (
                        <button
                          key={s.shift}
                          type="button"
                          onClick={() => onStartChecklist(s.shift)}
                          className="text-left p-5 rounded-2xl border border-slate-300 hover:border-slate-500 bg-white hover:shadow-md transition-all group cursor-pointer shadow-xs flex flex-col justify-between"
                        >
                          <div>
                            <div className="w-11 h-11 rounded-2xl bg-slate-100 group-hover:bg-slate-900 group-hover:text-white text-slate-700 flex items-center justify-center transition-colors mb-4">
                              {s.icon}
                            </div>
                            <h3 className="text-base font-bold text-slate-900 transition-colors">
                              {s.name}
                            </h3>
                            <p className="text-xs font-mono text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full inline-block mt-1.5 font-semibold">
                              {s.time}
                            </p>
                            <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">{s.desc}</p>
                          </div>
                          <span className="inline-flex items-center gap-1 mt-4 text-xs font-bold text-slate-900 group-hover:underline">
                            <span>เริ่มกะนี้</span>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M5 12h14M12 5l7 7-7 7"/>
                            </svg>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: STAFF & ROLES */}
          {activeTab === "staff" && (
            <div className="space-y-6">
              {!canManagePositions && (
                <div className="bg-slate-100 border border-slate-300 rounded-xl p-3.5 text-xs text-slate-800">
                  <p className="font-bold text-slate-900">สิทธิ์ผู้ช่วยผู้จัดการร้าน (Assistant Store Manager)</p>
                  <p className="text-slate-600 mt-0.5">
                    ท่านสามารถตรวจสอบรายชื่อและประวัติการทำงานได้ แต่<strong>ไม่สามารถเลือกหรือเปลี่ยนตำแหน่งงานให้พนักงานได้</strong> (สิทธิ์สงวนไว้เฉพาะผู้จัดการร้านและกรรมการ)
                  </p>
                </div>
              )}

              {staffMsg && (
                <div role="status" className={`p-3 rounded-xl text-xs font-semibold border ${staffMsg.type === "success" ? "bg-slate-100 border-slate-300 text-slate-900" : "bg-red-50 border-red-300 text-red-700"}`}>
                  {staffMsg.text}
                </div>
              )}

              {/* Staff Toolbar */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="flex flex-1 gap-2 flex-wrap sm:flex-nowrap">
                  <input
                    type="text"
                    placeholder="ค้นหาพนักงานด้วยชื่อ, อีเมล หรือตำแหน่ง..."
                    value={staffSearch}
                    onChange={(e) => setStaffSearch(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-500 focus:border-slate-900 focus:bg-white focus-visible:outline-2 focus-visible:outline-slate-900 transition-colors"
                  />
                  <div role="tablist" aria-label="ตัวกรองพนักงาน" className="flex bg-slate-100 p-1 rounded-xl text-xs gap-1">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={staffFilter === "all"}
                      onClick={() => setStaffFilter("all")}
                      className={`px-3 py-1.5 min-h-[32px] rounded-lg font-medium transition-all cursor-pointer ${staffFilter === "all" ? "bg-white text-slate-900 shadow-2xs font-bold border border-slate-200/80" : "text-slate-600 hover:text-slate-900"}`}
                    >
                      ทั้งหมด ({employees.length})
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={staffFilter === "unassigned"}
                      onClick={() => setStaffFilter("unassigned")}
                      className={`px-3 py-1.5 min-h-[32px] rounded-lg font-medium transition-all cursor-pointer ${staffFilter === "unassigned" ? "bg-white text-slate-900 shadow-2xs font-bold border border-slate-200/80" : "text-slate-600 hover:text-slate-900"}`}
                    >
                      รอกำหนด ({unassignedEmployees.length})
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={staffFilter === "assigned"}
                      onClick={() => setStaffFilter("assigned")}
                      className={`px-3 py-1.5 min-h-[32px] rounded-lg font-medium transition-all cursor-pointer ${staffFilter === "assigned" ? "bg-white text-slate-900 shadow-2xs font-bold border border-slate-200/80" : "text-slate-600 hover:text-slate-900"}`}
                    >
                      มีตำแหน่งแล้ว ({employees.length - unassignedEmployees.length})
                    </button>
                  </div>
                </div>

                {canManagePositions && (
                  <button
                    type="button"
                    onClick={() => setShowAddStaffModal(true)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <span>+ เพิ่มพนักงานใหม่</span>
                  </button>
                )}
              </div>

              {/* Staff Cards Grid */}
              {filteredEmployees.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm bg-white border border-slate-200/90 rounded-2xl">
                  {staffSearch ? "ไม่พบพนักงานที่ตรงกับคำค้นหา" : "ยังไม่มีพนักงานในระบบ"}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredEmployees.map((emp) => {
                    const empSessions = sessions.filter((s) => s.userId === emp.id);
                    const lastSession = empSessions[empSessions.length - 1];

                    return (
                      <div
                        key={emp.id}
                        className={`p-4 rounded-2xl border transition-all bg-white shadow-2xs ${
                          !emp.position ? "border-slate-300 bg-slate-50/40" : "border-slate-200/90 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-sm">
                              {emp.name.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm font-bold text-slate-900">{emp.name}</h3>
                                {!emp.position ? (
                                  <Badge color="amber">รอกำหนด</Badge>
                                ) : emp.position === "แคชเชียร์" ? (
                                  <Badge color="green">แคชเชียร์</Badge>
                                ) : emp.position === "พนักงานจัดเรียงสินค้า" ? (
                                  <Badge color="blue">จัดเรียงสินค้า</Badge>
                                ) : (
                                  <Badge color="muted">{emp.position}</Badge>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 font-mono mt-0.5">{emp.email}</p>
                              {lastSession && (
                                <p className="text-[11px] text-slate-500 mt-1">
                                  เข้ากะล่าสุด: {getShiftName(lastSession.shift)} ({fmtDate(lastSession.startedAt)})
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 min-w-[160px]">
                              {canManagePositions ? (
                                <select
                                  aria-label={`ตำแหน่งของ ${emp.name}`}
                                  value={emp.position || ""}
                                  onChange={(e) => handleUpdateUserPosition(emp.id, e.target.value)}
                                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer w-full bg-slate-50 text-slate-800 border-slate-300 hover:border-slate-400 focus:border-slate-900 focus-visible:outline-2 focus-visible:outline-slate-900"
                                >
                                  <option value="">-- รอกำหนดตำแหน่ง --</option>
                                  {positions.map((p) => (
                                    <option key={p.id} value={p.name}>
                                      {p.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border bg-slate-50 text-slate-800 border-slate-200">
                                    {emp.position || "รอกำหนดตำแหน่ง"}
                                  </span>
                                </div>
                              )}
                            </div>

                            {canManagePositions && (
                              <button
                                type="button"
                                onClick={() => handleDeleteStaff(emp.id)}
                                aria-label={`ลบพนักงาน ${emp.name}`}
                                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-colors min-h-[32px] inline-flex items-center gap-1 font-medium cursor-pointer"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                ลบ
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Roles and Checklist Standards Section */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">ตำแหน่งและเกณฑ์เช็คลิสต์ประจำสาขา ({positions.length})</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      โครงสร้างตำแหน่งงานที่ใช้ในการมอบหมายหน้าที่และกำหนดเกณฑ์เช็คลิสต์ในแต่ละกะ
                    </p>
                  </div>
                </div>

                {canManagePositions && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <label htmlFor="new-position-input-unified" className="sr-only">ชื่อตำแหน่งงานใหม่</label>
                      <input
                        id="new-position-input-unified"
                        type="text"
                        placeholder="เพิ่มตำแหน่งใหม่ เช่น เจ้าหน้าที่ความปลอดภัย (จป.)..."
                        value={newPositionName}
                        onChange={(e) => setNewPositionName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddPosition()}
                        className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-500 focus:border-slate-900 focus-visible:outline-2 focus-visible:outline-slate-900 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={handleAddPosition}
                        disabled={!newPositionName.trim()}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M12 5v14M5 12h14"/>
                        </svg>
                        <span>เพิ่มตำแหน่ง</span>
                      </button>
                    </div>
                    {positionMsg && (
                      <p role="status" className={`text-xs font-semibold ${positionMsg.type === "success" ? "text-slate-800" : "text-red-700"}`}>
                        {positionMsg.text}
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {positions.map((pos) => {
                    const count = employees.filter((u) => u.position === pos.name).length;
                    const morningItems = getChecklistTemplate(pos.name, "morning").length;
                    const afternoonItems = getChecklistTemplate(pos.name, "afternoon").length;

                    return (
                      <div
                        key={pos.id}
                        className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-white hover:shadow-2xs transition-all"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 flex-shrink-0">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                              <circle cx="12" cy="7" r="4"/>
                            </svg>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">{pos.name}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              พนักงาน <strong className="text-slate-800">{count} คน</strong> • เช็คลิสต์ {morningItems + afternoonItems} ข้อ
                            </p>
                          </div>
                        </div>

                        {canManagePositions && (
                          <button
                            type="button"
                            onClick={() => handleDeletePosition(pos.id)}
                            aria-label={`ลบตำแหน่ง ${pos.name}`}
                            className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            ลบ
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: HISTORY & AUDIT TRAIL */}
          {activeTab === "history" && (
            <div className="space-y-4">
              {unread > 0 && (
                <div className="bg-slate-100 border border-slate-300 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-slate-900 animate-pulse" aria-hidden="true" />
                    <p className="text-xs font-semibold text-slate-900">
                      มีรายงานส่งงานใหม่ที่ยังไม่ได้อ่าน <strong>{unread} รายการ</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="text-xs px-3 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-semibold cursor-pointer transition-colors shadow-2xs"
                  >
                    ทำเครื่องหมายอ่านทั้งหมด
                  </button>
                </div>
              )}

              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">ประวัติการตรวจกะและบันทึกการปฏิบัติงาน ({completedSessions.length})</h2>
                    <p className="text-xs text-slate-500 mt-0.5">คลิกที่แต่ละรายการเพื่อตรวจสอบรายละเอียดผลตรวจและเวลาที่เสร็จสิ้น</p>
                  </div>
                </div>

                {completedSessions.length === 0 ? (
                  <div className="text-center py-16 text-slate-500 text-sm">
                    ยังไม่มีประวัติการส่งมอบกะที่บันทึกไว้ในระบบ
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {completedSessions.map((sess) => (
                      <button
                        type="button"
                        key={sess.id}
                        onClick={() => setSelectedSession(sess)}
                        className="w-full text-left p-4 rounded-xl border border-slate-200/80 bg-slate-50/40 hover:bg-white hover:border-slate-400 transition-all focus-visible:outline-2 focus-visible:outline-slate-900 shadow-2xs cursor-pointer group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-slate-900 group-hover:underline transition-colors">
                                {sess.userName}
                              </span>
                              {sess.userPosition && <Badge color="muted">{sess.userPosition}</Badge>}
                              {getShiftBadge(sess.shift)}
                              <Badge color="muted">
                                {sess.items.filter((i) => i.completedAt).length}/{sess.items.length} รายการ (100%)
                              </Badge>
                            </div>
                            <p className="text-[11px] font-mono text-slate-500">
                              {fmtDate(sess.completedAt!)} • เริ่ม {fmtTime(sess.startedAt)} → เสร็จ {fmtTime(sess.completedAt!)}
                            </p>
                          </div>
                          <span className="text-xs text-slate-800 font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                            <span>ดูผลตรวจ</span>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M9 18l6-6-6-6"/>
                            </svg>
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Staff Modal */}
      <AddStaffModal
        isOpen={showAddStaffModal}
        onClose={() => setShowAddStaffModal(false)}
        positions={positions}
        canManagePositions={canManagePositions}
        onStaffAdded={(newUser) => {
          setUsersList([...usersList, newUser]);
          setStaffMsg({ text: `เพิ่มพนักงาน "${newUser.name}" เรียบร้อยแล้ว`, type: "success" });
          setTimeout(() => setStaffMsg(null), 3000);
        }}
      />

      {/* Session Detail Modal */}
      <SessionDetailModal
        session={selectedSession}
        onClose={() => setSelectedSession(null)}
      />
    </div>
  );
}
