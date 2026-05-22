"use client";

import TestCaseManagementApp from "@/components/TestCaseManagementApp";
import EmployeeMyTestPlansScreen from "@/components/workspaceScreens/EmployeeMyTestPlansScreen";

export default function EmployeeMyTestPlansPage() {
  return (
    <TestCaseManagementApp
      screenRenderer={(workspace) => (
        <EmployeeMyTestPlansScreen
          scopedPlans={workspace.scopedPlans}
          matchesSearch={workspace.matchesSearch}
          setRunForm={workspace.setRunForm}
          setActiveTab={workspace.setActiveTab}
        />
      )}
    />
  );
}