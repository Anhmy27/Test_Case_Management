"use client";

import { Suspense } from "react";
import AdminTestCasesHistoryRoute from "@/components/workspaceScreens/AdminTestCasesHistoryRoute";
import { WorkspaceContentSkeleton } from "@/components/workspaceScreens/shared";

export default function AdminTestCasesHistoryPage() {
  return (
    <Suspense fallback={<WorkspaceContentSkeleton />}>
      <AdminTestCasesHistoryRoute />
    </Suspense>
  );
}
