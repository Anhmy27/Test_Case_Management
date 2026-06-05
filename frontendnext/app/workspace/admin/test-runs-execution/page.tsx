import { Suspense } from "react";
import WorkspaceExecutionRoute from "@/components/workspaceScreens/WorkspaceExecutionRoute";
import { WorkspaceContentSkeleton } from "@/components/workspaceScreens/shared";

export default function AdminTestRunsExecutionPage() {
  return (
    <Suspense fallback={<WorkspaceContentSkeleton />}>
      <WorkspaceExecutionRoute role="admin" />
    </Suspense>
  );
}
