"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../../../context/AppContext";
import { LoadingSpinner } from "../../loading";
import { BranchOperationsPage } from "../../../components/manager/BranchOperationsPage";

export default function ManagerBranchesRoutePage() {
  const router = useRouter();
  const { currentUser, isReady, logout } = useApp();

  useEffect(() => {
    if (!isReady) return;
    if (!currentUser) {
      router.replace("/");
      return;
    }
    // Disallow regular employees; allow manager, manager_assistant, general_manager, committee, admin
    if (currentUser.role === "employee") {
      router.replace("/checklist");
    }
  }, [currentUser, isReady, router]);

  if (!isReady || !currentUser) {
    return <LoadingSpinner text="กำลังโหลดรายงานภาพรวมสาขา..." />;
  }

  return (
    <BranchOperationsPage
      currentUser={currentUser}
      onLogout={() => logout("/")}
    />
  );
}
