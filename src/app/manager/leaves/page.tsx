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
    if (!currentUser) {
      router.replace("/");
      return;
    }
    const hasNoBranch =
      (!currentUser.branchId || !currentUser.branchName) &&
      !currentUser.isAdmin &&
      currentUser.executiveType === "none";
    if (hasNoBranch) {
      router.replace("/awaiting-assignment");
      return;
    }
    // Disallow regular employees
    if (currentUser.role === "employee") {
      router.replace("/checklist");
      return;
    }
    // Disallow executive and committee from managing leaves (they can view staff-status instead)
    const isExecutiveOrCommittee =
      !currentUser.isAdmin &&
      (currentUser.role === "general_manager" ||
        currentUser.role === "committee" ||
        currentUser.executiveType === "executive" ||
        currentUser.executiveType === "committee");
    if (isExecutiveOrCommittee) {
      router.replace("/manager/staff-status");
      return;
    }
  }, [currentUser, isReady, router]);

  if (!isReady || !currentUser) {
    return <LoadingSpinner text="กำลังโหลดระบบจัดการการลาพนักงาน..." />;
  }

  return <BranchStaffUnifiedHub currentUser={currentUser} initialTab="leaves" />;
}
