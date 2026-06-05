"use client";

import { Suspense } from "react";
import AdminTestPlansRoute from "@/components/workspaceScreens/AdminTestPlansRoute";
import { WorkspaceContentSkeleton } from "@/components/workspaceScreens/shared";

export default function AdminTestPlansPage() {
  return (
    <Suspense fallback={<WorkspaceContentSkeleton />}>
      <AdminTestPlansRoute />
    </Suspense>
  );
}
