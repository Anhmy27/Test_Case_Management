"use client";

import TestCaseManagementApp from "@/components/TestCaseManagementApp";
import AdminVersionsScreen from "@/components/workspaceScreens/AdminVersionsScreen";

export default function AdminVersionsPage() {
  return (
    <TestCaseManagementApp
      screenRenderer={(workspace) => (
        <AdminVersionsScreen
          versionForm={workspace.versionForm}
          setVersionForm={workspace.setVersionForm}
          createVersion={workspace.createVersion}
          scopedProjects={workspace.scopedProjects}
          versions={workspace.versions}
          projects={workspace.projects}
          matchesSearch={workspace.matchesSearch}
          getId={workspace.getId}
        />
      )}
    />
  );
}