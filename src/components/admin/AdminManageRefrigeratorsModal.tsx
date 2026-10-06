"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Snowflake,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  Check,
  X,
  AlertTriangle,
  Thermometer,
  ShieldAlert,
} from "lucide-react";
import {
  RefrigeratorConfig,
  getRefrigeratorsByBranchAction,
  createBranchRefrigeratorAction,
  updateRefrigeratorAction,
  deleteRefrigeratorAction,
} from "../../actions/refrigerator";

interface AdminManageRefrigeratorsModalProps {
  isOpen: boolean;
  branch: {
    id: string;
    name: string;
    code?: string;
  } | null;
  onClose: () => void;
  onUpdated?: () => void;
}

const PRESETS = [
  { label: "❄️ ตู้แช่เย็นเครื่องดื่ม / อาหาร", name: "ตู้แช่เย็น ", min: 0, max: 4 },
  { label: "🧊 ตู้แช่แข็งเนื้อสัตว์ / ไอศกรีม", name: "ตู้แช่แข็ง ", min: -22, max: -18 },
  { label: "🍰 ตู้โชว์เค้กและเบเกอรี่", name: "ตู้โชว์เค้ก ", min: 2, max: 6 },
  { label: "🥬 ตู้แช่ผักและผลไม้สด", name: "ตู้แช่ผักผลไม้ ", min: 4, max: 8 },
];

export function AdminManageRefrigeratorsModal({
  isOpen,
  branch,
  onClose,
  onUpdated,
}: AdminManageRefrigeratorsModalProps) {
  const [refrigerators, setRefrigerators] = useState<RefrigeratorConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New Refrigerator Form State
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMinTemp, setNewMinTemp] = useState<number>(0);
  const [newMaxTemp, setNewMaxTemp] = useState<number>(4);
  const [newDisableCheck, setNewDisableCheck] = useState(false);
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  // Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editMinTemp, setEditMinTemp] = useState<number>(0);
  const [editMaxTemp, setEditMaxTemp] = useState<number>(4);
  const [editDisableCheck, setEditDisableCheck] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete Confirmation State
  const [deletingRef, setDeletingRef] = useState<RefrigeratorConfig | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  const loadRefrigerators = useCallback(
    async (isSilent = false) => {
      if (!branch?.id) return;
      try {
        if (!isSilent) setIsLoading(true);
        else setIsRefreshing(true);
        setErrorMessage(null);

        const res = await getRefrigeratorsByBranchAction(branch.id);
        if (res.success && res.data) {
          setRefrigerators(res.data);
        } else {
          setErrorMessage(res.error || "ไม่สามารถดึงข้อมูลตู้แช่ได้");
        }
      } catch (err: unknown) {
        setErrorMessage((err as Error)?.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [branch]
  );

  useEffect(() => {
    if (isOpen && branch?.id) {
      void loadRefrigerators(false);
      setIsAddingNew(false);
      setEditingId(null);
      setDeletingRef(null);
    }
  }, [isOpen, branch, loadRefrigerators]);

  // Handle Create New Refrigerator
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!branch?.id) return;
    if (!newName.trim()) {
      showToast("กรุณาระบุชื่อตู้แช่");
      return;
    }
    if (newMinTemp > newMaxTemp) {
      showToast("อุณหภูมิต่ำสุดต้องไม่มากกว่าอุณหภูมิสูงสุด");
      return;
    }

    try {
      setIsSubmittingNew(true);
      const res = await createBranchRefrigeratorAction({
        branchId: branch.id,
        name: newName.trim(),
        minTemperature: Number(newMinTemp),
        maxTemperature: Number(newMaxTemp),
        disableCheck: newDisableCheck,
      });

      if (res.success) {
        showToast(`เพิ่มตู้แช่ "${newName.trim()}" สำเร็จ`);
        setNewName("");
        setNewMinTemp(0);
        setNewMaxTemp(4);
        setNewDisableCheck(false);
        setIsAddingNew(false);
        await loadRefrigerators(true);
        onUpdated?.();
      } else {
        showToast(res.error || "ไม่สามารถเพิ่มตู้แช่ได้");
      }
    } catch {
      showToast("เกิดข้อผิดพลาดในการเพิ่มตู้แช่");
    } finally {
      setIsSubmittingNew(false);
    }
  }

  // Handle Start Editing
  function startEdit(ref: RefrigeratorConfig) {
    setEditingId(ref.id);
    setEditName(ref.name);
    setEditMinTemp(ref.min_temperature);
    setEditMaxTemp(ref.max_temperature);
    setEditDisableCheck(Boolean(ref.disable_check));
  }

  // Handle Save Edit
  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    if (!editName.trim()) {
      showToast("กรุณาระบุชื่อตู้แช่");
      return;
    }
    if (editMinTemp > editMaxTemp) {
      showToast("อุณหภูมิต่ำสุดต้องไม่มากกว่าอุณหภูมิสูงสุด");
      return;
    }

    try {
      setIsSavingEdit(true);
      const res = await updateRefrigeratorAction({
        id: editingId,
        name: editName.trim(),
        minTemperature: Number(editMinTemp),
        maxTemperature: Number(editMaxTemp),
        disableCheck: editDisableCheck,
      });

      if (res.success) {
        showToast("บันทึกการแก้ไขตู้แช่สำเร็จ");
        setEditingId(null);
        await loadRefrigerators(true);
        onUpdated?.();
      } else {
        showToast(res.error || "ไม่สามารถบันทึกตู้แช่ได้");
      }
    } catch {
      showToast("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setIsSavingEdit(false);
    }
  }

  // Handle Quick Toggle Status
  async function handleQuickToggleStatus(ref: RefrigeratorConfig) {
    const nextDisabled = !ref.disable_check;
    try {
      const res = await updateRefrigeratorAction({
        id: ref.id,
        name: ref.name,
        minTemperature: ref.min_temperature,
        maxTemperature: ref.max_temperature,
        disableCheck: nextDisabled,
      });

      if (res.success) {
        showToast(
          nextDisabled
            ? `ปิดการตรวจตู้ "${ref.name}" ชั่วคราวแล้ว`
            : `เปิดการตรวจตู้ "${ref.name}" ประจำวันแล้ว`
        );
        await loadRefrigerators(true);
        onUpdated?.();
      } else {
        showToast(res.error || "ไม่สามารถเปลี่ยนสถานะได้");
      }
    } catch {
      showToast("เกิดข้อผิดพลาดในการเปลี่ยนสถานะ");
    }
  }

  // Handle Delete
  async function handleConfirmDelete() {
    if (!deletingRef) return;
    try {
      setIsDeleting(true);
      const res = await deleteRefrigeratorAction(deletingRef.id);
      if (res.success) {
        showToast(`ลบตู้แช่ "${deletingRef.name}" เรียบร้อยแล้ว`);
        setDeletingRef(null);
        await loadRefrigerators(true);
        onUpdated?.();
      } else {
        showToast(res.error || "ไม่สามารถลบตู้แช่ได้");
      }
    } catch {
      showToast("เกิดข้อผิดพลาดในการลบตู้แช่");
    } finally {
      setIsDeleting(false);
    }
  }

  if (!isOpen || !branch) return null;

  const totalCount = refrigerators.length;
  const activeCount = refrigerators.filter((r) => !r.disable_check).length;
  const disabledCount = totalCount - activeCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4 animate-fade-in">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-surface-2)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-700 dark:text-cyan-300 flex items-center justify-center shrink-0">
              <Snowflake className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-[var(--color-text)] text-base sm:text-lg">
                  กำหนดค่าตู้แช่ประจำสาขา (Refrigerator Configuration)
                </h3>
                {branch.code && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/30">
                    {branch.code}
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                สาขา: <strong className="text-[var(--color-text)]">{branch.name}</strong> •
                กำหนดรายการตู้แช่ ช่วงอุณหภูมิที่ปลอดภัย และสถานะตรวจประจำวัน
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่างกำหนดค่าตู้แช่"
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl hover:bg-[var(--color-surface)] border border-transparent hover:border-[var(--color-border)] transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Toast Alert */}
        {toastMessage && (
          <div className="bg-amber-500 text-amber-950 px-4 py-2 text-xs font-bold text-center shadow-inner animate-fade-in flex items-center justify-center gap-1.5">
            <span>✨ {toastMessage}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Summary Strip & Actions Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--color-surface-2)]/70 p-3.5 rounded-2xl border border-[var(--color-border)]">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-xs">
              <span className="font-bold text-[var(--color-text)]">
                ตู้แช่ทั้งหมด: <span className="font-mono text-sm">{totalCount}</span> ตู้
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                ตรวจประจำวัน: {activeCount}
              </span>
              {disabledCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/30">
                  ปิดตรวจชั่วคราว: {disabledCount}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadRefrigerators(true)}
                disabled={isRefreshing}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] border border-[var(--color-border)] flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                title="รีเฟรชข้อมูลตู้แช่"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                <span>รีเฟรช</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAddingNew((prev) => !prev)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                  isAddingNew
                    ? "bg-rose-500 text-white hover:bg-rose-600"
                    : "bg-[var(--color-brown)] hover:bg-[var(--color-brown-light)] text-amber-200 dark:bg-amber-400 dark:text-amber-950"
                }`}
              >
                {isAddingNew ? (
                  <>
                    <X className="w-3.5 h-3.5" />
                    <span>ปิดฟอร์มเพิ่มตู้</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ เพิ่มตู้แช่ใหม่</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Add New Refrigerator Form (Collapsible) */}
          {isAddingNew && (
            <div className="bg-gradient-to-br from-amber-500/5 via-[var(--color-surface-2)] to-[var(--color-surface)] border-2 border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500 text-amber-950 flex items-center justify-center font-bold text-xs shadow-2xs">
                    +
                  </div>
                  <h4 className="text-sm font-bold text-[var(--color-text)]">
                    เพิ่มตู้แช่ใหม่ประจำสาขา {branch.name}
                  </h4>
                </div>
                <span className="text-[11px] text-[var(--color-text-muted)]">
                  คลิก Preset เพื่อเติมข้อมูลด่วนได้
                </span>
              </div>

              {/* Quick Preset Buttons */}
              <div>
                <p className="text-[11px] font-semibold text-[var(--color-text-muted)] mb-1.5">
                  รูปแบบตู้แช่มาตรฐาน (Quick Presets):
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        const existingMatching = refrigerators.filter((r) =>
                          r.name.startsWith(p.name)
                        ).length;
                        setNewName(`${p.name}${existingMatching + 1}`);
                        setNewMinTemp(p.min);
                        setNewMaxTemp(p.max);
                      }}
                      className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-[var(--color-surface)] hover:bg-amber-500/20 text-[var(--color-text)] border border-[var(--color-border)] hover:border-amber-400 transition-all cursor-pointer"
                    >
                      {p.label} ({p.min}°C ~ {p.max}°C)
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleCreate} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                      ชื่อตู้แช่ *
                    </label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="เช่น ตู้แช่เย็นเครื่องดื่ม 1"
                      required
                      className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs text-[var(--color-text)] focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                      อุณหภูมิต่ำสุด (°C) *
                    </label>
                    <input
                      type="number"
                      value={newMinTemp}
                      onChange={(e) => setNewMinTemp(Number(e.target.value))}
                      required
                      className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs text-[var(--color-text)] font-mono focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                      อุณหภูมิสูงสุด (°C) *
                    </label>
                    <input
                      type="number"
                      value={newMaxTemp}
                      onChange={(e) => setNewMaxTemp(Number(e.target.value))}
                      required
                      className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs text-[var(--color-text)] font-mono focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs select-none">
                    <input
                      type="checkbox"
                      checked={newDisableCheck}
                      onChange={(e) => setNewDisableCheck(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer"
                    />
                    <span className="text-[var(--color-text)]">
                      ปิดตรวจชั่วคราว (Disable Daily Check) - สำหรับตู้ที่ปิดซ่อมหรือไม่ใช้งาน
                    </span>
                  </label>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setIsAddingNew(false)}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border border-[var(--color-border)] transition-all cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingNew}
                      className="px-4 py-1.5 text-xs font-bold rounded-xl bg-[var(--color-brown)] hover:bg-[var(--color-brown-light)] text-amber-100 dark:bg-amber-400 dark:text-amber-950 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {isSubmittingNew ? "กำลังบันทึก..." : "บันทึกตู้แช่ใหม่"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* List of Refrigerators */}
          <div className="space-y-3">
            {isLoading ? (
              <div className="py-12 text-center text-xs text-[var(--color-text-muted)] flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <span>กำลังดึงข้อมูลตู้แช่ของสาขา {branch.name}...</span>
              </div>
            ) : refrigerators.length === 0 ? (
              <div className="py-14 text-center border-2 border-dashed border-[var(--color-border)] rounded-2xl bg-[var(--color-surface-2)]/40 p-6 space-y-2.5">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 mx-auto flex items-center justify-center text-xl">
                  ❄️
                </div>
                <h4 className="text-sm font-bold text-[var(--color-text)]">
                  ยังไม่มีตู้แช่ที่ลงทะเบียนไว้ในสาขานี้
                </h4>
                <p className="text-xs text-[var(--color-text-muted)] max-w-md mx-auto">
                  คลิกปุ่ม &quot;+ เพิ่มตู้แช่ใหม่&quot; ด้านบนเพื่อเพิ่มตู้แช่เย็น ตู้แช่แข็ง
                  หรือตู้โชว์เค้กสำหรับพนักงานตรวจเช็คอุณหภูมิประจำวัน
                </p>
              </div>
            ) : (
              refrigerators.map((ref) => {
                const isEditingThis = editingId === ref.id;
                const isDisabled = Boolean(ref.disable_check);
                const isSubzero = ref.min_temperature < 0;

                if (isEditingThis) {
                  return (
                    <div
                      key={ref.id}
                      className="bg-[var(--color-surface-2)] border-2 border-amber-500/60 rounded-2xl p-4 shadow-sm space-y-3 animate-fade-in"
                    >
                      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
                        <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>กำลังแก้ไข: {ref.name}</span>
                        </span>
                        <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
                          ID: {ref.id.slice(0, 8)}...
                        </span>
                      </div>

                      <form onSubmit={handleSaveEdit} className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-[var(--color-text)] mb-1">
                              ชื่อตู้แช่ *
                            </label>
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              required
                              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-1.5 text-xs text-[var(--color-text)] focus:outline-none focus:border-amber-400"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-[var(--color-text)] mb-1">
                              อุณหภูมิต่ำสุด (°C) *
                            </label>
                            <input
                              type="number"
                              value={editMinTemp}
                              onChange={(e) => setEditMinTemp(Number(e.target.value))}
                              required
                              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-1.5 text-xs text-[var(--color-text)] font-mono focus:outline-none focus:border-amber-400"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-[var(--color-text)] mb-1">
                              อุณหภูมิสูงสุด (°C) *
                            </label>
                            <input
                              type="number"
                              value={editMaxTemp}
                              onChange={(e) => setEditMaxTemp(Number(e.target.value))}
                              required
                              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-1.5 text-xs text-[var(--color-text)] font-mono focus:outline-none focus:border-amber-400"
                            />
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                          <label className="inline-flex items-center gap-2 cursor-pointer text-xs select-none">
                            <input
                              type="checkbox"
                              checked={editDisableCheck}
                              onChange={(e) => setEditDisableCheck(e.target.checked)}
                              className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer"
                            />
                            <span className="text-[var(--color-text)]">
                              ปิดตรวจชั่วคราว (Disable Daily Check)
                            </span>
                          </label>

                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border border-[var(--color-border)] cursor-pointer"
                            >
                              ยกเลิก
                            </button>
                            <button
                              type="submit"
                              disabled={isSavingEdit}
                              className="px-4 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{isSavingEdit ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}</span>
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                  );
                }

                return (
                  <div
                    key={ref.id}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs ${
                      isDisabled
                        ? "bg-[var(--color-surface-2)]/50 border-[var(--color-border)] opacity-85"
                        : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-amber-400"
                    }`}
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-base shrink-0 shadow-2xs ${
                          isDisabled
                            ? "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                            : isSubzero
                            ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30"
                            : "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30"
                        }`}
                      >
                        {isSubzero ? "🧊" : "❄️"}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-extrabold text-[var(--color-text)]">
                            {ref.name}
                          </h4>
                          {isDisabled ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30">
                              ✕ ปิดตรวจชั่วคราว
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                              ✓ ตรวจประจำวัน
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] flex-wrap">
                          <span className="inline-flex items-center gap-1 font-mono font-semibold bg-[var(--color-surface-2)] px-2 py-0.5 rounded-md border border-[var(--color-border)]">
                            <Thermometer className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                            <span>
                              {ref.min_temperature}°C ถึง {ref.max_temperature}°C
                            </span>
                          </span>

                          <span className="text-[11px]">
                            {isSubzero
                              ? "ประเภท: แช่แข็ง (Freezer)"
                              : "ประเภท: แช่เย็น (Chiller)"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons Toolbar */}
                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleQuickToggleStatus(ref)}
                        className={`px-2.5 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                          isDisabled
                            ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                            : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-amber-700 hover:bg-amber-50 border-[var(--color-border)]"
                        }`}
                        title={
                          isDisabled
                            ? "เปิดการตรวจตู้แช่นี้ประจำวัน"
                            : "ปิดการตรวจตู้แช่นี้ชั่วคราว"
                        }
                      >
                        {isDisabled ? "เปิดตรวจ" : "ปิดตรวจ"}
                      </button>

                      <button
                        type="button"
                        onClick={() => startEdit(ref)}
                        className="p-1.5 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] text-[var(--color-text)] border border-[var(--color-border)] transition-all cursor-pointer"
                        title="แก้ไขข้อมูลตู้แช่"
                        aria-label={`แก้ไขตู้แช่ ${ref.name}`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingRef(ref)}
                        className="p-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-all cursor-pointer"
                        title="ลบตู้แช่นี้ออกจากสาขา"
                        aria-label={`ลบตู้แช่ ${ref.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-[var(--color-border)] flex items-center justify-between bg-[var(--color-surface-2)]">
          <span className="text-[11px] text-[var(--color-text-muted)]">
            การเปลี่ยนแปลงจะมีผลต่อระบบตรวจอุณหภูมิกะของสาขา {branch.name} ทันที
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-[var(--color-surface)] hover:bg-[var(--color-border)] text-[var(--color-text)] border border-[var(--color-border)] transition-all cursor-pointer shadow-2xs"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>

      {/* Delete Confirmation Sub-Modal */}
      {deletingRef && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-[var(--color-text)]">
                  ยืนยันการลบตู้แช่
                </h4>
                <p className="text-xs text-[var(--color-text-muted)]">
                  สาขา: {branch.name}
                </p>
              </div>
            </div>

            <div className="bg-[var(--color-surface-2)] p-3 rounded-xl border border-[var(--color-border)] text-xs space-y-1">
              <p className="font-bold text-[var(--color-text)]">
                ชื่อตู้: {deletingRef.name}
              </p>
              <p className="text-[var(--color-text-muted)]">
                ช่วงอุณหภูมิ: {deletingRef.min_temperature}°C ถึง {deletingRef.max_temperature}°C
              </p>
              <p className="text-rose-600 dark:text-rose-400 text-[11px] pt-1">
                ⚠️ งานตรวจอุณหภูมิที่ยังไม่ได้ตรวจสำหรับวันนี้ของตู้นี้จะถูกลบออกจากระบบทันที
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingRef(null)}
                disabled={isDeleting}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] text-[var(--color-text)] border border-[var(--color-border)] cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-sm disabled:opacity-50"
              >
                {isDeleting ? "กำลังลบ..." : "ยืนยันการลบตู้แช่"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
