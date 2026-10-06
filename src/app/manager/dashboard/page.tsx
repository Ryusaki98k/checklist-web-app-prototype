"use client";
import { useEffect, useState, useCallback } from "react";

import { useRouter } from "next/navigation";
import { ExecutiveDashboard } from "../../../components/manager/ExecutiveDashboard";
import { ManagerDashboard } from "../../../components/manager/ManagerDashboard";
import { useApp } from "../../../context/AppContext";
import { useLoading } from "../../../context/LoadingContext";
import { LoadingSpinner } from "../../loading";

export default function ManagerDashboardPage() {
  const router = useRouter();
  const {
    currentUser,
    activeSession,
    isReady,
    logout,
    selectShift,
    updateSession,
    endShift,
  } = useApp();
  const { navigate } = useLoading();

  const [forceView, setForceView] = useState<"manager" | "executive" | null>(null);

  // Use current logged in user or sample preview user
  const activeUser = currentUser || {
    id: "preview-exec-user",
    name: "คุณวิภาดา สุขเจริญ",
    username: "manager",
    role: "manager" as const,
    position: "ผู้จัดการร้าน",
  };

  const isAssistantRole =
    activeUser.role === "manager_assistant" ||
    (activeUser.position?.includes("ผู้ช่วย") ?? false);

  const isExecutiveRole =
    !isAssistantRole &&
    (activeUser.role === "general_manager" ||
      activeUser.role === "committee" ||
      (activeUser.position?.includes("กรรมการ") ?? false) ||
      (activeUser.position?.includes("ผู้จัดการทั่วไป") ?? false));

  // Sync initial view from URL query param if present (?view=executive or ?view=manager)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const parseViewParam = () => {
        const params = new URLSearchParams(window.location.search);
        const v = params.get("view");
        if (v === "executive") {
          if (isAssistantRole) {
            setForceView("manager");
            const url = new URL(window.location.href);
            url.searchParams.delete("view");
            window.history.replaceState({}, "", url.toString());
          } else {
            setForceView("executive");
          }
        } else if (v === "manager") {
          setForceView("manager");
        } else {
          setForceView(null);
        }
      };

      parseViewParam();
      window.addEventListener("popstate", parseViewParam);
      return () => window.removeEventListener("popstate", parseViewParam);
    }
  }, [isAssistantRole]);

  // Defensive clean-up: if assistant somehow has forceView === "executive", reset to manager
  useEffect(() => {
    if (isAssistantRole && forceView === "executive") {
      setForceView("manager");
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        if (url.searchParams.get("view") === "executive") {
          url.searchParams.delete("view");
          window.history.replaceState({}, "", url.toString());
        }
      }
    }
  }, [isAssistantRole, forceView]);

  const handleSwitchToExecutive = useCallback(() => {
    if (isAssistantRole) return;
    setForceView("executive");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("view", "executive");
      window.history.pushState({ view: "executive" }, "", url.toString());
    }
  }, [isAssistantRole]);

  const handleSwitchToManager = useCallback(() => {
    setForceView("manager");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("view", "manager");
      window.history.pushState({ view: "manager" }, "", url.toString());
    }
  }, []);

  useEffect(() => {
    if (!isReady) return;
    if (currentUser?.role === "admin") {
      router.replace("/admin/dashboard");
    }
  }, [currentUser, isReady, router]);

  if (!isReady) {
    return <LoadingSpinner text="กำลังโหลดแดชบอร์ด..." />;
  }

  const showExecutiveDashboard =
    !isAssistantRole &&
    (forceView === "executive" || (isExecutiveRole && forceView !== "manager"));

  if (showExecutiveDashboard) {
    return (
      <ExecutiveDashboard
        user={activeUser}
        onLogout={() => logout("/")}
        activeSession={activeSession}
        onStartChecklist={selectShift}
        onUpdateSession={updateSession}
        onEndShift={endShift}
        onOpenChecklistPage={() => navigate("/checklist", "กำลังเปิดรายการเช็คลิสต์...")}
        onSwitchToManagerView={handleSwitchToManager}
      />
    );
  }

  return (
    <ManagerDashboard
      user={activeUser}
      onLogout={() => logout("/")}
      activeSession={activeSession}
      onStartChecklist={selectShift}
      onUpdateSession={updateSession}
      onEndShift={endShift}
      onOpenChecklistPage={() => navigate("/checklist", "กำลังเปิดรายการเช็คลิสต์...")}
      onSwitchToExecutiveView={isAssistantRole ? undefined : handleSwitchToExecutive}
    />
  );
}
