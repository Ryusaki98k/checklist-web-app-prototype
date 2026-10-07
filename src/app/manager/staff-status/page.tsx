"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../../../context/AppContext";
import { LoadingSpinner } from "../../loading";
import { BranchStaffUnifiedHub } from "../../../components/manager/BranchStaffUnifiedHub";

export default function ManagerStaffStatusPage() {
  const router = useRouter();
  const { currentUser, isReady } = useApp();

  useEffect(() => {
    if (!isReady) return;
    if (!currentUser) {
      router.replace("/");
      return;
    }
    // Allow manager, manager_assistant, general_manager, committee, and admin
    if (currentUser.role === "employee") {
      router.replace("/checklist");
    }
  }, [currentUser, isReady, router]);

  if (!isReady || !currentUser) {
    return <LoadingSpinner text="กำลังโหลดข้อมูลสถานะพนักงาน..." />;
  }

  return <BranchStaffUnifiedHub currentUser={currentUser} initialTab="presence" />;
}
