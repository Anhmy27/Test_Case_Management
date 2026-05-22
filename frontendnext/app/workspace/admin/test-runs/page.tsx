"use client";

import TestCaseManagementApp from "@/components/TestCaseManagementApp";
import AdminTestRunsScreen from "@/components/workspaceScreens/AdminTestRunsScreen";

export default function AdminTestRunsPage() {
  return (
    <TestCaseManagementApp
      screenRenderer={(workspace) => (
        <AdminTestRunsScreen
          runForm={workspace.runForm}
          setRunForm={workspace.setRunForm}
          startRun={workspace.startRun}
          scopedPlans={workspace.scopedPlans}
          selectedRunPlanIsAutomation={workspace.selectedRunPlanIsAutomation}
          adminRuns={workspace.adminRuns}
          matchesSearch={workspace.matchesSearch}
          userName={workspace.userName}
          currentUserId={workspace.currentUserId}
          setSelectedRunId={workspace.setSelectedRunId}
          loadMyItems={workspace.loadMyItems}
          setActiveTab={workspace.setActiveTab}
        />
      )}
    />
  );
}