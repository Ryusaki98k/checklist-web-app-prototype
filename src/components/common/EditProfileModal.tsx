"use client";

import React, { useState, useRef } from "react";
import { User } from "../../types";
import { useApp } from "../../context/AppContext";
import { UserAvatar } from "./UserAvatar";
import { ProfileImageCropperModal } from "./ProfileImageCropperModal";
import {
  uploadProfileImageAction,
  changeUserProfileImageAction,
} from "../../actions/auth";
import {
  X,
  Camera,
  Trash2,
  Check,
  User as UserIcon,
  Store,
  Shield,
  AlertCircle,
  Sparkles,
} from "lucide-react";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: (updatedUser: User) => void;
}

export function EditProfileModal({
  isOpen,
  onClose,
  onProfileUpdated,
}: EditProfileModalProps) {
  const { currentUser, setCurrentUser, refreshUserData } = useApp();

  const [name, setName] = useState(currentUser?.name || "");
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [isPhotoRemoved, setIsPhotoRemoved] = useState(false);

  // Cropper state
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);

  // Loading & error
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state whenever modal opens or currentUser changes
  React.useEffect(() => {
    if (isOpen && currentUser) {
      setName(currentUser.name || "");
      setCroppedBlob(null);
      setLocalPreviewUrl(null);
      setIsPhotoRemoved(false);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, currentUser]);

  if (!isOpen || !currentUser) return null;

  const currentProfileId = currentUser.profile_id || null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMsg("กรุณาเลือกไฟล์รูปภาพ (PNG, JPG, หรือ WebP)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("ขนาดไฟล์รูปภาพต้องไม่เกิน 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setRawImageSrc(reader.result as string);
      setIsCropperOpen(true);
      setErrorMsg(null);
    };
    reader.readAsDataURL(file);

    // Reset input value so same file can be selected again
    e.target.value = "";
  };

  const handleCropComplete = (blob: Blob, previewUrl: string) => {
    setCroppedBlob(blob);
    setLocalPreviewUrl(previewUrl);
    setIsPhotoRemoved(false);
  };

  const handleRemovePhoto = () => {
    setCroppedBlob(null);
    setLocalPreviewUrl(null);
    setIsPhotoRemoved(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser.id) return;

    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMsg("กรุณากรอกชื่อ-นามสกุล");
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      let nextProfileId = currentProfileId || null;

      // 1. If photo was removed
      if (isPhotoRemoved) {
        nextProfileId = null;
      }
      // 2. If a new cropped photo was uploaded
      else if (croppedBlob) {
        const formData = new FormData();
        formData.append("file", croppedBlob, "profile_avatar.webp");

        const uploadRes = await uploadProfileImageAction(formData);
        if (!uploadRes.success || !uploadRes.profile_id) {
          throw new Error(uploadRes.error || "ไม่สามารถอัปโหลดรูปภาพไปยังคลาวด์ได้");
        }
        nextProfileId = uploadRes.profile_id;
      }

      // 3. Update in database and delete old photo if replaced
      const updateRes = await changeUserProfileImageAction({
        userId: currentUser.id,
        old_profile_id: currentProfileId,
        new_profile_id: nextProfileId,
        name: cleanName,
      });

      if (!updateRes.success || !updateRes.user) {
        throw new Error(updateRes.error || "ไม่สามารถบันทึกข้อมูลผู้ใช้ได้");
      }

      // Update global context & refetch user from database
      const freshUser = updateRes.user;
      setCurrentUser(freshUser);
      await refreshUserData();
      onProfileUpdated?.(freshUser);

      // Broadcast update across open tabs
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("app:profile-updated", {
            detail: { userId: currentUser.id, user: freshUser },
          })
        );
      }

      setSuccessMsg("บันทึกข้อมูลและอัปเดตรูปโปรไฟล์สำเร็จ!");
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      console.error("Save profile error:", err);
      setErrorMsg(err?.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6 animate-fade-in font-sans"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Camera size={20} strokeWidth={2.2} />
              </div>
              <div>
                <h2 id="edit-profile-title" className="text-base sm:text-lg font-extrabold text-[var(--color-text)] tracking-tight">
                  แก้ไขโปรไฟล์ผู้ใช้
                </h2>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  จัดการรูปประจำตัวและข้อมูลบัญชีของคุณ
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="p-2 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
              title="ปิด"
              aria-label="ปิด"
            >
              <X size={20} />
            </button>
          </div>

          {/* Feedback Alerts */}
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-2xl text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2.5">
              <AlertCircle size={16} className="shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-2xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2.5 font-bold">
              <Check size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            {/* Center Profile Photo Section */}
            <div className="flex flex-col items-center justify-center p-4 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-2xl space-y-4">
              <div className="relative group">
                {localPreviewUrl ? (
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden shadow-md ring-4 ring-amber-500/20 border-2 border-amber-500">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={localPreviewUrl}
                      alt="พรีวิวรูปโปรไฟล์ใหม่"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <UserAvatar
                    user={isPhotoRemoved ? { ...currentUser, profile_id: null } : currentUser}
                    name={name}
                    size="3xl"
                    className="shadow-md ring-4 ring-amber-500/15"
                  />
                )}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-2 -right-2 p-2.5 rounded-full bg-amber-500 hover:bg-amber-600 text-amber-950 shadow-lg border-2 border-[var(--color-surface)] transition-all cursor-pointer hover:scale-110 active:scale-95"
                  title="เปลี่ยนรูปภาพ"
                  aria-label="เปลี่ยนรูปภาพ"
                >
                  <Camera size={16} strokeWidth={2.4} />
                </button>
              </div>

              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Action Buttons for Avatar */}
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-1.5 rounded-xl bg-[var(--color-surface)] hover:bg-[var(--color-border-subtle)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-text)] transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <Camera size={14} className="text-amber-600 dark:text-amber-400" />
                  <span>{localPreviewUrl || currentProfileId ? "เปลี่ยนรูปใหม่" : "อัปโหลดรูปภาพ"}</span>
                </button>

                {(localPreviewUrl || (currentProfileId && !isPhotoRemoved)) && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 border border-rose-300 dark:border-rose-800 text-xs font-bold text-rose-700 dark:text-rose-300 transition-colors cursor-pointer flex items-center gap-1.5"
                    title="ลบรูปโปรไฟล์ออก"
                  >
                    <Trash2 size={14} />
                    <span>ลบรูปภาพ</span>
                  </button>
                )}
              </div>

              <div className="text-[10px] text-[var(--color-text-muted)] text-center space-y-0.5 pt-1">
                <p>รองรับไฟล์ PNG, JPG, WebP (ตัดอัตราส่วน 1:1 พอดีกรอบ)</p>
                <p className="opacity-80">
                  รูปโปรไฟล์เริ่มต้นดัดแปลงและดาวน์โหลดจาก{" "}
                  <a
                    href="https://www.flaticon.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-amber-600 dark:hover:text-amber-400 font-semibold transition-colors"
                  >
                    www.flaticon.com
                  </a>
                </p>
              </div>
            </div>

            {/* User Form Fields */}
            <div className="space-y-4">
              <div>
                <label htmlFor="edit-name" className="block text-xs font-bold text-[var(--color-text-muted)] mb-1.5">
                  ชื่อ-นามสกุล <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="edit-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full bg-[var(--color-surface-2)] focus:bg-[var(--color-surface)] border border-[var(--color-border)] focus:border-amber-400 rounded-2xl px-4 py-2.5 text-sm text-[var(--color-text)] font-semibold placeholder:text-[var(--color-text-subtle)] focus-visible:outline-none focus:ring-2 focus:ring-amber-400/40 transition-all pl-10"
                    placeholder="ชื่อผู้ใช้งาน"
                  />
                  <UserIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
                </div>
              </div>

              {/* Read-only Profile Attributes */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 bg-[var(--color-surface-2)]/60 border border-[var(--color-border)] rounded-2xl space-y-1">
                  <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-1">
                    <Sparkles size={11} className="text-amber-500" />
                    ชื่อผู้ใช้ (Username)
                  </span>
                  <p className="text-xs font-mono font-bold text-[var(--color-text)] truncate">
                    @{currentUser.username || currentUser.name}
                  </p>
                </div>

                <div className="p-3 bg-[var(--color-surface-2)]/60 border border-[var(--color-border)] rounded-2xl space-y-1">
                  <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-1">
                    <Store size={11} className="text-amber-500" />
                    สาขาประจำการ
                  </span>
                  <p className="text-xs font-bold text-[var(--color-text)] truncate">
                    {currentUser.branchName || "ไม่ได้ระบุสาขา"}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--color-border)]">
              <button
                type="button"
                disabled={isSaving}
                onClick={onClose}
                className="px-5 py-2.5 rounded-2xl border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] text-xs sm:text-sm font-bold text-[var(--color-text)] transition-all cursor-pointer min-h-[42px]"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 rounded-2xl bg-[var(--color-brown)] hover:bg-[var(--color-brown-light)] text-amber-100 text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer flex items-center gap-2 min-h-[42px] disabled:opacity-60"
              >
                {isSaving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <>
                    <Check size={18} strokeWidth={2.5} />
                    <span>บันทึกการเปลี่ยนแปลง</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

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
    </>
  );
}
