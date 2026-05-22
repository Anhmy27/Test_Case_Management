"use client";

import TestCaseManagementApp from "@/components/TestCaseManagementApp";
import ExecutionScreen from "@/components/workspaceScreens/ExecutionScreen";

export default function EmployeeExecutionPage() {
  return (
    <TestCaseManagementApp
      screenRenderer={(workspace) => (
        <ExecutionScreen
          runForm={workspace.runForm}
          setRunForm={workspace.setRunForm}
          startRun={workspace.startRun}
          scopedPlans={workspace.scopedPlans}
          selectedRunPlanIsAutomation={workspace.selectedRunPlanIsAutomation}
          selectedRun={workspace.selectedRun}
          myItems={workspace.myItems}
          selectedItemId={workspace.selectedItemId}
          setSelectedItemId={workspace.setSelectedItemId}
          selectedItem={workspace.selectedItem}
          notes={workspace.notes}
          setNotes={workspace.setNotes}
          updateResult={workspace.updateResult}
          endRun={workspace.endRun}
          canEditSelectedRun={workspace.canEditSelectedRun}
        />
      )}
    />
  );
}