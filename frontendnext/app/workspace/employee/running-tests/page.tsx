"use client";

import TestCaseManagementApp from "@/components/TestCaseManagementApp";
import EmployeeRunningTestsScreen from "@/components/workspaceScreens/EmployeeRunningTestsScreen";

export default function EmployeeRunningTestsPage() {
  return (
    <TestCaseManagementApp
      screenRenderer={(workspace) => (
        <EmployeeRunningTestsScreen
          myScopedRuns={workspace.myScopedRuns}
          matchesSearch={workspace.matchesSearch}
          setSelectedRunId={workspace.setSelectedRunId}
          loadMyItems={workspace.loadMyItems}
          setActiveTab={workspace.setActiveTab}
          userName={workspace.userName}
        />
      )}
    />
  );
}