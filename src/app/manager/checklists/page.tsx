"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../../../context/AppContext";
import { LoadingSpinner } from "../../loading";
import { ChecklistManagementHub } from "../../../components/manager/checklists/ChecklistManagementHub";

export default function ManagerChecklistsPage() {
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
  }, [currentUser, isReady, router]);

  if (!isReady || !currentUser) {
    return <LoadingSpinner text="กำลังโหลดระบบจัดการเช็คลิสต์และภารกิจ..." />;
  }

  return <ChecklistManagementHub currentUser={currentUser} />;
}
