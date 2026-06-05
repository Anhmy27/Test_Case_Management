"use client";

import { Suspense } from "react";
import WorkspaceExecutionRoute from "@/components/workspaceScreens/WorkspaceExecutionRoute";
import { WorkspaceContentSkeleton } from "@/components/workspaceScreens/shared";

export default function EmployeeExecutionPage() {
  return (
    <Suspense fallback={<WorkspaceContentSkeleton />}>
      <WorkspaceExecutionRoute role="employee" />
    </Suspense>
  );
}
