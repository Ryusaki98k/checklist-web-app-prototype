"use client";

import React, { createContext, useContext, useEffect, useState, useTransition, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ShiftSession, ShiftType, User, ActiveRole } from "../types";
import { getUserAvailableRoles, canAccessRole, getRoleDisplayTitle } from "../utils/roles";
import { STAFF_POSITIONS } from "../types";
import {
  getActiveSession,
  getCurrentUser,
  getSelectedShift,
  getSessions,
  saveActiveSession,
  saveCurrentUser,
  saveSelectedShift,
  saveSessions,
  getThaiDateString,
  isTodayThai,
  evictDailyCache,
  clearAllLocalStorage,
} from "../data/storage";
import {
  getOrCreateShiftSessionAction,
  endShiftSessionAction,
} from "../actions/checklist";
import { getUserByIdAction, syncOAuthUserAction } from "../actions/auth";
import { getBranchesAction } from "../actions/branch";
import { createClient } from "../db/supabase/client";
import { secureGetItem, secureRemoveItem } from "../utils/crypto";
import { invalidateBranchCache } from "../utils/cache";
import { useLoading } from "./LoadingContext";

interface AppContextType {
  currentUser: User | null;
  selectedShift: ShiftType | null;
  activeSession: ShiftSession | null;
  sessions: ShiftSession[];
  isReady: boolean;
  login: (user: User, shift?: ShiftType, redirectPath?: string, roleToActivate?: ActiveRole) => Promise<void> | void;
  logout: (redirectTo?: string) => void;
  switchRole: (newRole: ActiveRole) => void;
  availableRoles: ActiveRole[];
  selectShift: (shift: ShiftType) => Promise<void>;
  selectPosition: (position: string) => void;
  updateSession: (updated: ShiftSession) => void;
  endShift: (continueNextShift?: boolean, reason?: string) => Promise<void>;
  setCurrentUser: (user: User | null) => void;
  setSelectedShift: (shift: ShiftType | null) => void;
  setActiveSession: (session: ShiftSession | null) => void;
  refreshUserData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { startLoading, withLoading, resetLoading } = useLoading();
  const [, startTransition] = useTransition();
  const [isReady, setIsReady] = useState(false);
  const [currentUser, setCurrentUserState] = useState<User | null>(null);
  const [selectedShift, setSelectedShiftState] = useState<ShiftType | null>(null);

  const [activeSession, setActiveSessionState] = useState<ShiftSession | null>(null);
  const [sessions, setSessionsState] = useState<ShiftSession[]>([]);

  // Keep ref to activeSession so date check doesn't recreate callback or trigger effect loops
  const activeSessionRef = useRef(activeSession);
  useEffect(() => {
    activeSessionRef.current = activeSession;
  });

  // Enforce branch association: any user without a branch cannot access operational pages
  useEffect(() => {
    if (!isReady || !currentUser) return;
    const hasNoBranch =
      (!currentUser.branchId || !currentUser.branchName) &&
      !currentUser.isAdmin &&
      currentUser.executiveType === "none";
    if (hasNoBranch) {
      const allowedPaths = [
        "/awaiting-assignment",
        "/",
        "/login/employee",
        "/login/manager",
        "/login",
        "/guide",
        "/readme",
        "/auth/callback",
      ];
      const isAllowed = allowedPaths.some(
        (p) => pathname === p || pathname?.startsWith("/guide") || pathname?.startsWith("/readme") || pathname?.startsWith("/auth")
      );
      if (!isAllowed) {
        router.replace("/awaiting-assignment");
      }
    }
  }, [isReady, currentUser, pathname, router]);

  const refreshUserData = async () => {
    if (!currentUser?.id) return;
    try {
      const res = await getUserByIdAction(currentUser.id);
      if (res.success && res.user) {
        setCurrentUserState(res.user);
        saveCurrentUser(res.user);
      }
    } catch (err) {
      console.warn("Failed to refresh user data:", err);
    }
  };

  const reloadEverythingFromDb = React.useCallback(async (explicitUser?: User | null) => {
    if (typeof window === "undefined") return;
    const currentThaiDate = getThaiDateString();

    console.info("Purging localStorage and reloading everything from DB on new date...");

    // 1. Clear all localStorage while preserving theme
    clearAllLocalStorage(true);
    localStorage.setItem("app_last_entered_date", currentThaiDate);
    localStorage.setItem("app_last_visit_date", currentThaiDate);
    localStorage.setItem("app_last_login_date", currentThaiDate);

    // 2. Clear all in-memory React session states
    setActiveSessionState(null);
    setSelectedShiftState(null);
    setSessionsState([]);

    // 3. Invalidate branch cache
    invalidateBranchCache();

    // 4. Reload branches from DB
    try {
      await getBranchesAction({ forceRefresh: true });
    } catch (err) {
      console.warn("Failed to reload branches from DB:", err);
    }

    // 5. Reload user from DB if user is provided or exists
    const targetUserId = explicitUser?.id || currentUser?.id;
    if (targetUserId) {
      try {
        const userRes = await getUserByIdAction(targetUserId);
        if (userRes.success && userRes.user) {
          setCurrentUserState(userRes.user);
          saveCurrentUser(userRes.user);
        } else if (explicitUser) {
          setCurrentUserState(explicitUser);
          saveCurrentUser(explicitUser);
        }
      } catch (err) {
        console.warn("Failed to reload user from DB:", err);
        if (explicitUser) {
          setCurrentUserState(explicitUser);
          saveCurrentUser(explicitUser);
        }
      }
    } else {
      setCurrentUserState(null);
    }

    // 6. Broadcast event so other components refresh from DB
    window.dispatchEvent(new CustomEvent("app:date-rollover", { detail: { date: currentThaiDate } }));
  }, [currentUser?.id]);

  const checkDateRollover = React.useCallback(() => {
    if (typeof window === "undefined") return;
    const currentThaiDate = getThaiDateString();
    const lastVisit = localStorage.getItem("app_last_visit_date");
    const lastEntered = localStorage.getItem("app_last_entered_date");
    const currentSession = activeSessionRef.current;

    // Condition 1: Recorded date is different from today's Thai date
    // Condition 2: Active session exists in state but started on a past day
    const isPastSession = currentSession?.startedAt && !isTodayThai(currentSession.startedAt);
    const dateChanged = Boolean(
      (lastVisit && lastVisit !== currentThaiDate) ||
      (lastEntered && lastEntered !== currentThaiDate)
    );

    if (dateChanged || isPastSession) {
      console.info("Daily cache rollover triggered. Purging previous day's operational cache and reloading DB...");
      void reloadEverythingFromDb();

      if (window.location.pathname.includes("/checklist")) {
        router.replace("/shift");
      }
    }
  }, [router, reloadEverythingFromDb]);

  useEffect(() => {
    // Check if the user entered from another date
    if (typeof window !== "undefined") {
      try {
        const todayDateStr = getThaiDateString();
        const lastVisit = localStorage.getItem("app_last_visit_date");
        const lastEntered = localStorage.getItem("app_last_entered_date");
        const wasNewDateEntry = localStorage.getItem("app_entered_new_date") === "true";

        if (wasNewDateEntry || (lastVisit && lastVisit !== todayDateStr) || (lastEntered && lastEntered !== todayDateStr)) {
          console.info("User entered site from another date. Clearing localStorage and reloading from DB...");
          void reloadEverythingFromDb();
          localStorage.removeItem("app_entered_new_date");
        } else {
          localStorage.setItem("app_last_entered_date", todayDateStr);
          localStorage.setItem("app_last_visit_date", todayDateStr);
        }
      } catch (err) {
        console.warn("Failed to check daily visit date:", err);
      }
    }

    const storedUser = getCurrentUser();
    const storedSession = getActiveSession();
    // Only restore shift if there's a valid today session
    const storedShift = storedSession ? getSelectedShift() : null;
    const storedSessions = getSessions();

    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (storedUser) setCurrentUserState(storedUser);
    if (storedShift) {
      setSelectedShiftState(storedShift);
    } else {
      secureRemoveItem("app_selected_shift");
    }

    // Only restore active session if it matches the current user and is from today
    if (storedSession && storedUser && storedSession.userId === storedUser.id) {
      setActiveSessionState(storedSession);
    } else if (storedSession && isTodayThai(storedSession.startedAt)) {
      setActiveSessionState(storedSession);
    } else {
      secureRemoveItem("app_active_session");
      secureRemoveItem("app_selected_shift");
      setActiveSessionState(null);
    }

    if (storedSessions && storedUser) {
      const userSessions = storedSessions.filter((s) => s.userId === storedUser.id);
      setSessionsState(userSessions);
    } else {
      setSessionsState([]);
    }

    // Set up real-time listener for tab focus, visibility change, and heartbeat
    const onActivity = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        checkDateRollover();
      }
    };

    window.addEventListener("focus", onActivity);
    document.addEventListener("visibilitychange", onActivity);
    const interval = setInterval(checkDateRollover, 30000);

    // Check Supabase Auth state for OAuth logins
    try {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user) {
          // Only sync if user was already stored or if we have an active auth code/token callback in the URL
          const hasAuthCallback =
            typeof window !== "undefined" &&
            (window.location.search.includes("code=") ||
              window.location.hash.includes("access_token=") ||
              window.location.pathname.startsWith("/auth/callback"));

          if (!storedUser && !hasAuthCallback) {
            // Stale auth session without active user - sign out cleanly to prevent phantom logins
            void supabase.auth.signOut();
            return;
          }

          const authUser = data.user;
          const username =
          authUser.user_metadata?.user_name ||
          authUser.email?.split("@")[0]?.toLowerCase() ||
          `user_${authUser.id.substring(0, 6)}`;

        const name =
          authUser.user_metadata?.full_name ||
          authUser.user_metadata?.name ||
          username;

        syncOAuthUserAction({
          id: authUser.id,
          username,
          name,
        }).then((syncRes) => {
          if (syncRes.success && syncRes.user) {
            setCurrentUserState(syncRes.user);
            saveCurrentUser(syncRes.user);
          }
        }).catch(console.error);
      }
    }).catch((err) => {
      console.warn("Supabase auth check failed:", err);
    });
  } catch (err) {
    console.warn("Supabase client initialization skipped:", err);
  }

  setIsReady(true);

    return () => {
      window.removeEventListener("focus", onActivity);
      document.removeEventListener("visibilitychange", onActivity);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for employee score & streak updates across tabs, windows, and realtime notifications
  useEffect(() => {
    if (!currentUser?.id) return;

    const handleScoreUpdate = (event?: CustomEvent) => {
      const targetUserId = event?.detail?.userId;
      // If no specific userId, or matches current user, refresh user scores and details
      if (!targetUserId || targetUserId === currentUser.id) {
        void refreshUserData();
      }
    };

    // 1. In-tab custom event
    window.addEventListener("app:scores-updated", handleScoreUpdate as EventListener);

    // 2. Cross-tab BroadcastChannel
    let broadcastChannel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        broadcastChannel = new BroadcastChannel("app_scores_sync");
        broadcastChannel.onmessage = (msgEvent) => {
          if (msgEvent.data?.type === "SCORES_UPDATED") {
            const targetUserId = msgEvent.data?.userId;
            if (!targetUserId || targetUserId === currentUser.id) {
              void refreshUserData();
            }
          }
        };
      }
    } catch (e) {
      console.warn("BroadcastChannel app_scores_sync unavailable:", e);
    }

    // 3. Supabase Realtime subscription for external approvals/point awards
    let realtimeChannel: any = null;
    try {
      const supabase = createClient();
      realtimeChannel = supabase
        .channel(`user-scores-${currentUser.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "checklist_web_app",
            table: "notifications",
            filter: `recipient_id=eq.${currentUser.id}`,
          },
          (payload: any) => {
            const type = payload?.new?.type;
            if (type === "point_awarded" || type === "shift_approved") {
              void refreshUserData();
              window.dispatchEvent(
                new CustomEvent("app:scores-updated", {
                  detail: { userId: currentUser.id, shiftSessionId: payload?.new?.shift_session_id },
                })
              );
            }
          }
        )
        .subscribe();
    } catch (e) {
      console.warn("Supabase realtime user score subscription unavailable:", e);
    }

    return () => {
      window.removeEventListener("app:scores-updated", handleScoreUpdate as EventListener);
      if (broadcastChannel) {
        try {
          broadcastChannel.close();
        } catch (_) {}
      }
      if (realtimeChannel) {
        try {
          const supabase = createClient();
          supabase.removeChannel(realtimeChannel);
        } catch (_) {}
      }
    };
  }, [currentUser?.id]);

  function setCurrentUser(user: User | null) {
    setCurrentUserState(user);
    saveCurrentUser(user);
  }

  function setSelectedShift(shift: ShiftType | null) {
    setSelectedShiftState(shift);
    saveSelectedShift(shift);
  }

  function setActiveSession(session: ShiftSession | null) {
    setActiveSessionState(session);
    saveActiveSession(session);
  }

  const availableRoles = React.useMemo(() => {
    return getUserAvailableRoles(currentUser);
  }, [currentUser]);

  const switchRole = React.useCallback(
    (newRole: ActiveRole) => {
      if (!currentUser) return;
      if (!canAccessRole(currentUser, newRole)) {
        console.warn(`User does not have permission to switch to role ${newRole}`);
        return;
      }

      const roleDisplay = getRoleDisplayTitle(newRole);
      const loadingMsg = `กำลังสลับบทบาทเป็น ${roleDisplay}...`;

      let targetPath = "/position";
      if (newRole === "admin") {
        targetPath = "/admin/dashboard";
      } else if (newRole === "manager" || newRole === "manager_assistant") {
        if (!currentUser.branchId || !currentUser.branchName) {
          targetPath = "/awaiting-assignment";
        } else {
          targetPath = "/manager/dashboard";
        }
      } else if (newRole === "committee" || newRole === "general_manager") {
        targetPath = "/manager/dashboard";
      } else {
        // Employee role
        if (!currentUser.branchId || !currentUser.branchName) {
          targetPath = "/awaiting-assignment";
        } else {
          targetPath = "/position";
        }
      }

      // Immediately activate global loading screen
      startLoading(loadingMsg, true);

      // Dispatch custom navigation event for progress bar & listeners
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("app:navigating", {
            detail: { href: targetPath, message: loadingMsg, role: newRole },
          })
        );
      }

      const updatedUser: User = {
        ...currentUser,
        activeRole: newRole,
        role: newRole,
        position:
          newRole === "manager"
            ? "ผู้จัดการร้าน"
            : newRole === "manager_assistant"
            ? "ผู้ช่วยผู้จัดการร้าน"
            : newRole === "committee"
            ? "กรรมการ"
            : newRole === "general_manager"
            ? "ผู้จัดการทั่วไป"
            : newRole === "admin"
            ? "ผู้ดูแลระบบส่วนกลาง"
            : undefined,
      };

      saveCurrentUser(updatedUser);
      setCurrentUser(updatedUser);

      const isCurrentPage = typeof window !== "undefined" && window.location.pathname === targetPath;

      startTransition(() => {
        router.push(targetPath);
      });

      if (isCurrentPage) {
        // Since URL does not change, complete transition gracefully after render settles
        setTimeout(() => {
          resetLoading();
        }, 500);
      }
    },
    [currentUser, router, startLoading, resetLoading]
  );

  async function login(user: User, shift?: ShiftType, redirectPath?: unknown, roleToActivate?: ActiveRole) {
    const loginMsg = "กำลังเข้าสู่ระบบและเตรียมข้อมูล...";
    startLoading(loginMsg, true);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("app:navigating", { detail: { message: loginMsg } }));
    }
    const targetPath = typeof redirectPath === "string" ? redirectPath : null;

    const todayDateStr = getThaiDateString();
    const lastLoginDate = localStorage.getItem("app_last_login_date");
    const lastEnteredDate = localStorage.getItem("app_last_entered_date");
    const wasNewDateEntry = localStorage.getItem("app_entered_new_date") === "true";
    const prevEnteredDate = localStorage.getItem("app_previous_entered_date");

    const isFromAnotherDate =
      wasNewDateEntry ||
      (lastEnteredDate && lastEnteredDate !== todayDateStr) ||
      (lastLoginDate && lastLoginDate !== todayDateStr) ||
      (prevEnteredDate && prevEnteredDate !== todayDateStr);

    let activeUser = user;
    if (roleToActivate && canAccessRole(user, roleToActivate)) {
      activeUser = {
        ...activeUser,
        activeRole: roleToActivate,
        role: roleToActivate,
      };
    }

    if (isFromAnotherDate) {
      console.info("User login from another date detected. Clearing localStorage and reloading from DB...");
      await reloadEverythingFromDb(user);
      localStorage.removeItem("app_entered_new_date");
      localStorage.removeItem("app_previous_entered_date");

      // Verify user directly from DB to get the most updated state
      try {
        const dbUserRes = await getUserByIdAction(user.id);
        if (dbUserRes.success && dbUserRes.user) {
          activeUser = {
            ...dbUserRes.user,
            activeRole: roleToActivate && canAccessRole(dbUserRes.user, roleToActivate) ? roleToActivate : dbUserRes.user.activeRole || dbUserRes.user.role,
            role: roleToActivate && canAccessRole(dbUserRes.user, roleToActivate) ? roleToActivate : dbUserRes.user.role,
          };
          setCurrentUserState(activeUser);
          saveCurrentUser(activeUser);
        }
      } catch (err) {
        console.warn("Could not refetch user on new date login:", err);
      }
    } else {
      localStorage.setItem("app_last_login_date", todayDateStr);
      localStorage.setItem("app_last_entered_date", todayDateStr);
      localStorage.setItem("app_last_visit_date", todayDateStr);
      setCurrentUserState(activeUser);
      saveCurrentUser(activeUser);
    }

    // Strict branch verification: any non-admin/non-executive user without a branch cannot access the app
    const hasNoBranch =
      (!activeUser.branchId || !activeUser.branchName) &&
      !activeUser.isAdmin &&
      activeUser.executiveType === "none";
    if (hasNoBranch) {
      setCurrentUser(activeUser);
      startTransition(() => {
        router.push("/awaiting-assignment");
      });
      return;
    }

    if (targetPath) {
      setCurrentUser(activeUser);
      startTransition(() => {
        router.push(targetPath);
      });
      return;
    }

    // Reset previous user's active session and queue if user changed
    const prevUser = getCurrentUser();
    if (prevUser && prevUser.id !== activeUser.id) {
      secureRemoveItem("app_sessions");
      secureRemoveItem("app_active_session");
      secureRemoveItem("app_selected_shift");
      secureRemoveItem("app_queue_afternoon");
      setSessionsState([]);
      setActiveSession(null);
      setSelectedShift(null);
    }

    if (activeUser.role === "admin") {
      setCurrentUser(activeUser);
      startTransition(() => {
        router.push("/admin/dashboard");
      });
    } else if (
      activeUser.role === "manager" ||
      activeUser.role === "manager_assistant" ||
      activeUser.role === "committee" ||
      activeUser.role === "general_manager"
    ) {
      setCurrentUser(activeUser);
      startTransition(() => {
        router.push("/manager/dashboard");
      });
    } else {
      // Clear any leftover session when an employee logs in so they always start clean
      setActiveSession(null);
      setSelectedShift(null);
      secureRemoveItem("app_active_session");
      secureRemoveItem("app_selected_shift");

      const staffUser: User = { ...activeUser, position: undefined };
      setCurrentUser(staffUser);
      startTransition(() => {
        router.push("/position");
      });
    }
  }

  async function logout(redirectTo?: unknown) {
    const logoutMsg = "กำลังออกจากระบบ...";
    startLoading(logoutMsg, true);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("app:navigating", { detail: { message: logoutMsg } }));
    }
    const targetUrl = typeof redirectTo === "string" ? redirectTo : "/";

    try {
      const supabase = createClient();
      await supabase.auth.signOut({ scope: "local" });
    } catch (err) {
      console.warn("Supabase signOut error:", err);
    }

    if (typeof window !== "undefined") {
      // Clear all auth cookies
      try {
        document.cookie.split(";").forEach((cookie) => {
          const eqPos = cookie.indexOf("=");
          const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
          if (name.startsWith("sb-") || name.includes("supabase")) {
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;`;
          }
        });
      } catch (e) {
        console.warn("Error clearing auth cookies:", e);
      }

      // Clear all app and auth items in localStorage (preserve theme)
      try {
        const theme = localStorage.getItem("theme");
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith("sb-") || key.includes("supabase") || key.startsWith("app_") || key.startsWith("mgr_")) {
            localStorage.removeItem(key);
          }
        });
        if (theme) localStorage.setItem("theme", theme);
      } catch (e) {
        console.warn("Error clearing localStorage:", e);
      }

      // Clear all sessionStorage
      try {
        sessionStorage.clear();
      } catch (e) {
        console.warn("Error clearing sessionStorage:", e);
      }
    }

    // Clear local storage items
    secureRemoveItem("app_sessions");
    secureRemoveItem("app_manager_read_notifs");
    secureRemoveItem("app_queue_afternoon");
    secureRemoveItem("app_active_session");
    secureRemoveItem("app_selected_shift");
    secureRemoveItem("app_current_user");

    setSessionsState([]);
    setCurrentUser(null);
    setSelectedShift(null);
    setActiveSession(null);

    // Guarantee full tear-down and navigation directly to home page
    if (typeof window !== "undefined") {
      window.location.replace(targetUrl);
    } else {
      router.replace(targetUrl);
    }
  }

  function selectPosition(position: string) {
    if (!currentUser) return;
    startLoading("กำลังเลือกตำแหน่ง...", true);

    let activeUser = currentUser;
    if (position !== activeUser.position) {
      activeUser = { ...activeUser, position };
      setCurrentUser(activeUser);
    }

    startTransition(() => {
      router.push("/shift");
    });
  }

  async function selectShift(shift: ShiftType): Promise<void> {
    if (!currentUser) return;

    await withLoading(async () => {
      setSelectedShift(shift);

      const position = currentUser.position || STAFF_POSITIONS[0];

      try {
        const res = await getOrCreateShiftSessionAction({
          userId: currentUser.id,
          userName: currentUser.name,
          position,
          shift,
        });

        if (res.success && res.session) {
          const session = res.session;
          const allSessions = getSessions();
          const existingIdx = allSessions.findIndex((s) => s.id === session.id);
          const next =
            existingIdx >= 0
              ? allSessions.map((s) => (s.id === session.id ? session : s))
              : [...allSessions, session];
          saveSessions(next);
          setSessionsState(next);
          setActiveSession(session);

          const targetPath = currentUser.role === "manager" ? "/admin/dashboard" : "/checklist";
          router.push(targetPath);
          return;
        } else {
          alert("ดึงข้อมูลจากฐานข้อมูลไม่สำเร็จ: " + (res.error || ""));
          throw new Error(res.error || "ดึงข้อมูลจากฐานข้อมูลไม่สำเร็จ");
        }
      } catch (err) {
        console.warn("Could not sync shift session from DB:", err);
        if (!(err instanceof Error && err.message.includes("ดึงข้อมูลจากฐานข้อมูลไม่สำเร็จ"))) {
          alert("เกิดข้อผิดพลาดในการดึงข้อมูลจากระบบ กรุณาลองใหม่อีกครั้ง");
        }
        throw err;
      }
    }, "กำลังเตรียมเช็คลิสต์ประจำกะ...");
  }

  function updateSession(updated: ShiftSession) {
    if (!isTodayThai(updated.startedAt)) {
      setActiveSession(null);
      return;
    }
    const allSessions = getSessions();
    const hasSess = allSessions.some((s) => s.id === updated.id);
    const next = hasSess
      ? allSessions.map((s) => (s.id === updated.id ? updated : s))
      : [...allSessions, updated];
    saveSessions(next);
    setSessionsState(next);
    setActiveSession(updated);
  }

  async function endShift(continueNextShift?: boolean, reason?: string) {
    await withLoading(async () => {
      if (activeSession) {
        const endedAt = new Date().toISOString();
        const updated: ShiftSession = {
          ...activeSession,
          completedAt: activeSession.completedAt || endedAt,
          incompleteReason: reason || activeSession.incompleteReason || null,
        };
        const allSessions = getSessions();
        const hasSess = allSessions.some((s) => s.id === updated.id);
        const next = hasSess
          ? allSessions.map((s) => (s.id === updated.id ? updated : s))
          : [...allSessions, updated];
        saveSessions(next);
        setSessionsState(next);

        try {
          const res = await endShiftSessionAction({
            shiftSessionId: activeSession.id,
            reason,
          });
          if (!res.success) {
            console.error("Failed to end shift in DB:", res.error);
            alert(res.error || "เกิดข้อผิดพลาดในการบันทึกจบกะ");
            return;
          }
        } catch (err) {
          console.error("Failed to end shift in DB:", err);
          alert("เกิดข้อผิดพลาดในการเชื่อมต่อเพื่อจบกะ");
          return;
        }
      }
      const wasManager = currentUser?.role === "manager";
      const currentShift = activeSession?.shift || selectedShift;
      const nextShiftToRun = currentShift === "morning" ? "afternoon" : null;

      const hadAfternoonQueue =
        continueNextShift ||
        (typeof window !== "undefined" && secureGetItem("app_queue_afternoon") === "true");
      if (typeof window !== "undefined") {
        secureRemoveItem("app_queue_afternoon");
      }

      setActiveSession(null);
      setSelectedShift(null);

      if (hadAfternoonQueue && !wasManager && nextShiftToRun) {
        await selectShift(nextShiftToRun);
        return;
      }

      const target = wasManager ? "/admin/dashboard" : "/shift";
      router.replace(target);
    }, "กำลังบันทึกและส่งรายงานกะ...");
  }

  return (
    <AppContext.Provider
      value={{
        currentUser,
        selectedShift,
        activeSession,
        sessions,
        isReady,
        login,
        logout,
        switchRole,
        availableRoles,
        selectShift,
        selectPosition,
        updateSession,
        endShift,
        setCurrentUser,
        setSelectedShift,
        setActiveSession,
        refreshUserData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}

export function useOptionalApp() {
  return useContext(AppContext);
}

