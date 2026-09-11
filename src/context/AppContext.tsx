"use client";

import React, { createContext, useContext, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Notification, Position, ShiftSession, ShiftType, User } from "../types";
import { getChecklistTemplate } from "../data/checklists";
import {
  ensureDefaultManager,
  getActiveSession,
  getCurrentUser,
  getSelectedShift,
  getSessions,
  getUsers,
  saveActiveSession,
  saveCurrentUser,
  saveSelectedShift,
  saveSessions,
  saveUsers,
  uid,
} from "../data/storage";

interface AppContextType {
  currentUser: User | null;
  selectedShift: ShiftType | null;
  activeSession: ShiftSession | null;
  isReady: boolean;
  login: (user: User, shift?: ShiftType) => void;
  logout: () => void;
  selectShift: (shift: ShiftType) => void;
  selectPosition: (position: string) => void;
  updateSession: (updated: ShiftSession) => void;
  endShift: () => void;
  setCurrentUser: (user: User | null) => void;
  setSelectedShift: (shift: ShiftType | null) => void;
  setActiveSession: (session: ShiftSession | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isReady, setIsReady] = useState(false);
  const [currentUser, setCurrentUserState] = useState<User | null>(null);
  const [selectedShift, setSelectedShiftState] = useState<ShiftType | null>(null);
  const [activeSession, setActiveSessionState] = useState<ShiftSession | null>(null);

  useEffect(() => {
    ensureDefaultManager();
    const storedUser = getCurrentUser();
    const storedShift = getSelectedShift();
    const storedSession = getActiveSession();

    if (storedUser) setCurrentUserState(storedUser);
    if (storedShift) setSelectedShiftState(storedShift);
    if (storedSession) setActiveSessionState(storedSession);

    setIsReady(true);
  }, []);

  // Keep currentUser synced if position gets updated in storage
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      const users = getUsers();
      const fresh = users.find((u) => u.id === currentUser.id);
      if (fresh && fresh.position !== currentUser.position) {
        setCurrentUserState(fresh);
        saveCurrentUser(fresh);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [currentUser]);

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

  function login(user: User, shift?: ShiftType) {
    setCurrentUser(user);
    if (user.role === "manager") {
      startTransition(() => {
        router.push("/admin/dashboard");
      });
    } else {
      if (shift) {
        setSelectedShift(shift);
        startTransition(() => {
          router.push("/position");
        });
      } else {
        startTransition(() => {
          router.push("/shift");
        });
      }
    }
  }

  function logout() {
    const wasManager = currentUser?.role === "manager";
    setCurrentUser(null);
    setSelectedShift(null);
    setActiveSession(null);

    startTransition(() => {
      if (wasManager) {
        router.push("/admin");
      } else {
        router.push("/");
      }
    });
  }

  function selectShift(shift: ShiftType) {
    setSelectedShift(shift);
    startTransition(() => {
      router.push("/position");
    });
  }

  function selectPosition(position: string) {
    if (!currentUser || !selectedShift) return;

    let activeUser = currentUser;
    if (position !== activeUser.position) {
      activeUser = { ...activeUser, position };
      setCurrentUser(activeUser);
      const users = getUsers().map((u) => (u.id === activeUser.id ? { ...u, position } : u));
      saveUsers(users);
    }

    const template = getChecklistTemplate(position, selectedShift);
    const session: ShiftSession = {
      id: uid(),
      userId: activeUser.id,
      userName: activeUser.name,
      userPosition: position,
      shift: selectedShift,
      startedAt: new Date().toISOString(),
      completedAt: null,
      items: template.map((i) => ({ ...i, completedAt: null })),
      notified: false,
    };

    const sessions = getSessions();
    saveSessions([...sessions, session]);
    setActiveSession(session);

    startTransition(() => {
      router.push(activeUser.role === "manager" ? "/admin/dashboard" : "/checklist");
    });
  }

  function updateSession(updated: ShiftSession) {
    const sessions = getSessions().map((s) => (s.id === updated.id ? updated : s));
    saveSessions(sessions);
    setActiveSession(updated);
  }

  function endShift() {
    const wasManager = currentUser?.role === "manager";
    setActiveSession(null);
    setSelectedShift(null);

    startTransition(() => {
      if (wasManager) {
        router.push("/admin/dashboard");
      } else {
        router.push("/shift");
      }
    });
  }

  return (
    <AppContext.Provider
      value={{
        currentUser,
        selectedShift,
        activeSession,
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
