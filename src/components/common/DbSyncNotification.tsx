"use client";

import { CheckCircle2, X, Database } from "lucide-react";

export interface DbSyncNotificationData {
  message: string;
  timestamp: number;
  count?: number;
}

interface DbSyncNotificationProps {
  notification: DbSyncNotificationData | null;
  onClose: () => void;
}

/**
 * DbSyncNotification
 * Subtle local toast/badge confirming to the user that checklist data was actually
 * updated and verified in the database on the next DB cache check.
 */
export function DbSyncNotification({ notification, onClose }: DbSyncNotificationProps) {
  if (!notification) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed bottom-20 sm:bottom-6 right-3 sm:right-6 z-50 flex items-center gap-2.5 sm:gap-3 px-3.5 sm:px-4 py-2.5 bg-emerald-800/95 dark:bg-emerald-950/95 text-white text-xs font-bold rounded-2xl shadow-2xl border border-emerald-400/40 backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200 select-none max-w-[90vw] sm:max-w-md pointer-events-auto"
    >
      <div className="w-6 h-6 rounded-xl bg-emerald-500/25 border border-emerald-400/40 flex items-center justify-center shrink-0 text-emerald-300">
        <CheckCircle2 size={15} className="animate-pulse" />
      </div>

      <div className="flex flex-col min-w-0 pr-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="leading-tight text-white font-extrabold text-xs">
            {notification.message}
          </span>
          {Boolean(notification.count && notification.count > 1) && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-emerald-500/30 text-emerald-200">
              {notification.count} รายการ
            </span>
          )}
        </div>
        <span className="text-[10px] text-emerald-200/85 font-medium flex items-center gap-1 mt-0.5">
          <Database size={10} className="shrink-0" />
          <span>ตรวจสอบแคชฐานข้อมูลเรียบร้อย (DB Cache Verified)</span>
        </span>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="ml-auto text-emerald-200/70 hover:text-white p-1 rounded-lg hover:bg-emerald-700/50 transition-colors cursor-pointer shrink-0"
        aria-label="ปิดการแจ้งเตือน"
      >
        <X size={14} />
      </button>
    </aside>
  );
}
