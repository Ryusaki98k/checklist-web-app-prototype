"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChecklistPage } from "../../components/staff/ChecklistPage";
import { useApp } from "../../context/AppContext";
import { useLoading } from "../../context/LoadingContext";
import { LoadingSpinner } from "../loading";
import { getActiveSession } from "../../data/storage";

export default function ChecklistRoutePage() {
  const router = useRouter();
  const { currentUser, activeSession, selectedShift, isReady, updateSession, endShift, setActiveSession } = useApp();
  const { navigate } = useLoading();

  const redirectedRef = useRef(false);

  useEffect(() => {
    if (!isReady) return;
    if (!currentUser) {
      if (!redirectedRef.current) {
        redirectedRef.current = true;
        router.replace("/");
      }
      return;
    }
    const isExecutiveOrCommittee =
      currentUser.role === "general_manager" ||
      currentUser.role === "committee" ||
      (currentUser.position?.includes("ผู้จัดการทั่วไป") ?? false) ||
      (currentUser.position?.includes("กรรมการ") ?? false);

    if (isExecutiveOrCommittee) {
      if (!redirectedRef.current) {
        redirectedRef.current = true;
        router.replace("/manager/dashboard");
      }
      return;
    }
    if (!activeSession) {
      const stored = getActiveSession();
      if (stored) {
        setActiveSession(stored);
      } else if (!redirectedRef.current) {
        redirectedRef.current = true;
        router.replace(currentUser.role === "manager" ? "/admin/dashboard" : "/shift");
      }
    }
  }, [currentUser, activeSession, isReady, router, setActiveSession]);

  if (!isReady || !currentUser || !activeSession) {
    return <LoadingSpinner text="กำลังนำท่านไปยังหน้าถัดไป..." subtitle="กรุณารอสักครู่ ระบบกำลังประมวลผลข้อมูล" />;
  }

  return (
    <ChecklistPage
      session={activeSession}
      selectedShift={selectedShift}
      onUpdate={updateSession}
      onEndShift={endShift}
      onOpenDashboard={
        currentUser.role === "manager"
          ? () => navigate("/admin/dashboard", "กำลังเปิดแดชบอร์ด...")
          : undefined
      }
      onExit={() => navigate("/shift", "กำลังกลับสู่หน้าเลือกกะ...")}
    />
  );
}
