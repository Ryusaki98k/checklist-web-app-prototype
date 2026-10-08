import { useState, useEffect } from "react";
import { User, Role } from "../../types";
import { BrandLogo } from "../common/BrandLogo";
import { ThemeToggle } from "../common/ThemeToggle";
import { RoleSwitcher } from "../common/RoleSwitcher";
import { NavbarRefreshControl } from "../common/NavbarRefreshControl";
import { UserAvatar } from "../common/UserAvatar";
import { EditProfileModal } from "../common/EditProfileModal";
import { LogOut, RefreshCw, Snowflake, ShieldCheck, Settings2, UserPen } from "lucide-react";

import { createBranchAction, assignStaffToBranchAction, assignTasksToBranchAction, DashboardBranch as Branch } from "../../actions/branch";
import { fetchBranchesWithCache, invalidateBranchCache } from "../../utils/cache";
import { getAllUsersAction, updateUserRoleAction, updateUserPermissionsAction } from "../../actions/auth";
import { getAllTasksAction, createTaskAction, toggleTaskDisabledAction } from "../../actions/task";
import { AdminCronSettingsTab } from "./AdminCronSettingsTab";
import { AdminAddUserModal } from "./AdminAddUserModal";
import { AdminManageRefrigeratorsModal } from "./AdminManageRefrigeratorsModal";
import { AdminUserPermissionsModal } from "./AdminUserPermissionsModal";

interface MasterTask {
  id: string;
  title: string;
  role: "cashier" | "stock" | "manager_assistant";
  shift: "morning" | "afternoon" | "both";
  timeWindow: string;
  mandatory: boolean;
  active: boolean;
}



// Removed INITIAL_BRANCHES

const INITIAL_MASTER_TASKS: MasterTask[] = [
  {
    id: "mt-1",
    title: "สแกนนิ้วเข้างาน แต่งกายและติดป้ายชื่อเรียบร้อย",
    role: "cashier",
    shift: "morning",
    timeWindow: "06:00 – 07:30",
    mandatory: true,
    active: true,
  },
  {
    id: "mt-2",
    title: "เปิดเครื่อง POS ล็อกอินด้วยรหัสของตนเอง และทดสอบอุปกรณ์",
    role: "cashier",
    shift: "morning",
    timeWindow: "06:00 – 07:30",
    mandatory: true,
    active: true,
  },
  {
    id: "mt-3",
    title: "ตรวจนับเงินทอน (Float) ก้นลิ้นชักให้ครบถ้วน",
    role: "cashier",
    shift: "morning",
    timeWindow: "06:00 – 07:30",
    mandatory: true,
    active: true,
  },
  {
    id: "mt-4",
    title: "ตรวจเช็คอุณหภูมิตู้แช่เย็น (Chiller) และตู้แช่แข็ง (Freezer)",
    role: "stock",
    shift: "morning",
    timeWindow: "06:00 – 08:00",
    mandatory: true,
    active: true,
  },
  {
    id: "mt-5",
    title: "ตรวจรับสินค้าสด (Fresh Meat & Egg Supplies) จากรถขนส่ง",
    role: "stock",
    shift: "morning",
    timeWindow: "07:00 – 09:30",
    mandatory: true,
    active: true,
  },
  {
    id: "mt-6",
    title: "ตรวจสอบความเรียบร้อยของพนักงานก่อนเปิดประตูร้าน",
    role: "manager_assistant",
    shift: "morning",
    timeWindow: "07:30 – 08:00",
    mandatory: true,
    active: true,
  },
  {
    id: "mt-7",
    title: "ตรวจสอบยอดขายรอบเที่ยงและสรุปเงินส่งเซฟกลาง",
    role: "manager_assistant",
    shift: "afternoon",
    timeWindow: "14:00 – 15:30",
    mandatory: true,
    active: true,
  },
];



export function AdminDashboardView({
  user,
  onLogout,
}: {
  user: User;
  onLogout: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "branches" | "tasks" | "users" | "cron">("overview");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [tasks, setTasks] = useState<MasterTask[]>(INITIAL_MASTER_TASKS);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modal states
  const [isNewBranchModalOpen, setIsNewBranchModalOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [selectedBranchForRefrigerators, setSelectedBranchForRefrigerators] = useState<Branch | null>(null);

  const [isManageStaffModalOpen, setIsManageStaffModalOpen] = useState(false);
  const [selectedBranchForStaff, setSelectedBranchForStaff] = useState<string | null>(null);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [isSavingStaff, setIsSavingStaff] = useState(false);
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState("");

  const [isManageTasksModalOpen, setIsManageTasksModalOpen] = useState(false);
  const [selectedBranchForTasks, setSelectedBranchForTasks] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [isSavingTasks, setIsSavingTasks] = useState(false);
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [assignedTaskSearchQuery, setAssignedTaskSearchQuery] = useState("");
  const [tasksList, setTasksList] = useState<any[]>([]);

  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskRole, setNewTaskRole] = useState<"manager_assistant" | "cashier" | "stock">("cashier");
  const [newTaskShift, setNewTaskShift] = useState<"morning" | "afternoon" | "night" | "morning_afternoon">("morning");
  const [newTaskStart, setNewTaskStart] = useState("");
  const [newTaskEnd, setNewTaskEnd] = useState("");
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

  // Filters
  const [branchSearch, setBranchSearch] = useState("");
  const [taskRoleFilter, setTaskRoleFilter] = useState<"all" | "cashier" | "stock" | "manager_assistant">("all");
  const [userSearch, setUserSearch] = useState("");
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [isUpdatingRole, setIsUpdatingRole] = useState<string | null>(null);
  const [editingPermissionsUser, setEditingPermissionsUser] = useState<User | null>(null);

  function togglePassword(userId: string) {
    setVisiblePasswords(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  const loadBranches = async (force = false) => {
    const res = await fetchBranchesWithCache({ force, intervalMs: 30000 });
    if (res.success && res.branches) {
      setBranches(res.branches);
      if (force) showToast("อัปเดตข้อมูลสาขาล่าสุดเรียบร้อย");
    } else {
      showToast(res.error || "โหลดข้อมูลสาขาไม่สำเร็จ");
    }
  };

  const loadUsers = async () => {
    const resUsers = await getAllUsersAction();

    if (resUsers.success && resUsers.users) {
      setUsersList(resUsers.users);
    } else {
      showToast(resUsers.error || "โหลดข้อมูลผู้ใช้ไม่สำเร็จ");
    }
  };

  const loadTasks = async () => {
    const res = await getAllTasksAction();
    if (res.success && res.tasks) {
      setTasksList(res.tasks);
    } else {
      showToast(res.error || "โหลดข้อมูลงานไม่สำเร็จ");
    }
  };

  useEffect(() => {
    loadUsers();
    loadTasks();
    loadBranches();
  }, []);

  const [isAdminRefreshing, setIsAdminRefreshing] = useState(false);
  const [isAdminDbRefreshing, setIsAdminDbRefreshing] = useState(false);
  const [adminLastRefreshedAt, setAdminLastRefreshedAt] = useState<Date | null>(new Date());
  const [adminLastRefreshType, setAdminLastRefreshType] = useState<"cache" | "db">("cache");

  const handleAdminNavbarRefresh = async () => {
    try {
      setIsAdminRefreshing(true);
      await Promise.all([
        loadBranches(false),
        loadUsers(),
        loadTasks(),
      ]);
      setAdminLastRefreshedAt(new Date());
      setAdminLastRefreshType("cache");
      showToast("รีเฟรชข้อมูลระบบเรียบร้อยแล้ว");
    } catch (err) {
      console.error("Admin refresh error:", err);
    } finally {
      setIsAdminRefreshing(false);
    }
  };

  const handleAdminNavbarRefreshFromDb = async () => {
    try {
      setIsAdminDbRefreshing(true);
      invalidateBranchCache();
      await Promise.all([
        loadBranches(true),
        loadUsers(),
        loadTasks(),
      ]);
      setAdminLastRefreshedAt(new Date());
      setAdminLastRefreshType("db");
      showToast("ดึงข้อมูลสดจากฐานข้อมูลเรียบร้อย (Bypass Cache)");
    } catch (err) {
      console.error("Admin refresh from DB error:", err);
    } finally {
      setIsAdminDbRefreshing(false);
    }
  };

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }

  async function handleCreateBranch(e: React.FormEvent) {
    e.preventDefault();
    if (!newBranchName.trim()) return showToast("กรุณาระบุชื่อสาขา");

    setIsCreatingBranch(true);
    const res = await createBranchAction(newBranchName);
    setIsCreatingBranch(false);

    if (res.success) {
      showToast("เพิ่มสาขาใหม่สำเร็จ");
      setIsNewBranchModalOpen(false);
      setNewBranchName("");
      invalidateBranchCache();
      loadBranches(true);
    } else {
      showToast(res.error || "เกิดข้อผิดพลาด");
    }
  }



  function openManageStaffModal(branchId: string) {
    setSelectedBranchForStaff(branchId);
    const branch = branches.find((b) => b.id === branchId);
    setSelectedStaffIds(branch ? branch.members : []);
    setIsManageStaffModalOpen(true);
  }

  async function handleSaveStaff() {
    if (!selectedBranchForStaff) return;
    setIsSavingStaff(true);

    const res = await assignStaffToBranchAction(selectedBranchForStaff, selectedStaffIds);
    setIsSavingStaff(false);

    if (res.success) {
      showToast("บันทึกการมอบหมายพนักงานสำเร็จ");
      setIsManageStaffModalOpen(false);
      invalidateBranchCache();
      loadBranches(true);
    } else {
      showToast(res.error || "เกิดข้อผิดพลาด");
    }
  }

  function openManageTasksModal(branchId: string) {
    const branch = branches.find((b) => b.id === branchId);
    if (!branch) return;
    setSelectedBranchForTasks(branch.id);
    setSelectedTaskIds(branch.tasks || []);
    setIsManageTasksModalOpen(true);
  }

  async function handleSaveTasks() {
    if (!selectedBranchForTasks) return;
    setIsSavingTasks(true);
    const res = await assignTasksToBranchAction(selectedBranchForTasks, selectedTaskIds);
    if (res.success) {
      showToast("บันทึกการตั้งค่างานของสาขาสำเร็จ");
      invalidateBranchCache();
      await loadBranches(true);
      setIsManageTasksModalOpen(false);
    } else {
      showToast(res.error || "เกิดข้อผิดพลาด");
    }
    setIsSavingTasks(false);
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTaskName.trim()) return showToast("กรุณาระบุชื่องาน");

    setIsCreatingTask(true);
    const res = await createTaskAction({
      name: newTaskName,
      task_role: newTaskRole,
      shift: newTaskShift,
      start: newTaskStart,
      end: newTaskEnd,
      disabled: false
    });
    setIsCreatingTask(false);

    if (res.success) {
      showToast("เพิ่มงานใหม่สำเร็จ");
      setIsCreateTaskModalOpen(false);
      setNewTaskName("");
      setNewTaskStart("");
      setNewTaskEnd("");
      loadTasks(); // reload from DB
    } else {
      showToast(res.error || "เกิดข้อผิดพลาด");
    }
  }

  async function toggleTaskStatus(taskId: string, currentDisabled: boolean) {
    const nextDisabled = !currentDisabled;
    setTasksList((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, disabled: nextDisabled } : t))
    );
    try {
      const res = await toggleTaskDisabledAction(taskId, nextDisabled);
      if (res.success) {
        showToast(nextDisabled ? "ปิดการใช้งานงานนี้แล้ว (ซ่อนจากเช็คลิสต์)" : "เปิดการใช้งานงานนี้เรียบร้อยแล้ว");
        invalidateBranchCache();
      } else {
        showToast(res.error || "เกิดข้อผิดพลาดในการปรับสถานะ");
        setTasksList((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, disabled: currentDisabled } : t))
        );
      }
    } catch {
      showToast("เกิดข้อผิดพลาดในการปรับสถานะ");
      setTasksList((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, disabled: currentDisabled } : t))
      );
    }
  }

  async function handlePromoteUser(userId: string, newRole: Role) {
    if (userId === user.id && newRole !== "admin") {
      showToast("ไม่สามารถลดระดับสิทธิ์ของบัญชีตนเองได้");
      return;
    }

    const prevRole = usersList.find((u) => u.id === userId)?.role;
    // Optimistic UI update
    setUsersList((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    );
    setIsUpdatingRole(userId);

    try {
      const res = await updateUserRoleAction(userId, newRole);
      if (res.success) {
        showToast(`ปรับเปลี่ยนสิทธิ์ผู้ใช้เป็น ${newRole} สำเร็จ`);
        // Refresh from DB to guarantee exact sync
        const fresh = await getAllUsersAction();
        if (fresh.success && fresh.users) {
          setUsersList(fresh.users);
        }
      } else {
        showToast(res.error || "ไม่สามารถเปลี่ยนสิทธิ์ผู้ใช้ได้");
        if (prevRole) {
          setUsersList((prev) =>
            prev.map((u) => (u.id === userId ? { ...u, role: prevRole } : u))
          );
        }
      }
    } catch (err) {
      console.error("handlePromoteUser error:", err);
      showToast("เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล");
      if (prevRole) {
        setUsersList((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: prevRole } : u))
        );
      }
    } finally {
      setIsUpdatingRole(null);
    }
  }



  const filteredBranches = branches.filter((b) =>
    b.name.toLowerCase().includes(branchSearch.toLowerCase()) ||
    b.code.toLowerCase().includes(branchSearch.toLowerCase())
  );

  const filteredTasks = tasksList.filter((t) =>
    taskRoleFilter === "all" ? true : t.task_role === taskRoleFilter
  );

  const filteredUsers = usersList.filter((u) =>
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.username && u.username.toLowerCase().includes(userSearch.toLowerCase())) ||
    (u.position && u.position.toLowerCase().includes(userSearch.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] flex flex-col justify-between">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-[var(--color-brown)] text-amber-100 border border-amber-500/40 text-xs font-bold px-4 py-2.5 rounded-xl shadow-xl animate-fade-in flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Navbar */}
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-md sticky top-0 z-40 px-3 sm:px-8 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <BrandLogo size={38} showText={true} hideTextOnMobile={true} isDark={false} />
          <div className="hidden md:flex items-center gap-2 pl-4 border-l border-[var(--color-border)]">
            <span className="text-xs font-mono font-bold tracking-wider uppercase bg-amber-100 text-amber-950 border border-amber-300 px-2.5 py-1 rounded-lg shadow-2xs">
              System Admin Portal
            </span>
            <span className="text-xs text-[var(--color-text-muted)] font-semibold">ระดับศูนย์กลางองค์กร</span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <NavbarRefreshControl
            onRefresh={handleAdminNavbarRefresh}
            onRefreshFromDb={handleAdminNavbarRefreshFromDb}
            isLoading={isAdminRefreshing}
            isDbLoading={isAdminDbRefreshing}
            lastRefreshedAt={adminLastRefreshedAt}
            lastRefreshType={adminLastRefreshType}
          />
          <div className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-[var(--color-border)]">
            <div className="text-right hidden sm:block">
              <div className="flex items-center gap-1.5 justify-end">
                <p className="text-xs font-bold text-[var(--color-text)]">{user.name}</p>
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(true)}
                  className="p-1 rounded-lg text-[var(--color-text-muted)] hover:text-amber-700 hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
                  title="แก้ไขโปรไฟล์"
                  aria-label="แก้ไขโปรไฟล์"
                >
                  <UserPen size={12} />
                </button>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] font-semibold">{user.position || "ผู้ดูแลระบบส่วนกลาง"}</p>
            </div>
            <UserAvatar
              user={user}
              size="sm"
              editable={true}
              onEdit={() => setIsEditProfileOpen(true)}
              className="cursor-pointer shadow-xs"
              title="คลิกเพื่อแก้ไขโปรไฟล์"
            />
          </div>

          <RoleSwitcher />
          <ThemeToggle />
          <button
            type="button"
            onClick={onLogout}
            title="ออกจากระบบ"
            aria-label="ออกจากระบบ"
            className="text-xs sm:text-sm text-[var(--color-text)] hover:text-rose-700 hover:bg-rose-50 hover:border-rose-300 dark:hover:bg-rose-950/40 dark:hover:border-rose-700 transition-all px-3 py-2 rounded-xl border border-[var(--color-border)] font-bold cursor-pointer min-h-[38px] inline-flex items-center justify-center gap-1.5 shrink-0"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">ออกจากระบบ</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* Navigation Tabs Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
          <div className="flex items-center gap-1 bg-[var(--color-surface-2)] p-1.5 rounded-2xl border border-[var(--color-border)] text-xs font-semibold max-w-full overflow-x-auto no-scrollbar">
            {[
              { id: "overview", label: "ภาพรวมระบบ (Overview)" },
              { id: "branches", label: `จัดการสาขา (${branches.length})` },
              { id: "tasks", label: `แม่แบบงานกลาง (${tasks.length})` },
              { id: "users", label: `จัดการผู้ใช้และสิทธิ์ (${usersList.length})` },
              { id: "cron", label: "ตั้งค่างานระบบ (Cron Jobs)" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 sm:px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${activeTab === tab.id
                  ? "bg-[var(--color-brown)] text-amber-200 dark:bg-amber-400 dark:text-amber-950 shadow-sm font-bold"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] font-semibold"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-2xs" />
            <span className="text-xs text-[var(--color-text-muted)] font-mono">DB Pooler: Connected</span>
          </div>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-fade-in">
            {/* ─── Enterprise Fleet Status Strip ─────────────────────────────────── */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6 divide-y md:divide-y-0 md:divide-x divide-[var(--color-border)]">
              {/* Metric 1: Branch Network */}
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                    เครือข่ายสาขาทั่วประเทศ
                  </span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800">
                    Online 100%
                  </span>
                </div>
                <div className="flex items-baseline gap-2 pt-1">
                  <span className="text-3xl font-extrabold font-mono text-[var(--color-text)]">
                    {branches.filter(b => b.status === "active").length}
                  </span>
                  <span className="text-xs text-[var(--color-text-subtle)] font-medium">
                    / {branches.length} สาขาเปิดทำการ
                  </span>
                </div>
              </div>

              {/* Metric 2: Personnel */}
              <div className="flex-1 pt-4 md:pt-0 md:pl-6 space-y-1">
                <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                  บุคลากรในระบบ
                </span>
                <div className="flex items-baseline gap-2 pt-1">
                  <span className="text-3xl font-extrabold font-mono text-[var(--color-text)]">
                    {usersList.length || 8}
                  </span>
                  <span className="text-xs text-[var(--color-text-subtle)] font-medium">
                    บัญชีผู้ปฏิบัติงาน
                  </span>
                </div>
              </div>

              {/* Metric 3: Standard Master Tasks */}
              <div className="flex-1 pt-4 md:pt-0 md:pl-6 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                    แม่แบบงานมาตรฐานกลาง
                  </span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                    SOP Master
                  </span>
                </div>
                <div className="flex items-baseline gap-2 pt-1">
                  <span className="text-3xl font-extrabold font-mono text-[var(--color-text)]">
                    {tasksList.length || tasks.length}
                  </span>
                  <span className="text-xs text-[var(--color-text-subtle)] font-medium">
                    ขั้นตอนการตรวจงาน
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Status Table */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-[var(--color-text)]">สรุปผลการปฏิบัติงานรายสาขาประจำวัน</h3>
                  <p className="text-xs text-[var(--color-text-muted)]">แสดงข้อมูลความคืบหน้าการเช็คลิสต์ของทุกสาขาแบบเรียลไทม์</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("branches")}
                  className="text-xs text-amber-700 hover:text-[var(--color-amber)] font-semibold transition-colors cursor-pointer"
                >
                  จัดการสาขาทั้งหมด →
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[var(--color-border)] text-[var(--color-text)] font-bold bg-[var(--color-surface-2)]">
                    <tr>
                      <th className="py-3 px-3 rounded-l-lg font-bold">รหัสสาขา</th>
                      <th className="py-3 px-3 font-bold">ชื่อสาขา</th>
                      <th className="py-3 px-3 font-bold">ผู้จัดการประจำสาขา</th>
                      <th className="py-3 px-3 font-bold">พนักงาน</th>
                      <th className="py-3 px-3 font-bold">สถานะ</th>
                      <th className="py-3 px-3 text-right rounded-r-lg font-bold">ความคืบหน้า Checklist</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]/70">
                    {branches.map((b) => (
                      <tr key={b.id} className="hover:bg-[var(--color-background)] transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-amber-950 dark:text-amber-200">{b.code}</td>
                        <td className="py-3 px-3 font-semibold text-[var(--color-text)]">{b.name}</td>
                        <td className="py-3 px-3 text-[var(--color-text-muted)] font-medium">{b.managerName}</td>
                        <td className="py-3 px-3 text-[var(--color-text)] font-mono font-semibold">{b.staffCount} คน</td>
                        <td className="py-3 px-3">
                          <span
                            className={`text-xs font-bold px-2.5 py-0.5 rounded-full border shadow-2xs ${b.status === "active"
                              ? "bg-emerald-100 text-emerald-950 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-800"
                              : "bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-800"
                              }`}
                          >
                            {b.status === "active" ? "เปิดปกติ" : "รอเปิด"}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-24 h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden border border-[var(--color-border)]">
                              <div
                                className={`h-full rounded-full ${b.todayCompletionRate === 100
                                  ? "bg-emerald-500"
                                  : b.todayCompletionRate > 80
                                    ? "bg-amber-400"
                                    : "bg-[var(--color-border)]"
                                  }`}
                                style={{ width: `${b.todayCompletionRate}%` }}
                              />
                            </div>
                            <span className="font-mono font-bold text-[var(--color-text)] w-10 text-right">
                              {b.todayCompletionRate}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BRANCH MANAGEMENT */}
        {activeTab === "branches" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[var(--color-surface)] border border-[var(--color-border)] p-4 rounded-2xl shadow-sm">
              <input
                id="branch-search-input"
                type="text"
                value={branchSearch}
                onChange={(e) => setBranchSearch(e.target.value)}
                placeholder="ค้นหาชื่อสาขา หรือรหัสสาขา..."
                aria-label="ค้นหาชื่อสาขา หรือรหัสสาขา"
                className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-3.5 py-2 text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:outline-none focus:border-amber-400 w-full sm:w-80"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadBranches(true)}
                  title="รีเฟรชข้อมูลสาขา (อัปเดตทันที)"
                  className="bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] text-[var(--color-text)] text-xs font-semibold px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-[var(--color-border)] shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>รีเฟรช</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsNewBranchModalOpen(true)}
                  className="bg-[var(--color-brown)] hover:bg-[var(--color-brown-light)] text-amber-100 text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span>+ เพิ่มสาขาใหม่</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBranches.map((b) => (
                <div key={b.id} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 space-y-4 hover:border-amber-400 shadow-sm transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-mono font-bold text-amber-950 dark:text-amber-200 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded border border-[var(--color-amber)]">
                        {b.code}
                      </span>
                      <h4 className="text-base font-bold text-[var(--color-text)] mt-1.5">{b.name}</h4>
                      <p className="text-xs text-[var(--color-text-muted)]">{b.location}</p>
                    </div>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${b.status === "active"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-[var(--color-amber-glow)] text-[var(--color-amber)] border border-[var(--color-amber)]"
                        }`}
                    >
                      {b.status === "active" ? "เปิดทำการ" : "Standby"}
                    </span>
                  </div>

                  <div className="pt-3 border-t border-[var(--color-border)] grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-[var(--color-text-subtle)]">ผู้จัดการสาขา</p>
                      <p className="font-semibold text-[var(--color-text)] mt-0.5 truncate">{b.managerName}</p>
                    </div>
                    <div>
                      <p className="text-[var(--color-text-subtle)]">จำนวนพนักงาน</p>
                      <p className="font-semibold text-[var(--color-text)] mt-0.5">{b.staffCount} คน</p>
                    </div>
                  </div>

                  <div className="pt-2 grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => openManageStaffModal(b.id)}
                      className="text-xs font-bold text-[var(--color-text)] hover:text-amber-950 bg-[var(--color-surface-2)] hover:bg-amber-100 min-h-[38px] inline-flex items-center justify-center px-2 py-1.5 rounded-xl border border-[var(--color-border)] transition-all cursor-pointer"
                    >
                      จัดการสาขา
                    </button>
                    <button
                      type="button"
                      onClick={() => openManageTasksModal(b.id)}
                      className="text-xs font-bold text-amber-950 bg-amber-100 hover:bg-amber-200 min-h-[38px] inline-flex items-center justify-center px-2 py-1.5 rounded-xl border border-amber-300 transition-all cursor-pointer"
                    >
                      จัดการงาน
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedBranchForRefrigerators(b)}
                      className="text-xs font-bold text-cyan-900 dark:text-cyan-200 bg-cyan-50 dark:bg-cyan-950/40 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 min-h-[38px] inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl border border-cyan-300 dark:border-cyan-800 transition-all cursor-pointer"
                      title="กำหนดค่าตู้แช่และช่วงอุณหภูมิประจำสาขานี้"
                    >
                      <Snowflake className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                      <span>จัดการตู้แช่</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: MASTER TASKS */}
        {activeTab === "tasks" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[var(--color-surface)] border border-[var(--color-border)] p-4 rounded-2xl shadow-sm">
              <div className="flex items-center gap-1 bg-[var(--color-surface-2)] p-1 rounded-xl border border-[var(--color-border)] text-xs font-semibold max-w-full overflow-x-auto no-scrollbar">
                {[
                  { id: "all", label: "ทั้งหมด" },
                  { id: "cashier", label: "แคชเชียร์" },
                  { id: "stock", label: "สต็อก/จัดเรียง" },
                  { id: "manager_assistant", label: "ผู้ช่วยผู้จัดการ" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setTaskRoleFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0 ${taskRoleFilter === f.id ? "bg-[var(--color-brown)] text-amber-100 font-bold" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                      }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setIsCreateTaskModalOpen(true)}
                className="bg-[var(--color-brown)] hover:bg-[var(--color-brown-light)] text-amber-100 text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer shadow-sm"
              >
                + เพิ่มรายการงานใหม่
              </button>
            </div>

            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[var(--color-border)] text-[var(--color-text-muted)] font-semibold bg-[var(--color-surface-2)]">
                    <tr>
                      <th className="py-3.5 px-4">รายการงาน (Master Task)</th>
                      <th className="py-3.5 px-3">ตำแหน่งงาน</th>
                      <th className="py-3.5 px-3">กะงาน</th>
                      <th className="py-3.5 px-3">ช่วงเวลา</th>
                      <th className="py-3.5 px-3 text-right">สถานะระบบ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]/70">
                    {filteredTasks.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-[var(--color-text-subtle)]">ไม่มีข้อมูล หรือ ไม่มีงานในตำแหน่งนี้</td>
                      </tr>
                    ) : (
                      filteredTasks.map((t, idx) => (
                        <tr key={t.id} className="hover:bg-[var(--color-background)] transition-colors">
                          <td className="py-3.5 px-4 font-medium text-[var(--color-text)] max-w-md">
                            <span className="font-mono text-[var(--color-text-subtle)] mr-2">{String(idx + 1).padStart(2, "0")}</span>
                            <span>{t.name}</span>
                          </td>
                          <td className="py-3.5 px-3">
                            <span className="px-2 py-0.5 rounded-md bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border border-[var(--color-border)] font-semibold text-[11px]">
                              {t.task_role === "cashier" ? "แคชเชียร์" : t.task_role === "stock" ? "สต็อก/จัดเรียง" : "ผู้ช่วยผจก."}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-[var(--color-text-muted)] capitalize">{t.shift === "morning" ? "กะเช้า" : t.shift === "afternoon" ? "กะบ่าย" : "ควบกะ"}</td>
                          <td className="py-3.5 px-3 font-mono text-[var(--color-text-muted)]">{t.start ? `${t.start} - ${t.end}` : "ตามเวลาปฏิบัติการ"}</td>
                          <td className="py-3.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => toggleTaskStatus(t.id, Boolean(t.disabled))}
                              title={t.disabled ? "คลิกเพื่อเปิดใช้งาน" : "คลิกเพื่อปิดชั่วคราว"}
                              className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer border ${!t.disabled
                                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                : "bg-[var(--color-surface-2)] text-[var(--color-text-subtle)] hover:bg-rose-50 hover:text-rose-700 border-[var(--color-border)]"
                                }`}
                            >
                              {!t.disabled ? "✓ ทำงานได้" : "✕ ปิดชั่วคราว"}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: USERS & PERMISSIONS */}
        {activeTab === "users" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[var(--color-surface)] border border-[var(--color-border)] p-4 rounded-2xl shadow-sm">
              <input
                id="user-search-input"
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="ค้นหาชื่อผู้ใช้งาน หรือตำแหน่ง..."
                aria-label="ค้นหาชื่อผู้ใช้งาน หรือตำแหน่ง"
                className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-3.5 py-2 text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:outline-none focus:border-amber-400 w-full sm:w-80"
              />

              <button
                type="button"
                onClick={() => setIsAddUserModalOpen(true)}
                className="bg-[var(--color-brown)] hover:bg-[var(--color-brown-light)] text-amber-100 text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                + เพิ่มผู้ใช้ใหม่
              </button>
            </div>

            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[var(--color-border)] text-[var(--color-text-muted)] font-semibold bg-[var(--color-surface-2)]">
                    <tr>
                      <th className="py-3.5 px-4">ชื่อ-นามสกุล</th>
                      <th className="py-3.5 px-3">ชื่อผู้ใช้ (Username)</th>
                      <th className="py-3.5 px-3">รหัสผ่าน</th>
                      <th className="py-3.5 px-3">บทบาทระบบ (Role)</th>
                      <th className="py-3.5 px-3">ตำแหน่งที่กำหนด</th>
                      <th className="py-3.5 px-3">คะแนนสะสม (แต้ม)</th>
                      <th className="py-3.5 px-3 text-right">ปรับเปลี่ยนสิทธิ์</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]/70">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-[var(--color-background)] transition-colors">
                        <td className="py-3.5 px-4 font-bold text-[var(--color-text)] flex items-center gap-2.5">
                          <UserAvatar user={u} size="xs" />
                          <span>{u.name}</span>
                        </td>
                        <td className="py-3.5 px-3 font-mono text-[var(--color-text-muted)]">{u.username || u.name}</td>
                        <td className="py-3.5 px-3 font-mono text-[var(--color-text-muted)]">
                          <div className="flex items-center gap-2">
                            <span>
                              {visiblePasswords.has(u.id) ? (u.password || "ไม่มีรหัสผ่าน") : "••••••••"}
                            </span>
                            <button
                              type="button"
                              onClick={() => togglePassword(u.id)}
                              className="text-[var(--color-text-subtle)] hover:text-amber-700 cursor-pointer min-h-[44px] min-w-[44px] sm:min-h-[28px] sm:min-w-[28px] inline-flex items-center justify-center rounded-lg"
                              title={visiblePasswords.has(u.id) ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                            >
                              {visiblePasswords.has(u.id) ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" /></svg>
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${u.role === "admin" || u.role === "committee"
                              ? "bg-[var(--color-brown)] text-amber-300 border border-[var(--color-text)]"
                              : u.role === "manager" || u.role === "general_manager"
                                ? "bg-amber-100 text-amber-950 border border-amber-300"
                                : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border border-[var(--color-border)]"
                              }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-[var(--color-text-muted)]">{u.position || "-"}</td>
                        <td className="py-3.5 px-3">
                          <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                            {u.point ?? 0}
                          </span>
                          <span className="text-[10px] text-[var(--color-text-subtle)] ml-1">แต้ม</span>
                        </td>

                        <td className="py-3.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            <div className="flex items-center gap-1 flex-wrap justify-end">
                              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/60" title="พนักงานสาขา">
                                Staff
                              </span>
                              {u.managerType === "assistant" && (
                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-400 dark:border-emerald-700/60" title="ผู้ช่วยผู้จัดการร้าน">
                                  ผู้ช่วย ผจก.
                                </span>
                              )}
                              {u.managerType === "store" && (
                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-600 text-white shadow-2xs" title="ผู้จัดการร้าน">
                                  ผจก.ร้าน
                                </span>
                              )}
                              {u.executiveType === "committee" && (
                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/15 text-blue-800 dark:text-blue-300 border border-blue-400 dark:border-blue-700/60" title="กรรมการบริหาร">
                                  กรรมการ
                                </span>
                              )}
                              {u.executiveType === "executive" && (
                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-600 text-white shadow-2xs" title="ผู้จัดการทั่วไป (GM)">
                                  GM
                                </span>
                              )}
                              {u.isAdmin && (
                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-600 text-white shadow-2xs" title="ผู้ดูแลระบบส่วนกลาง">
                                  Admin
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => setEditingPermissionsUser(u)}
                              className="px-2 py-1 rounded-xl bg-[var(--color-surface-2)] hover:bg-amber-500/15 text-[var(--color-text)] hover:text-amber-900 dark:hover:text-amber-200 border border-[var(--color-border)] hover:border-amber-400 text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer shrink-0"
                              title={`กำหนดสิทธิ์แบบละเอียดสำหรับ ${u.name}`}
                            >
                              <Settings2 size={12} />
                              <span>ตั้งค่าสิทธิ์</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: CRON SETTINGS */}
        {activeTab === "cron" && (
          <AdminCronSettingsTab showToast={showToast} />
        )}



        {isNewBranchModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
              <div className="px-6 py-4 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-surface-2)]">
                <h3 className="font-bold text-[var(--color-text)] text-lg">เพิ่มสาขาใหม่</h3>
                <button
                  type="button"
                  onClick={() => setIsNewBranchModalOpen(false)}
                  aria-label="ปิดหน้าต่างเพิ่มสาขา"
                  title="ปิดหน้าต่าง"
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 rounded-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <div className="p-6">
                <form onSubmit={handleCreateBranch} className="space-y-4">
                  <div>
                    <label htmlFor="new-branch-name-input" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">ชื่อสาขา (อย่างน้อย 3 ตัวอักษร)</label>
                    <input
                      id="new-branch-name-input"
                      type="text"
                      required
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      placeholder="เช่น สาขาพญาไท"
                      className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:outline-none focus:border-amber-400 transition-colors"
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsNewBranchModalOpen(false)}
                      className="flex-1 py-3 bg-[var(--color-surface-2)] hover:bg-[var(--color-border-subtle)] text-[var(--color-text-muted)] border border-[var(--color-border)] rounded-xl text-sm font-bold transition-all cursor-pointer"
                    >
                      ยกเลิกการสร้างสาขา
                    </button>
                    <button
                      type="submit"
                      disabled={isCreatingBranch || newBranchName.length < 3}
                      className="flex-1 py-3 bg-[var(--color-brown)] hover:bg-[var(--color-brown-light)] disabled:opacity-50 disabled:cursor-not-allowed text-amber-300 rounded-xl text-sm font-bold transition-all shadow-sm cursor-pointer"
                    >
                      {isCreatingBranch ? "กำลังสร้าง..." : "บันทึกข้อมูลสาขา"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {isManageStaffModalOpen && selectedBranchForStaff && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
              <div className="px-6 py-4 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-surface-2)]">
                <h3 className="font-bold text-[var(--color-text)] text-lg">จัดการพนักงานและผู้จัดการสาขา</h3>
                <button
                  type="button"
                  onClick={() => setIsManageStaffModalOpen(false)}
                  aria-label="ปิดหน้าต่างจัดการพนักงาน"
                  title="ปิดหน้าต่าง"
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 rounded-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden divide-y md:divide-y-0 md:divide-x divide-[var(--color-border)]">
                {/* Left Panel: Assigned Staff (Cards Stack) */}
                <div className="w-full md:w-1/2 flex flex-col bg-[var(--color-background)] shrink-0 md:shrink min-h-[280px] md:min-h-0">
                  <div className="p-4 border-b border-[var(--color-border)]">
                    <h4 className="font-semibold text-emerald-700">พนักงานประจำสาขานี้</h4>
                    <p className="text-xs text-[var(--color-text-muted)]">บุคลากรที่ถูกคัดเลือกและจัดตารางงานแล้ว</p>
                  </div>
                  <div className="p-4 overflow-y-auto flex-1 space-y-4">
                    {/* Management Level */}
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden shadow-xs">
                      <div className="bg-[var(--color-amber-glow)] border-b border-[var(--color-border)] px-3 py-2 text-xs font-bold text-[var(--color-amber)]">
                        ผู้จัดการร้าน (Manager)
                      </div>
                      <div className="p-2 space-y-1">
                        {usersList.filter(u => selectedStaffIds.includes(u.id) && (u.role === "manager" || u.role === "general_manager")).length === 0 && (
                          <div className="text-xs text-[var(--color-text-subtle)] text-center py-2">ยังไม่มีบุคลากร</div>
                        )}
                        {usersList.filter(u => selectedStaffIds.includes(u.id) && (u.role === "manager" || u.role === "general_manager")).map((user) => (
                          <div key={user.id} className="flex justify-between items-center p-2 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                            <div>
                              <p className="text-sm font-bold text-[var(--color-text)] leading-tight">{user.name}</p>
                              <p className="text-[10px] text-[var(--color-text-subtle)] mt-0.5">@{user.username || user.name}</p>
                            </div>
                            <button onClick={() => setSelectedStaffIds(prev => prev.filter(id => id !== user.id))} className="text-rose-700 text-xs min-h-[44px] min-w-[44px] sm:min-h-[28px] sm:min-w-0 inline-flex items-center justify-center px-3 py-2 sm:px-2 sm:py-1 rounded-lg bg-rose-50 hover:bg-rose-100 font-semibold cursor-pointer whitespace-nowrap transition-colors">นำออก</button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Assistant Level */}
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden shadow-xs">
                      <div className="bg-[var(--color-amber-glow)]/60 border-b border-[var(--color-border)] px-3 py-2 text-xs font-bold text-[var(--color-text)]">
                        ผู้ช่วยผู้จัดการ (Assistant)
                      </div>
                      <div className="p-2 space-y-1">
                        {usersList.filter(u => selectedStaffIds.includes(u.id) && u.role === "manager_assistant").length === 0 && (
                          <div className="text-xs text-[var(--color-text-subtle)] text-center py-2">ยังไม่มีบุคลากร</div>
                        )}
                        {usersList.filter(u => selectedStaffIds.includes(u.id) && u.role === "manager_assistant").map((user) => (
                          <div key={user.id} className="flex justify-between items-center p-2 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                            <div>
                              <p className="text-sm font-bold text-[var(--color-text)] leading-tight">{user.name}</p>
                            </div>
                            <button onClick={() => setSelectedStaffIds(prev => prev.filter(id => id !== user.id))} className="text-rose-700 text-xs min-h-[44px] min-w-[44px] sm:min-h-[28px] sm:min-w-0 inline-flex items-center justify-center px-3 py-2 sm:px-2 sm:py-1 rounded-lg bg-rose-50 hover:bg-rose-100 font-semibold cursor-pointer whitespace-nowrap transition-colors">นำออก</button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Staff Level */}
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden shadow-xs">
                      <div className="bg-[var(--color-surface-2)] border-b border-[var(--color-border)] px-3 py-2 text-xs font-bold text-[var(--color-text-muted)]">
                        พนักงานทั่วไป (Staff)
                      </div>
                      <div className="p-2 space-y-1">
                        {usersList.filter(u => selectedStaffIds.includes(u.id) && u.role === "employee").length === 0 && (
                          <div className="text-xs text-[var(--color-text-subtle)] text-center py-2">ยังไม่มีบุคลากร</div>
                        )}
                        {usersList.filter(u => selectedStaffIds.includes(u.id) && u.role === "employee").map((user) => (
                          <div key={user.id} className="flex justify-between items-center p-2 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                            <div>
                              <p className="text-sm font-bold text-[var(--color-text)] leading-tight">{user.name}</p>
                              <p className="text-[10px] text-[var(--color-text-subtle)]">{user.position || "พนักงาน"}</p>
                            </div>
                            <button onClick={() => setSelectedStaffIds(prev => prev.filter(id => id !== user.id))} className="text-rose-700 text-xs min-h-[44px] min-w-[44px] sm:min-h-[28px] sm:min-w-0 inline-flex items-center justify-center px-3 py-2 sm:px-2 sm:py-1 rounded-lg bg-rose-50 hover:bg-rose-100 font-semibold cursor-pointer whitespace-nowrap transition-colors">นำออก</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Panel: Available Users (Searchable) */}
                <div className="w-full md:w-1/2 flex flex-col bg-[var(--color-surface)] shrink-0 md:shrink min-h-[300px] md:min-h-0">
                  <div className="p-4 border-b border-[var(--color-border)]">
                    <h4 className="font-semibold text-[var(--color-text)]">รายชื่อพนักงานในระบบ</h4>
                    <input
                      id="staff-search-input"
                      type="text"
                      placeholder="ค้นหาชื่อ หรือชื่อผู้ใช้..."
                      aria-label="ค้นหาชื่อหรือชื่อผู้ใช้พนักงานในระบบ"
                      value={staffSearchQuery}
                      onChange={(e) => setStaffSearchQuery(e.target.value)}
                      className="mt-2 w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-amber-400 transition-colors"
                    />
                  </div>
                  <div className="p-4 overflow-y-auto flex-1 space-y-2">
                    {usersList
                      .filter(u => !selectedStaffIds.includes(u.id))
                      .filter(u => u.role === "manager" || u.role === "manager_assistant" || u.role === "employee")
                      .filter(u => u.name.toLowerCase().includes(staffSearchQuery.toLowerCase()) || (u.username && u.username.toLowerCase().includes(staffSearchQuery.toLowerCase())))
                      .sort((a, b) => {
                        const rank = { manager: 1, manager_assistant: 2, employee: 3 };
                        const rankA = rank[a.role as keyof typeof rank] || 99;
                        const rankB = rank[b.role as keyof typeof rank] || 99;
                        return rankA - rankB;
                      })
                      .map((user) => (
                        <div key={user.id} className="flex justify-between items-center p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-amber-400 transition-colors">
                          <div className="flex-1">
                            <div className="text-sm font-bold text-[var(--color-text)] leading-tight">{user.name}</div>
                            <div className="text-[10px] text-[var(--color-text-subtle)] mt-0.5">{user.position || "พนักงาน"}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedStaffIds(prev => [...prev, user.id])}
                            className="bg-[var(--color-brown)] hover:bg-[var(--color-brown-light)] text-amber-300 text-[11px] font-bold min-h-[44px] min-w-[44px] sm:min-h-[32px] sm:min-w-0 inline-flex items-center justify-center px-3.5 py-2.5 sm:px-3 sm:py-1.5 rounded-lg cursor-pointer shadow-xs whitespace-nowrap"
                          >
                            + เพิ่มเข้าสาขา
                          </button>
                        </div>
                      ))}
                    {usersList
                      .filter(u => !selectedStaffIds.includes(u.id))
                      .filter(u => u.role === "manager" || u.role === "manager_assistant" || u.role === "employee")
                      .filter(u => u.name.toLowerCase().includes(staffSearchQuery.toLowerCase()) || (u.username && u.username.toLowerCase().includes(staffSearchQuery.toLowerCase()))).length === 0 && (
                        <div className="text-center text-[var(--color-text-subtle)] text-sm py-8">
                          ไม่พบรายชื่อพนักงาน หรือถูกเพิ่มเข้าสาขาหมดแล้ว
                        </div>
                      )}
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface-2)] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsManageStaffModalOpen(false)}
                  className="px-6 py-2.5 bg-[var(--color-surface)] hover:bg-[var(--color-border-subtle)] text-[var(--color-text-muted)] border border-[var(--color-border)] rounded-xl text-sm font-bold transition-all cursor-pointer"
                >
                  ยกเลิกโดยไม่บันทึก
                </button>
                <button
                  type="button"
                  onClick={handleSaveStaff}
                  disabled={isSavingStaff}
                  className="px-6 py-2.5 bg-[var(--color-brown)] hover:bg-[var(--color-brown-light)] disabled:opacity-50 text-amber-300 rounded-xl text-sm font-bold transition-all shadow-sm cursor-pointer"
                >
                  {isSavingStaff ? "กำลังบันทึก..." : "ยืนยันการตั้งค่าพนักงาน"}
                </button>
              </div>
            </div>
          </div>
        )}

        {isManageTasksModalOpen && selectedBranchForTasks && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
              <div className="px-6 py-4 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-surface-2)]">
                <h3 className="font-bold text-[var(--color-text)] text-lg">กำหนดขอบเขตงานของสาขา</h3>
                <button
                  type="button"
                  onClick={() => setIsManageTasksModalOpen(false)}
                  aria-label="ปิดหน้าต่างกำหนดขอบเขตงาน"
                  title="ปิดหน้าต่าง"
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 rounded-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden divide-y md:divide-y-0 md:divide-x divide-[var(--color-border)]">
                {/* Left Panel: Assigned Tasks */}
                <div className="w-full md:w-1/2 flex flex-col bg-[var(--color-background)] shrink-0 md:shrink min-h-[280px] md:min-h-0">
                  <div className="p-4 border-b border-[var(--color-border)]">
                    <h4 className="font-semibold text-emerald-700">งานที่สาขานี้ต้องทำ</h4>
                    <input
                      id="assigned-task-search-input"
                      type="text"
                      placeholder="ค้นหาชื่องานที่มอบหมายแล้ว..."
                      aria-label="ค้นหาชื่องานที่มอบหมายแล้ว"
                      value={assignedTaskSearchQuery}
                      onChange={(e) => setAssignedTaskSearchQuery(e.target.value)}
                      className="mt-2 w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:outline-none focus:border-amber-400 transition-colors"
                    />
                  </div>
                  <div className="p-4 overflow-y-auto flex-1 space-y-4">
                    {/* Management Level */}
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden shadow-xs">
                      <div className="bg-[var(--color-amber-glow)]/60 border-b border-[var(--color-border)] px-3 py-2 text-xs font-bold text-[var(--color-text)]">
                        ผู้ช่วยผู้จัดการ (Assistant)
                      </div>
                      <div className="p-2 space-y-1">
                        {tasksList.filter(t => selectedTaskIds.includes(t.id) && t.task_role === "manager_assistant" && t.name.toLowerCase().includes(assignedTaskSearchQuery.toLowerCase())).length === 0 && (
                          <div className="text-xs text-[var(--color-text-subtle)] text-center py-2">ไม่มีระบบงาน</div>
                        )}
                        {tasksList.filter(t => selectedTaskIds.includes(t.id) && t.task_role === "manager_assistant" && t.name.toLowerCase().includes(assignedTaskSearchQuery.toLowerCase())).map((t) => (
                          <div key={t.id} className="flex justify-between items-center p-2 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                            <div>
                              <p className="text-sm font-bold text-[var(--color-text)] leading-tight">{t.name}</p>
                              <p className="text-[10px] text-[var(--color-text-subtle)] mt-0.5">{t.shift} | {t.start || "ตามกำหนด"}</p>
                            </div>
                            <button onClick={() => setSelectedTaskIds(prev => prev.filter(id => id !== t.id))} className="text-rose-700 text-xs min-h-[44px] min-w-[44px] sm:min-h-[28px] sm:min-w-0 inline-flex items-center justify-center px-3 py-2 sm:px-2 sm:py-1 rounded-lg bg-rose-50 hover:bg-rose-100 font-semibold cursor-pointer whitespace-nowrap transition-colors">นำออก</button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Staff Level - Cashier */}
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden shadow-xs">
                      <div className="bg-[var(--color-surface-2)] border-b border-[var(--color-border)] px-3 py-2 text-xs font-bold text-emerald-700">
                        พนักงานแคชเชียร์ (Cashier)
                      </div>
                      <div className="p-2 space-y-1">
                        {tasksList.filter(t => selectedTaskIds.includes(t.id) && t.task_role === "cashier" && t.name.toLowerCase().includes(assignedTaskSearchQuery.toLowerCase())).length === 0 && (
                          <div className="text-xs text-[var(--color-text-subtle)] text-center py-2">ไม่มีระบบงาน</div>
                        )}
                        {tasksList.filter(t => selectedTaskIds.includes(t.id) && t.task_role === "cashier" && t.name.toLowerCase().includes(assignedTaskSearchQuery.toLowerCase())).map((t) => (
                          <div key={t.id} className="flex justify-between items-center p-2 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                            <div>
                              <p className="text-sm font-bold text-[var(--color-text)] leading-tight">{t.name}</p>
                              <p className="text-[10px] text-[var(--color-text-subtle)] mt-0.5">{t.shift} | {t.start || "ตามกำหนด"}</p>
                            </div>
                            <button onClick={() => setSelectedTaskIds(prev => prev.filter(id => id !== t.id))} className="text-rose-700 text-xs min-h-[44px] min-w-[44px] sm:min-h-[28px] sm:min-w-0 inline-flex items-center justify-center px-3 py-2 sm:px-2 sm:py-1 rounded-lg bg-rose-50 hover:bg-rose-100 font-semibold cursor-pointer whitespace-nowrap transition-colors">นำออก</button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Staff Level - Stock */}
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden shadow-xs">
                      <div className="bg-[var(--color-surface-2)] border-b border-[var(--color-border)] px-3 py-2 text-xs font-bold text-[var(--color-amber)]">
                        พนักงานสต็อก (Stock)
                      </div>
                      <div className="p-2 space-y-1">
                        {tasksList.filter(t => selectedTaskIds.includes(t.id) && t.task_role === "stock" && t.name.toLowerCase().includes(assignedTaskSearchQuery.toLowerCase())).length === 0 && (
                          <div className="text-xs text-[var(--color-text-subtle)] text-center py-2">ไม่มีระบบงาน</div>
                        )}
                        {tasksList.filter(t => selectedTaskIds.includes(t.id) && t.task_role === "stock" && t.name.toLowerCase().includes(assignedTaskSearchQuery.toLowerCase())).map((t) => (
                          <div key={t.id} className="flex justify-between items-center p-2 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                            <div>
                              <p className="text-sm font-bold text-[var(--color-text)] leading-tight">{t.name}</p>
                              <p className="text-[10px] text-[var(--color-text-subtle)] mt-0.5">{t.shift} | {t.start || "ตามกำหนด"}</p>
                            </div>
                            <button onClick={() => setSelectedTaskIds(prev => prev.filter(id => id !== t.id))} className="text-rose-700 text-xs min-h-[44px] min-w-[44px] sm:min-h-[28px] sm:min-w-0 inline-flex items-center justify-center px-3 py-2 sm:px-2 sm:py-1 rounded-lg bg-rose-50 hover:bg-rose-100 font-semibold cursor-pointer whitespace-nowrap transition-colors">นำออก</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Panel: Available Tasks (Searchable) */}
                <div className="w-full md:w-1/2 flex flex-col bg-[var(--color-surface)] shrink-0 md:shrink min-h-[300px] md:min-h-0">
                  <div className="p-4 border-b border-[var(--color-border)]">
                    <h4 className="font-semibold text-[var(--color-text)]">งานทั้งหมดในระบบกลาง</h4>
                    <input
                      id="central-task-search-input"
                      type="text"
                      placeholder="ค้นหาชื่องาน..."
                      aria-label="ค้นหาชื่องานทั้งหมดในระบบกลาง"
                      value={taskSearchQuery}
                      onChange={(e) => setTaskSearchQuery(e.target.value)}
                      className="mt-2 w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:outline-none focus:border-amber-400 transition-colors"
                    />
                  </div>
                  <div className="p-4 overflow-y-auto flex-1 space-y-2">
                    {tasksList
                      .filter(t => !selectedTaskIds.includes(t.id))
                      .filter(t => t.name.toLowerCase().includes(taskSearchQuery.toLowerCase()))
                      .sort((a, b) => a.task_role.localeCompare(b.task_role))
                      .map((t) => (
                        <div key={t.id} className="flex justify-between items-center p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-amber-400 transition-colors">
                          <div className="flex-1">
                            <div className="text-sm font-bold text-[var(--color-text)] leading-tight">{t.name}</div>
                            <div className="text-[10px] text-[var(--color-text-subtle)] mt-0.5">{t.task_role} | กะ: {t.shift} | {t.start || "ตามกำหนด"}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedTaskIds(prev => [...prev, t.id])}
                            className="bg-[var(--color-brown)] hover:bg-[var(--color-brown-light)] text-amber-300 text-[11px] font-bold min-h-[44px] min-w-[44px] sm:min-h-[32px] sm:min-w-0 inline-flex items-center justify-center px-3.5 py-2.5 sm:px-3 sm:py-1.5 rounded-lg cursor-pointer flex-shrink-0 ml-2 shadow-xs whitespace-nowrap"
                          >
                            + มอบหมาย
                          </button>
                        </div>
                      ))}
                    {tasksList
                      .filter(t => !selectedTaskIds.includes(t.id))
                      .filter(t => t.name.toLowerCase().includes(taskSearchQuery.toLowerCase())).length === 0 && (
                        <div className="text-center text-[var(--color-text-subtle)] text-sm py-8">
                          ไม่พบรายการงาน หรือถูกกำหนดเข้าสาขาหมดแล้ว
                        </div>
                      )}
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface-2)] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsManageTasksModalOpen(false)}
                  className="px-6 py-2.5 bg-[var(--color-surface)] hover:bg-[var(--color-border-subtle)] text-[var(--color-text-muted)] border border-[var(--color-border)] rounded-xl text-sm font-bold transition-all cursor-pointer"
                >
                  ยกเลิกโดยไม่บันทึก
                </button>
                <button
                  type="button"
                  onClick={handleSaveTasks}
                  disabled={isSavingTasks}
                  className="px-6 py-2.5 bg-[var(--color-brown)] hover:bg-[var(--color-brown-light)] disabled:opacity-50 text-amber-300 rounded-xl text-sm font-bold transition-all shadow-sm cursor-pointer"
                >
                  {isSavingTasks ? "กำลังบันทึก..." : "ยืนยันการตั้งค่างานสาขา"}
                </button>
              </div>
            </div>
          </div>
        )}

        {isCreateTaskModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
              <div className="px-6 py-4 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-surface-2)]">
                <h3 className="font-bold text-[var(--color-text)] text-lg">เพิ่มรายการงานใหม่ (Master Task)</h3>
                <button
                  type="button"
                  onClick={() => setIsCreateTaskModalOpen(false)}
                  aria-label="ปิดหน้าต่างเพิ่มงานใหม่"
                  title="ปิดหน้าต่าง"
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 rounded-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateTask}>
                <div className="p-6 space-y-4">
                  <div>
                    <label htmlFor="create-task-name" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
                      ชื่อรายการงาน <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="create-task-name"
                      type="text"
                      value={newTaskName}
                      onChange={(e) => setNewTaskName(e.target.value)}
                      placeholder="เช่น ทำความสะอาดจุดแคชเชียร์"
                      className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:outline-none focus:border-amber-400 w-full transition-all"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="create-task-role" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
                        ตำแหน่งงาน <span className="text-rose-500">*</span>
                      </label>
                      <select
                        id="create-task-role"
                        value={newTaskRole}
                        onChange={(e) => setNewTaskRole(e.target.value as any)}
                        className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-amber-400 w-full transition-all cursor-pointer"
                      >
                        <option value="cashier">แคชเชียร์</option>
                        <option value="stock">สต็อก / จัดเรียง</option>
                        <option value="manager_assistant">ผู้ช่วยผู้จัดการ</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="create-task-shift" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
                        กะงาน <span className="text-rose-500">*</span>
                      </label>
                      <select
                        id="create-task-shift"
                        value={newTaskShift}
                        onChange={(e) => setNewTaskShift(e.target.value as any)}
                        className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-amber-400 w-full transition-all cursor-pointer"
                      >
                        <option value="morning">กะเช้า</option>
                        <option value="afternoon">กะบ่าย</option>
                        <option value="night">กะดึก (Night)</option>
                        <option value="morning_afternoon">ควบกะ (เช้า-บ่าย)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="create-task-start" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
                        เวลาเริ่ม (Optional)
                      </label>
                      <input
                        id="create-task-start"
                        type="time"
                        value={newTaskStart}
                        onChange={(e) => setNewTaskStart(e.target.value)}
                        className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:outline-none focus:border-amber-400 w-full transition-all"
                      />
                    </div>

                    <div>
                      <label htmlFor="create-task-end" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
                        เวลาสิ้นสุด (Optional)
                      </label>
                      <input
                        id="create-task-end"
                        type="time"
                        value={newTaskEnd}
                        onChange={(e) => setNewTaskEnd(e.target.value)}
                        className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:outline-none focus:border-amber-400 w-full transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface-2)] flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCreateTaskModalOpen(false)}
                    className="px-6 py-2.5 bg-[var(--color-surface)] hover:bg-[var(--color-border-subtle)] text-[var(--color-text-muted)] border border-[var(--color-border)] rounded-xl text-sm font-bold transition-all cursor-pointer"
                  >
                    ยกเลิกการเพิ่มงาน
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingTask}
                    className="px-6 py-2.5 bg-[var(--color-brown)] hover:bg-[var(--color-brown-light)] disabled:opacity-50 text-amber-300 rounded-xl text-sm font-bold transition-all cursor-pointer flex items-center gap-2 shadow-sm"
                  >
                    {isCreatingTask ? "กำลังบันทึก..." : "เพิ่มงาน"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}



        {/* Add User Modal */}
        <AdminAddUserModal
          isOpen={isAddUserModalOpen}
          onClose={() => setIsAddUserModalOpen(false)}
          branches={branches}
          onUserCreated={async (newUser) => {
            showToast(`เพิ่มผู้ใช้ "${newUser.name}" สำเร็จ`);
            await loadUsers();
          }}
        />

        {/* Edit User Permissions Modal */}
        <AdminUserPermissionsModal
          isOpen={Boolean(editingPermissionsUser)}
          targetUser={editingPermissionsUser}
          currentAdminId={user.id}
          onClose={() => setEditingPermissionsUser(null)}
          showToast={showToast}
          onPermissionsUpdated={async (updated) => {
            setUsersList((prev) =>
              prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u))
            );
            await loadUsers();
          }}
        />

        {/* Manage Branch Refrigerators Modal */}
        <AdminManageRefrigeratorsModal
          isOpen={Boolean(selectedBranchForRefrigerators)}
          branch={selectedBranchForRefrigerators}
          allBranches={branches}
          onClose={() => setSelectedBranchForRefrigerators(null)}
          onUpdated={() => {
            invalidateBranchCache();
            void loadBranches(true);
          }}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)] py-3 text-center text-xs text-[var(--color-text-muted)]">
        Eater Egg Fresh Mart • Central Enterprise Administration Portal v2.0
      </footer>

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
      />
    </div>
  );
}
