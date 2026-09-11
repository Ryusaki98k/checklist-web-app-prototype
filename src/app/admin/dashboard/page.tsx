"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ManagerDashboard } from "../../../components/admin/ManagerDashboard";
import { useApp } from "../../../context/AppContext";

export default function AdminDashboardPage() {
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
      router.replace("/admin");
      return;
    }
    if (currentUser.role !== "manager") {
      router.replace("/");
    }
  }, [currentUser, isReady, router]);

  if (!isReady || !currentUser || currentUser.role !== "manager") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/70">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-900 border-t-transparent" />
      </div>
    );
  }

  return (
    <ManagerDashboard
      user={currentUser}
      onLogout={logout}
      activeSession={activeSession}
      onStartChecklist={selectShift}
      onUpdateSession={updateSession}
      onEndShift={endShift}
      onOpenChecklistPage={() => router.push("/checklist")}
    />
  );
}
