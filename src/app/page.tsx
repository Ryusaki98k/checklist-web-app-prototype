"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { StaffAuthPage } from "../components/staff/StaffAuthPage";
import { useApp } from "../context/AppContext";

export default function HomePage() {
  const router = useRouter();
  const { currentUser, isReady, login } = useApp();

  useEffect(() => {
    if (!isReady) return;
    if (currentUser) {
      if (currentUser.role === "manager") {
        router.replace("/admin/dashboard");
      } else {
        router.replace("/shift");
      }
    }
  }, [currentUser, isReady, router]);

  return <StaffAuthPage onLogin={login} />;
}
