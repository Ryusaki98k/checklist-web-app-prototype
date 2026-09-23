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
      const requiresBranch = currentUser.role === "employee" || currentUser.role === "manager_assistant" || currentUser.role === "manager";
      if (requiresBranch && !currentUser.branchName) {
        router.replace("/awaiting-assignment");
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
