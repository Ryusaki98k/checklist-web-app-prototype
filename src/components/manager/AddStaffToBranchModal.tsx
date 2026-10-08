"use client";

import { useState, useEffect, useMemo } from "react";
import { User, Role } from "../../types";
import {
  getUnassignedUsersAction,
  addEmployeeToBranchAction,
} from "../../actions/manager";
import { useModalFocusTrap } from "../common/ModalFocusTrap";
import {
  UserPlus,
  Users,
  Search,
  Check,
  Briefcase,
  Store,
  ShieldCheck,
  AlertCircle,
  X,
  RotateCw,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { UserAvatar } from "../common/UserAvatar";

interface AddStaffToBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchId: string;
  branchName: string;
  currentUser: User;
  onStaffAdded: () => void;
}

export function AddStaffToBranchModal({
  isOpen,
  onClose,
  branchId,
  branchName,
  currentUser,
  onStaffAdded,
}: AddStaffToBranchModalProps) {
  const [activeTab, setActiveTab] = useState<"pool" | "new">("pool");
  const [unassignedUsers, setUnassignedUsers] = useState<
    Array<{ id: string; name: string; username: string; createdAt?: string }>
  >([]);
  const [isLoadingPool, setIsLoadingPool] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Assignment configuration
  const [selectedRole, setSelectedRole] = useState<"employee" | "manager_assistant">("employee");
  const [customPosition, setCustomPosition] = useState<string>("แคชเชียร์");

  // New staff form state
  const [newStaffForm, setNewStaffForm] = useState({
    name: "",
    username: "",
    password: "123",
    role: "employee" as "employee" | "manager_assistant",
    position: "แคชเชียร์",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { dialogRef, handleKeyDown } = useModalFocusTrap(isOpen, onClose);

  // Load unassigned users whenever modal opens or tab changes to pool
  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setSelectedUserId(null);

    async function fetchPool() {
      setIsLoadingPool(true);
      try {
        const res = await getUnassignedUsersAction();
        if (res.success && res.users) {
          setUnassignedUsers(res.users);
        } else {
          setErrorMsg(res.error || "ไม่สามารถโหลดรายชื่อพนักงานที่รอสาขาได้");
        }
      } catch (err: any) {
        console.error("Error fetching unassigned pool:", err);
        setErrorMsg("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
      } finally {
        setIsLoadingPool(false);
      }
    }

    if (activeTab === "pool") {
      void fetchPool();
    }
  }, [isOpen, activeTab]);

  const filteredPool = useMemo(() => {
    if (!searchQuery.trim()) return unassignedUsers;
    const q = searchQuery.toLowerCase();
    return unassignedUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.username && u.username.toLowerCase().includes(q))
    );
  }, [unassignedUsers, searchQuery]);

  if (!isOpen) return null;

  async function handleAssignFromPool() {
    if (!selectedUserId) {
      setErrorMsg("กรุณาเลือกพนักงานที่ต้องการเพิ่มเข้าสาขา");
      return;
    }
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const res = await addEmployeeToBranchAction({
        managerId: currentUser.id,
        branchId,
        userId: selectedUserId,
        role: selectedRole,
        position: customPosition,
      });

      if (res.success) {
        onStaffAdded();
        onClose();
      } else {
        setErrorMsg(res.error || "ไม่สามารถเพิ่มพนักงานเข้าสาขาได้");
      }
    } catch (err: any) {
      console.error("Add from pool error:", err);
      setErrorMsg("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateNewStaff() {
    const { name, username, password, role, position } = newStaffForm;
    if (!name.trim() || !username.trim()) {
      setErrorMsg("กรุณากรอกชื่อ-นามสกุล และชื่อผู้ใช้ให้ครบถ้วน");
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const res = await addEmployeeToBranchAction({
        managerId: currentUser.id,
        branchId,
        newUserData: {
          name: name.trim(),
          username: username.trim().toLowerCase(),
          password: password.trim() || "123",
          role,
          position: position || undefined,
        },
        role,
        position,
      });

      if (res.success) {
        onStaffAdded();
        onClose();
      } else {
        setErrorMsg(res.error || "ไม่สามารถสร้างและเพิ่มพนักงานเข้าสาขาได้");
      }
    } catch (err: any) {
      console.error("Create new staff error:", err);
      setErrorMsg("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-staff-modal-title"
        tabIndex={-1}
        className="w-full max-w-xl bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl p-5 sm:p-7 text-[var(--color-text)] flex flex-col gap-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-amber-950 flex items-center justify-center shadow-xs shrink-0">
              <UserPlus size={22} strokeWidth={2.2} />
            </div>
            <div>
              <h2 id="add-staff-modal-title" className="text-base sm:text-lg font-bold text-[var(--color-text)] leading-tight">
                เพิ่มพนักงานเข้าสาขา
              </h2>
              <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1.5 mt-0.5">
                <Store size={13} className="text-amber-600 shrink-0" />
                <span>สาขาประจำการ: <strong className="text-[var(--color-text)]">{branchName}</strong></span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div role="tablist" className="flex p-1 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl gap-1">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "pool"}
            onClick={() => {
              setActiveTab("pool");
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "pool"
                ? "bg-amber-500 text-amber-950 shadow-xs"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            <Users size={14} />
            <span>เลือกจากพนักงานที่รอสาขา</span>
            {unassignedUsers.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-950/20 text-amber-950 dark:text-amber-100">
                {unassignedUsers.length}
              </span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "new"}
            onClick={() => {
              setActiveTab("new");
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "new"
                ? "bg-amber-500 text-amber-950 shadow-xs"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            <UserPlus size={14} />
            <span>สร้างพนักงานใหม่เข้าสาขา</span>
          </button>
        </div>

        {/* Error message if any */}
        {errorMsg && (
          <div role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tab 1: Select from Unassigned Pool */}
        {activeTab === "pool" && (
          <div className="space-y-4">
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อหรือชื่อผู้ใช้..."
                className="w-full pl-9 pr-3.5 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl text-xs sm:text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-2 focus:outline-amber-500"
              />
            </div>

            {isLoadingPool ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-[var(--color-text-muted)]">
                <RotateCw size={20} className="animate-spin text-amber-600" />
                <span>กำลังโหลดรายชื่อพนักงานที่รอสาขา...</span>
              </div>
            ) : filteredPool.length === 0 ? (
              <div className="py-10 px-4 text-center bg-[var(--color-surface-2)]/40 rounded-xl border border-[var(--color-border-subtle)] space-y-2">
                <Users size={28} className="mx-auto text-[var(--color-text-muted)] opacity-50" />
                <p className="text-xs font-bold text-[var(--color-text)]">
                  {searchQuery ? "ไม่พบพนักงานที่ตรงกับคำค้นหา" : "ไม่มีพนักงานที่รอการกำหนดสาขาในระบบ"}
                </p>
                <p className="text-[11px] text-[var(--color-text-muted)] max-w-sm mx-auto">
                  คุณสามารถสลับไปยังแท็บ &ldquo;สร้างพนักงานใหม่เข้าสาขา&rdquo; เพื่อเพิ่มพนักงานเข้าประจำการได้ทันที
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {filteredPool.map((u) => {
                  const isSelected = selectedUserId === u.id;
                  return (
                    <div
                      key={u.id}
                      onClick={() => setSelectedUserId(u.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? "bg-amber-50 dark:bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/20"
                          : "bg-[var(--color-surface-2)]/50 border-[var(--color-border)] hover:border-amber-400"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UserAvatar user={u} size="sm" className="shrink-0 shadow-xs" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[var(--color-text)] truncate">{u.name}</p>
                          <p className="text-[11px] text-[var(--color-text-muted)] font-mono">@{u.username}</p>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isSelected ? (
                          <span className="w-5 h-5 rounded-full bg-amber-500 text-amber-950 flex items-center justify-center">
                            <Check size={12} strokeWidth={3} />
                          </span>
                        ) : (
                          <span className="w-5 h-5 rounded-full border border-[var(--color-border)] block" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Assignment settings for selected user */}
            {selectedUserId && (
              <div className="pt-3 border-t border-[var(--color-border)] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                      บทบาทในสาขา
                    </label>
                    <select
                      value={selectedRole}
                      onChange={(e) => {
                        const r = e.target.value as "employee" | "manager_assistant";
                        setSelectedRole(r);
                        if (r === "manager_assistant") {
                          setCustomPosition("ผู้ช่วยผู้จัดการร้าน");
                        } else if (customPosition === "ผู้ช่วยผู้จัดการร้าน") {
                          setCustomPosition("แคชเชียร์");
                        }
                      }}
                      className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs font-semibold text-[var(--color-text)] focus:outline-2 focus:outline-amber-500 cursor-pointer"
                    >
                      <option value="employee">พนักงานประจำสาขา (Floor Staff)</option>
                      <option value="manager_assistant">ผู้ช่วยผู้จัดการร้าน (Assistant Manager)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                      ตำแหน่งงานที่มอบหมาย
                    </label>
                    <select
                      value={customPosition}
                      onChange={(e) => setCustomPosition(e.target.value)}
                      className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs font-semibold text-[var(--color-text)] focus:outline-2 focus:outline-amber-500 cursor-pointer"
                    >
                      <option value="แคชเชียร์">แคชเชียร์</option>
                      <option value="พนักงานสต็อก/จัดเรียง">พนักงานสต็อก/จัดเรียง</option>
                      <option value="พนักงานทั่วไป">พนักงานทั่วไป</option>
                      <option value="ผู้ช่วยผู้จัดการร้าน">ผู้ช่วยผู้จัดการร้าน</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 py-2.5 px-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>

              <button
                type="button"
                onClick={handleAssignFromPool}
                disabled={!selectedUserId || isSubmitting}
                className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-amber-950 text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <RotateCw size={14} className="animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <>
                    <UserCheck size={14} />
                    <span>ยืนยันการเพิ่มเข้าสาขา</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Create Brand New Staff Form */}
        {activeTab === "new" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreateNewStaff();
            }}
            className="space-y-3.5"
          >
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                ชื่อ-นามสกุล <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="เช่น สมชาย ใจมั่น"
                value={newStaffForm.name}
                onChange={(e) => setNewStaffForm({ ...newStaffForm, name: e.target.value })}
                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-2 focus:outline-amber-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                  ชื่อผู้ใช้ (Username) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="เช่น somchai"
                  value={newStaffForm.username}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, username: e.target.value })}
                  className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-2 focus:outline-amber-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                  รหัสผ่านเริ่มต้น <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="รหัสผ่านเข้าใช้งาน"
                  value={newStaffForm.password}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, password: e.target.value })}
                  className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-2 focus:outline-amber-500 font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                  บทบาทในสาขา
                </label>
                <select
                  value={newStaffForm.role}
                  onChange={(e) => {
                    const r = e.target.value as "employee" | "manager_assistant";
                    setNewStaffForm({
                      ...newStaffForm,
                      role: r,
                      position: r === "manager_assistant" ? "ผู้ช่วยผู้จัดการร้าน" : newStaffForm.position === "ผู้ช่วยผู้จัดการร้าน" ? "แคชเชียร์" : newStaffForm.position,
                    });
                  }}
                  className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs font-semibold text-[var(--color-text)] focus:outline-2 focus:outline-amber-500 cursor-pointer"
                >
                  <option value="employee">พนักงานประจำสาขา (Floor Staff)</option>
                  <option value="manager_assistant">ผู้ช่วยผู้จัดการร้าน (Assistant Manager)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                  ตำแหน่งหน้าที่
                </label>
                <select
                  value={newStaffForm.position}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, position: e.target.value })}
                  className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs font-semibold text-[var(--color-text)] focus:outline-2 focus:outline-amber-500 cursor-pointer"
                >
                  <option value="แคชเชียร์">แคชเชียร์</option>
                  <option value="พนักงานสต็อก/จัดเรียง">พนักงานสต็อก/จัดเรียง</option>
                  <option value="พนักงานทั่วไป">พนักงานทั่วไป</option>
                  <option value="ผู้ช่วยผู้จัดการร้าน">ผู้ช่วยผู้จัดการร้าน</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 py-2.5 px-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-amber-950 text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <RotateCw size={14} className="animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={14} />
                    <span>สร้างและเพิ่มเข้าสาขา</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
