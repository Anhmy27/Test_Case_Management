"use client";

import TestCaseManagementApp from "@/components/TestCaseManagementApp";
import AdminTestPlansScreen from "@/components/workspaceScreens/AdminTestPlansScreen";

export default function AdminTestPlansPage() {
  return (
    <TestCaseManagementApp
      screenRenderer={(workspace) => (
        <AdminTestPlansScreen
          planForm={workspace.planForm}
          setPlanForm={workspace.setPlanForm}
          createPlan={workspace.createPlan}
          scopedProjects={workspace.scopedProjects}
          scopedVersions={workspace.scopedVersions}
          planProjectGroups={workspace.planProjectGroups}
          planProjectCases={workspace.planProjectCases}
          selectedPlanGroupIds={workspace.selectedPlanGroupIds}
          selectedPlanCaseIds={workspace.selectedPlanCaseIds}
          selectedPlanGroups={workspace.selectedPlanGroups}
          selectedPlanCasesByGroup={workspace.selectedPlanCasesByGroup}
          togglePlanGroup={workspace.togglePlanGroup}
          togglePlanCase={workspace.togglePlanCase}
          users={workspace.users}
          currentUser={workspace.currentUser}
          selectedPlanId={workspace.selectedPlanId}
          selectPlanForAssignment={workspace.selectPlanForAssignment}
          assignDraft={workspace.assignDraft}
          setAssignDraft={workspace.setAssignDraft}
          saveAssignments={workspace.saveAssignments}
          scopedPlans={workspace.scopedPlans}
          editingPlanId={workspace.editingPlanId}
          editingExecutionMode={workspace.editingExecutionMode}
          setEditingPlanId={workspace.setEditingPlanId}
          setEditingExecutionMode={workspace.setEditingExecutionMode}
          updatePlanExecutionMode={workspace.updatePlanExecutionMode}
          userName={workspace.userName}
          getId={workspace.getId}
          matchesSearch={workspace.matchesSearch}
        />
      )}
    />
  );
}