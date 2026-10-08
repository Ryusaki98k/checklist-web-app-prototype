"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PositionSelectPage } from "../../components/staff/PositionSelectPage";
import { useApp } from "../../context/AppContext";
import { LoadingSpinner } from "../loading";

export default function PositionRoutePage() {
  const router = useRouter();
  const { currentUser, isReady, selectPosition, logout } = useApp();

  useEffect(() => {
    if (!isReady) return;
    if (!currentUser) {
      router.replace("/");
    } else {
      const isExecutiveOrCommittee =
        currentUser.role === "general_manager" ||
        currentUser.role === "committee" ||
        (currentUser.position?.includes("ผู้จัดการทั่วไป") ?? false) ||
        (currentUser.position?.includes("กรรมการ") ?? false);

      if (isExecutiveOrCommittee) {
        router.replace("/manager/dashboard");
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
    }
  }, [currentUser, isReady, router]);

  if (!isReady || !currentUser) {
    return <LoadingSpinner text="กำลังเตรียมข้อมูลตำแหน่ง..." />;
  }

  return (
    <PositionSelectPage
      user={currentUser}
      onSelectPosition={selectPosition}
      onLogout={logout}
    />
  );
}
