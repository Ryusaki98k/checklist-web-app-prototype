"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShiftSelectPage } from "../../components/staff/ShiftSelectPage";
import { useApp } from "../../context/AppContext";
import { LoadingSpinner } from "../loading";

export default function ShiftRoutePage() {
  const router = useRouter();
  const { currentUser, sessions, isReady, selectShift, logout } = useApp();

  useEffect(() => {
    if (!isReady) return;
    if (!currentUser) {
      router.replace("/");
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
      onBack={() => router.push("/position")}
      onLogout={logout}
    />
  );
}
