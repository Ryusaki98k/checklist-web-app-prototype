"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../../context/AppContext";

export default function MainRedirectPage() {
  const router = useRouter();
  const { currentUser, isReady } = useApp();

  useEffect(() => {
    if (!isReady) return;
    if (!currentUser) {
      router.replace("/");
      return;
    }

    if (currentUser.role === "admin") {
      router.replace("/admin/dashboard");
    } else if (currentUser.role === "committee" || currentUser.role === "general_manager") {
      router.replace("/manager/dashboard");
    } else if (!currentUser.branchId || !currentUser.branchName) {
      router.replace("/awaiting-assignment");
    } else if (currentUser.role === "manager" || currentUser.role === "manager_assistant") {
      router.replace("/manager/dashboard");
    } else {
      router.replace("/position");
    }
  }, [currentUser, isReady, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] text-[var(--color-text)]">
      <div className="h-8 w-8 animate-spin rounded-full border-3 border-amber-500 border-t-transparent" />
    </div>
  );
}
