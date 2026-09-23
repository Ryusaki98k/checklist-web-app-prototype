"use client";

import React, { createContext, useContext, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShiftSession, ShiftType, User } from "../types";
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
} from "../data/storage";
import {
  getOrCreateShiftSessionAction,
  toggleTaskWorkAction,
  endShiftSessionAction,
} from "../actions/checklist";
import { getUserByIdAction, syncOAuthUserAction } from "../actions/auth";
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
  login: (user: User, shift?: ShiftType, redirectPath?: string) => void;
  logout: (redirectTo?: string) => void;
  selectShift: (shift: ShiftType) => void;
  selectPosition: (position: string) => void;
  updateSession: (updated: ShiftSession) => void;
  endShift: (continueNextShift?: boolean) => void;
  setCurrentUser: (user: User | null) => void;
  setSelectedShift: (shift: ShiftType | null) => void;
  setActiveSession: (session: ShiftSession | null) => void;
  refreshUserData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { startLoading, withLoading } = useLoading();
  const [, startTransition] = useTransition();
  const [isReady, setIsReady] = useState(false);
  const [currentUser, setCurrentUserState] = useState<User | null>(null);
  const [selectedShift, setSelectedShiftState] = useState<ShiftType | null>(null);

  const [activeSession, setActiveSessionState] = useState<ShiftSession | null>(null);
  const [sessions, setSessionsState] = useState<ShiftSession[]>([]);

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

  useEffect(() => {
    // Check if the last time the user visited the site is a different day
    if (typeof window !== "undefined") {
      try {
        const todayDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
        const lastVisit = localStorage.getItem("app_last_visit_date");
        if (lastVisit && lastVisit !== todayDateStr) {
          // Different day: evict operational cache data
          secureRemoveItem("app_sessions");
          secureRemoveItem("app_active_session");
          secureRemoveItem("app_selected_shift");
          secureRemoveItem("app_manager_read_notifs");
          secureRemoveItem("app_notifications");
          invalidateBranchCache();
        }
        localStorage.setItem("app_last_visit_date", todayDateStr);
      } catch (err) {
        console.warn("Failed to check daily visit date:", err);
      }
    }

    const storedUser = getCurrentUser();
    const storedShift = getSelectedShift();
    const storedSession = getActiveSession();
    const storedSessions = getSessions();

    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (storedUser) setCurrentUserState(storedUser);
    if (storedShift) setSelectedShiftState(storedShift);

    // Only restore active session if it matches the current user
    if (storedSession && storedUser && storedSession.userId === storedUser.id) {
      setActiveSessionState(storedSession);
    } else if (storedSession && (!storedUser || storedSession.userId !== storedUser?.id)) {
      secureRemoveItem("app_active_session");
      secureRemoveItem("app_selected_shift");
    }

    if (storedSessions && storedUser) {
      const userSessions = storedSessions.filter((s) => s.userId === storedUser.id);
      setSessionsState(userSessions);
    } else {
      setSessionsState([]);
    }

    // Check Supabase Auth state for OAuth logins
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        const authUser = data.user;
        const name =
          authUser.user_metadata?.full_name ||
          authUser.user_metadata?.name ||
          authUser.email?.split("@")[0] ||
          "ผู้ใช้งาน";

        syncOAuthUserAction({
          id: authUser.id,
          email: authUser.email!,
          name,
        }).then((syncRes) => {
          if (syncRes.success && syncRes.user) {
            setCurrentUserState(syncRes.user);
            saveCurrentUser(syncRes.user);
          }
        }).catch(console.error);
      }
    });

    setIsReady(true);
  }, []);

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

  function login(user: User, shift?: ShiftType, redirectPath?: unknown) {
    startLoading("กำลังเข้าสู่ระบบ...", true);
    const targetPath = typeof redirectPath === "string" ? redirectPath : null;

    // Role verification for branch association
    const requiresBranch =
      user.role === "employee" || user.role === "manager_assistant" || user.role === "manager";
    if (requiresBranch && !user.branchName) {
      setCurrentUser(user);
      startTransition(() => {
        router.push("/awaiting-assignment");
      });
      return;
    }

    if (targetPath) {
      setCurrentUser(user);
      startTransition(() => {
        router.push(targetPath);
      });
      return;
    }

    // Reset previous user's active session and queue if user changed
    const prevUser = getCurrentUser();
    if (prevUser && prevUser.id !== user.id) {
      secureRemoveItem("app_sessions");
      secureRemoveItem("app_active_session");
      secureRemoveItem("app_selected_shift");
      secureRemoveItem("app_queue_afternoon");
      setSessionsState([]);
      setActiveSession(null);
      setSelectedShift(null);
    }

    if (user.role === "admin" || user.role === "committee" || user.role === "general_manager") {
      setCurrentUser(user);
      startTransition(() => {
        router.push("/admin/dashboard");
      });
    } else if (user.role === "manager" || user.role === "manager_assistant") {
      setCurrentUser(user);
      startTransition(() => {
        router.push("/manager/dashboard");
      });
    } else {
      // Clear any leftover session when an employee logs in so they always start clean
      setActiveSession(null);
      setSelectedShift(null);
      secureRemoveItem("app_active_session");
      secureRemoveItem("app_selected_shift");

      const staffUser: User = { ...user, position: undefined };
      setCurrentUser(staffUser);
      startTransition(() => {
        router.push("/position");
      });
    }
  }

  async function logout(redirectTo?: unknown) {
    startLoading("กำลังออกจากระบบ...", true);
    const targetUrl = typeof redirectTo === "string" ? redirectTo : null;
    const prevRole = currentUser?.role;

    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Supabase signOut error:", err);
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

    startTransition(() => {
      if (targetUrl) {
        router.push(targetUrl);
      } else if (prevRole === "admin" || prevRole === "committee" || prevRole === "general_manager") {
        router.push("/admin");
      } else if (prevRole === "manager" || prevRole === "manager_assistant") {
        router.push("/login/executive");
      } else {
        router.push("/login/staff");
      }
    });
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

  async function selectShift(shift: ShiftType) {
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

          startTransition(() => {
            router.push(currentUser.role === "manager" ? "/admin/dashboard" : "/checklist");
          });
          return;
        } else {
          alert("ดึงข้อมูลจากฐานข้อมูลไม่สำเร็จ: " + (res.error || ""));
        }
      } catch (err) {
        console.warn("Could not sync shift session from DB:", err);
        alert("เกิดข้อผิดพลาดในการดึงข้อมูลจากระบบ กรุณาลองใหม่อีกครั้ง");
      }
    }, "กำลังเตรียมเช็คลิสต์ประจำกะ...");
  }

  function updateSession(updated: ShiftSession) {
    const allSessions = getSessions();
    const hasSess = allSessions.some((s) => s.id === updated.id);
    const next = hasSess
      ? allSessions.map((s) => (s.id === updated.id ? updated : s))
      : [...allSessions, updated];
    saveSessions(next);
    setSessionsState(next);

    const changedItem = updated.items.find((item) => {
      const prev = activeSession?.items.find((p) => p.id === item.id);
      return prev ? prev.completedAt !== item.completedAt : false;
    });

    if (changedItem) {
      toggleTaskWorkAction({
        taskWorkId: changedItem.taskWorkId,
        shiftSessionId: updated.id,
        taskId: changedItem.id,
        completed: Boolean(changedItem.completedAt),
        comment: changedItem.comment || undefined,
      }).catch((err) => console.error("Failed to sync toggle to DB:", err));
    }

    setActiveSession(updated);
  }

  async function endShift(continueNextShift?: boolean) {
    await withLoading(async () => {
      if (activeSession) {
        const endedAt = new Date().toISOString();
        const updated: ShiftSession = {
          ...activeSession,
          completedAt: activeSession.completedAt || endedAt,
        };
        const allSessions = getSessions();
        const hasSess = allSessions.some((s) => s.id === updated.id);
        const next = hasSess
          ? allSessions.map((s) => (s.id === updated.id ? updated : s))
          : [...allSessions, updated];
        saveSessions(next);
        setSessionsState(next);

        try {
          await endShiftSessionAction(activeSession.id);
        } catch (err) {
          console.error("Failed to end shift in DB:", err);
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

      startTransition(() => {
        if (wasManager) {
          router.push("/admin/dashboard");
        } else {
          router.push("/shift");
        }
      });
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
