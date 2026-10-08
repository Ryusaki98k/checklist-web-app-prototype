"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useLoading } from "../../context/LoadingContext";
import { useOptionalApp } from "../../context/AppContext";

const emptySubscribe = () => () => {};

/**
 * GlobalButtonDisabler
 *
 * Enforces that EVERY single button, submit input, and interactive role="button" element
 * across all pages of the application is disabled whenever any loading or transition process
 * is active (app initialization, page transitions, async server actions, or active loading states).
 *
 * Guarantees that users cannot accidentally click or trigger unintended actions during loading.
 */
export function GlobalButtonDisabler() {
  const { isLoading, isPageTransition, isNavigating } = useLoading();
  const appContext = useOptionalApp();
  const isAppReady = appContext ? appContext.isReady : true;

  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // Busy when the app is initializing OR an active blocking loading/DB/API operation is running OR page transition is active
  const isBusy = !isMounted || !isAppReady || isLoading || isPageTransition || isNavigating;
  const isBusyRef = useRef(isBusy);

  useEffect(() => {
    isBusyRef.current = isBusy;
  }, [isBusy]);

  // Synchronize loading busy state with root document element and body
  useEffect(() => {
    if (typeof document === "undefined") return;

    const body = document.body;
    const docEl = document.documentElement;

    if (isBusy) {
      body.setAttribute("data-loading-busy", "true");
      docEl.setAttribute("data-loading-busy", "true");
      docEl.setAttribute("aria-busy", "true");
    } else {
      body.removeAttribute("data-loading-busy");
      docEl.removeAttribute("data-loading-busy");
      docEl.removeAttribute("aria-busy");
    }

    return () => {
      body.removeAttribute("data-loading-busy");
      docEl.removeAttribute("data-loading-busy");
      docEl.removeAttribute("aria-busy");
    };
  }, [isBusy]);

  // Window-level capture phase interceptor:
  // Intercepts ALL clicks, pointerdowns, mousedowns, touchstarts, keydowns, and submits before any element handler can run.
  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleCapture(e: Event) {
      if (!isBusyRef.current && document.body.getAttribute("data-loading-busy") !== "true") {
        return;
      }

      const target = e.target as HTMLElement | null;
      if (!target) return;

      const buttonOrAction = target.closest<HTMLElement>(
        "button, input[type='button'], input[type='submit'], [role='button'], a[href]"
      );

      if (buttonOrAction) {
        // Special case: don't prevent focus movement keys (Tab, Arrow keys)
        if (e.type === "keydown") {
          const keyEvent = e as KeyboardEvent;
          if (keyEvent.key !== "Enter" && keyEvent.key !== " ") {
            return;
          }
        }

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    }

    const eventNames = ["click", "pointerdown", "mousedown", "touchstart", "keydown", "submit"];
    eventNames.forEach((name) => {
      window.addEventListener(name, handleCapture, { capture: true, passive: false });
    });

    return () => {
      eventNames.forEach((name) => {
        window.removeEventListener(name, handleCapture, { capture: true });
      });
    };
  }, []);

  return null;
}
