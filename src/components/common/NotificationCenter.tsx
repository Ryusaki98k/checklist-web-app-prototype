"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, CheckCheck, Clock, Award, AlertTriangle, ShieldCheck, X } from "lucide-react";
import { Notification } from "../../types";
import {
  getNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "../../actions/notifications";
import { useApp } from "../../context/AppContext";
import { createClient } from "../../db/supabase/client";

function formatNotificationDateTime(dateStr: string | Date | undefined): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";

    const now = new Date();
    const dDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(d);
    const nowDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(now);

    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yestDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(yesterday);

    const timeStr = new Intl.DateTimeFormat("th-TH", {
      timeZone: "Asia/Bangkok",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d) + " น.";

    if (dDate === nowDate) {
      return `วันนี้ เวลา ${timeStr}`;
    } else if (dDate === yestDate) {
      return `เมื่อวาน เวลา ${timeStr}`;
    } else {
      const dateStrThai = new Intl.DateTimeFormat("th-TH", {
        timeZone: "Asia/Bangkok",
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(d);
      return `${dateStrThai} เวลา ${timeStr}`;
    }
  } catch {
    return String(dateStr);
  }
}

function formatFullDateTime(dateStr: string | Date | undefined): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    return (
      new Intl.DateTimeFormat("th-TH", {
        timeZone: "Asia/Bangkok",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(d) + " น."
    );
  } catch {
    return String(dateStr);
  }
}

export function NotificationCenter() {
  const { currentUser } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!currentUser) return;
    try {
      const res = await getNotificationsAction({
        userId: currentUser.id,
        role: currentUser.role,
        branchId: currentUser.branchId,
      });
      if (res.success && res.notifications) {
        setNotifications(res.notifications);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Supabase Realtime Subscription for live instant updates
    let channel: any;
    try {
      const supabase = createClient();
      channel = supabase
        .channel("realtime-notifications")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "checklist_web_app",
            table: "notifications",
          },
          () => {
            fetchNotifications();
          }
        )
        .subscribe();
    } catch (e) {
      console.warn("Supabase realtime subscription skipped or unavailable:", e);
    }

    const interval = setInterval(fetchNotifications, 15000); // 15s backup poll
    return () => {
      clearInterval(interval);
      if (channel) {
        try {
          const supabase = createClient();
          supabase.removeChannel(channel);
        } catch (_) { }
      }
    };
  }, [currentUser?.id, currentUser?.branchId]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAsRead = async (notifId: string) => {
    if (!currentUser) return;
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    await markNotificationReadAction(notifId, currentUser.id);
  };

  const handleMarkAllAsRead = async () => {
    if (!currentUser) return;
    setLoading(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    await markAllNotificationsReadAction(currentUser.id, currentUser.role, currentUser.branchId);
    setLoading(false);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "point_awarded":
        return <Award className="w-4 h-4 text-amber-500" />;
      case "shift_submitted":
        return <Clock className="w-4 h-4 text-blue-500" />;
      case "incomplete_shift":
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case "shift_approved":
        return <ShieldCheck className="w-4 h-4 text-emerald-500" />;
      case "refrigerator_alert":
        return <AlertTriangle className="w-4 h-4 text-rose-500" />;
      default:
        return <Bell className="w-4 h-4 text-indigo-500" />;
    }
  };

  if (!currentUser) return null;

  return (
    <div className={`relative inline-block text-left ${isOpen ? "z-50" : ""}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] transition-all cursor-pointer text-[var(--color-text-muted)] hover:text-[var(--color-text)] focus-visible:outline-none focus:ring-2 focus:ring-amber-400"
        aria-label={unreadCount > 0 ? `การแจ้งเตือน มี ${unreadCount} รายการใหม่ที่ยังไม่ได้อ่าน` : "การแจ้งเตือน ไม่มีรายการใหม่"}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-rose-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-sm">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Mobile backdrop to dismiss cleanly and prevent background tap confusion */}
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-2xs z-[55] sm:hidden"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <div className="fixed left-3 right-3 top-16 sm:top-full sm:left-auto sm:right-0 sm:mt-2 sm:absolute sm:w-96 max-w-md sm:max-w-none bg-[var(--color-surface)] border-2 border-[var(--color-border)] rounded-2xl shadow-2xl shadow-amber-950/20 z-[60] overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[75vh] sm:max-h-[32rem]">
            <div className="p-3.5 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-surface-2)] shrink-0">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <h3 className="text-xs font-bold text-[var(--color-text)]">การแจ้งเตือน</h3>
                {unreadCount > 0 && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-950 dark:text-amber-200 font-bold border border-amber-300 dark:border-amber-800">
                    {unreadCount} ใหม่
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllAsRead}
                    disabled={loading}
                    className="text-xs text-amber-900 hover:text-amber-950 dark:text-amber-200 dark:hover:text-amber-100 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <CheckCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>อ่านทั้งหมด</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] rounded-lg cursor-pointer sm:hidden min-w-[32px] min-h-[32px] inline-flex items-center justify-center"
                  aria-label="ปิดการแจ้งเตือน"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto divide-y divide-[var(--color-border)] flex-1">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--color-text-muted)] flex flex-col items-center gap-2">
                  <Bell className="w-8 h-8 opacity-30 stroke-1" />
                  <p className="font-bold text-[var(--color-text)]">ไม่มีการแจ้งเตือนใหม่ในขณะนี้</p>
                  <p className="text-xs text-[var(--color-text-subtle)] max-w-xs">เมื่อมีการส่งมอบกะ รายงานแจ้งเตือนอุณหภูมิตู้แช่ หรือการรับรองงาน ข้อมูลจะแสดงที่นี่แบบเรียลไทม์</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => !n.read && handleMarkAsRead(n.id)}
                    className={`p-3 sm:p-3.5 transition-colors flex items-start gap-3 cursor-pointer ${n.read
                        ? "hover:bg-[var(--color-surface-2)]/50 text-[var(--color-text-muted)]"
                        : "bg-amber-500/5 hover:bg-amber-500/10 font-medium"
                      }`}
                  >
                    <div className="mt-0.5 p-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs shrink-0">
                      {getTypeIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p className="text-xs font-bold text-[var(--color-text)] truncate">{n.title}</p>
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)] leading-relaxed break-words">
                        {n.message}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-text-subtle)]">
                        <span
                          className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-amber-950 dark:text-amber-200 bg-[var(--color-surface)] border border-[var(--color-border)] px-2 py-0.5 rounded-md shadow-2xs"
                          title={`เวลาแจ้งเตือน: ${formatFullDateTime(n.createdAt)}`}
                        >
                          <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span>{formatNotificationDateTime(n.createdAt)}</span>
                        </span>
                        {n.branchName && <span className="text-[11px] font-medium text-[var(--color-text-muted)]">• สาขา {n.branchName}</span>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
