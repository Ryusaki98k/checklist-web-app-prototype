"use client";

import React, { useState } from "react";
import { X, ZoomIn } from "lucide-react";
import { getProfileImageUrl, getUserInitials } from "../../utils/profileStorage";
import { Badge } from "./Badge";
import { useModalFocusTrap } from "./ModalFocusTrap";

interface EnlargeAvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    name: string;
    position?: string;
    profileId?: string | null;
    role?: string;
  } | null;
}

export function EnlargeAvatarModal({ isOpen, onClose, user }: EnlargeAvatarModalProps) {
  const [failedProfileId, setFailedProfileId] = useState<string | null>(null);
  const { dialogRef, handleKeyDown } = useModalFocusTrap(isOpen, onClose);

  if (!isOpen || !user) return null;

  const isFailed = failedProfileId === (user.profileId || "__none__");
  const imageUrl = user.profileId && !isFailed ? getProfileImageUrl(user.profileId) : null;
  const initials = getUserInitials(user.name, user.role);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="enlarge-avatar-title"
        tabIndex={-1}
        className="w-full max-w-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-2xl p-5 sm:p-6 text-[var(--color-text)] flex flex-col items-center gap-4 animate-in zoom-in-95 duration-150 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="w-full flex items-center justify-between pb-2 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-text-muted)]">
            <ZoomIn size={15} className="text-amber-500" />
            <span id="enlarge-avatar-title">รูปโปรไฟล์พนักงาน</span>
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

        {/* Large Profile Picture */}
        <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-2xl overflow-hidden shadow-md border-2 border-[var(--color-border)] bg-[var(--color-surface-2)] flex items-center justify-center relative">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={user.name}
              className="w-full h-full object-cover"
              onError={() => setFailedProfileId(user.profileId || "__none__")}
            />
          ) : !isFailed ? (
            // Default placeholder avatar
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/user.png"
              alt={user.name}
              className="w-full h-full object-cover"
              onError={() => setFailedProfileId(user.profileId || "__none__")}
            />
          ) : (
            // Fallback initials
            <div className="w-full h-full flex flex-col items-center justify-center bg-amber-500/10 text-amber-900 dark:text-amber-200">
              <span className="text-4xl font-extrabold uppercase tracking-wide">{initials}</span>
            </div>
          )}
        </div>

        {/* User Info */}
        <div className="text-center space-y-1 w-full">
          <h3 className="text-base sm:text-lg font-bold text-[var(--color-text)] truncate px-2">
            {user.name}
          </h3>
          <div className="flex items-center justify-center gap-1.5 flex-wrap pt-0.5">
            {user.position && (
              <Badge color="muted">{user.position}</Badge>
            )}
            {user.role && (
              <span className="text-[11px] font-semibold text-[var(--color-text-muted)] px-2 py-0.5 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                {user.role === "manager"
                  ? "ผู้จัดการร้าน"
                  : user.role === "manager_assistant"
                  ? "ผู้ช่วยผู้จัดการร้าน"
                  : user.role === "cashier"
                  ? "แคชเชียร์"
                  : user.role === "stock"
                  ? "พนักงานสต็อก"
                  : "พนักงานประจำสาขา"}
              </span>
            )}
          </div>
        </div>

        {/* Close Button */}
        <div className="w-full pt-1">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] text-xs font-bold text-[var(--color-text)] transition-colors cursor-pointer text-center"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}
