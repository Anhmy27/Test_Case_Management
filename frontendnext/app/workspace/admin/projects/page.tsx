"use client";

import TestCaseManagementApp from "@/components/TestCaseManagementApp";
import AdminProjectsScreen from "@/components/workspaceScreens/AdminProjectsScreen";

export default function AdminProjectsPage() {
  return (
    <TestCaseManagementApp
      screenRenderer={(workspace) => (
        <AdminProjectsScreen
          editingProjectId={workspace.editingProjectId}
          projectForm={workspace.projectForm}
          setProjectForm={workspace.setProjectForm}
          saveProject={workspace.saveProject}
          cancelProjectEdit={workspace.cancelProjectEdit}
          projects={workspace.projects}
          matchesSearch={workspace.matchesSearch}
          startProjectEdit={workspace.startProjectEdit}
          deleteProject={workspace.deleteProject}
        />
      )}
    />
  );
}