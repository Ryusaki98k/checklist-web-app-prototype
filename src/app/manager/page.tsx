"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../../context/AppContext";

export default function ManagerLoginPage() {
  const router = useRouter();
  const { currentUser, isReady } = useApp();

  useEffect(() => {
    if (!isReady) return;
    if (currentUser && currentUser.role !== "employee") {
      router.replace("/manager/dashboard");
    } else {
      router.replace("/");
    }
  }, [currentUser, isReady, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50/70">
      <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-900 border-t-transparent" />
    </div>
  );
}
