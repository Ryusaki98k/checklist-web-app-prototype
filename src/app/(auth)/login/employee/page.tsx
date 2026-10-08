"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { EmployeeAuthPage } from "../../../../components/auth/EmployeeAuthPage";
import { useApp } from "../../../../context/AppContext";

export default function EmployeeLoginPage() {
    const router = useRouter();
    const { currentUser, isReady, login } = useApp();

    useEffect(() => {
        if (!isReady) return;
        if (currentUser) {
            const role = currentUser.activeRole || currentUser.role;
            if (role === "employee") {
                if (!currentUser.branchId || !currentUser.branchName) {
                    router.replace("/awaiting-assignment");
                } else {
                    router.replace("/position");
                }
            }
        }
    }, [currentUser, isReady, router]);

    return <EmployeeAuthPage onLogin={login} />;
}
