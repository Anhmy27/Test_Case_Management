"use client";

import TestCaseManagementApp from "@/components/TestCaseManagementApp";
import EmployeeHistoryScreen from "@/components/workspaceScreens/EmployeeHistoryScreen";

export default function EmployeeHistoryPage() {
  return (
    <TestCaseManagementApp
      screenRenderer={(workspace) => (
        <EmployeeHistoryScreen
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