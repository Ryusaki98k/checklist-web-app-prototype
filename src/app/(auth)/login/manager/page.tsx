"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ManagerAuthPage } from "../../../../components/auth/ManagerAuthPage";
import { useApp } from "../../../../context/AppContext";

export default function ManagerLoginPage() {
    const router = useRouter();
    const { currentUser, isReady, login } = useApp();

    useEffect(() => {
        if (!isReady) return;
        if (currentUser) {
            const role = currentUser.activeRole || currentUser.role;
            if (role === "manager" || role === "manager_assistant") {
                if (!currentUser.branchId || !currentUser.branchName) {
                    router.replace("/awaiting-assignment");
                } else {
                    router.replace("/manager/dashboard");
                }
            } else if (role === "committee" || role === "general_manager") {
                router.replace("/manager/dashboard");
            } else if (role === "admin") {
                router.replace("/admin/dashboard");
            }
        }
    }, [currentUser, isReady, router]);

    return <ManagerAuthPage onLogin={login} />;
}
