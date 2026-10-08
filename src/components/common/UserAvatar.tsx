"use client";

import React, { useState } from "react";
import { User, Role, ActiveRole } from "../../types";
import { getProfileImageUrl, getUserInitials } from "../../utils/profileStorage";
import { Camera, User as UserIcon } from "lucide-react";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";

interface UserAvatarProps {
  user?: Partial<User> | null;
  name?: string;
  profileId?: string | null;
  role?: Role | ActiveRole;
  size?: AvatarSize;
  className?: string;
  editable?: boolean;
  onEdit?: () => void;
  onClick?: () => void;
  title?: string;
}

const SIZE_MAP: Record<AvatarSize, { container: string; text: string; camera: number; badgeSize: string }> = {
  xs: { container: "w-6 h-6 rounded-lg", text: "text-[10px]", camera: 10, badgeSize: "w-3.5 h-3.5" },
  sm: { container: "w-8 h-8 rounded-xl", text: "text-xs", camera: 12, badgeSize: "w-4 h-4" },
  md: { container: "w-10 h-10 rounded-xl", text: "text-sm", camera: 14, badgeSize: "w-5 h-5" },
  lg: { container: "w-12 h-12 rounded-2xl", text: "text-base", camera: 16, badgeSize: "w-5 h-5" },
  xl: { container: "w-16 h-16 rounded-2xl", text: "text-xl", camera: 18, badgeSize: "w-6 h-6" },
  "2xl": { container: "w-20 h-20 rounded-3xl", text: "text-2xl", camera: 20, badgeSize: "w-7 h-7" },
  "3xl": { container: "w-24 h-24 rounded-3xl", text: "text-3xl", camera: 22, badgeSize: "w-8 h-8" },
};

export function UserAvatar({
  user,
  name,
  profileId,
  role,
  size = "md",
  className = "",
  editable = false,
  onEdit,
  onClick,
  title,
}: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);

  const effectiveName = name || user?.name || user?.username || "";
  const effectiveProfileId = profileId !== undefined ? profileId : (user?.profile_id || user?.profileId || null);
  const effectiveRole = role || user?.activeRole || user?.role || "employee";
  const imageUrl = effectiveProfileId && !imageError ? getProfileImageUrl(effectiveProfileId) : null;

  const sizeCfg = SIZE_MAP[size] || SIZE_MAP.md;

  // Determine fallback initial badge gradient based on role
  const getRoleGradient = () => {
    switch (effectiveRole) {
      case "admin":
        return "bg-[var(--color-brown)] text-amber-300 dark:bg-amber-400 dark:text-amber-950";
      case "committee":
      case "general_manager":
        return "bg-gradient-to-br from-indigo-500 to-amber-600 text-white";
      case "manager":
        return "bg-gradient-to-br from-amber-500 to-amber-700 text-amber-950";
      case "manager_assistant":
        return "bg-amber-100 dark:bg-amber-950/80 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700";
      default:
        return "bg-[var(--color-brown)] text-amber-100 dark:bg-amber-900/60 dark:text-amber-200";
    }
  };

  const initials = getUserInitials(effectiveName, effectiveRole);

  const handleClick = (e: React.MouseEvent) => {
    if (editable && onEdit) {
      e.stopPropagation();
      onEdit();
    } else if (onClick) {
      onClick();
    }
  };

  const isClickable = Boolean(onClick || (editable && onEdit));

  return (
    <div
      onClick={isClickable ? handleClick : undefined}
      className={`relative inline-flex items-center justify-center shrink-0 select-none group ${
        isClickable ? "cursor-pointer" : ""
      } ${className}`}
      title={title || effectiveName}
    >
      <div
        className={`${sizeCfg.container} overflow-hidden shadow-xs ring-1 ring-black/5 dark:ring-white/10 flex items-center justify-center font-bold tracking-tight transition-transform duration-200 ${
          isClickable ? "group-hover:scale-105 active:scale-95" : ""
        } ${imageUrl ? "bg-[var(--color-surface-2)]" : getRoleGradient()}`}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={effectiveName || "รูปโปรไฟล์"}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : initials ? (
          <span className={`${sizeCfg.text} uppercase font-extrabold`}>{initials}</span>
        ) : (
          <UserIcon size={sizeCfg.camera * 1.2} className="opacity-75" />
        )}
      </div>

      {/* Editable Camera Overlay Badge */}
      {editable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.();
          }}
          className={`absolute -bottom-1 -right-1 ${sizeCfg.badgeSize} rounded-full bg-amber-500 hover:bg-amber-600 text-amber-950 flex items-center justify-center shadow-md border-2 border-[var(--color-surface)] transition-all cursor-pointer group-hover:scale-110 active:scale-90`}
          title="แก้ไขรูปโปรไฟล์"
          aria-label="แก้ไขรูปโปรไฟล์"
        >
          <Camera size={sizeCfg.camera} strokeWidth={2.4} />
        </button>
      )}
    </div>
  );
}
