"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShiftSelectPage } from "../../components/staff/ShiftSelectPage";
import { useApp } from "../../context/AppContext";
import { useLoading } from "../../context/LoadingContext";
import { LoadingSpinner } from "../loading";

export default function ShiftRoutePage() {
  const router = useRouter();
  const { currentUser, sessions, isReady, selectShift, logout } = useApp();
  const { navigate } = useLoading();

  useEffect(() => {
    if (!isReady) return;
    if (!currentUser) {
      router.replace("/");
      return;
    }
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

    if (currentUser.role === "employee" && !currentUser.position) {
      router.replace("/position");
    }
  }, [currentUser, isReady, router]);

  if (!isReady || !currentUser || (currentUser.role === "employee" && !currentUser.position)) {
    return <LoadingSpinner text="กำลังเตรียมข้อมูลกะการทำงาน..." />;
  }

  return (
    <ShiftSelectPage
      user={currentUser}
      sessions={sessions}
      onSelect={selectShift}
      onBack={() => navigate("/position", "กำลังเตรียมข้อมูลตำแหน่ง...")}
      onLogout={logout}
    />
  );
}
