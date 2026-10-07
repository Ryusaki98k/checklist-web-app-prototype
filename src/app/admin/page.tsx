"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminAuthPage } from "../../components/admin/AdminAuthPage";
import { useApp } from "../../context/AppContext";

export default function AdminLoginPage() {
  const router = useRouter();
  const { currentUser, isReady, login } = useApp();

  useEffect(() => {
    if (!isReady) return;
    if (currentUser?.role === "admin") {
      router.replace("/admin/dashboard");
    } else if (currentUser && (currentUser.role === "committee" || currentUser.role === "general_manager")) {
      router.replace("/manager/dashboard");
    }
  }, [currentUser, isReady, router]);

  return <AdminAuthPage onLogin={login} />;
}
