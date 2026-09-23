"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useLoading } from "../../context/LoadingContext";

export function PageTransitionWatcher() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { startLoading, stopLoading } = useLoading();

  const [progress, setProgress] = useState<number | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const activeNavRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const previousUrlRef = useRef("");

  // When pathname or searchParams change, navigation has landed
  useEffect(() => {
    const currentUrl = `${pathname}${searchParams ? `?${searchParams.toString()}` : ""}`;

    if (previousUrlRef.current && previousUrlRef.current !== currentUrl) {
      if (activeNavRef.current) {
        // Complete the bar
        setProgress(100);
        if (timerRef.current) clearTimeout(timerRef.current);

        timerRef.current = setTimeout(() => {
          setIsVisible(false);
          setProgress(null);
          stopLoading();
          activeNavRef.current = false;
        }, 220);
      }
    }

    previousUrlRef.current = currentUrl;
  }, [pathname, searchParams, stopLoading]);

  // Intercept click on internal links to provide instant feedback and prevent misclicks
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

        // If clicking the exact current URL without hash difference, no route transition needed
        if (url.pathname === currentUrl.pathname && url.search === currentUrl.search) {
          return;
        }

        // Start navigation progress
        activeNavRef.current = true;
        setIsVisible(true);
        setProgress(20);

        // Advance progress smoothly
        setTimeout(() => setProgress(55), 100);
        setTimeout(() => setProgress(80), 300);

        // Show full screen transition blocker if transition takes >100ms
        const overlayTimer = setTimeout(() => {
          if (activeNavRef.current) {
            startLoading("กำลังเปลี่ยนหน้า...", true);
          }
        }, 100);

        // Safety fallback: if navigation fails or is cancelled, auto-recover in 6 seconds
        setTimeout(() => {
          if (activeNavRef.current) {
            clearTimeout(overlayTimer);
            setProgress(null);
            setIsVisible(false);
            stopLoading();
            activeNavRef.current = false;
          }
        }, 6000);
      } catch {
        // Ignore invalid URLs
      }
    }

    document.addEventListener("click", handleAnchorClick, true);
    return () => {
      document.removeEventListener("click", handleAnchorClick, true);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [startLoading, stopLoading]);

  if (!isVisible && progress === null) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 h-1 z-[9999] pointer-events-none bg-transparent"
      aria-hidden="true"
    >
      <div
        className="h-full bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400 shadow-[0_0_12px_rgba(245,158,11,0.85)] transition-all ease-out"
        style={{
          width: `${progress ?? 0}%`,
          transitionDuration: progress === 100 ? "150ms" : "300ms",
          opacity: progress === 100 ? 0.8 : 1,
        }}
      />
    </div>
  );
}
