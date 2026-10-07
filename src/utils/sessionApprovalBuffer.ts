/**
 * Resilient Session Approval Buffer & Manager Keepalive Utility
 * Ensures approvals are never lost when changing tabs, closing pages, or experiencing network hiccups.
 * Mirrored from taskChecklistBuffer.ts architecture.
 */

import { approveShiftSessionAction } from "../actions/manager";
import { Role } from "../types";

export interface PendingApproval {
  shiftSessionId: string;
  role: "manager" | "manager_assistant" | "committee" | "general_manager" | Role;
  isException?: boolean;
  timestamp: number;
}

const PERSISTENT_APPROVALS_KEY = "mgr_pending_approvals";

/**
 * Get all pending approvals stored in localStorage
 */
export function getPendingApprovals(): PendingApproval[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PERSISTENT_APPROVALS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Save pending approvals to localStorage
 */
export function savePendingApprovals(queue: PendingApproval[]): void {
  if (typeof window === "undefined") return;
  try {
    if (queue.length === 0) {
      localStorage.removeItem(PERSISTENT_APPROVALS_KEY);
    } else {
      localStorage.setItem(PERSISTENT_APPROVALS_KEY, JSON.stringify(queue));
    }
  } catch (err) {
    console.warn("Failed to save pending approvals queue:", err);
  }
}

/**
 * Add a pending approval to the queue
 */
export function addPendingApproval(item: PendingApproval): void {
  const current = getPendingApprovals();
  const existingIdx = current.findIndex((i) => i.shiftSessionId === item.shiftSessionId);
  if (existingIdx >= 0) {
    current[existingIdx] = item;
  } else {
    current.push(item);
  }
  savePendingApprovals(current);
}

/**
 * Remove a pending approval by shiftSessionId
 */
export function removePendingApproval(shiftSessionId: string): void {
  const current = getPendingApprovals();
  const filtered = current.filter((i) => i.shiftSessionId !== shiftSessionId);
  savePendingApprovals(filtered);
}

/**
 * Send queued approvals to DB using fetch keepalive (or sendBeacon) on page unload
 */
export function sendApprovalsViaBeacon(items: PendingApproval[]): boolean {
  if (!items || items.length === 0 || typeof window === "undefined") return false;
  const payload = JSON.stringify({
    items: items.map((item) => ({
      shiftSessionId: item.shiftSessionId,
      role: item.role,
      isException: item.isException,
    })),
  });

  const url = "/api/manager/approve-session";

  try {
    if (typeof fetch === "function") {
      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      });
      return true;
    }
  } catch (err) {
    console.warn("fetch keepalive for approvals failed, falling back to sendBeacon:", err);
  }

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json" });
      return navigator.sendBeacon(url, blob);
    }
  } catch (err) {
    console.warn("navigator.sendBeacon for approvals failed:", err);
  }

  return false;
}

/**
 * Broadcast score updates to all active tabs, contexts, and components
 */
export function broadcastScoresUpdated(detail: {
  userId?: string;
  shiftSessionId?: string;
}): void {
  if (typeof window === "undefined") return;

  // 1. Dispatch custom event for current window
  try {
    window.dispatchEvent(
      new CustomEvent("app:scores-updated", {
        detail,
      })
    );
  } catch (e) {
    console.warn("Failed to dispatch app:scores-updated event:", e);
  }

  // 2. Broadcast across browser tabs via BroadcastChannel
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel("app_scores_sync");
      channel.postMessage({
        type: "SCORES_UPDATED",
        ...detail,
        timestamp: Date.now(),
      });
      channel.close();
    }
  } catch (e) {
    console.warn("Failed to broadcast on app_scores_sync channel:", e);
  }
}

// Global browser unload listeners for approval persistence
if (typeof window !== "undefined") {
  const flushApprovalsOnUnload = () => {
    const queue = getPendingApprovals();
    if (queue.length > 0) {
      sendApprovalsViaBeacon(queue);
    }
  };

  window.addEventListener("beforeunload", flushApprovalsOnUnload);
  window.addEventListener("pagehide", flushApprovalsOnUnload);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushApprovalsOnUnload();
    }
  });
}

/**
 * Flush any pending approvals asynchronously (e.g. on dashboard startup)
 */
export async function flushPendingApprovals(): Promise<void> {
  if (typeof window === "undefined") return;
  const queue = getPendingApprovals();
  if (queue.length === 0) return;

  try {
    const response = await fetch("/api/manager/approve-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: queue }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data?.results && Array.isArray(data.results)) {
        for (const res of data.results) {
          if (res.success) {
            removePendingApproval(res.shiftSessionId);
            if (res.targetUserId) {
              broadcastScoresUpdated({
                userId: res.targetUserId,
                shiftSessionId: res.shiftSessionId,
              });
            }
          }
        }
      } else if (data?.success) {
        savePendingApprovals([]);
      }
    }
  } catch (err) {
    console.warn("Failed to flush pending approvals:", err);
  }
}

/**
 * Execute a resilient session approval with optimistic safety, persistent queue, and timeout
 */
export async function executeResilientApproval(params: {
  shiftSessionId: string;
  role: "manager" | "manager_assistant" | "committee" | "general_manager" | Role;
  isException?: boolean;
}): Promise<{ success: boolean; targetUserId?: string; error?: string }> {
  const pendingItem: PendingApproval = {
    shiftSessionId: params.shiftSessionId,
    role: params.role,
    isException: params.isException,
    timestamp: Date.now(),
  };

  // 1. Immediately persist to localStorage queue for unload survival
  addPendingApproval(pendingItem);

  // 2. Perform the approval request with a 12-second timeout guard
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    // Try primary server action first for efficiency
    const res = await approveShiftSessionAction({
      shiftSessionId: params.shiftSessionId,
      role: params.role,
      isException: params.isException,
    });

    clearTimeout(timeoutId);

    if (res.success) {
      // Clean up from pending queue
      removePendingApproval(params.shiftSessionId);

      // Broadcast score updates across tabs and contexts
      broadcastScoresUpdated({
        userId: res.targetUserId,
        shiftSessionId: params.shiftSessionId,
      });

      return { success: true, targetUserId: res.targetUserId };
    } else {
      // If server returned an explicit error rejection, remove from queue so it doesn't get resent
      removePendingApproval(params.shiftSessionId);
      return { success: false, error: res.error || "ไม่สามารถอนุมัติได้" };
    }
  } catch (actionErr: unknown) {
    clearTimeout(timeoutId);
    console.warn("Direct server action failed, attempting keepalive route fallback...", actionErr);

    // Fallback to API route
    try {
      const response = await fetch("/api/manager/approve-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftSessionId: params.shiftSessionId,
          role: params.role,
          isException: params.isException,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          removePendingApproval(params.shiftSessionId);
          broadcastScoresUpdated({
            userId: data.targetUserId,
            shiftSessionId: params.shiftSessionId,
          });
          return { success: true, targetUserId: data.targetUserId };
        } else {
          removePendingApproval(params.shiftSessionId);
          return { success: false, error: data.error || "ไม่สามารถอนุมัติได้" };
        }
      }
    } catch (fallbackErr) {
      console.error("Approval fallback also failed:", fallbackErr);
    }

    const message = actionErr instanceof Error ? actionErr.message : "การเชื่อมต่อขัดข้อง รายการจะถูกส่งใหม่อัตโนมัติเมื่อกลับมาออนไลน์";
    return {
      success: false,
      error: message,
    };
  }
}
