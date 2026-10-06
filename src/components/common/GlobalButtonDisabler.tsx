"use client";

import { useEffect, useRef, useState } from "react";
import { useLoading } from "../../context/LoadingContext";
import { useOptionalApp } from "../../context/AppContext";

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

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Unified busy state across the entire application
  const isBusy = !isMounted || !isAppReady || isLoading || isPageTransition || isNavigating;
  const isBusyRef = useRef(isBusy);

  useEffect(() => {
    isBusyRef.current = isBusy;
  }, [isBusy]);

  // Synchronize disabled state with DOM elements and set data attribute on body
  useEffect(() => {
    if (typeof document === "undefined") return;

    const body = document.body;
    const docEl = document.documentElement;

    if (isBusy) {
      body.setAttribute("data-loading-busy", "true");
      docEl.setAttribute("data-loading-busy", "true");

      const disableElement = (el: HTMLElement) => {
        if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement) {
          // Only tag if not already disabled by component's internal logic
          if (!el.disabled && !el.hasAttribute("data-auto-disabled-by-loading")) {
            el.disabled = true;
            el.setAttribute("data-auto-disabled-by-loading", "true");
            el.setAttribute("aria-disabled", "true");
          }
        } else if (el.getAttribute("role") === "button") {
          if (el.getAttribute("aria-disabled") !== "true") {
            el.setAttribute("aria-disabled", "true");
            el.setAttribute("data-auto-disabled-by-loading", "true");
          }
        }
      };

      // Disable existing button elements in current DOM
      const targets = document.querySelectorAll<HTMLElement>(
        "button, input[type='button'], input[type='submit'], [role='button']"
      );
      targets.forEach(disableElement);

      // Mutation observer to immediately disable any dynamically mounted buttons while loading
      const observer = new MutationObserver((mutations) => {
        if (!isBusyRef.current) return;
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              if (
                node.matches("button, input[type='button'], input[type='submit'], [role='button']")
              ) {
                disableElement(node);
              }
              const children = node.querySelectorAll<HTMLElement>(
                "button, input[type='button'], input[type='submit'], [role='button']"
              );
              children.forEach(disableElement);
            }
          });
        });
      });

      observer.observe(body, { childList: true, subtree: true });

      return () => {
        observer.disconnect();
      };
    } else {
      // Re-enable elements that were disabled specifically by this loader
      const autoDisabled = document.querySelectorAll<HTMLElement>(
        "[data-auto-disabled-by-loading='true']"
      );
      autoDisabled.forEach((el) => {
        if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement) {
          el.disabled = false;
        }
        el.removeAttribute("aria-disabled");
        el.removeAttribute("data-auto-disabled-by-loading");
      });

      body.removeAttribute("data-loading-busy");
      docEl.removeAttribute("data-loading-busy");
    }
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
