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
    if (!currentUser) {
      router.replace("/");
    } else if (currentUser.role === "admin") {
      router.replace("/admin/dashboard");
    }
  }, [currentUser, isReady, router]);

  if (!isReady || !currentUser) {
    return <LoadingSpinner text="กำลังโหลดแดชอบอร์ดผู้บริหาร..." />;
  }

  return (
    <ExecutiveDashboard
      user={currentUser}
      onLogout={() => logout("/")}
      activeSession={activeSession}
      onStartChecklist={selectShift}
      onUpdateSession={updateSession}
      onEndShift={endShift}
      onOpenChecklistPage={() => router.push("/checklist")}
    />
  );
}
