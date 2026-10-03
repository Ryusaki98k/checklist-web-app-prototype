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
    if (!currentUser || currentUser.role === "employee") {
      router.replace("/");
    }
  }, [currentUser, isReady, router]);

  if (!isReady || !currentUser) {
    return <LoadingSpinner text="กำลังโหลดระบบดูแลมส่วนกาง..." />;
  }

  return (
    <AdminDashboardView
      user={currentUser}
      onLogout={logout}
    />
  );
}
