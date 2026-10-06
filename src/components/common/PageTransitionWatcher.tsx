"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useLoading } from "../../context/LoadingContext";

export function PageTransitionWatcher() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { startLoading, resetLoading, setIsNavigating } = useLoading();

  const [progress, setProgress] = useState<number | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const activeNavRef = useRef(false);
  const timersRef = useRef<NodeJS.Timeout[]>([]);
  const previousUrlRef = useRef("");

  // Helper to clear all running timers
  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  }, []);

  // When pathname or searchParams change, navigation has landed
  useEffect(() => {
    const currentUrl = `${pathname}${searchParams ? `?${searchParams.toString()}` : ""}`;

    if (previousUrlRef.current && previousUrlRef.current !== currentUrl) {
      // Clear any pending step or fallback timers
      clearTimers();

      // Complete the top loading bar
      setProgress(100);
      setIsVisible(true);

      const hideTimer = setTimeout(() => {
        setIsVisible(false);
        const resetTimer = setTimeout(() => {
          setProgress(null);
          activeNavRef.current = false;
          setIsNavigating(false);
        }, 180);
        timersRef.current.push(resetTimer);
      }, 120);
      timersRef.current.push(hideTimer);

      // Reset any lingering global page-transition lock and re-enable buttons
      resetLoading();
      setIsNavigating(false);
    }

    previousUrlRef.current = currentUrl;
  }, [pathname, searchParams, clearTimers, resetLoading, setIsNavigating]);

  // Intercept click on internal links to provide instant feedback and lock buttons immediately
  useEffect(() => {
    function handleAnchorClick(e: MouseEvent) {
      // Ignore right clicks or clicks with modifier keys
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href) return;

      // Ignore external links, hash anchors, mailto, tel, downloads
      if (
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("javascript:") ||
        target.hasAttribute("download") ||
        target.getAttribute("target") === "_blank"
      ) {
        return;
      }

      // Check if it's an internal route
      try {
        const url = new URL(href, window.location.href);
        const currentUrl = new URL(window.location.href);

        if (url.origin !== currentUrl.origin) return; // External origin

        // If clicking the exact current URL (including hash), no route transition needed
        if (
          url.pathname === currentUrl.pathname &&
          url.search === currentUrl.search &&
          url.hash === currentUrl.hash
        ) {
          return;
        }

        // Cancel any pending timers from previous interactions
        clearTimers();

        // Start navigation progress & immediately lock all buttons across all pages
        activeNavRef.current = true;
        setIsVisible(true);
        setProgress(25);
        startLoading("กำลังเตรียมเนื้อหาหน้าถัดไป...", true);
        setIsNavigating(true);

        // Advance progress smoothly and predictably
        timersRef.current.push(setTimeout(() => setProgress(50), 120));
        timersRef.current.push(setTimeout(() => setProgress(75), 350));
        timersRef.current.push(setTimeout(() => setProgress(88), 700));

        // Safety fallback: if navigation fails or cancels, auto-recover in 4 seconds
        const fallbackTimer = setTimeout(() => {
          if (activeNavRef.current) {
            setProgress(100);
            const fadeTimer = setTimeout(() => {
              setIsVisible(false);
              setProgress(null);
              resetLoading();
              setIsNavigating(false);
              activeNavRef.current = false;
            }, 180);
            timersRef.current.push(fadeTimer);
          }
        }, 4000);
        timersRef.current.push(fallbackTimer);
      } catch {
        // Ignore invalid URLs
      }
    }

    const handlePopState = () => {
      // Browser back/forward button clicked
      clearTimers();
      activeNavRef.current = true;
      setIsVisible(true);
      setProgress(35);
      startLoading("กำลังเตรียมเนื้อหาหน้าถัดไป...", true);
      setIsNavigating(true);
      timersRef.current.push(setTimeout(() => setProgress(70), 150));
    };

    const handleCustomNav = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const message = detail?.message || "กำลังเตรียมเนื้อหาหน้าถัดไป...";
      clearTimers();
      activeNavRef.current = true;
      setIsVisible(true);
      setProgress(30);
      startLoading(message, true);
      setIsNavigating(true);
      timersRef.current.push(setTimeout(() => setProgress(65), 120));
      timersRef.current.push(setTimeout(() => setProgress(85), 350));
    };

    document.addEventListener("click", handleAnchorClick, true);
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("app:navigating", handleCustomNav);

    return () => {
      document.removeEventListener("click", handleAnchorClick, true);
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("app:navigating", handleCustomNav);
      clearTimers();
    };
  }, [clearTimers, startLoading, resetLoading, setIsNavigating]);

  if (!isVisible && progress === null) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 h-1 z-[9999] pointer-events-none transition-opacity duration-200 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden="true"
    >
      <div
        className="h-full bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400 shadow-[0_0_12px_rgba(245,158,11,0.85)] transition-all ease-out"
        style={{
          width: `${progress ?? 0}%`,
          transitionDuration: progress === 100 ? "160ms" : "250ms",
        }}
      />
    </div>
  );
}
