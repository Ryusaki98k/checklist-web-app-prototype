"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShiftSelectPage } from "../../components/staff/ShiftSelectPage";
import { useApp } from "../../context/AppContext";

export default function ShiftRoutePage() {
  const router = useRouter();
  const { currentUser, isReady, selectShift, logout } = useApp();

  useEffect(() => {
    if (!isReady) return;
    if (!currentUser) {
      router.replace("/");
    }
  }, [currentUser, isReady, router]);

  if (!isReady || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/70">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-900 border-t-transparent" />
      </div>
    );
  }

  return (
    <ShiftSelectPage
      user={currentUser}
      onSelect={selectShift}
      onLogout={logout}
    />
  );
}
