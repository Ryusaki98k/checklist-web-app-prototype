"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

interface LoadingContextType {
  isLoading: boolean;
  loadingMessage: string;
  isPageTransition: boolean;
  isNavigating: boolean;
  setIsNavigating: (navigating: boolean) => void;
  startLoading: (message?: string, isTransition?: boolean) => void;
  stopLoading: () => void;
  resetLoading: () => void;
  withLoading: <T>(action: () => Promise<T>, message?: string) => Promise<T>;
  navigate: (href: string, message?: string) => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("กำลังประมวลผล...");
  const [isPageTransition, setIsPageTransition] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  // Track active count to handle concurrent requests gracefully
  const activeCountRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearDomBusy = useCallback(() => {
    if (typeof document !== "undefined") {
      document.body.removeAttribute("data-loading-busy");
      document.documentElement.removeAttribute("data-loading-busy");
      document.documentElement.removeAttribute("aria-busy");
    }
  }, []);

  const resetLoading = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsPageTransition(false);
    setIsNavigating(false);
    // Only clear loading and DOM busy if there are no active async DB/API operations
    if (activeCountRef.current === 0) {
      setIsLoading(false);
      clearDomBusy();
    }
  }, [clearDomBusy]);

  const startLoading = useCallback((message = "กำลังประมวลผล...", isTransition = false) => {
    setLoadingMessage(message);

    if (isTransition) {
      setIsPageTransition(true);
      setIsNavigating(true);
      // For page transitions, don't increment activeCountRef; clear transition state after timer
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setIsPageTransition(false);
        setIsNavigating(false);
        if (activeCountRef.current === 0) {
          clearDomBusy();
        }
      }, 1800);
      return;
    }

    activeCountRef.current += 1;
    setIsLoading(true);
  }, [clearDomBusy]);

  const stopLoading = useCallback(() => {
    activeCountRef.current = Math.max(0, activeCountRef.current - 1);
    if (activeCountRef.current === 0) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setIsLoading(false);
      setIsPageTransition(false);
      setIsNavigating(false);
      clearDomBusy();
    }
  }, [clearDomBusy]);

  const withLoading = useCallback(
    async <T,>(action: () => Promise<T>, message = "กำลังประมวลผล..."): Promise<T> => {
      startLoading(message, false);
      try {
        return await action();
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading]
  );

  const navigate = useCallback(
    (href: string, message = "กำลังเตรียมเนื้อหาหน้าถัดไป...") => {
      setLoadingMessage(message);
      setIsPageTransition(true);
      setIsNavigating(true);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setIsPageTransition(false);
        setIsNavigating(false);
        if (activeCountRef.current === 0) {
          clearDomBusy();
        }
      }, 1800);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("app:navigating", { detail: { href, message } }));
      }
      router.push(href);
    },
    [router, clearDomBusy]
  );

  return (
    <LoadingContext.Provider
      value={{
        isLoading,
        loadingMessage,
        isPageTransition,
        isNavigating,
        setIsNavigating,
        startLoading,
        stopLoading,
        resetLoading,
        withLoading,
        navigate,
      }}
    >
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error("useLoading must be used within a LoadingProvider");
  }
  return context;
}

