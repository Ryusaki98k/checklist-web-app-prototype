"use client";

import { useState, useEffect, useRef } from "react";
import { User } from "../../types";
import { getUsers, saveUsers } from "../../data/storage";
import { registerAction, uploadProfileImageAction } from "../../actions/auth";
import { DashboardBranch } from "../../actions/branch";
import { fetchBranchesWithCache } from "../../utils/cache";
import { useApp } from "../../context/AppContext";
import { useRouter } from "next/navigation";
import { ProfileImageCropperModal } from "../common/ProfileImageCropperModal";
import { UserAvatar } from "../common/UserAvatar";
import { UserPlus, Building2, AtSign, Lock, CheckCircle2, AlertCircle, Camera, Trash2 } from "lucide-react";

interface EmployeeRegisterFormProps {
  onSuccess?: (user: User) => void;
  className?: string;
  isMainPage?: boolean;
}

export function EmployeeRegisterForm({
  onSuccess,
  className = "",
  isMainPage = false,
}: EmployeeRegisterFormProps) {
  const router = useRouter();
  const { login } = useApp();
  const [branches, setBranches] = useState<DashboardBranch[]>([]);
  const [form, setForm] = useState({
    name: "",
    username: "",
    password: "",
    confirmPassword: "",
    branchId: "",
  });

  // Profile image upload & crop state
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchBranchesWithCache({ intervalMs: 60000 })
      .then((res) => {
        if (res.success && res.branches) {
          setBranches(res.branches);
        }
      })
      .catch(console.error);
  }, []);

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("กรุณาเลือกไฟล์รูปภาพ (PNG, JPG, หรือ WebP)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("ขนาดรูปภาพต้องไม่เกิน 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setRawImageSrc(reader.result as string);
      setIsCropperOpen(true);
      setError("");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCropComplete = (blob: Blob, previewUrl: string) => {
    setAvatarBlob(blob);
    setAvatarPreviewUrl(previewUrl);
  };

  const handleRemoveAvatar = () => {
    setAvatarBlob(null);
    setAvatarPreviewUrl(null);
  };

  async function handleRegister(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!form.name.trim() || !form.username.trim() || !form.password.trim() || !form.confirmPassword.trim()) {
      setError("กรุณากรอกชื่อ-นามสกุล, ชื่อผู้ใช้ และรหัสผ่านให้ครบถ้วน");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }
    if (form.password.length < 3) {
      setError("รหัสผ่านต้องมีความยาวอย่างน้อย 3 ตัวอักษร");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      let uploadedProfileId: string | null = null;

      // 1. If user selected and cropped an avatar, upload it to Supabase Storage first
      if (avatarBlob) {
        const formData = new FormData();
        formData.append("file", avatarBlob, "profile_avatar.webp");
        const uploadRes = await uploadProfileImageAction(formData);

        if (!uploadRes.success || !uploadRes.profile_id) {
          throw new Error(uploadRes.error || "อัปโหลดรูปโปรไฟล์ไม่สำเร็จ");
        }
        uploadedProfileId = uploadRes.profile_id;
      }

      // 2. Register user with profile_id linked
      const res = await registerAction({
        name: form.name.trim(),
        username: form.username.trim().toLowerCase(),
        password: form.password,
        role: "employee",
        branchId: form.branchId || undefined,
        profile_id: uploadedProfileId,
      });

      if (!res.success || !res.user) {
        setError(res.error || "ไม่สามารถลงทะเบียนได้ กรุณาลองใหม่อีกครั้ง");
        setLoading(false);
        return;
      }

      const localUsers = getUsers();
      saveUsers([...localUsers, res.user]);
      setSuccessMsg(`ลงทะเบียนพนักงาน "${res.user.name}" สำเร็จ! กำลังเข้าสู่ระบบ...`);

      setTimeout(() => {
        if (onSuccess) {
          onSuccess(res.user!);
        } else {
          login(res.user!);
          if (!res.user!.branchId) {
            router.push("/awaiting-assignment");
          } else {
            router.push("/position");
          }
        }
      }, 1200);
    } catch (err: unknown) {
      console.error("Register error:", err);
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการสมัครสมาชิก กรุณาลองใหม่อีกครั้ง";
      setError(msg);
      setLoading(false);
    }
  }

  const inputClass =
    "w-full bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-2)] focus:bg-[var(--color-surface)] border border-[var(--color-border)] focus:border-amber-400 rounded-xl px-4 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus-visible:outline-none focus:ring-2 focus:ring-amber-400/40 transition-all";

  return (
    <form onSubmit={handleRegister} className={`space-y-4 ${className}`}>
      {isMainPage && (
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[var(--color-border)]">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
            <UserPlus size={18} />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-[var(--color-text)]">
              ลงทะเบียนพนักงานใหม่ (New Employee Registration)
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              สำหรับพนักงานประจำสาขา (แคชเชียร์, สต็อก, พนักงานทั่วไป)
            </p>
          </div>
        </div>
      )}

      {/* ─── Profile Picture Upload Section (Top of Registration) ─── */}
      <div className="p-4 sm:p-5 bg-[var(--color-surface-2)]/80 border border-[var(--color-border)] rounded-2xl flex flex-col items-center justify-center space-y-3 transition-all shadow-2xs">
        <div className="relative group">
          {avatarPreviewUrl ? (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden shadow-md ring-4 ring-amber-500/30 border-2 border-amber-500">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarPreviewUrl}
                alt="รูปโปรไฟล์ที่เลือก"
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden relative shadow-md ring-2 ring-amber-500/20 border-2 border-[var(--color-border)] bg-[var(--color-surface)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/user.png"
                alt="รูปโปรไฟล์เริ่มต้น"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute -bottom-1 -right-1 p-2 rounded-full bg-amber-500 hover:bg-amber-600 text-amber-950 shadow-md border-2 border-[var(--color-surface)] transition-transform hover:scale-110 active:scale-95 cursor-pointer"
            title="อัปโหลดและตัดรูปโปรไฟล์"
            aria-label="อัปโหลดและตัดรูปโปรไฟล์"
          >
            <Camera size={14} strokeWidth={2.4} />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleFileSelected}
          className="hidden"
        />

        <div className="flex items-center gap-2 flex-wrap justify-center">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-1.5 rounded-xl bg-[var(--color-surface)] hover:bg-[var(--color-border-subtle)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-text)] transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            <Camera size={13} className="text-amber-600 dark:text-amber-400" />
            <span>{avatarPreviewUrl ? "เปลี่ยนรูปใหม่" : "อัปโหลดรูปโปรไฟล์ (1:1)"}</span>
          </button>

          {avatarPreviewUrl && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-xs font-bold text-rose-700 dark:text-rose-300 transition-colors cursor-pointer flex items-center gap-1"
            >
              <Trash2 size={13} />
              <span>ลบรูป</span>
            </button>
          )}
        </div>
        <p className="text-[10px] sm:text-[11px] text-[var(--color-text-muted)] text-center">
          สามารถครอปรูปเป็นสี่เหลี่ยมจัตุรัส 1:1 ได้ทันที (ไม่บังคับ)
        </p>
      </div>

      <div>
        <label htmlFor="reg-name" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
          ชื่อ-นามสกุลพนักงาน <span className="text-rose-500">*</span>
        </label>
        <input
          id="reg-name"
          className={inputClass}
          placeholder="เช่น สมศรี ใจดี"
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
      </div>

      <div>
        <label htmlFor="reg-branch" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
          สาขาประจำการ
        </label>
        <div className="relative">
          <select
            id="reg-branch"
            className={`${inputClass} appearance-none cursor-pointer pr-10`}
            value={form.branchId}
            onChange={(e) => setForm({ ...form, branchId: e.target.value })}
          >
            <option value="">-- เลือกสาขาประจำการ (หรือข้ามเพื่อกำหนดภายหลัง) --</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <Building2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
        </div>
      </div>

      <div>
        <label htmlFor="reg-username" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
          ชื่อผู้ใช้สำหรับเข้าสู่ระบบ (Username) <span className="text-rose-500">*</span>
        </label>
        <div className="relative">
          <input
            id="reg-username"
            className={inputClass}
            placeholder="เช่น somchai123 หรือ cashier01"
            type="text"
            autoComplete="username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
          <AtSign size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="reg-password" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
            รหัสผ่าน <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              id="reg-password"
              className={inputClass}
              placeholder="••••••••"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            <Lock size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
          </div>
        </div>

        <div>
          <label htmlFor="reg-confirm-password" className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
            ยืนยันรหัสผ่าน <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              id="reg-confirm-password"
              className={inputClass}
              placeholder="••••••••"
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              required
            />
            <Lock size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 font-semibold flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div role="status" className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 font-semibold flex items-center gap-2">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className={`w-full min-h-[44px] py-2.5 text-amber-100 text-sm font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 bg-[var(--color-brown)] hover:bg-[var(--color-brown-light)] active:bg-[#1f0d0c] shadow-amber-950/20 ${
          loading ? "opacity-70 cursor-not-allowed" : ""
        }`}
      >
        <UserPlus size={16} />
        <span>{loading ? "กำลังบันทึกข้อมูล..." : "ลงทะเบียนและเริ่มงานพนักงานสาขา"}</span>
      </button>

      {/* 1:1 Image Cropper Modal */}
      <ProfileImageCropperModal
        isOpen={isCropperOpen}
        imageSrc={rawImageSrc}
        onClose={() => {
          setIsCropperOpen(false);
          setRawImageSrc(null);
        }}
        onCropComplete={handleCropComplete}
      />
    </form>
  );
}
