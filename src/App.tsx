import { useState, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Role = "employee" | "manager";

interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
}

interface ChecklistItem {
  id: string;
  label: string;
  completedAt: string | null;
}

interface ShiftSession {
  id: string;
  userId: string;
  userName: string;
  shift: "morning" | "afternoon";
  startedAt: string;
  completedAt: string | null;
  items: ChecklistItem[];
  notified: boolean;
}

interface Notification {
  id: string;
  shiftSessionId: string;
  userName: string;
  shift: "morning" | "afternoon";
  completedAt: string;
  read: boolean;
}

// ─── Checklist Templates ──────────────────────────────────────────────────────
const MORNING_ITEMS: Omit<ChecklistItem, "completedAt">[] = [
  { id: "m1", label: "ตรวจสอบอุปกรณ์ความปลอดภัย (PPE)" },
  { id: "m2", label: "เช็คระดับน้ำมันและสารหล่อลื่นเครื่องจักร" },
  { id: "m3", label: "ทดสอบระบบไฟฉุกเฉินและสัญญาณเตือนภัย" },
  { id: "m4", label: "ตรวจสอบสต็อกวัตถุดิบประจำวัน" },
  { id: "m5", label: "เปิดระบบสายพานลำเลียงและทดสอบการทำงาน" },
  { id: "m6", label: "บันทึกอุณหภูมิและความชื้นห้องเก็บสินค้า" },
  { id: "m7", label: "ตรวจสอบความสะอาดพื้นที่ปฏิบัติงาน" },
  { id: "m8", label: "รายงานความพร้อมเครื่องจักรทุกสถานี" },
  { id: "m9", label: "ตรวจสอบระบบระบายอากาศและแสงสว่าง" },
  { id: "m10", label: "บันทึกเป้าหมายการผลิตประจำกะ" },
];

const AFTERNOON_ITEMS: Omit<ChecklistItem, "completedAt">[] = [
  { id: "a1", label: "รับช่วงงานและรับทราบสถานะจากกะเช้า" },
  { id: "a2", label: "ตรวจสอบบันทึกการผลิตและปัญหากะเช้า" },
  { id: "a3", label: "เช็คสต็อกสินค้าสำเร็จรูปและบรรจุภัณฑ์" },
  { id: "a4", label: "ตรวจสอบการทำงานของเครื่องจักรทุกตัว" },
  { id: "a5", label: "บันทึกปริมาณการใช้วัตถุดิบ" },
  { id: "a6", label: "ตรวจสอบและเติมสารเคมีในกระบวนการผลิต" },
  { id: "a7", label: "ทำความสะอาดจุดเสี่ยงและพื้นที่อันตราย" },
  { id: "a8", label: "ปิดระบบที่ไม่จำเป็นและประหยัดพลังงาน" },
  { id: "a9", label: "บันทึกยอดผลิตจริงเทียบเป้าหมาย" },
  { id: "a10", label: "ส่งมอบงานและบันทึกปัญหาสำหรับกะถัดไป" },
];

// ─── LocalStorage Helpers ─────────────────────────────────────────────────────
function getUsers(): User[] {
  return JSON.parse(localStorage.getItem("app_users") ?? "[]");
}
function saveUsers(users: User[]) {
  localStorage.setItem("app_users", JSON.stringify(users));
}
function getSessions(): ShiftSession[] {
  return JSON.parse(localStorage.getItem("app_sessions") ?? "[]");
}
function saveSessions(sessions: ShiftSession[]) {
  localStorage.setItem("app_sessions", JSON.stringify(sessions));
}
function getNotifications(): Notification[] {
  return JSON.parse(localStorage.getItem("app_notifications") ?? "[]");
}
function saveNotifications(notifs: Notification[]) {
  localStorage.setItem("app_notifications", JSON.stringify(notifs));
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" });
}

// Seed a default manager account
function ensureDefaultManager() {
  const users = getUsers();
  if (!users.find((u) => u.role === "manager")) {
    users.push({ id: uid(), name: "ผู้จัดการ", email: "manager@factory.com", password: "manager123", role: "manager" });
    saveUsers(users);
  }
}

// ─── Components ───────────────────────────────────────────────────────────────

function Badge({ children, color = "muted" }: { children: React.ReactNode; color?: "green" | "amber" | "blue" | "muted" | "red" }) {
  const cls = {
    green: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    amber: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    blue: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    muted: "bg-white/5 text-[var(--color-text-muted)] border-white/10",
    red: "bg-red-500/15 text-red-400 border-red-500/30",
  }[color];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border font-mono ${cls}`}>
      {children}
    </span>
  );
}

function Divider() {
  return <div className="h-px bg-[var(--color-border)] w-full" />;
}

// ─── Login / Register Page ────────────────────────────────────────────────────
function AuthPage({ onLogin }: { onLogin: (user: User) => void }) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "employee" as Role });
  const [error, setError] = useState("");

  function handleLogin() {
    const users = getUsers();
    const user = users.find((u) => u.email === form.email && u.password === form.password);
    if (!user) { setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง"); return; }
    setError("");
    onLogin(user);
  }

  function handleRegister() {
    if (!form.name || !form.email || !form.password) { setError("กรุณากรอกข้อมูลให้ครบ"); return; }
    const users = getUsers();
    if (users.find((u) => u.email === form.email)) { setError("อีเมลนี้มีผู้ใช้งานแล้ว"); return; }
    const newUser: User = { id: uid(), name: form.name, email: form.email, password: form.password, role: form.role };
    saveUsers([...users, newUser]);
    setError("");
    onLogin(newUser);
  }

  // [#7] 2.4.7/2.4.13 — Custom focus ring replaces default outline; meets 2px + 3:1 contrast
  const inp = "w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40 transition-colors";

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 mb-4">
            {/* [#1] 1.1.1 — Decorative logo SVG hidden from assistive tech */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-emerald-400" aria-hidden="true">
              <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">ShiftCheck</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">ระบบตรวจสอบงานประจำกะ</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-1 mb-6">
          {(["login", "register"] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); setError(""); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${tab === t ? "bg-[var(--color-surface-2)] text-[var(--color-text)] shadow-sm" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}>
              {t === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {/* [#3] 1.3.1 / [#5] 1.3.5 — aria-label + autocomplete on all inputs */}
          {tab === "register" && (
            <input className={inp} placeholder="ชื่อ-นามสกุล" aria-label="ชื่อ-นามสกุล" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          )}
          <input className={inp} placeholder="อีเมล" type="email" aria-label="อีเมล" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className={inp} placeholder="รหัสผ่าน" type="password" aria-label="รหัสผ่าน" autoComplete={tab === "login" ? "current-password" : "new-password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && (tab === "login" ? handleLogin() : handleRegister())} />

          {tab === "register" && (
            <div className="flex gap-2" role="group" aria-label="ประเภทบัญชี">
              {/* [#10] 4.1.2 — aria-pressed signals selected state to screen readers */}
              {(["employee", "manager"] as const).map((r) => (
                <button key={r} onClick={() => setForm({ ...form, role: r })}
                  aria-pressed={form.role === r}
                  className={`flex-1 py-2 text-sm rounded-lg border transition-all ${form.role === r ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-400" : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-subtle)]"}`}>
                  {r === "employee" ? "พนักงาน" : "ผู้จัดการ"}
                </button>
              ))}
            </div>
          )}

          {/* [#9] 3.3.1 — role="alert" announces error dynamically to screen readers */}
          {error && <p role="alert" className="text-xs text-red-400 text-center">{error}</p>}

          <button onClick={tab === "login" ? handleLogin : handleRegister}
            className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg transition-colors mt-1">
            {tab === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
          </button>
        </div>

        {/* [#6] 1.4.3 — Elevated from text-subtle (#484f58, 2.6:1) to text-muted (#7d8590, 5.5:1) */}
        {tab === "login" && (
          <p className="text-center text-xs text-[var(--color-text-muted)] mt-5">
            บัญชีผู้จัดการทดสอบ: <span className="font-mono text-[var(--color-text-muted)]">manager@factory.com</span> / <span className="font-mono text-[var(--color-text-muted)]">manager123</span>
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Shift Select Page ────────────────────────────────────────────────────────
function ShiftSelectPage({ user, onSelect, onLogout }: { user: User; onSelect: (shift: "morning" | "afternoon") => void; onLogout: () => void }) {
  const now = new Date();
  const hour = now.getHours();
  const suggestedShift: "morning" | "afternoon" = hour < 14 ? "morning" : "afternoon";

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">ยินดีต้อนรับ</p>
            <h2 className="text-lg font-semibold">{user.name}</h2>
          </div>
          <button onClick={onLogout} className="text-xs text-[var(--color-text-muted)] hover:text-red-400 transition-colors px-3 py-1.5 rounded border border-[var(--color-border)] hover:border-red-500/30">
            ออกจากระบบ
          </button>
        </div>

        <h1 className="text-2xl font-semibold mb-2">เลือกกะที่ต้องการทำ</h1>
        <p className="text-sm text-[var(--color-text-muted)] mb-8">
          {fmtDate(now.toISOString())} — {fmtTime(now.toISOString())}
        </p>

        <div className="grid grid-cols-2 gap-4">
          {(["morning", "afternoon"] as const).map((shift) => {
            const isMorning = shift === "morning";
            const isRecommended = shift === suggestedShift;
            return (
              <button key={shift} onClick={() => onSelect(shift)}
                className={`relative group flex flex-col gap-4 p-6 rounded-2xl border transition-all text-left ${isRecommended ? "border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10" : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-amber-500/40 hover:bg-amber-500/5"}`}>
                {isRecommended && (
                  <span className="absolute top-3 right-3 text-[10px] font-mono bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">แนะนำ</span>
                )}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isMorning ? "bg-amber-500/15" : "bg-blue-500/15"}`}>
                  {/* [#1] 1.1.1 — Decorative icons inside labeled buttons; aria-hidden */}
                  {isMorning ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-amber-400" aria-hidden="true">
                      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2"/>
                      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-blue-400" aria-hidden="true">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-[var(--color-text)]">{isMorning ? "กะเช้า" : "กะบ่าย"}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5 font-mono">{isMorning ? "08:00 – 16:00" : "16:00 – 00:00"}</p>
                  {/* [#6] 1.4.3 — Elevated to text-muted for sufficient contrast */}
                <p className="text-xs text-[var(--color-text-muted)] mt-2">{isMorning ? "10 รายการตรวจสอบ" : "10 รายการตรวจสอบ"}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Checklist Page ───────────────────────────────────────────────────────────
function ChecklistPage({ session, onUpdate, onEndShift }: { session: ShiftSession; onUpdate: (s: ShiftSession) => void; onEndShift: () => void }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const isMorning = session.shift === "morning";
  const total = session.items.length;
  const done = session.items.filter((i) => i.completedAt).length;
  const allDone = done === total;
  const progress = total > 0 ? (done / total) * 100 : 0;

  function toggleItem(id: string) {
    if (session.completedAt) return;
    const updated = session.items.map((item) =>
      item.id === id ? { ...item, completedAt: item.completedAt ? null : new Date().toISOString() } : item
    );
    const allComplete = updated.every((i) => i.completedAt);
    let updatedSession = { ...session, items: updated };
    if (allComplete && !session.notified) {
      const completedAt = new Date().toISOString();
      updatedSession = { ...updatedSession, completedAt, notified: true };
      const notifs = getNotifications();
      notifs.push({ id: uid(), shiftSessionId: session.id, userName: session.userName, shift: session.shift, completedAt, read: false });
      saveNotifications(notifs);
    }
    onUpdate(updatedSession);
  }

  function endShift() {
    setShowConfirm(false);
    onEndShift();
  }

  return (
    <div className="min-h-full flex flex-col max-w-lg mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge color={isMorning ? "amber" : "blue"}>{isMorning ? "☀ กะเช้า" : "🌙 กะบ่าย"}</Badge>
            {allDone && <Badge color="green">✓ ครบแล้ว</Badge>}
          </div>
          <h1 className="text-lg font-semibold">{session.userName}</h1>
          <p className="text-xs text-[var(--color-text-muted)] font-mono mt-0.5">เริ่ม {fmtTime(session.startedAt)}</p>
        </div>
        <button onClick={() => setShowConfirm(true)}
          className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-red-500/40 hover:text-red-400 transition-colors">
          จบกะ
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-6 bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)]">
        <div className="flex justify-between text-xs mb-2">
          <span className="text-[var(--color-text-muted)]">ความคืบหน้า</span>
          <span className="font-mono text-[var(--color-text)]">{done}/{total}</span>
        </div>
        {/* [#4] 1.3.1 — role="progressbar" exposes progress to assistive tech */}
        <div role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total} aria-label={`ความคืบหน้า ${done} จาก ${total} รายการ`}
          className="h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        {/* [#12] 4.1.3 — role="status" announces completion message without stealing focus */}
        {allDone && (
          <p role="status" className="text-xs text-emerald-400 mt-2 font-medium">✓ แจ้งเตือนผู้จัดการเรียบร้อยแล้ว</p>
        )}
      </div>

      {/* Checklist */}
      <div className="space-y-2 flex-1">
        {session.items.map((item, idx) => {
          const isDone = !!item.completedAt;
          return (
            <button key={item.id} onClick={() => toggleItem(item.id)}
              className={`w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${isDone ? "bg-emerald-500/5 border-emerald-500/25" : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-2)]"}`}>
              <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${isDone ? "border-emerald-500 bg-emerald-500" : "border-[var(--color-text-subtle)]"}`}>
                {isDone && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {/* [#6] 1.4.3 — Elevated to text-muted for sufficient contrast */}
                  <span className="text-xs font-mono text-[var(--color-text-muted)]" aria-hidden="true">{String(idx + 1).padStart(2, "0")}</span>
                  <p className={`text-sm ${isDone ? "text-[var(--color-text-muted)] line-through" : "text-[var(--color-text)]"}`}>{item.label}</p>
                </div>
                {isDone && item.completedAt && (
                  <p className="text-[10px] font-mono text-emerald-500/70 mt-1">{fmtTime(item.completedAt)}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* [#11] 4.1.2 — role="dialog" + aria-modal + aria-labelledby + Escape handler */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
          onClick={() => setShowConfirm(false)}
          onKeyDown={(e) => e.key === "Escape" && setShowConfirm(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="confirm-shift-title"
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}>
            <h3 id="confirm-shift-title" className="font-semibold mb-2">จบกะงาน?</h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-6">
              {allDone ? "คุณทำงานครบทุกรายการแล้ว ยืนยันการจบกะ" : `ยังมีงานที่ยังไม่เสร็จ ${total - done} รายการ คุณแน่ใจหรือไม่?`}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
                ยกเลิก
              </button>
              <button onClick={endShift} className="flex-1 py-2 rounded-lg bg-red-500/80 hover:bg-red-500 text-white text-sm font-medium transition-colors">
                จบกะ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Manager Dashboard ────────────────────────────────────────────────────────
function ManagerDashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [notifications, setNotifications] = useState<Notification[]>(getNotifications);
  const [sessions, setSessions] = useState<ShiftSession[]>(getSessions);
  const [activeTab, setActiveTab] = useState<"inbox" | "history">("inbox");
  const [selectedSession, setSelectedSession] = useState<ShiftSession | null>(null);

  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const interval = setInterval(() => {
      setNotifications(getNotifications());
      setSessions(getSessions());
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  function markRead(id: string) {
    const updated = notifications.map((n) => n.id === id ? { ...n, read: true } : n);
    saveNotifications(updated);
    setNotifications(updated);
  }

  function markAllRead() {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    saveNotifications(updated);
    setNotifications(updated);
  }

  const completedSessions = sessions.filter((s) => s.completedAt).sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());

  return (
    <div className="min-h-full flex flex-col max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-[var(--color-text-muted)]">ผู้จัดการ</p>
          <h1 className="text-lg font-semibold">{user.name}</h1>
        </div>
        <button onClick={onLogout} className="text-xs text-[var(--color-text-muted)] hover:text-red-400 transition-colors px-3 py-1.5 rounded border border-[var(--color-border)] hover:border-red-500/30">
          ออกจากระบบ
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "แจ้งเตือนทั้งหมด", value: notifications.length, color: "text-[var(--color-text)]" },
          { label: "ยังไม่ได้อ่าน", value: unread, color: "text-amber-400" },
          { label: "กะที่เสร็จวันนี้", value: completedSessions.filter((s) => s.completedAt && new Date(s.completedAt).toDateString() === new Date().toDateString()).length, color: "text-emerald-400" },
        ].map((stat) => (
          <div key={stat.label} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4">
            <p className={`text-2xl font-semibold font-mono ${stat.color}`}>{stat.value}</p>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-1 mb-4">
        {(["inbox", "history"] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${activeTab === t ? "bg-[var(--color-surface-2)] text-[var(--color-text)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}>
            {t === "inbox" ? "กล่องแจ้งเตือน" : "ประวัติกะ"}
            {t === "inbox" && unread > 0 && (
              <span className="bg-amber-500 text-black text-[10px] font-bold font-mono rounded-full w-4 h-4 flex items-center justify-center">{unread}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "inbox" && (
        <div>
          {notifications.length > 0 && unread > 0 && (
            <div className="flex justify-end mb-3">
              <button onClick={markAllRead} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
                อ่านทั้งหมด
              </button>
            </div>
          )}
          {notifications.length === 0 ? (
            <div className="text-center py-16 text-[var(--color-text-muted)]">
              {/* [#1] 1.1.1 — Decorative empty-state bell */}
              <div className="w-12 h-12 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center mx-auto mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[var(--color-text-muted)]" aria-hidden="true">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </div>
              <p className="text-sm">ไม่มีการแจ้งเตือน</p>
            </div>
          ) : (
            <div className="space-y-2">
              {[...notifications].reverse().map((notif) => {
                const sess = sessions.find((s) => s.id === notif.shiftSessionId);
                return (
                  <div key={notif.id} className={`p-4 rounded-xl border transition-all ${!notif.read ? "bg-amber-500/5 border-amber-500/25" : "bg-[var(--color-surface)] border-[var(--color-border)]"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {!notif.read && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />}
                          <p className="text-sm font-medium">{notif.userName}</p>
                          <Badge color={notif.shift === "morning" ? "amber" : "blue"}>{notif.shift === "morning" ? "กะเช้า" : "กะบ่าย"}</Badge>
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)]">ตรวจสอบงานครบทุกรายการแล้ว</p>
                        {/* [#6] 1.4.3 — Elevated to text-muted */}
                        <p className="text-[10px] font-mono text-[var(--color-text-muted)] mt-1">{fmtDate(notif.completedAt)} {fmtTime(notif.completedAt)}</p>
                      </div>
                      <div className="flex gap-2">
                        {sess && (
                          <button onClick={() => { setSelectedSession(sess); markRead(notif.id); }}
                            className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-emerald-500/30 transition-colors">
                            ดูรายละเอียด
                          </button>
                        )}
                        {!notif.read && (
                          <button onClick={() => markRead(notif.id)}
                            className="text-xs px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors">
                            อ่านแล้ว
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-2">
          {completedSessions.length === 0 ? (
            <div className="text-center py-16 text-[var(--color-text-muted)] text-sm">ยังไม่มีประวัติกะ</div>
          ) : (
            completedSessions.map((sess) => (
              <button key={sess.id} onClick={() => setSelectedSession(sess)} className="w-full text-left p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-emerald-500/30 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium">{sess.userName}</p>
                      <Badge color={sess.shift === "morning" ? "amber" : "blue"}>{sess.shift === "morning" ? "กะเช้า" : "กะบ่าย"}</Badge>
                      <Badge color="green">{sess.items.filter((i) => i.completedAt).length}/{sess.items.length}</Badge>
                    </div>
                    {/* [#6] 1.4.3 — Elevated to text-muted */}
                    <p className="text-[10px] font-mono text-[var(--color-text-muted)]">{fmtDate(sess.completedAt!)} {fmtTime(sess.startedAt)} → {fmtTime(sess.completedAt!)}</p>
                  </div>
                  {/* [#1] 1.1.1 — Decorative chevron */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-[var(--color-text-muted)]" aria-hidden="true">
                    <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* [#11] 4.1.2 — role="dialog" + aria-modal + aria-labelledby + Escape + close label */}
      {selectedSession && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50"
          onClick={() => setSelectedSession(null)}
          onKeyDown={(e) => e.key === "Escape" && setSelectedSession(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="session-detail-title"
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 id="session-detail-title" className="font-semibold">{selectedSession.userName}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge color={selectedSession.shift === "morning" ? "amber" : "blue"}>{selectedSession.shift === "morning" ? "กะเช้า" : "กะบ่าย"}</Badge>
                    <span className="text-xs font-mono text-[var(--color-text-muted)]">{fmtDate(selectedSession.startedAt)}</span>
                  </div>
                </div>
                {/* [#2] 1.1.1 — Icon-only close button needs accessible name */}
                <button onClick={() => setSelectedSession(null)} aria-label="ปิด" className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                </button>
              </div>
              <Divider />
              <div className="mt-4 space-y-2">
                {selectedSession.items.map((item, idx) => (
                  <div key={item.id} className={`flex items-start gap-3 p-3 rounded-lg ${item.completedAt ? "bg-emerald-500/5" : "bg-[var(--color-surface-2)]"}`}>
                    <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${item.completedAt ? "border-emerald-500 bg-emerald-500" : "border-[var(--color-text-subtle)]"}`}>
                      {item.completedAt && <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <div className="flex-1">
                      <div className="flex gap-2">
                        <span className="text-[10px] font-mono text-[var(--color-text-subtle)]">{String(idx + 1).padStart(2, "0")}</span>
                        <p className="text-xs text-[var(--color-text)]">{item.label}</p>
                      </div>
                      {item.completedAt && (
                        <p className="text-[10px] font-mono text-emerald-500/70 mt-0.5">{fmtTime(item.completedAt)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
type Page = "auth" | "shift-select" | "checklist" | "manager";

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [page, setPage] = useState<Page>("auth");
  const [activeSession, setActiveSession] = useState<ShiftSession | null>(null);

  useEffect(() => {
    ensureDefaultManager();
    // [#8] 3.1.1 — Set valid BCP 47 language tag for Thai content
    document.documentElement.lang = "th";
  }, []);

  function handleLogin(user: User) {
    setCurrentUser(user);
    setPage(user.role === "manager" ? "manager" : "shift-select");
  }

  function handleShiftSelect(shift: "morning" | "afternoon") {
    if (!currentUser) return;
    const session: ShiftSession = {
      id: uid(),
      userId: currentUser.id,
      userName: currentUser.name,
      shift,
      startedAt: new Date().toISOString(),
      completedAt: null,
      items: (shift === "morning" ? MORNING_ITEMS : AFTERNOON_ITEMS).map((i) => ({ ...i, completedAt: null })),
      notified: false,
    };
    const sessions = getSessions();
    saveSessions([...sessions, session]);
    setActiveSession(session);
    setPage("checklist");
  }

  function handleSessionUpdate(updated: ShiftSession) {
    const sessions = getSessions().map((s) => s.id === updated.id ? updated : s);
    saveSessions(sessions);
    setActiveSession(updated);
  }

  function handleEndShift() {
    setActiveSession(null);
    setPage("shift-select");
  }

  function handleLogout() {
    setCurrentUser(null);
    setActiveSession(null);
    setPage("auth");
  }

  return (
    <div className="min-h-full bg-[var(--color-background)]">
      {page === "auth" && <AuthPage onLogin={handleLogin} />}
      {page === "shift-select" && currentUser && (
        <ShiftSelectPage user={currentUser} onSelect={handleShiftSelect} onLogout={handleLogout} />
      )}
      {page === "checklist" && activeSession && (
        <ChecklistPage session={activeSession} onUpdate={handleSessionUpdate} onEndShift={handleEndShift} />
      )}
      {page === "manager" && currentUser && (
        <ManagerDashboard user={currentUser} onLogout={handleLogout} />
      )}
    </div>
  );
}
