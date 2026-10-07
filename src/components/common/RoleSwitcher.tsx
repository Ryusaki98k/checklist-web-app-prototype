"use client";

import React, { useState, useRef, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { ActiveRole } from "../../types";
import { getRoleDisplayTitle, getRoleShortTitle, getRoleTheme } from "../../utils/roles";
import {
  Users,
  Briefcase,
  Landmark,
  ShieldCheck,
  ChevronDown,
  Check,
  Sparkles,
} from "lucide-react";

interface RoleSwitcherProps {
  className?: string;
  showIconOnlyOnMobile?: boolean;
}

export function RoleSwitcher({ className = "", showIconOnlyOnMobile = true }: RoleSwitcherProps) {
  const { currentUser, switchRole, availableRoles } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside or Esc
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!currentUser) return null;

  const activeRole: ActiveRole = currentUser.activeRole || currentUser.role || "employee";
  const hasMultipleRoles = availableRoles.length > 1;

  const renderRoleIcon = (role: ActiveRole, size = 15) => {
    switch (role) {
      case "admin":
        return <ShieldCheck size={size} className="text-purple-600 dark:text-purple-400 shrink-0" />;
      case "general_manager":
      case "committee":
        return <Landmark size={size} className="text-blue-600 dark:text-blue-400 shrink-0" />;
      case "manager":
      case "manager_assistant":
        return <Briefcase size={size} className="text-emerald-600 dark:text-emerald-400 shrink-0" />;
      case "employee":
      default:
        return <Users size={size} className="text-amber-600 dark:text-amber-400 shrink-0" />;
    }
  };

  const currentTheme = getRoleTheme(activeRole);

  // If user only has 1 role, display as a sleek role pill
  if (!hasMultipleRoles) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold ${currentTheme.bg} ${currentTheme.color} border ${currentTheme.border} ${className}`}
        title={`บทบาทปัจจุบัน: ${getRoleDisplayTitle(activeRole)}`}
      >
        {renderRoleIcon(activeRole, 14)}
        <span className={showIconOnlyOnMobile ? "hidden sm:inline" : ""}>
          {getRoleShortTitle(activeRole)}
        </span>
      </div>
    );
  }

  // Multi-role user: Interactive Role Switcher
  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title="สลับบทบาทการทำงาน (Multi-role account)"
        className={`group inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs border ${currentTheme.bg} ${currentTheme.color} ${currentTheme.border} hover:shadow-xs active:scale-98`}
      >
        {renderRoleIcon(activeRole, 15)}
        <span className={showIconOnlyOnMobile ? "hidden sm:inline" : ""}>
          {getRoleShortTitle(activeRole)}
        </span>
        <span className="hidden sm:inline-flex text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.2 rounded-full bg-white/60 dark:bg-black/30 border border-current opacity-80">
          {availableRoles.length} สิทธิ์
        </span>
        <ChevronDown
          size={13}
          className={`shrink-0 transition-transform duration-200 opacity-70 group-hover:opacity-100 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 sm:w-72 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-2xl z-50 overflow-hidden animate-fade-in p-1.5">
          <div className="px-3 py-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-2)]/60 rounded-xl mb-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[var(--color-text)] flex items-center gap-1">
                <Sparkles size={12} className="text-amber-500" />
                สลับบทบาทการทำงาน
              </span>
              <span className="text-[10px] text-[var(--color-text-muted)] font-mono">
                {currentUser.username || currentUser.name}
              </span>
            </div>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
              บัญชีเดียวสามารถปฏิบัติหน้าที่ได้หลายบทบาท
            </p>
          </div>

          <div className="space-y-1">
            {availableRoles.map((role) => {
              const isActive = role === activeRole;
              const theme = getRoleTheme(role);

              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    if (!isActive) {
                      switchRole(role);
                    }
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                    isActive
                      ? `${theme.bg} ${theme.color} border ${theme.border} font-bold`
                      : "text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isActive
                          ? "bg-white/80 dark:bg-black/40 shadow-2xs"
                          : "bg-[var(--color-surface-2)]"
                      }`}
                    >
                      {renderRoleIcon(role, 15)}
                    </div>
                    <div className="min-w-0 text-left">
                      <div className="truncate text-xs">{getRoleDisplayTitle(role)}</div>
                      <div className="text-[10px] text-[var(--color-text-muted)] font-normal">
                        {role === "employee" && "ตรวจงานเช็คลิสต์ประจำกะ"}
                        {(role === "manager" || role === "manager_assistant") && "ตรวจรับรองกะและดูแลสาขา"}
                        {(role === "general_manager" || role === "committee") && "ภาพรวมและรายงานผู้บริหาร"}
                        {role === "admin" && "จัดการระบบและสิทธิ์ส่วนกลาง"}
                      </div>
                    </div>
                  </div>

                  {isActive ? (
                    <span className="shrink-0 p-1 rounded-full bg-current/15 text-current">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  ) : (
                    <span className="text-[10px] text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 font-medium">
                      สลับ
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
