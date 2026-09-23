"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChecklistPage } from "../../components/staff/ChecklistPage";
import { useApp } from "../../context/AppContext";
import { LoadingSpinner } from "../loading";

export default function ChecklistRoutePage() {
  const router = useRouter();
  const { currentUser, activeSession, selectedShift, isReady, updateSession, endShift } = useApp();

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
    return <LoadingSpinner text="กำลังเตรียมรายการเช็คลิสต์..." />;
  }

  return (
    <ChecklistPage
      session={activeSession}
      selectedShift={selectedShift}
      onUpdate={updateSession}
      onEndShift={endShift}
      onOpenDashboard={
        currentUser.role === "manager"
          ? () => router.push("/admin/dashboard")
          : undefined
      }
      onExit={() => router.push("/shift")}
    />
  );
}
