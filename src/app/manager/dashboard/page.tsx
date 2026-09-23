"use client";
import { useEffect } from "react";

import { useRouter } from "next/navigation";
import { ExecutiveDashboard } from "../../../components/manager/ExecutiveDashboard";
import { useApp } from "../../../context/AppContext";
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
  useEffect(() => {
    if (!isReady) return;
    if (currentUser?.role === "admin") {
      router.replace("/admin/dashboard");
    }
  }, [currentUser, isReady, router]);

  if (!isReady) {
    return <LoadingSpinner text="กำลังโหลดแดชบอร์ดผู้บริหาร..." />;
  }

  // Use current logged in user or sample executive preview user
  const activeUser = currentUser || {
    id: "preview-exec-user",
    name: "คุณวิภาดา สุขเจริญ",
    email: "manager@factory.com",
    role: "manager" as const,
    position: "ผู้จัดการร้าน",
  };

  return (
    <ExecutiveDashboard
      user={activeUser}
      onLogout={() => logout("/")}
      activeSession={activeSession}
      onStartChecklist={selectShift}
      onUpdateSession={updateSession}
      onEndShift={endShift}
      onOpenChecklistPage={() => router.push("/checklist")}
    />
  );
}
