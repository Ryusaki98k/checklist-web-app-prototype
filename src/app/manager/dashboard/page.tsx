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

  // Sync initial view from URL query param if present (?view=executive or ?view=manager)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const parseViewParam = () => {
        const params = new URLSearchParams(window.location.search);
        const v = params.get("view");
        if (v === "executive" || v === "manager") {
          setForceView(v);
        } else {
          setForceView(null);
        }
      };

      parseViewParam();
      window.addEventListener("popstate", parseViewParam);
      return () => window.removeEventListener("popstate", parseViewParam);
    }
  }, []);

  const handleSwitchToExecutive = useCallback(() => {
    setForceView("executive");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("view", "executive");
      window.history.pushState({ view: "executive" }, "", url.toString());
    }
  }, []);

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

  // Use current logged in user or sample preview user
  const activeUser = currentUser || {
    id: "preview-exec-user",
    name: "คุณวิภาดา สุขเจริญ",
    username: "manager",
    role: "manager" as const,
    position: "ผู้จัดการร้าน",
  };

  const isExecutiveRole =
    activeUser.role === "general_manager" ||
    activeUser.role === "committee" ||
    (activeUser.position?.includes("กรรมการ") ?? false) ||
    (activeUser.position?.includes("ผู้จัดการทั่วไป") ?? false);

  const showExecutiveDashboard =
    forceView === "executive" || (isExecutiveRole && forceView !== "manager");

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
      onSwitchToExecutiveView={handleSwitchToExecutive}
    />
  );
}
