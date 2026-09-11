"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChecklistPage } from "../../components/staff/ChecklistPage";
import { useApp } from "../../context/AppContext";

export default function ChecklistRoutePage() {
  const router = useRouter();
  const { currentUser, activeSession, isReady, updateSession, endShift } = useApp();

  useEffect(() => {
    if (!isReady) return;
    if (!currentUser) {
      router.replace("/");
      return;
    }
    if (!activeSession) {
      router.replace(currentUser.role === "manager" ? "/admin/dashboard" : "/shift");
    }
  }, [currentUser, activeSession, isReady, router]);

  if (!isReady || !currentUser || !activeSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/70">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-900 border-t-transparent" />
      </div>
    );
  }

  return (
    <ChecklistPage
      session={activeSession}
      onUpdate={updateSession}
      onEndShift={endShift}
      onOpenDashboard={
        currentUser.role === "manager"
          ? () => router.push("/admin/dashboard")
          : undefined
      }
    />
  );
}
