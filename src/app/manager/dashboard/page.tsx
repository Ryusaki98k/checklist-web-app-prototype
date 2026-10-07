"use client";
import { useEffect } from "react";
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

  useEffect(() => {
    if (!isReady) return;
    if (!currentUser) {
      router.replace("/");
      return;
    }
    if (currentUser.role === "admin") {
      router.replace("/admin/dashboard");
    }
  }, [currentUser, isReady, router]);

  if (!isReady || !currentUser) {
    return <LoadingSpinner text="กำลังโหลดแดชบอร์ด..." />;
  }

  const isAssistantRole =
    currentUser.role === "manager_assistant" ||
    (currentUser.position?.includes("ผู้ช่วย") ?? false);

  const isExecutiveRole =
    !isAssistantRole &&
    (currentUser.role === "general_manager" ||
      currentUser.role === "committee" ||
      (currentUser.position?.includes("กรรมการ") ?? false) ||
      (currentUser.position?.includes("ผู้จัดการทั่วไป") ?? false));

  if (isExecutiveRole) {
    return (
      <ExecutiveDashboard
        user={currentUser}
        onLogout={() => logout("/")}
      />
    );
  }

  return (
    <ManagerDashboard
      user={currentUser}
      onLogout={() => logout("/")}
      activeSession={activeSession}
      onStartChecklist={selectShift}
      onUpdateSession={updateSession}
      onEndShift={endShift}
      onOpenChecklistPage={() => navigate("/checklist", "กำลังเปิดรายการเช็คลิสต์...")}
    />
  );
}
