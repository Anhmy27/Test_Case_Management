"use client";

import TestCaseManagementApp from "@/components/TestCaseManagementApp";
import AdminDashboardScreen from "@/components/workspaceScreens/AdminDashboardScreen";

export default function AdminDashboardPage() {
  return (
    <TestCaseManagementApp
      screenRenderer={(workspace) => (
        <AdminDashboardScreen
          isGlobalScope={workspace.isGlobalScope}
          totalProjects={workspace.totalProjects}
          totalPlans={workspace.totalPlans}
          totalCases={workspace.totalCases}
          runningRunsCount={workspace.runningRunsCount}
          totalUsers={workspace.totalUsers}
          dashboardSummary={workspace.dashboardSummary}
          dashboardData={workspace.dashboardData}
          projectOverview={workspace.projectOverview}
          projects={workspace.projects}
          matchesSearch={workspace.matchesSearch}
          userName={workspace.userName}
          getId={workspace.getId}
        />
      )}
    />
  );
}