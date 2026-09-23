"use client";

import { useEffect, useState } from "react";
import { User } from "../../types";
import {
    RefrigeratorConfig,
    getRefrigeratorsAction,
    createRefrigeratorAction,
    updateRefrigeratorAction,
} from "../../actions/refrigerator";
import { Snowflake, AlertOctagon, ClipboardCheck, Settings } from "lucide-react";
import { BranchRefrigeratorLiveView } from "./BranchRefrigeratorLiveView";

export function RefrigeratorConfigView({ user }: { user: User }) {
    const [subTab, setSubTab] = useState<"live" | "config">("live");
    const [refrigerators, setRefrigerators] = useState<RefrigeratorConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [isAdding, setIsAdding] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);

    // Form State
    const [formName, setFormName] = useState("ตู้แช่");
    const [formMinTemp, setFormMinTemp] = useState(0);
    const [formMaxTemp, setFormMaxTemp] = useState(4);
    const [formDisable, setFormDisable] = useState(false);
    const [saving, setSaving] = useState(false);

    const [formError, setFormError] = useState("");
    const [liveRefreshKey, setLiveRefreshKey] = useState(0);

    async function loadData() {
        setLoading(true);
        const res = await getRefrigeratorsAction(user.id);
        if (res.success && res.data) {
            setRefrigerators(res.data);
        } else {
            setError(res.error || "เกิดข้อผิดพลาดในการดึงข้อมูล");
        }
        setLoading(false);
    }

    useEffect(() => {
        if (subTab === "config") {
            loadData();
        }
        const handleExternalRefresh = () => {
            if (subTab === "config") {
                loadData();
            }
            setLiveRefreshKey((k) => k + 1);
        };
        window.addEventListener("refresh-dashboard-data", handleExternalRefresh);
        return () => window.removeEventListener("refresh-dashboard-data", handleExternalRefresh);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [subTab]);

    async function handleToggleDisable(ref: RefrigeratorConfig) {
        const newDisable = !ref.disable_check;
        setRefrigerators((prev) =>
            prev.map((r) => (r.id === ref.id ? { ...r, disable_check: newDisable } : r))
        );
        try {
            const res = await updateRefrigeratorAction({
                id: ref.id,
                name: ref.name,
                minTemperature: ref.min_temperature ?? 0,
                maxTemperature: ref.max_temperature ?? 4,
                disableCheck: newDisable,
            });
            if (res.success) {
                setLiveRefreshKey((k) => k + 1);
            } else {
                setRefrigerators((prev) =>
                    prev.map((r) => (r.id === ref.id ? { ...r, disable_check: ref.disable_check } : r))
                );
            }
        } catch {
            setRefrigerators((prev) =>
                prev.map((r) => (r.id === ref.id ? { ...r, disable_check: ref.disable_check } : r))
            );
        }
    }

    function handleOpenAdd() {
        setIsAdding(true);
        setEditId(null);
        setFormName("ตู้แช่");
        setFormMinTemp(0);
        setFormMaxTemp(4);
        setFormDisable(false);
        setFormError("");
    }

    function handleOpenEdit(ref: RefrigeratorConfig) {
        setIsAdding(false);
        setEditId(ref.id);
        setFormName(ref.name);
        setFormMinTemp(ref.min_temperature ?? 0);
        setFormMaxTemp(ref.max_temperature ?? 4);
        setFormDisable(ref.disable_check);
        setFormError("");
    }

    function handleCancel() {
        setIsAdding(false);
        setEditId(null);
        setFormError("");
    }

    async function handleSave() {
        if (!formName.trim()) {
            setFormError("กรุณาระบุชื่อตู้แช่");
            return;
        }

        if (formMinTemp > formMaxTemp) {
            setFormError("อุณหภูมิต่ำสุดต้องไม่เกินอุณหภูมิสูงสุด");
            return;
        }

        setSaving(true);
        setFormError("");
        if (isAdding) {
            const res = await createRefrigeratorAction({
                userId: user.id,
                name: formName,
                minTemperature: formMinTemp,
                maxTemperature: formMaxTemp,
                disableCheck: formDisable,
            });
            if (res.success && res.data) {
                setRefrigerators([...refrigerators, res.data]);
                setLiveRefreshKey((k) => k + 1);
                handleCancel();
            } else {
                setFormError(res.error || "บันทึกไม่สำเร็จ");
            }
        } else if (editId) {
            const res = await updateRefrigeratorAction({
                id: editId,
                name: formName,
                minTemperature: formMinTemp,
                maxTemperature: formMaxTemp,
                disableCheck: formDisable,
            });
            if (res.success) {
                setRefrigerators(
                    refrigerators.map((r) =>
                        r.id === editId
                            ? { ...r, name: formName, min_temperature: formMinTemp, max_temperature: formMaxTemp, disable_check: formDisable }
                            : r
                    )
                );
                setLiveRefreshKey((k) => k + 1);
                handleCancel();
            } else {
                setFormError(res.error || "อัปเดตไม่สำเร็จ");
            }
        }
        setSaving(false);
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Sub-tab Navigation */}
            <div className="flex bg-[var(--color-surface-2)] p-1 rounded-2xl border border-[var(--color-border)] text-xs font-bold gap-1 shadow-2xs max-w-md">
                <button
                    type="button"
                    onClick={() => setSubTab("live")}
                    className={`flex-1 py-2 sm:py-2.5 px-3 rounded-xl text-center cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                        subTab === "live"
                            ? "bg-[var(--color-brown)] text-amber-100 dark:bg-amber-400 dark:text-amber-950 shadow-xs font-extrabold"
                            : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                    }`}
                >
                    <ClipboardCheck size={14} />
                    <span>ตรวจเช็ควันนี้ (Live Tasks)</span>
                </button>
                <button
                    type="button"
                    onClick={() => setSubTab("config")}
                    className={`flex-1 py-2 sm:py-2.5 px-3 rounded-xl text-center cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                        subTab === "config"
                            ? "bg-[var(--color-brown)] text-amber-100 dark:bg-amber-400 dark:text-amber-950 shadow-xs font-extrabold"
                            : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                    }`}
                >
                    <Settings size={14} />
                    <span>จัดการตู้แช่ ({refrigerators.length})</span>
                </button>
            </div>

            {subTab === "live" ? (
                <BranchRefrigeratorLiveView key={liveRefreshKey} user={user} />
            ) : (
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--color-border)] pb-3">
                    <div>
                        <h3 className="text-sm font-bold text-[var(--color-text)] flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-cyan-400" />
                            <span>การตั้งค่าและจัดการอุปกรณ์ตู้แช่เซเว่นฯ (Refrigerator Configuration)</span>
                        </h3>
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                            เพิ่มตู้แช่, ตั้งชื่อ, และกำหนดอุณหภูมิเป้าหมายของตู้แช่ในสาขาของท่าน
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleOpenAdd}
                        disabled={isAdding || editId !== null}
                        className="text-xs font-semibold text-amber-950 bg-amber-400 hover:bg-amber-500 border border-amber-500 px-3.5 py-2 min-h-[44px] sm:min-h-[36px] rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                        <span>+ เพิ่มตู้แช่ใหม่</span>
                    </button>
                </div>

                {error && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs rounded-xl">
                        {error}
                    </div>
                )}

                {(isAdding || editId) && (
                    <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] p-4 sm:p-5 rounded-xl space-y-4 mb-4 relative">
                        <h4 className="font-bold text-sm text-[var(--color-text)]">
                            {isAdding ? "เพิ่มตู้แช่ใหม่" : "แก้ไขข้อมูลตู้แช่"}
                        </h4>

                        {formError && (
                            <div role="alert" className="p-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs rounded-lg font-semibold">
                                {formError}
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label htmlFor="ref-name" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                                    ชื่อตู้แช่ (เช่น ตู้เบียร์, ตู้นม, ตู้ 1)
                                </label>
                                <input
                                    id="ref-name"
                                    type="text"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] focus:border-amber-400 rounded-lg px-3 py-2 text-sm text-[var(--color-text)] focus:outline-hidden"
                                />
                            </div>
                            <div>
                                <label htmlFor="ref-min-temp" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                                    อุณหภูมิต่ำสุด (°C)
                                </label>
                                <input
                                    id="ref-min-temp"
                                    type="number"
                                    value={formMinTemp}
                                    onChange={(e) => setFormMinTemp(Number(e.target.value))}
                                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] focus:border-amber-400 rounded-lg px-3 py-2 text-sm text-[var(--color-text)] focus:outline-hidden"
                                />
                            </div>
                            <div>
                                <label htmlFor="ref-max-temp" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                                    อุณหภูมิสูงสุด (°C)
                                </label>
                                <input
                                    id="ref-max-temp"
                                    type="number"
                                    value={formMaxTemp}
                                    onChange={(e) => setFormMaxTemp(Number(e.target.value))}
                                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] focus:border-amber-400 rounded-lg px-3 py-2 text-sm text-[var(--color-text)] focus:outline-hidden"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="disableCheck"
                                checked={formDisable}
                                onChange={(e) => setFormDisable(e.target.checked)}
                                className="w-4 h-4 text-amber-500 rounded focus:ring-amber-400"
                            />
                            <label htmlFor="disableCheck" className="text-xs font-semibold text-[var(--color-text-muted)] cursor-pointer">
                                ปิดการตรวจสอบตู้แช่นี้ (ตู้เสียหรือปิดใช้งาน)
                            </label>
                        </div>
                        <div className="pt-2 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="px-4 py-2 min-h-[44px] sm:min-h-[36px] text-xs font-semibold text-[var(--color-text-muted)] hover:text-rose-600 bg-[var(--color-surface)] rounded-xl transition-colors border border-[var(--color-border)] cursor-pointer"
                            >
                                ยกเลิกโดยไม่บันทึก
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving}
                                className="px-4 py-2 min-h-[44px] sm:min-h-[36px] text-xs font-bold text-amber-950 bg-amber-400 hover:bg-amber-500 rounded-xl transition-colors border border-amber-500 shadow-sm disabled:opacity-50 cursor-pointer"
                            >
                                {saving ? "กำลังบันทึก..." : isAdding ? "เพิ่มตู้แช่ลงสาขา" : "บันทึกการแก้ไข"}
                            </button>
                        </div>
                    </div>
                )}

                {loading && <div className="text-center py-8 text-xs text-[var(--color-text-muted)]">กำลังโหลดข้อมูลตู้แช่...</div>}

                {!loading && refrigerators.length === 0 && !isAdding && (
                    <div className="text-center py-10 border-2 border-dashed border-[var(--color-border)] rounded-2xl bg-[var(--color-surface-2)]/50 p-6">
                        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-2.5">
                            <Snowflake className="w-5 h-5" />
                        </div>
                        <p className="text-sm font-bold text-[var(--color-text)] mb-1">ยังไม่มีรายการตู้แช่ในระบบสาขานี้</p>
                        <p className="text-xs text-[var(--color-text-subtle)] max-w-sm mx-auto">กดปุ่ม &quot;+ เพิ่มตู้แช่ใหม่&quot; ด้านบน เพื่อระบุชื่อตู้และกำหนดอุณหภูมิเป้าหมายสำหรับให้พนักงานตรวจสอบประจำวัน</p>
                    </div>
                )}

                {!loading && refrigerators.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {refrigerators.map((ref) => (
                            <div
                                key={ref.id}
                                className={`p-4 rounded-xl border transition-all ${ref.disable_check
                                    ? "bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text-muted)]"
                                    : "bg-[var(--color-surface)] border-sky-200 dark:border-sky-800/80 hover:border-sky-400 dark:hover:border-sky-600 shadow-xs"
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shadow-2xs ${ref.disable_check ? "bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200" : "bg-sky-100 dark:bg-sky-950/60 border-sky-300 dark:border-sky-800 text-sky-950 dark:text-sky-200"}`}>
                                            {ref.disable_check ? <AlertOctagon className="w-4 h-4" /> : <Snowflake className="w-4 h-4" />}
                                        </div>
                                        <div>
                                            <h4 className={`font-bold text-sm ${ref.disable_check ? "text-[var(--color-text-muted)] line-through" : "text-[var(--color-text)]"}`}>
                                                {ref.name}
                                            </h4>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => handleToggleDisable(ref)}
                                            title={ref.disable_check ? "คลิกเพื่อเปิดใช้งานตู้แช่นี้" : "คลิกเพื่อปิดใช้งานตู้แช่นี้ (งดตรวจ)"}
                                            className={`px-2 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer flex items-center gap-1 min-h-[32px] ${
                                                ref.disable_check
                                                    ? "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800 hover:bg-rose-200"
                                                    : "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800 hover:bg-emerald-200"
                                            }`}
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full ${ref.disable_check ? "bg-rose-500" : "bg-emerald-500"}`} />
                                            <span>{ref.disable_check ? "ปิดอยู่" : "เปิดอยู่"}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleOpenEdit(ref)}
                                            className="p-1.5 min-h-[32px] min-w-[32px] flex items-center justify-center text-[var(--color-text-muted)] hover:text-amber-950 hover:bg-amber-100/70 dark:hover:bg-amber-950/50 dark:hover:text-amber-200 rounded-lg transition-colors cursor-pointer"
                                            title="แก้ไขข้อมูล"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-xs font-semibold">
                                    <span className="text-[var(--color-text-muted)]">เกณฑ์อุณหภูมิ:</span>
                                    <span className={`px-2 py-0.5 rounded-full border font-mono font-bold ${ref.disable_check ? "bg-[var(--color-surface-2)] text-[var(--color-text-subtle)] border-[var(--color-border)]" : "bg-sky-50 dark:bg-sky-950/50 text-sky-950 dark:text-sky-200 border-sky-200 dark:border-sky-800"}`}>
                                        {ref.min_temperature} °C ~ {ref.max_temperature} °C
                                    </span>
                                </div>
                                {ref.disable_check && (
                                    <div className="mt-2 text-xs font-bold text-rose-900 dark:text-rose-200 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg px-2 py-1 text-center">
                                        ปิดการตรวจสอบ/ซ่อมบำรุง
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            )}
        </div>
    );
}
