"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { User } from "../../types";
import { BranchStaffPresenceView } from "./BranchStaffPresenceView";
import { BranchLeaveManagementView } from "./BranchLeaveManagementView";
import { LoadingSpinner } from "../../app/loading";

interface BranchStaffUnifiedHubProps {
  currentUser: User;
  initialTab?: "presence" | "leaves";
}

function BranchStaffUnifiedHubContent({
  currentUser,
  initialTab = "presence",
}: BranchStaffUnifiedHubProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get("tab") as "presence" | "leaves" | null;
  const urlUserId = searchParams.get("userId") || undefined;

  const [internalTab, setInternalTab] = useState<"presence" | "leaves">(initialTab);
  const [internalUserId, setInternalUserId] = useState<string | undefined>(undefined);

  // Derive active tab and user: priority to URL query param, then fallback to internal state
  const activeTab: "presence" | "leaves" =
    tabFromUrl === "presence" || tabFromUrl === "leaves" ? tabFromUrl : internalTab;
  const selectedUserIdForLeave = urlUserId || internalUserId;

  const handleTabChange = (newTab: "presence" | "leaves") => {
    setInternalTab(newTab);
    setInternalUserId(undefined);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", newTab);
    if (newTab === "presence") {
      params.delete("userId");
    }
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", newUrl);
  };

  const handleSwitchToLeaves = (userId?: string) => {
    setInternalTab("leaves");
    setInternalUserId(userId);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", "leaves");
    if (userId) {
      params.set("userId", userId);
    }
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", newUrl);
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {activeTab === "presence" ? (
        <BranchStaffPresenceView
          currentUser={currentUser}
          currentTab="presence"
          onTabChange={handleTabChange}
          onSwitchToLeaves={handleSwitchToLeaves}
        />
      ) : (
        <BranchLeaveManagementView
          currentUser={currentUser}
          currentTab="leaves"
          onTabChange={handleTabChange}
          onBackToDashboard={() => router.push("/manager/dashboard")}
          defaultSelectedUserId={selectedUserIdForLeave}
        />
      )}
    </div>
  );
}

export function BranchStaffUnifiedHub(props: BranchStaffUnifiedHubProps) {
  return (
    <Suspense fallback={<LoadingSpinner text="กำลังโหลดข้อมูลพนักงานและการลา..." />}>
      <BranchStaffUnifiedHubContent {...props} />
    </Suspense>
  );
}
