"use client";

import { useEffect, useRef } from "react";
import { flushAllPendingChecklists } from "../../utils/taskChecklistBuffer";

// 1 minute (60,000 milliseconds) threshold as requested
const AWAY_THRESHOLD_MS = 60 * 1000;
// Minimum cooldown between forced reloads to prevent reload loops
const RELOAD_COOLDOWN_MS = 10 * 1000;

const STORAGE_LAST_ACTIVE_KEY = "app_last_active_timestamp";
const STORAGE_LAST_RELOAD_KEY = "app_last_auto_reload_time";

/**
 * AutoReloadWatcher
 * Monitors user absence, tab visibility, device sleep, and tab freeze/idle states.
 * If the user is away from the page for more than 1 minute or the device/tab unfreezes after >= 1 min idle,
 * forces a complete page reload (like pressing the browser refresh button) when the user returns.
 */
export function AutoReloadWatcher() {
  const isReloadingRef = useRef(false);
  const hiddenAtRef = useRef<number | null>(null);
  const lastHeartbeatRef = useRef<number>(Date.now());
  const pendingReloadRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Initialize timestamps on mount
    const now = Date.now();
    lastHeartbeatRef.current = now;
    try {
      sessionStorage.setItem(STORAGE_LAST_ACTIVE_KEY, String(now));
    } catch {
      // Ignore storage errors
    }

    // Helper: Execute full page reload safely
    const performReload = async (reason: string) => {
      if (isReloadingRef.current) return;

      // Ensure cooldown has elapsed since the last reload to prevent reload loops
      try {
        const lastReload = Number(sessionStorage.getItem(STORAGE_LAST_RELOAD_KEY) || 0);
        if (lastReload && Date.now() - lastReload < RELOAD_COOLDOWN_MS) {
          return;
        }
      } catch {
        // Continue
      }

      // If currently offline, wait until back online before forcing reload to avoid offline error pages
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        pendingReloadRef.current = true;
        const handleOnline = () => {
          window.removeEventListener("online", handleOnline);
          if (pendingReloadRef.current) {
            void performReload("reconnected_online");
          }
        };
        window.addEventListener("online", handleOnline);
        return;
      }

      isReloadingRef.current = true;
      pendingReloadRef.current = false;

      try {
        sessionStorage.setItem(STORAGE_LAST_RELOAD_KEY, String(Date.now()));
      } catch {
        // Ignore storage errors
      }

      console.info(`[AutoReloadWatcher] Forcing full page reload (reason: ${reason})`);

      // Flush any pending checklist toggles before reloading
      try {
        await Promise.race([
          flushAllPendingChecklists(),
          new Promise((resolve) => setTimeout(resolve, 300)),
        ]);
      } catch {
        // Continue to reload regardless
      }

      window.location.reload();
    };

    // Helper: Check if the away/idle duration exceeded 1 minute (60s)
    const checkAwayAndReload = (triggerName: string) => {
      if (isReloadingRef.current) return;

      const currentTime = Date.now();
      let shouldReload = false;
      let recordedAwayTime = 0;

      // 1. Check in-memory hidden timestamp
      if (hiddenAtRef.current) {
        const diff = currentTime - hiddenAtRef.current;
        if (diff >= AWAY_THRESHOLD_MS) {
          shouldReload = true;
          recordedAwayTime = diff;
        }
      }

      // 2. Check persistent sessionStorage timestamp (resilient against tab suspension & BFCache)
      if (!shouldReload) {
        try {
          const storedLastActive = Number(sessionStorage.getItem(STORAGE_LAST_ACTIVE_KEY) || 0);
          if (storedLastActive) {
            const diff = currentTime - storedLastActive;
            if (diff >= AWAY_THRESHOLD_MS) {
              shouldReload = true;
              recordedAwayTime = diff;
            }
          }
        } catch {
          // Continue
        }
      }

      // 3. Check if marked by heartbeat gap
      if (!shouldReload && pendingReloadRef.current) {
        shouldReload = true;
      }

      if (shouldReload) {
        const secondsAway = Math.round(recordedAwayTime / 1000);
        void performReload(`${triggerName} (away for ${secondsAway}s >= 60s)`);
      } else {
        // Still within 1 minute: reset hidden timer and update active timestamp
        hiddenAtRef.current = null;
        try {
          sessionStorage.setItem(STORAGE_LAST_ACTIVE_KEY, String(currentTime));
        } catch {
          // Ignore
        }
      }
    };

    // 1. Visibility change listener (tab switch, minimize, phone screen off/on)
    const handleVisibilityChange = () => {
      const now = Date.now();
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = now;
        try {
          sessionStorage.setItem(STORAGE_LAST_ACTIVE_KEY, String(now));
        } catch {
          // Ignore
        }
      } else if (document.visibilityState === "visible") {
        checkAwayAndReload("visibility_visible");
      }
    };

    // 2. Window focus & blur listeners (app switching, desktop window focus)
    const handleFocus = () => {
      checkAwayAndReload("window_focus");
    };

    const handleBlur = () => {
      if (!hiddenAtRef.current) {
        hiddenAtRef.current = Date.now();
      }
      try {
        sessionStorage.setItem(STORAGE_LAST_ACTIVE_KEY, String(Date.now()));
      } catch {
        // Ignore
      }
    };

    // 3. Mobile Page Lifecycle: pagehide & pageshow (BFCache freeze/thaw)
    const handlePageHide = () => {
      hiddenAtRef.current = Date.now();
      try {
        sessionStorage.setItem(STORAGE_LAST_ACTIVE_KEY, String(Date.now()));
      } catch {
        // Ignore
      }
    };

    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        // Restored from BFCache: check away time or reload
        checkAwayAndReload("pageshow_persisted");
      } else {
        checkAwayAndReload("pageshow");
      }
    };

    // 4. Heartbeat interval: Detects CPU throttling, OS sleep/wake, tab freezing
    // Runs every 1,000ms. If OS sleeps or tab is frozen for > 60s, the next tick gap is >= 60,000ms.
    const heartbeatInterval = setInterval(() => {
      const currentTime = Date.now();
      const gap = currentTime - lastHeartbeatRef.current;
      lastHeartbeatRef.current = currentTime;

      // Update active timestamp if page is currently visible
      if (typeof document !== "undefined" && !document.hidden) {
        try {
          sessionStorage.setItem(STORAGE_LAST_ACTIVE_KEY, String(currentTime));
        } catch {
          // Ignore
        }
      }

      // Check if gap indicates a freeze / sleep of >= 60 seconds
      if (gap >= AWAY_THRESHOLD_MS) {
        if (typeof document !== "undefined" && document.visibilityState === "visible") {
          void performReload(`heartbeat_freeze_detected (freeze gap: ${Math.round(gap / 1000)}s >= 60s)`);
        } else {
          pendingReloadRef.current = true;
        }
      }
    }, 1000);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
      clearInterval(heartbeatInterval);
    };
  }, []);

  return null;
}
