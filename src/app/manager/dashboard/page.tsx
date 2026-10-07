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

  useEffect(() => {
    if (!isReady) return;
    if (currentUser?.role === "admin") {
      router.replace("/admin/dashboard");
    }
  }, [currentUser, isReady, router]);

  if (!isReady) {
    return <LoadingSpinner text="กำลังโหลดแดชบอร์ด..." />;
  }

  if (isExecutiveRole) {
    return (
      <ExecutiveDashboard
        user={activeUser}
        onLogout={() => logout("/")}
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
    />
  );
}
