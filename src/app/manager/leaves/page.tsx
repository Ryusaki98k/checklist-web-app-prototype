"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../../../context/AppContext";
import { LoadingSpinner } from "../../loading";
import { BranchStaffUnifiedHub } from "../../../components/manager/BranchStaffUnifiedHub";

export default function ManagerLeavesPage() {
  const router = useRouter();
  const { currentUser, isReady } = useApp();

  useEffect(() => {
    if (!isReady) return;
    // Disallow regular employees and logged-out users; allow manager,
    // manager_assistant, general_manager, committee, admin
    if (!currentUser || currentUser.role === "employee") {
      router.replace("/");
    }
  }, [currentUser, isReady, router]);

  if (!isReady || !currentUser) {
    return <LoadingSpinner text="กำลังโหลดระบบจัดการการลาพนักงาน..." />;
  }

  return <BranchStaffUnifiedHub currentUser={currentUser} initialTab="leaves" />;
}
