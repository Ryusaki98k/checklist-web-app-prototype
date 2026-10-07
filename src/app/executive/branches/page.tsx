"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "../../loading";

export default function ExecutiveBranchesRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/manager/branches");
  }, [router]);

  return <LoadingSpinner text="กำลังนำท่านไปยังหน้ารายงานภาพรวมสาขา..." />;
}
