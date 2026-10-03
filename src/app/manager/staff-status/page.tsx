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
    // Allow manager, manager_assistant, general_manager, committee, and admin
    if (!currentUser || currentUser.role === "employee") {
      router.replace("/");
    }
  }, [currentUser, isReady, router]);

  if (!isReady || !currentUser) {
    return <LoadingSpinner text="กำลังโหลดข้อมูลสถานพนักงาน..." />;
  }

  return <BranchStaffUnifiedHub currentUser={currentUser} initialTab="presence" />;
}
