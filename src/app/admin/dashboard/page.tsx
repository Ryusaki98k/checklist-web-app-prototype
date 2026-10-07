"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminDashboardView } from "../../../components/admin/AdminDashboardView";
import { useApp } from "../../../context/AppContext";
import { LoadingSpinner } from "../../loading";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { currentUser, isReady, logout } = useApp();

  useEffect(() => {
    if (!isReady) return;
    if (currentUser?.role === "employee") {
      router.replace("/");
    } else if (currentUser && (currentUser.role === "committee" || currentUser.role === "general_manager")) {
      router.replace("/manager/dashboard");
    }
  }, [currentUser, isReady, router]);

  if (!isReady) {
    return <LoadingSpinner text="กำลังโหลดระบบดูแลส่วนกลาง..." />;
  }

  const activeUser = currentUser || {
    id: "preview-admin-user",
    name: "คุณสมเกียรติ บริหารกิจ",
    username: "admin",
    role: "admin" as const,
    position: "ผู้ดูแลระบบส่วนกลาง",
  };

  return (
    <AdminDashboardView
      user={activeUser}
      onLogout={logout}
    />
  );
}
