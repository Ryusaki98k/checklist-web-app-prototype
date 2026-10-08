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

const PERSISTENT_QUEUE_KEY = "chk_pending_sync_queue";

/**
 * Helper to get the persistent pending queue from localStorage
 */
export function getPersistedQueue(): TaskBufferToggle[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PERSISTENT_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Helper to save the persistent pending queue to localStorage
 */
export function savePersistedQueue(queue: TaskBufferToggle[]): void {
  if (typeof window === "undefined") return;
  try {
    if (queue.length === 0) {
      localStorage.removeItem(PERSISTENT_QUEUE_KEY);
    } else {
      localStorage.setItem(PERSISTENT_QUEUE_KEY, JSON.stringify(queue));
    }
  } catch (err) {
    console.warn("Failed to save pending sync queue:", err);
  }
}

/**
 * Add or update an item in the persistent pending queue
 */
export function addToPersistedQueue(toggle: TaskBufferToggle): void {
  const current = getPersistedQueue();
  const existingIdx = current.findIndex(
    (t) => t.taskId === toggle.taskId && (!toggle.shiftSessionId || t.shiftSessionId === toggle.shiftSessionId)
  );
  if (existingIdx >= 0) {
    current[existingIdx] = toggle;
  } else {
    current.push(toggle);
  }
  savePersistedQueue(current);
}

/**
 * Remove items from the persistent pending queue that have been successfully flushed
 */
export function removeFromPersistedQueue(flushed: TaskBufferToggle[]): void {
  const current = getPersistedQueue();
  const flushedMap = new Map(flushed.map((f) => [`${f.taskId}_${f.shiftSessionId || ""}`, f.timestamp]));
  const remaining = current.filter((item) => {
    const key = `${item.taskId}_${item.shiftSessionId || ""}`;
    const flushedTs = flushedMap.get(key);
    // If not flushed or has newer click, keep
    return flushedTs === undefined || item.timestamp > flushedTs;
  });
  savePersistedQueue(remaining);
}

/**
 * Send queued toggles to DB using fetch keepalive (or sendBeacon) on page unload
 */
export function sendTogglesViaBeacon(items: TaskBufferToggle[]): boolean {
  if (!items || items.length === 0 || typeof window === "undefined") return false;
  const payload = JSON.stringify({
    items: items.map((item) => ({
      taskId: item.taskId,
      taskWorkId: item.taskWorkId,
      shiftSessionId: item.shiftSessionId,
      completed: item.completed,
      comment: item.comment,
    })),
  });

  const url = "/api/checklist/batch-sync";

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
    console.warn("fetch keepalive failed, falling back to sendBeacon:", err);
  }

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json" });
      return navigator.sendBeacon(url, blob);
    }
  } catch (err) {
    console.warn("navigator.sendBeacon failed:", err);
  }

  return false;
}

// Global registry of all active controllers so unload events flush all of them
const activeControllers = new Set<TaskChecklistBufferController>();

// Register global browser unload listeners once
if (typeof window !== "undefined") {
  const flushAllControllersOnUnload = () => {
    for (const ctrl of activeControllers) {
      ctrl.flushViaBeacon();
    }
    // Also check persistent queue for any stranded items
    const remainingQueue = getPersistedQueue();
    if (remainingQueue.length > 0) {
      sendTogglesViaBeacon(remainingQueue);
      savePersistedQueue([]);
    }
  };

  window.addEventListener("pagehide", flushAllControllersOnUnload);
  window.addEventListener("beforeunload", flushAllControllersOnUnload);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      for (const ctrl of activeControllers) {
        void ctrl.flush();
      }
    }
  });
}

/**
 * Public helper to await flushing of ALL active checklist controllers
 */
export async function flushAllPendingChecklists(): Promise<void> {
  const controllers = Array.from(activeControllers);
  await Promise.all(controllers.map((c) => c.flush()));
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
  private activeFlushPromise: Promise<boolean> | null = null;
  private debounceMs: number;
  private maxWaitMs: number;
  private firstEnqueueTime: number | null = null;
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
    maxWaitMs?: number;
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
    this.debounceMs = options?.debounceMs ?? 250;
    this.maxWaitMs = options?.maxWaitMs ?? 750;
    this.graceLockMs = options?.graceLockMs ?? 6000;
    this.onBatchSuccess = options?.onBatchSuccess;
    this.onBatchError = options?.onBatchError;
    this.onDbVerified = options?.onDbVerified;

    // Register into active set
    activeControllers.add(this);

    // Hydrate any unsaved items from persistent storage queue
    this.hydrateFromPersistentQueue();
  }

  private hydrateFromPersistentQueue(): void {
    if (typeof window === "undefined") return;
    try {
      const persisted = getPersistedQueue();
      if (persisted.length > 0) {
        for (const item of persisted) {
          this.pendingBuffer.set(item.taskId, item);
          this.recentLocks.set(item.taskId, {
            completed: item.completed,
            timestamp: item.timestamp,
          });
        }
        // Schedule debounced sync for hydrated items
        if (!this.debounceTimer) {
          this.debounceTimer = setTimeout(() => {
            void this.flush();
          }, 600);
        }
      }
    } catch (err) {
      console.warn("Failed to hydrate from persistent queue:", err);
    }
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
   * Enqueue a toggle into the buffer and persistent local storage.
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
    const item: TaskBufferToggle = {
      ...toggle,
      timestamp: now,
    };

    this.pendingBuffer.set(toggle.taskId, item);
    this.recentLocks.set(toggle.taskId, {
      completed: toggle.completed,
      timestamp: now,
    });

    // Mirror to persistent storage so it survives unloads, reloads, and tab closures
    addToPersistedQueue(item);

    if (!this.firstEnqueueTime) {
      this.firstEnqueueTime = now;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    const elapsed = now - this.firstEnqueueTime;
    const remainingToMax = Math.max(0, this.maxWaitMs - elapsed);
    const delay = Math.min(this.debounceMs, remainingToMax);

    this.debounceTimer = setTimeout(() => {
      void this.flush();
    }, delay);
  }

  /**
   * Flush pending items via Beacon / Keepalive (used during page unload)
   */
  public flushViaBeacon(): void {
    if (this.pendingBuffer.size === 0) return;
    const items = Array.from(this.pendingBuffer.values());
    sendTogglesViaBeacon(items);
    this.pendingBuffer.clear();
    this.firstEnqueueTime = null;
    removeFromPersistedQueue(items);
  }

  /**
   * Immediately flush all pending buffered toggles collectively to the database.
   * Concurrency-safe: awaits active flush if already running, then continues if more items remain.
   * Awaits DB/API resolution without premature timeout cancellation.
   */
  public async flush(): Promise<boolean> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.firstEnqueueTime = null;

    if (this.isFlushing && this.activeFlushPromise) {
      await this.activeFlushPromise;
      if (this.pendingBuffer.size === 0) {
        return true;
      }
    }

    if (this.pendingBuffer.size === 0) {
      return true;
    }

    const itemsToFlush = Array.from(this.pendingBuffer.values());
    this.isFlushing = true;

    const performFlush = async (): Promise<boolean> => {
      try {
        const payload = itemsToFlush.map((item) => ({
          taskId: item.taskId,
          taskWorkId: item.taskWorkId,
          shiftSessionId: item.shiftSessionId,
          completed: item.completed,
          comment: item.comment,
        }));

        let res: {
          success: boolean;
          results?: Array<{
            taskId?: string;
            taskWorkId?: string;
            completed: boolean;
            completedAt?: string | null;
          }>;
          error?: string;
        };

        try {
          res = await batchToggleTaskWorksAction(payload);
        } catch {
          // Fallback to fetch endpoint if Server Action encounters context issue
          const fallbackRes = await fetch("/api/checklist/batch-sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: payload }),
          });
          res = await fallbackRes.json();
        }

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

          // Clean up from persistent queue
          removeFromPersistedQueue(itemsToFlush);

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
        this.activeFlushPromise = null;

        // Pipeline: if more items arrived while this flush was in flight,
        // trigger the next flush immediately without idle delay!
        if (this.pendingBuffer.size > 0) {
          if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
          }
          this.firstEnqueueTime = null;
          setTimeout(() => {
            if (this.pendingBuffer.size > 0 && !this.isFlushing) {
              void this.flush();
            }
          }, 25);
        }
      }
    };

    this.activeFlushPromise = performFlush();
    return await this.activeFlushPromise;
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
   * Clean up timer on unmount and ensure pending items are flushed
   */
  public destroy(): void {
    activeControllers.delete(this);
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
  maxWaitMs?: number;
  graceLockMs?: number;
}) {
  const [controller] = useState(
    () =>
      new TaskChecklistBufferController({
        debounceMs: options.debounceMs ?? 250,
        maxWaitMs: options.maxWaitMs ?? 750,
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

  const flush = useCallback(
    async () => {
      return await controller.flush();
    },
    [controller]
  );

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
