"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ExecutiveAuthPage } from "../../../../components/auth/ExecutiveAuthPage";
import { useApp } from "../../../../context/AppContext";

export default function ExecutiveLoginPage() {
    const router = useRouter();
    const { currentUser, isReady, login } = useApp();

    useEffect(() => {
        if (!isReady) return;
        if (currentUser) {
            const role = currentUser.activeRole || currentUser.role;
            if (role === "general_manager" || role === "committee") {
                router.replace("/manager/dashboard");
            } else if (role === "admin") {
                router.replace("/admin/dashboard");
            }
        }
    }, [currentUser, isReady, router]);

    return <ExecutiveAuthPage onLogin={login} />;
}
