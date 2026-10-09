"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { User, ShiftType, SpecialTaskItem, BranchDailyTask } from "../../../types";
import {
  getBranchDailyTasksAction,
  createBranchDailyTaskAction,
  updateBranchDailyTaskAction,
  deleteBranchDailyTaskAction,
} from "../../../actions/task";
import {
  getSpecialTasksAction,
  createSpecialTaskAction,
  updateSpecialTaskAction,
  duplicateSpecialTaskAction,
  deleteSpecialTaskAction,
} from "../../../actions/specialTask";
import { getBranchStaffStatusAction } from "../../../actions/manager";
import {
  ListTodo,
  Users,
  Sparkles,
  Plus,
  Copy,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  ArrowLeft,
  Flame,
  Check,
  X,
  Snowflake,
  ShieldAlert,
} from "lucide-react";

interface ChecklistManagementHubProps {
  currentUser: User;
}

export function ChecklistManagementHub({ currentUser }: ChecklistManagementHubProps) {
  const isAssistant = currentUser.role === "manager_assistant";
  const isManager = currentUser.role === "manager" || currentUser.isAdmin;

  // Tabs: daily | joint | special
  const [activeTab, setActiveTab] = useState<"daily" | "joint" | "special">("daily");

  // Notifications / feedback toast
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const showToast = useCallback((type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Staff members in current branch (for assigning special tasks)
  const [staffList, setStaffList] = useState<Array<{ id: string; name: string; role: string; position?: string }>>([]);

  // --- 1. Daily Tasks State ---
  const [dailyTasks, setDailyTasks] = useState<BranchDailyTask[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [dailyRoleFilter, setDailyRoleFilter] = useState<string>("all");
  const [dailyShiftFilter, setDailyShiftFilter] = useState<string>("all");

  // Daily Task Modal State
  const [isDailyModalOpen, setIsDailyModalOpen] = useState(false);
  const [editingDailyTask, setEditingDailyTask] = useState<BranchDailyTask | null>(null);
  const [dailyForm, setDailyForm] = useState({
    name: "",
    taskRole: "cashier" as "cashier" | "stock" | "manager_assistant",
    shift: "morning" as ShiftType,
    startTime: "08:00",
    endTime: "16:00",
    category: "",
    forManagers: false,
    isJoint: false,
    selectableRoles: [] as string[],
  });

  // --- 2. Special Tasks State ---
  const [specialTasks, setSpecialTasks] = useState<SpecialTaskItem[]>([]);
  const [loadingSpecial, setLoadingSpecial] = useState(false);
  const [isSpecialModalOpen, setIsSpecialModalOpen] = useState(false);
  const [editingSpecialTask, setEditingSpecialTask] = useState<SpecialTaskItem | null>(null);

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const nextWeekStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  }, []);

  const [specialForm, setSpecialForm] = useState({
    title: "",
    description: "",
    targetType: "user" as "user" | "role" | "group",
    assignedUserId: "",
    assignedRole: "cashier",
    startDate: todayStr,
    endDate: nextWeekStr,
    pointsReward: 10,
    penaltyStreak: false,
  });

  // Fetch branch staff
  const loadStaff = useCallback(async () => {
    if (!currentUser.branchId) return;
    try {
      const res = await getBranchStaffStatusAction(currentUser.branchId);
      if (res.success && res.employees) {
        setStaffList(res.employees.map((e) => ({
          id: e.id,
          name: e.name,
          role: e.role,
          position: e.position,
        })));
      }
    } catch {
      // Non-blocking
    }
  }, [currentUser.branchId]);

  // Fetch branch daily tasks
  const loadDailyTasks = useCallback(async () => {
    if (!currentUser.branchId) return;
    setLoadingDaily(true);
    try {
      const res = await getBranchDailyTasksAction(currentUser.branchId);
      if (res.success && res.tasks) {
        setDailyTasks(res.tasks);
      } else {
        showToast("error", res.error || "ไม่สามารถโหลดงานประจำวันได้");
      }
    } catch (err: any) {
      showToast("error", err?.message || "เกิดข้อผิดพลาดในการโหลดงานประจำวัน");
    } finally {
      setLoadingDaily(false);
    }
  }, [currentUser.branchId, showToast]);

  // Fetch special tasks
  const loadSpecialTasks = useCallback(async () => {
    if (!currentUser.branchId) return;
    setLoadingSpecial(true);
    try {
      const res = await getSpecialTasksAction({ branchId: currentUser.branchId });
      if (res.success && res.tasks) {
        setSpecialTasks(res.tasks);
      } else {
        showToast("error", res.error || "ไม่สามารถโหลดภารกิจพิเศษได้");
      }
    } catch (err: any) {
      showToast("error", err?.message || "เกิดข้อผิดพลาดในการโหลดภารกิจพิเศษ");
    } finally {
      setLoadingSpecial(false);
    }
  }, [currentUser.branchId, showToast]);

  useEffect(() => {
    void loadStaff();
    void loadDailyTasks();
    void loadSpecialTasks();
  }, [loadStaff, loadDailyTasks, loadSpecialTasks]);

  // Handle Save Daily Task
  const handleSaveDailyTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dailyForm.name.trim() || !currentUser.branchId) return;

    try {
      if (editingDailyTask) {
        const res = await updateBranchDailyTaskAction({
          id: editingDailyTask.id,
          branchId: currentUser.branchId,
          name: dailyForm.name.trim(),
          taskRole: dailyForm.taskRole,
          shift: dailyForm.shift,
          startTime: dailyForm.startTime,
          endTime: dailyForm.endTime,
          category: dailyForm.category.trim() || null,
          forManagers: dailyForm.forManagers,
          isJoint: dailyForm.isJoint,
          selectableRoles: dailyForm.selectableRoles,
        });
        if (res.success) {
          showToast("success", "แก้ไขงานสำเร็จ");
          setIsDailyModalOpen(false);
          setEditingDailyTask(null);
          void loadDailyTasks();
        } else {
          showToast("error", res.error || "ไม่สามารถแก้ไขงานได้");
        }
      } else {
        const res = await createBranchDailyTaskAction({
          branchId: currentUser.branchId,
          name: dailyForm.name.trim(),
          taskRole: dailyForm.taskRole,
          shift: dailyForm.shift,
          startTime: dailyForm.startTime,
          endTime: dailyForm.endTime,
          category: dailyForm.category.trim() || null,
          forManagers: dailyForm.forManagers,
          isJoint: dailyForm.isJoint,
          selectableRoles: dailyForm.selectableRoles,
        });
        if (res.success) {
          showToast("success", "เพิ่มงานใหม่สำเร็จ");
          setIsDailyModalOpen(false);
          void loadDailyTasks();
        } else {
          showToast("error", res.error || "ไม่สามารถสร้างงานใหม่ได้");
        }
      }
    } catch (err: any) {
      showToast("error", err?.message || "เกิดข้อผิดพลาดในการบันทึก");
    }
  };

  // Handle Delete Daily Task
  const handleDeleteDailyTask = async (taskId: string, taskName: string) => {
    if (!confirm(`คุณต้องการลบงาน "${taskName}" ใช่หรือไม่?`)) return;
    try {
      const res = await deleteBranchDailyTaskAction(taskId, currentUser.branchId);
      if (res.success) {
        showToast("success", "ลบงานสำเร็จ");
        void loadDailyTasks();
      } else {
        showToast("error", res.error || "ไม่สามารถลบงานได้");
      }
    } catch (err: any) {
      showToast("error", err?.message || "เกิดข้อผิดพลาดในการลบงาน");
    }
  };

  // Handle Toggle Daily Task Disabled
  const handleToggleDailyTask = async (task: BranchDailyTask) => {
    try {
      const res = await updateBranchDailyTaskAction({
        id: task.id,
        branchId: currentUser.branchId,
        disabled: !task.disabled,
      });
      if (res.success) {
        showToast("success", task.disabled ? "เปิดใช้งานสำเร็จ" : "ปิดใช้งานสำเร็จ");
        void loadDailyTasks();
      } else {
        showToast("error", res.error || "ไม่สามารถเปลี่ยนสถานะได้");
      }
    } catch (err: any) {
      showToast("error", err?.message || "เกิดข้อผิดพลาด");
    }
  };

  // Handle Save Special Task
  const handleSaveSpecialTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!specialForm.title.trim() || !currentUser.branchId) return;

    // Strict validation for assistant manager: can only assign to employees
    if (isAssistant) {
      if (specialForm.targetType === "role" && specialForm.assignedRole === "manager_assistant") {
        showToast("error", "ผู้ช่วยผู้จัดการสามารถมอบหมายภารกิจให้พนักงานทั่วไปเท่านั้น");
        return;
      }
      if (specialForm.targetType === "user") {
        const targetStaff = staffList.find((s) => s.id === specialForm.assignedUserId);
        if (targetStaff && targetStaff.role !== "employee") {
          showToast("error", "ผู้ช่วยผู้จัดการสามารถมอบหมายภารกิจให้พนักงานทั่วไปเท่านั้น");
          return;
        }
      }
    }

    try {
      if (editingSpecialTask) {
        const res = await updateSpecialTaskAction({
          specialTaskId: editingSpecialTask.id,
          title: specialForm.title.trim(),
          description: specialForm.description.trim() || undefined,
          assignedUserId: specialForm.targetType === "user" ? specialForm.assignedUserId : undefined,
          assignedRole: specialForm.targetType === "role" ? specialForm.assignedRole : undefined,
          startDate: specialForm.startDate,
          endDate: specialForm.endDate,
          pointsReward: Number(specialForm.pointsReward) || 0,
          penaltyStreak: specialForm.penaltyStreak,
        });
        if (res.success) {
          showToast("success", "แก้ไขภารกิจสำเร็จ");
          setIsSpecialModalOpen(false);
          setEditingSpecialTask(null);
          void loadSpecialTasks();
        } else {
          showToast("error", res.error || "ไม่สามารถแก้ไขภารกิจได้");
        }
      } else {
        const res = await createSpecialTaskAction({
          branchId: currentUser.branchId,
          title: specialForm.title.trim(),
          description: specialForm.description.trim() || undefined,
          issuedByUserId: currentUser.id,
          targetType: specialForm.targetType,
          assignedUserId: specialForm.targetType === "user" ? specialForm.assignedUserId : undefined,
          assignedRole: specialForm.targetType === "role" ? specialForm.assignedRole : undefined,
          startDate: specialForm.startDate,
          endDate: specialForm.endDate,
          pointsReward: Number(specialForm.pointsReward) || 0,
          penaltyStreak: specialForm.penaltyStreak,
        });
        if (res.success) {
          showToast("success", "สร้างภารกิจพิเศษสำเร็จ");
          setIsSpecialModalOpen(false);
          void loadSpecialTasks();
        } else {
          showToast("error", res.error || "ไม่สามารถสร้างภารกิจได้");
        }
      }
    } catch (err: any) {
      showToast("error", err?.message || "เกิดข้อผิดพลาดในการบันทึกภารกิจ");
    }
  };

  // Handle 1-Click Duplicate Special Task
  const handleDuplicateSpecialTask = async (task: SpecialTaskItem) => {
    try {
      const res = await duplicateSpecialTaskAction({
        specialTaskId: task.id,
        issuedByUserId: currentUser.id,
        branchId: currentUser.branchId,
        newStartDate: todayStr,
        newEndDate: nextWeekStr,
      });
      if (res.success) {
        showToast("success", `คัดลอกภารกิจ "${task.title}" สำเร็จ!`);
        void loadSpecialTasks();
      } else {
        showToast("error", res.error || "ไม่สามารถคัดลอกภารกิจได้");
      }
    } catch (err: any) {
      showToast("error", err?.message || "เกิดข้อผิดพลาดในการคัดลอกภารกิจ");
    }
  };

  // Handle Delete Special Task
  const handleDeleteSpecialTask = async (taskId: string, title: string) => {
    if (!confirm(`คุณต้องการลบภารกิจพิเศษ "${title}" ใช่หรือไม่?`)) return;
    try {
      const res = await deleteSpecialTaskAction(taskId);
      if (res.success) {
        showToast("success", "ลบภารกิจสำเร็จ");
        void loadSpecialTasks();
      } else {
        showToast("error", res.error || "ไม่สามารถลบภารกิจได้");
      }
    } catch (err: any) {
      showToast("error", err?.message || "เกิดข้อผิดพลาดในการลบ");
    }
  };

  // Filtered Daily Tasks
  const filteredDailyTasks = useMemo(() => {
    return dailyTasks.filter((t) => {
      if (activeTab === "joint") {
        if (!t.isJoint) return false;
      } else {
        if (t.isJoint) return false;
      }
      if (dailyRoleFilter !== "all" && t.taskRole !== dailyRoleFilter) return false;
      if (dailyShiftFilter !== "all" && t.shift !== dailyShiftFilter) return false;
      return true;
    });
  }, [dailyTasks, activeTab, dailyRoleFilter, dailyShiftFilter]);

  // Allowed staff for assign select
  const assignableStaff = useMemo(() => {
    if (isAssistant) {
      return staffList.filter((s) => s.role === "employee");
    }
    return staffList;
  }, [staffList, isAssistant]);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] pb-20">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 animate-bounce">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs sm:text-sm font-bold border ${
              toast.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                : "bg-rose-50 dark:bg-rose-950 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200"
            }`}
          >
            {toast.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{toast.text}</span>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <header className="sticky top-0 z-30 bg-[var(--color-surface)]/95 backdrop-blur-md border-b border-[var(--color-border)] px-4 py-3 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/manager/dashboard"
              className="p-2 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
              title="กลับสู่หน้าแดชบอร์ด"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-base sm:text-lg font-black text-[var(--color-text)] flex items-center gap-2">
                <span>จัดการเช็คลิสต์ & ภารกิจสาขา</span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold">
                  {currentUser.branchName || "สาขาหลัก"}
                </span>
              </h1>
              <p className="text-xs text-[var(--color-text-muted)] font-medium">
                ระบบจัดการ 3 ประเภทงาน: งานประจำวัน • งานส่วนกลาง • ภารกิจพิเศษ
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex bg-[var(--color-surface)] p-1.5 rounded-2xl border border-[var(--color-border)] shadow-xs gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("daily")}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === "daily"
                ? "bg-[var(--color-brown)] text-amber-200 dark:bg-amber-400 dark:text-amber-950 shadow-xs"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            <ListTodo size={17} />
            <span>1. งานประจำวัน</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10 font-mono">
              {dailyTasks.filter((t) => !t.isJoint).length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("joint")}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === "joint"
                ? "bg-sky-600 text-white shadow-xs"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            <Users size={17} />
            <span>2. งานส่วนกลาง & ตู้แช่</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10 font-mono">
              {dailyTasks.filter((t) => t.isJoint).length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("special")}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === "special"
                ? "bg-amber-500 text-amber-950 shadow-xs"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            <Sparkles size={17} />
            <span>3. ภารกิจพิเศษ (Special Tasks)</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10 font-mono">
              {specialTasks.length}
            </span>
          </button>
        </div>

        {/* ═════════════════════════════════════════════════════════════════════
            TAB 1 & 2: DAILY TASKS / JOINT TASKS
        ═════════════════════════════════════════════════════════════════════ */}
        {(activeTab === "daily" || activeTab === "joint") && (
          <div className="space-y-4">
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--color-surface)] p-4 rounded-2xl border border-[var(--color-border)] shadow-xs">
              <div className="flex flex-wrap items-center gap-2">
                {/* Role Filter */}
                <select
                  value={dailyRoleFilter}
                  onChange={(e) => setDailyRoleFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs font-bold text-[var(--color-text)]"
                >
                  <option value="all">ทุกตำแหน่ง</option>
                  <option value="cashier">แคชเชียร์</option>
                  <option value="stock">สต็อกสินค้า</option>
                  <option value="manager_assistant">ผู้ช่วยผู้จัดการ</option>
                </select>

                {/* Shift Filter */}
                <select
                  value={dailyShiftFilter}
                  onChange={(e) => setDailyShiftFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs font-bold text-[var(--color-text)]"
                >
                  <option value="all">ทุกช่วงกะ</option>
                  <option value="morning">กะเช้า</option>
                  <option value="afternoon">กะบ่าย</option>
                  <option value="night">กะดึก/ปิดร้าน</option>
                  <option value="morning_afternoon">เช้า & บ่าย</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingDailyTask(null);
                  setDailyForm({
                    name: "",
                    taskRole: "cashier",
                    shift: "morning",
                    startTime: "08:00",
                    endTime: "16:00",
                    category: "",
                    forManagers: false,
                    isJoint: activeTab === "joint",
                    selectableRoles: activeTab === "joint" ? ["stock"] : [],
                  });
                  setIsDailyModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-amber-950 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <Plus size={16} strokeWidth={2.5} />
                <span>{activeTab === "joint" ? "สร้างงานส่วนกลางใหม่" : "สร้างงานประจำวันใหม่"}</span>
              </button>
            </div>

            {/* Tasks List */}
            {loadingDaily ? (
              <div className="py-16 text-center text-xs text-[var(--color-text-muted)]">
                กำลังโหลดรายการงาน...
              </div>
            ) : filteredDailyTasks.length === 0 ? (
              <div className="py-16 text-center bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-2xl p-6">
                <ListTodo size={32} className="mx-auto text-[var(--color-text-muted)] mb-2" />
                <p className="text-sm font-bold text-[var(--color-text)]">ไม่พบรายการงานในหมวดนี้</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  คลิกที่ปุ่ม &quot;สร้างงานใหม่&quot; ด้านบนเพื่อเพิ่มรายการงานสำหรับสาขานี้
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {filteredDailyTasks.map((t) => (
                  <div
                    key={t.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      t.disabled
                        ? "bg-[var(--color-surface-2)]/50 border-[var(--color-border)] opacity-60"
                        : "bg-[var(--color-surface)] border-[var(--color-border)] shadow-xs"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-[var(--color-text)]">{t.name}</span>
                        {t.category && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                            {t.category}
                          </span>
                        )}
                        {t.isJoint && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300">
                            งานส่วนกลาง (Joint)
                          </span>
                        )}
                        {t.forManagers && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300">
                            สำหรับผู้จัดการ/ผู้ช่วย
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                        <span>ตำแหน่ง: <strong>{t.taskRole}</strong></span>
                        <span>•</span>
                        <span>กะ: <strong>{t.shift}</strong></span>
                        <span>•</span>
                        <span>เวลา: {t.startTime} - {t.endTime}</span>
                        {t.selectableRoles && t.selectableRoles.length > 0 && (
                          <>
                            <span>•</span>
                            <span>ทำร่วมกันโดย: {t.selectableRoles.join(", ")}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => void handleToggleDailyTask(t)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                          t.disabled
                            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300"
                            : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border-[var(--color-border)]"
                        }`}
                      >
                        {t.disabled ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDailyTask(t);
                          setDailyForm({
                            name: t.name,
                            taskRole: t.taskRole,
                            shift: t.shift,
                            startTime: t.startTime || "08:00",
                            endTime: t.endTime || "16:00",
                            category: t.category || "",
                            forManagers: t.forManagers || false,
                            isJoint: t.isJoint || false,
                            selectableRoles: t.selectableRoles || [],
                          });
                          setIsDailyModalOpen(true);
                        }}
                        className="p-1.5 rounded-xl border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-amber-600 hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
                        title="แก้ไขงาน"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteDailyTask(t.id, t.name)}
                        className="p-1.5 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                        title="ลบงาน"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════
            TAB 3: SPECIAL TASKS (ภารกิจพิเศษ)
        ═════════════════════════════════════════════════════════════════════ */}
        {activeTab === "special" && (
          <div className="space-y-4">
            {/* Header info & Create button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--color-surface)] p-4 rounded-2xl border border-[var(--color-border)] shadow-xs">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-[var(--color-text)] flex items-center gap-2">
                  <Sparkles size={18} className="text-amber-500" />
                  <span>ภารกิจพิเศษตามช่วงเวลา (Special Period Tasks)</span>
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  ออกภารกิจโดยผู้จัดการหรือผู้ช่วยผู้จัดการ พร้อมระบบคัดลอก (1-Click Duplicate) และกำหนดบทลงโทษสตรีค
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingSpecialTask(null);
                  setSpecialForm({
                    title: "",
                    description: "",
                    targetType: "user",
                    assignedUserId: assignableStaff[0]?.id || "",
                    assignedRole: "cashier",
                    startDate: todayStr,
                    endDate: nextWeekStr,
                    pointsReward: 10,
                    penaltyStreak: false,
                  });
                  setIsSpecialModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-amber-950 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <Plus size={16} strokeWidth={2.5} />
                <span>ออกภารกิจพิเศษใหม่</span>
              </button>
            </div>

            {/* Special Tasks List */}
            {loadingSpecial ? (
              <div className="py-16 text-center text-xs text-[var(--color-text-muted)]">
                กำลังโหลดภารกิจพิเศษ...
              </div>
            ) : specialTasks.length === 0 ? (
              <div className="py-16 text-center bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-2xl p-6">
                <Sparkles size={32} className="mx-auto text-amber-500/60 mb-2" />
                <p className="text-sm font-bold text-[var(--color-text)]">ยังไม่มีภารกิจพิเศษในสาขานี้</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  คลิก &quot;ออกภารกิจพิเศษใหม่&quot; เพื่อกำหนดงานเฉพาะกิจพร้อมคะแนนรางวัลพิเศษ
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {specialTasks.map((st) => (
                  <div
                    key={st.id}
                    className="p-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-extrabold text-sm sm:text-base text-[var(--color-text)]">
                            {st.title}
                          </h4>
                          <p className="text-xs text-[var(--color-text-muted)] mt-0.5 line-clamp-2">
                            {st.description || "ไม่มีคำอธิบายเพิ่มเติม"}
                          </p>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-xl text-xs font-black uppercase tracking-wider shrink-0 ${
                            st.status === "approved"
                              ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                              : st.status === "submitted"
                              ? "bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300"
                              : st.status === "declined"
                              ? "bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300"
                              : "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
                          }`}
                        >
                          {st.status === "approved"
                            ? "อนุมัติแล้ว"
                            : st.status === "submitted"
                            ? "รออนุมัติ"
                            : st.status === "declined"
                            ? "ไม่อนุมัติ"
                            : "รอดำเนินการ"}
                        </span>
                      </div>

                      {/* Badges Info */}
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 font-extrabold flex items-center gap-1">
                          <Flame size={12} />
                          +{st.pointsReward} คะแนน
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-[var(--color-surface-2)] text-[var(--color-text-muted)] font-medium flex items-center gap-1">
                          <Calendar size={12} />
                          {st.startDate} ถึง {st.endDate}
                        </span>
                        {st.penaltyStreak ? (
                          <span className="px-2 py-0.5 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold flex items-center gap-1">
                            <ShieldAlert size={12} />
                            สตรีคเสียหายหากไม่เสร็จ
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold">
                            ไม่กระทบสตรีค
                          </span>
                        )}
                      </div>

                      {/* Target info */}
                      <div className="text-xs text-[var(--color-text-muted)] pt-1 border-t border-[var(--color-border)]">
                        <span>เป้าหมาย: </span>
                        <strong className="text-[var(--color-text)]">
                          {st.targetType === "user"
                            ? `รายบุคคล: ${st.assignedUserName || "พนักงาน"}`
                            : st.targetType === "role"
                            ? `ตำแหน่ง: ${st.assignedRole}`
                            : "ทั้งสาขา (Group)"}
                        </strong>
                        <span className="block text-[11px] mt-0.5 text-[var(--color-text-muted)]">
                          ออกภารกิจโดย: {st.issuedByUserName} ({st.issuedByUserRole || "หัวหน้างาน"})
                        </span>
                      </div>
                    </div>

                    {/* Actions bar (Duplicate, Edit, Delete) */}
                    <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => void handleDuplicateSpecialTask(st)}
                        className="text-xs font-bold px-2.5 py-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text)] flex items-center gap-1 transition-colors cursor-pointer"
                        title="คัดลอกภารกิจนี้เพื่อใช้ใหม่ในสัปดาห์ถัดไป (1-Click Duplicate)"
                      >
                        <Copy size={13} />
                        <span>คัดลอกภารกิจ</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSpecialTask(st);
                            setSpecialForm({
                              title: st.title,
                              description: st.description || "",
                              targetType: st.targetType,
                              assignedUserId: st.assignedUserId || "",
                              assignedRole: st.assignedRole || "cashier",
                              startDate: st.startDate,
                              endDate: st.endDate,
                              pointsReward: st.pointsReward,
                              penaltyStreak: st.penaltyStreak,
                            });
                            setIsSpecialModalOpen(true);
                          }}
                          className="p-1.5 rounded-xl border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-amber-600 transition-colors cursor-pointer"
                          title="แก้ไขภารกิจ"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteSpecialTask(st.id, st.title)}
                          className="p-1.5 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                          title="ลบภารกิจ"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ═════════════════════════════════════════════════════════════════════
          DAILY / JOINT TASK CREATE/EDIT MODAL
      ═════════════════════════════════════════════════════════════════════ */}
      {isDailyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <h3 className="text-base font-extrabold text-[var(--color-text)]">
                {editingDailyTask ? "แก้ไขรายการงาน" : activeTab === "joint" ? "สร้างงานส่วนกลางใหม่" : "สร้างงานประจำวันใหม่"}
              </h3>
              <button
                onClick={() => setIsDailyModalOpen(false)}
                className="p-1.5 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveDailyTask} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                  ชื่อรายการงาน *
                </label>
                <input
                  type="text"
                  required
                  value={dailyForm.name}
                  onChange={(e) => setDailyForm({ ...dailyForm, name: e.target.value })}
                  placeholder="เช่น ตรวจนับสต็อกสินค้าแห้ง, ปิดสวิตช์ไฟป้ายร้าน"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs text-[var(--color-text)] font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                    ตำแหน่งที่รับผิดชอบ
                  </label>
                  <select
                    value={dailyForm.taskRole}
                    onChange={(e) => setDailyForm({ ...dailyForm, taskRole: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs font-bold text-[var(--color-text)]"
                  >
                    <option value="cashier">แคชเชียร์</option>
                    <option value="stock">สต็อกสินค้า</option>
                    <option value="manager_assistant">ผู้ช่วยผู้จัดการ</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                    ช่วงกะ
                  </label>
                  <select
                    value={dailyForm.shift}
                    onChange={(e) => setDailyForm({ ...dailyForm, shift: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs font-bold text-[var(--color-text)]"
                  >
                    <option value="morning">กะเช้า</option>
                    <option value="afternoon">กะบ่าย</option>
                    <option value="night">กะดึก (ปิดร้าน)</option>
                    <option value="both">เช้า & บ่าย</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                    เวลาเริ่มต้น
                  </label>
                  <input
                    type="time"
                    value={dailyForm.startTime}
                    onChange={(e) => setDailyForm({ ...dailyForm, startTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs font-bold text-[var(--color-text)]"
                  >
                  </input>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                    เวลาสิ้นสุด
                  </label>
                  <input
                    type="time"
                    value={dailyForm.endTime}
                    onChange={(e) => setDailyForm({ ...dailyForm, endTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs font-bold text-[var(--color-text)]"
                  >
                  </input>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                  หมวดหมู่งาน (ไม่บังคับ)
                </label>
                <input
                  type="text"
                  value={dailyForm.category}
                  onChange={(e) => setDailyForm({ ...dailyForm, category: e.target.value })}
                  placeholder="เช่น อุปกรณ์, ความสะอาด, ตู้แช่, ความปลอดภัย"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs text-[var(--color-text)]"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-[var(--color-border)]">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[var(--color-text)]">
                  <input
                    type="checkbox"
                    checked={dailyForm.isJoint}
                    onChange={(e) => setDailyForm({ ...dailyForm, isJoint: e.target.checked })}
                    className="rounded border-[var(--color-border)] text-sky-600 focus:ring-sky-500"
                  />
                  <span>กำหนดเป็นงานส่วนกลาง (Joint Task - หลายคนช่วยกันเช็คได้)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[var(--color-text)]">
                  <input
                    type="checkbox"
                    checked={dailyForm.forManagers}
                    onChange={(e) => setDailyForm({ ...dailyForm, forManagers: e.target.checked })}
                    className="rounded border-[var(--color-border)] text-amber-600 focus:ring-amber-500"
                  />
                  <span>เป็นงานสำหรับผู้จัดการ / ผู้ช่วยผู้จัดการ (เช่น งานกะดึกปิดร้าน)</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
                <button
                  type="button"
                  onClick={() => setIsDailyModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-xs font-bold text-[var(--color-text)] cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-amber-950 text-xs font-extrabold cursor-pointer"
                >
                  {editingDailyTask ? "บันทึกการแก้ไข" : "สร้างงาน"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          SPECIAL TASK CREATE/EDIT MODAL
      ═════════════════════════════════════════════════════════════════════ */}
      {isSpecialModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <h3 className="text-base font-extrabold text-[var(--color-text)]">
                {editingSpecialTask ? "แก้ไขภารกิจพิเศษ" : "ออกภารกิจพิเศษใหม่"}
              </h3>
              <button
                onClick={() => setIsSpecialModalOpen(false)}
                className="p-1.5 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSpecialTask} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                  ชื่อภารกิจ *
                </label>
                <input
                  type="text"
                  required
                  value={specialForm.title}
                  onChange={(e) => setSpecialForm({ ...specialForm, title: e.target.value })}
                  placeholder="เช่น ตรวจเช็ค Big Cleaning ตู้แช่, จัดสต็อกสิ้นเดือน"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs text-[var(--color-text)] font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                  รายละเอียดภารกิจ
                </label>
                <textarea
                  rows={2}
                  value={specialForm.description}
                  onChange={(e) => setSpecialForm({ ...specialForm, description: e.target.value })}
                  placeholder="ระบุข้อกำหนด ผลลัพธ์ที่ต้องการ และเกณฑ์การตรวจรับ"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs text-[var(--color-text)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                    ประเภทการมอบหมาย
                  </label>
                  <select
                    value={specialForm.targetType}
                    onChange={(e) => setSpecialForm({ ...specialForm, targetType: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs font-bold text-[var(--color-text)]"
                  >
                    <option value="user">รายบุคคล (Specific User)</option>
                    <option value="role">ตามตำแหน่ง (Role Specific)</option>
                    <option value="group">ทั้งสาขา/กลุ่มงาน (Joint Group)</option>
                  </select>
                </div>

                {specialForm.targetType === "user" ? (
                  <div>
                    <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                      เลือกพนักงาน
                    </label>
                    <select
                      value={specialForm.assignedUserId}
                      onChange={(e) => setSpecialForm({ ...specialForm, assignedUserId: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs font-bold text-[var(--color-text)]"
                    >
                      {assignableStaff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.position || s.role})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : specialForm.targetType === "role" ? (
                  <div>
                    <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                      เลือกตำแหน่ง
                    </label>
                    <select
                      value={specialForm.assignedRole}
                      onChange={(e) => setSpecialForm({ ...specialForm, assignedRole: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs font-bold text-[var(--color-text)]"
                    >
                      <option value="cashier">แคชเชียร์</option>
                      <option value="stock">สต็อกสินค้า</option>
                      {isManager && <option value="manager_assistant">ผู้ช่วยผู้จัดการ</option>}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                      ขอบเขต
                    </label>
                    <div className="px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs font-bold text-amber-700 dark:text-amber-300">
                      พนักงานทุกคนในสาขานี้
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                    วันที่เริ่มต้น
                  </label>
                  <input
                    type="date"
                    required
                    value={specialForm.startDate}
                    onChange={(e) => setSpecialForm({ ...specialForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs font-bold text-[var(--color-text)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                    กำหนดสิ้นสุด
                  </label>
                  <input
                    type="date"
                    required
                    value={specialForm.endDate}
                    onChange={(e) => setSpecialForm({ ...specialForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs font-bold text-[var(--color-text)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                    คะแนนรางวัลพิเศษ (+pts)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={specialForm.pointsReward}
                    onChange={(e) => setSpecialForm({ ...specialForm, pointsReward: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs font-extrabold text-[var(--color-text)]"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs font-bold text-[var(--color-text)]">
                    <input
                      type="checkbox"
                      checked={specialForm.penaltyStreak}
                      onChange={(e) => setSpecialForm({ ...specialForm, penaltyStreak: e.target.checked })}
                      className="rounded border-[var(--color-border)] text-rose-600 focus:ring-rose-500"
                    />
                    <span>ตัดสตรีคหากไม่เสร็จ (Flawed)</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
                <button
                  type="button"
                  onClick={() => setIsSpecialModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-xs font-bold text-[var(--color-text)] cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-amber-950 text-xs font-extrabold cursor-pointer"
                >
                  {editingSpecialTask ? "บันทึกการแก้ไข" : "ออกภารกิจ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
