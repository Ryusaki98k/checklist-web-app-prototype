import { useEffect, useState, useCallback, useRef } from "react";
import { ChecklistItem } from "../types";
import { batchToggleTaskWorksAction } from "../actions/checklist";
import { secureGetItem, secureSetItem, secureRemoveItem } from "./crypto";

export interface TaskBufferToggle {
  taskId: string;
  taskWorkId?: string;
  shiftSessionId?: string;
  completed: boolean;
  comment?: string;
  timestamp: number;
}

export interface CachedChecklistData {
  sessionId?: string;
  items: ChecklistItem[];
  cachedAt: number;
}

/**
 * Build a stable signature string from checklist items to detect changes
 */
export function makeChecklistSignature(items: ChecklistItem[]): string {
  return items
    .map(
      (i) =>
        `${i.id}:${Boolean(i.completedAt)}:${i.completedByName || ""}:${i.comment || ""}:${i.taskWorkId || ""}`
    )
    .join("|");
}

/**
 * Save checklist items to secure local storage
 */
export function saveChecklistToCache(
  cacheKey: string,
  items: ChecklistItem[],
  sessionId?: string
): void {
  try {
    const data: CachedChecklistData = {
      sessionId,
      items,
      cachedAt: Date.now(),
    };
    secureSetItem(`chk_cache_${cacheKey}`, JSON.stringify(data));
  } catch (err) {
    console.warn("Failed to save checklist to cache:", err);
  }
}

/**
 * Load checklist items from secure local storage
 */
export function loadChecklistFromCache(cacheKey: string): ChecklistItem[] | null {
  try {
    const raw = secureGetItem(`chk_cache_${cacheKey}`);
    if (!raw) return null;
    const parsed: CachedChecklistData = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.items)) {
      return parsed.items;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Clear checklist cache for a key
 */
export function clearChecklistCache(cacheKey: string): void {
  try {
    secureRemoveItem(`chk_cache_${cacheKey}`);
  } catch (err) {
    console.warn("Failed to clear checklist cache:", err);
  }
}

export interface ReconcileResult {
  mergedItems: ChecklistItem[];
  hasExternalChanges: boolean;
}

/**
 * Reconcile fresh items from database with current local items and pending buffer.
 *
 * Rules:
 * 1. If an item has a pending buffered toggle or was toggled recently (within grace period),
 *    preserve the local optimistic state so stale DB reads do NOT revert the user's action.
 * 2. If an item does NOT have local pending changes and the server has different data,
 *    adopt the server changes (external updates from other managers/staff).
 */
export function reconcileTasksWithBuffer(
  serverItems: ChecklistItem[],
  currentLocalItems: ChecklistItem[],
  pendingBuffer: Map<string, TaskBufferToggle>,
  recentLocks: Map<string, { completed: boolean; timestamp: number }>,
  graceLockMs = 6000
): ReconcileResult {
  const now = Date.now();
  let hasExternalChanges = false;

  const currentMap = new Map<string, ChecklistItem>();
  for (const item of currentLocalItems) {
    currentMap.set(item.id, item);
  }

  const mergedItems = serverItems.map((sItem) => {
    const localMatch = currentMap.get(sItem.id);
    const pending = pendingBuffer.get(sItem.id);
    const lock = recentLocks.get(sItem.id);

    const isPending = Boolean(pending);
    const isLocked = Boolean(lock && now - lock.timestamp < graceLockMs);

    // 1. If user has pending buffered changes or recent click lock, keep local optimistic state!
    if (isPending || isLocked) {
      if (localMatch) {
        // Also update taskWorkId from server if server provided one and local was missing
        if (!localMatch.taskWorkId && sItem.taskWorkId) {
          return { ...localMatch, taskWorkId: sItem.taskWorkId };
        }
        return localMatch;
      }
      return sItem;
    }

    // 2. No pending local changes for this task: check if server data is different from local
    if (localMatch) {
      const serverDone = Boolean(sItem.completedAt);
      const localDone = Boolean(localMatch.completedAt);
      const serverComment = sItem.comment || "";
      const localComment = localMatch.comment || "";
      const serverWorkId = sItem.taskWorkId || "";
      const localWorkId = localMatch.taskWorkId || "";

      if (
        serverDone !== localDone ||
        serverComment !== localComment ||
        serverWorkId !== localWorkId ||
        sItem.completedByName !== localMatch.completedByName
      ) {
        hasExternalChanges = true;
        return sItem;
      }
      return localMatch;
    }

    // Brand new item from server
    hasExternalChanges = true;
    return sItem;
  });

  if (serverItems.length !== currentLocalItems.length) {
    hasExternalChanges = true;
  }

  return {
    mergedItems,
    hasExternalChanges,
  };
}

/**
 * TaskChecklistBufferController
 * Manages buffering, debouncing, and collective DB syncing for checklist items.
 */
export class TaskChecklistBufferController {
  private pendingBuffer = new Map<string, TaskBufferToggle>();
  private recentLocks = new Map<string, { completed: boolean; timestamp: number }>();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isFlushing = false;
  private debounceMs: number;
  private graceLockMs: number;

  // Track if changes were flushed to DB and awaiting verification from the next DB cache check
  private awaitingDbCheckConfirmation = false;
  private lastFlushedCount = 0;

  private onBatchSuccess?: (
    results: Array<{
      taskId?: string;
      taskWorkId?: string;
      completed: boolean;
      completedAt?: string | null;
    }>
  ) => void;
  private onBatchError?: (error: string) => void;
  private onDbVerified?: (info: {
    count: number;
    timestamp: number;
    message: string;
  }) => void;

  constructor(options?: {
    debounceMs?: number;
    graceLockMs?: number;
    onBatchSuccess?: (
      results: Array<{
        taskId?: string;
        taskWorkId?: string;
        completed: boolean;
        completedAt?: string | null;
      }>
    ) => void;
    onBatchError?: (error: string) => void;
    onDbVerified?: (info: {
      count: number;
      timestamp: number;
      message: string;
    }) => void;
  }) {
    this.debounceMs = options?.debounceMs ?? 400;
    this.graceLockMs = options?.graceLockMs ?? 6000;
    this.onBatchSuccess = options?.onBatchSuccess;
    this.onBatchError = options?.onBatchError;
    this.onDbVerified = options?.onDbVerified;
  }

  public getPendingMap(): Map<string, TaskBufferToggle> {
    return this.pendingBuffer;
  }

  public getLocksMap(): Map<string, { completed: boolean; timestamp: number }> {
    return this.recentLocks;
  }

  public isItemPending(taskId: string): boolean {
    return this.pendingBuffer.has(taskId);
  }

  /**
   * Enqueue a toggle into the buffer.
   * Debounces the collective database flush.
   */
  public enqueueToggle(toggle: {
    taskId: string;
    taskWorkId?: string;
    shiftSessionId?: string;
    completed: boolean;
    comment?: string;
  }): void {
    const now = Date.now();
    this.pendingBuffer.set(toggle.taskId, {
      ...toggle,
      timestamp: now,
    });
    this.recentLocks.set(toggle.taskId, {
      completed: toggle.completed,
      timestamp: now,
    });

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      void this.flush();
    }, this.debounceMs);
  }

  /**
   * Immediately flush all pending buffered toggles collectively to the database.
   */
  public async flush(): Promise<boolean> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.pendingBuffer.size === 0) {
      return true;
    }

    const itemsToFlush = Array.from(this.pendingBuffer.values());
    this.isFlushing = true;

    try {
      const res = await batchToggleTaskWorksAction(
        itemsToFlush.map((item) => ({
          taskId: item.taskId,
          taskWorkId: item.taskWorkId,
          shiftSessionId: item.shiftSessionId,
          completed: item.completed,
          comment: item.comment,
        }))
      );

      const now = Date.now();

      if (res.success) {
        // Clear flushed items from pending buffer
        for (const flushed of itemsToFlush) {
          const current = this.pendingBuffer.get(flushed.taskId);
          // If no newer click occurred during network flush, delete from pending
          if (current && current.timestamp <= flushed.timestamp) {
            this.pendingBuffer.delete(flushed.taskId);
          }
          // Refresh grace lock so immediate background polls still won't revert
          this.recentLocks.set(flushed.taskId, {
            completed: flushed.completed,
            timestamp: now,
          });
        }

        // Mark that submitted changes are awaiting confirmation in the next DB cache check
        this.awaitingDbCheckConfirmation = true;
        this.lastFlushedCount = itemsToFlush.length;

        if (this.onBatchSuccess && res.results) {
          this.onBatchSuccess(res.results);
        }
        return true;
      } else {
        console.error("TaskChecklistBufferController batch flush error:", res.error);
        if (this.onBatchError) {
          this.onBatchError(res.error || "บันทึกข้อมูลไม่สำเร็จ");
        }
        return false;
      }
    } catch (err: unknown) {
      console.error("TaskChecklistBufferController batch flush exception:", err);
      if (this.onBatchError) {
        const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย";
        this.onBatchError(message);
      }
      return false;
    } finally {
      this.isFlushing = false;
    }
  }

  public setCallbacks(callbacks: {
    onBatchSuccess?: (
      results: Array<{
        taskId?: string;
        taskWorkId?: string;
        completed: boolean;
        completedAt?: string | null;
      }>
    ) => void;
    onBatchError?: (error: string) => void;
    onDbVerified?: (info: {
      count: number;
      timestamp: number;
      message: string;
    }) => void;
  }): void {
    this.onBatchSuccess = callbacks.onBatchSuccess;
    this.onBatchError = callbacks.onBatchError;
    this.onDbVerified = callbacks.onDbVerified;
  }

  public markAwaitingDbCheck(count = 1): void {
    this.awaitingDbCheckConfirmation = true;
    this.lastFlushedCount = count;
  }

  public verifyDbCheck(serverItems: ChecklistItem[]): boolean {
    if (!this.awaitingDbCheckConfirmation) {
      return false;
    }
    if (Array.isArray(serverItems) && serverItems.length > 0) {
      this.awaitingDbCheckConfirmation = false;
      const count = this.lastFlushedCount;
      const info = {
        count,
        timestamp: Date.now(),
        message: "อัปเดตข้อมูลลงฐานข้อมูลเรียบร้อยแล้ว ✓",
      };
      if (this.onDbVerified) {
        this.onDbVerified(info);
      }
      return true;
    }
    return false;
  }

  /**
   * Clean up timer on unmount
   */
  public destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.pendingBuffer.size > 0) {
      void this.flush();
    }
  }
}

/**
 * useTaskChecklistBuffer
 * React hook integrating buffering, debounced collective syncing, and reconciliation.
 */
export function useTaskChecklistBuffer(options: {
  cacheKey: string;
  onBatchSuccess?: (
    results: Array<{
      taskId?: string;
      taskWorkId?: string;
      completed: boolean;
      completedAt?: string | null;
    }>
  ) => void;
  onBatchError?: (error: string) => void;
  onDbVerified?: (info: {
    count: number;
    timestamp: number;
    message: string;
  }) => void;
  debounceMs?: number;
  graceLockMs?: number;
}) {
  const [controller] = useState(
    () =>
      new TaskChecklistBufferController({
        debounceMs: options.debounceMs ?? 400,
        graceLockMs: options.graceLockMs ?? 6000,
      })
  );

  const [dbSyncNotification, setDbSyncNotification] = useState<{
    message: string;
    timestamp: number;
    count?: number;
  } | null>(null);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDbVerified = useCallback(
    (info: { count: number; timestamp: number; message: string }) => {
      setDbSyncNotification({
        message: info.message,
        timestamp: info.timestamp,
        count: info.count,
      });

      if (options.onDbVerified) {
        options.onDbVerified(info);
      }

      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      toastTimerRef.current = setTimeout(() => {
        setDbSyncNotification(null);
      }, 3500);
    },
    [options]
  );

  useEffect(() => {
    controller.setCallbacks({
      onBatchSuccess: options.onBatchSuccess,
      onBatchError: options.onBatchError,
      onDbVerified: handleDbVerified,
    });
  }, [controller, options.onBatchSuccess, options.onBatchError, handleDbVerified]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      controller.destroy();
    };
  }, [controller]);

  const clearDbSyncNotification = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setDbSyncNotification(null);
  }, []);

  const markAwaitingDbCheck = useCallback(
    (count = 1) => {
      controller.markAwaitingDbCheck(count);
    },
    [controller]
  );

  const enqueueToggle = useCallback(
    (toggle: {
      taskId: string;
      taskWorkId?: string;
      shiftSessionId?: string;
      completed: boolean;
      comment?: string;
    }) => {
      controller.enqueueToggle(toggle);
    },
    [controller]
  );

  const flush = useCallback(async () => {
    return await controller.flush();
  }, [controller]);

  const reconcile = useCallback(
    (serverItems: ChecklistItem[], currentLocalItems: ChecklistItem[]) => {
      // Confirm that database cache check verified recent submitted changes
      controller.verifyDbCheck(serverItems);

      return reconcileTasksWithBuffer(
        serverItems,
        currentLocalItems,
        controller.getPendingMap(),
        controller.getLocksMap(),
        options.graceLockMs ?? 6000
      );
    },
    [controller, options.graceLockMs]
  );

  const isItemPending = useCallback(
    (taskId: string) => {
      return controller.isItemPending(taskId);
    },
    [controller]
  );

  const saveToCache = useCallback(
    (items: ChecklistItem[], sessionId?: string) => {
      saveChecklistToCache(options.cacheKey, items, sessionId);
    },
    [options.cacheKey]
  );

  const loadFromCache = useCallback(() => {
    return loadChecklistFromCache(options.cacheKey);
  }, [options.cacheKey]);

  return {
    controller,
    enqueueToggle,
    flush,
    reconcile,
    isItemPending,
    saveToCache,
    loadFromCache,
    dbSyncNotification,
    clearDbSyncNotification,
    markAwaitingDbCheck,
  };
}
