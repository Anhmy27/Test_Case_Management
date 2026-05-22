"use client";

import TestCaseManagementApp from "@/components/TestCaseManagementApp";
import AdminTestCasesScreen from "@/components/workspaceScreens/AdminTestCasesScreen";

export default function AdminTestCasesPage() {
  return (
    <TestCaseManagementApp
      screenRenderer={(workspace) => (
        <AdminTestCasesScreen
          editingTestCaseId={workspace.editingTestCaseId}
          testCaseForm={workspace.testCaseForm}
          setTestCaseForm={workspace.setTestCaseForm}
          automationForm={workspace.automationForm}
          setAutomationForm={workspace.setAutomationForm}
          addTestCaseStep={workspace.addTestCaseStep}
          updateTestCaseStep={workspace.updateTestCaseStep}
          removeTestCaseStep={workspace.removeTestCaseStep}
          addAutomationStep={workspace.addAutomationStep}
          updateAutomationStep={workspace.updateAutomationStep}
          removeAutomationStep={workspace.removeAutomationStep}
          saveTestCase={workspace.saveTestCase}
          cancelTestCaseEdit={workspace.cancelTestCaseEdit}
          testCases={workspace.testCases}
          matchesSearch={workspace.matchesSearch}
          startTestCaseEdit={workspace.startTestCaseEdit}
          deleteTestCase={workspace.deleteTestCase}
          scopedProjects={workspace.scopedProjects}
          scopedGroups={workspace.scopedGroups}
          selectedProjectId={workspace.selectedProjectId}
          downloadTestCaseTemplate={workspace.downloadTestCaseTemplate}
          importTestCases={workspace.importTestCases}
          importInputRef={workspace.importInputRef}
        />
      )}
    />
  );
}