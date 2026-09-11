"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PositionSelectPage } from "../../components/staff/PositionSelectPage";
import { useApp } from "../../context/AppContext";

export default function PositionRoutePage() {
  const router = useRouter();
  const { currentUser, selectedShift, isReady, selectPosition, logout } = useApp();

  useEffect(() => {
    if (!isReady) return;
    if (!currentUser) {
      router.replace("/");
      return;
    }
    if (!selectedShift) {
      router.replace("/shift");
    }
  }, [currentUser, selectedShift, isReady, router]);

  if (!isReady || !currentUser || !selectedShift) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/70">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-900 border-t-transparent" />
      </div>
    );
  }

  return (
    <PositionSelectPage
      user={currentUser}
      shift={selectedShift}
      onSelectPosition={selectPosition}
      onBack={() => router.push("/shift")}
      onLogout={logout}
    />
  );
}
