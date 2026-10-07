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
    if (!currentUser) {
      router.replace("/");
      return;
    }
    if (currentUser.role === "employee") {
      router.replace("/");
    } else if (currentUser.role === "committee" || currentUser.role === "general_manager") {
      router.replace("/manager/dashboard");
    } else if (currentUser.role !== "admin") {
      router.replace("/manager/dashboard");
    }
  }, [currentUser, isReady, router]);

  if (!isReady || !currentUser) {
    return <LoadingSpinner text="กำลังโหลดระบบดูแลส่วนกลาง..." />;
  }

  return (
    <AdminDashboardView
      user={currentUser}
      onLogout={logout}
    />
  );
}
