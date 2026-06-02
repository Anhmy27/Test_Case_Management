"use client";

import { Suspense } from "react";
import WorkspaceExecutionRoute from "@/components/workspaceScreens/WorkspaceExecutionRoute";

export default function EmployeeExecutionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
          Loading execution workspace...
        </div>
      }
    >
      <WorkspaceExecutionRoute role="employee" />
    </Suspense>
  );
}