"use client";

import TestCaseManagementApp from "@/components/TestCaseManagementApp";
import AdminGroupsScreen from "@/components/workspaceScreens/AdminGroupsScreen";

export default function AdminGroupsPage() {
  return (
    <TestCaseManagementApp
      screenRenderer={(workspace) => (
        <AdminGroupsScreen
          groupForm={workspace.groupForm}
          setGroupForm={workspace.setGroupForm}
          createGroup={workspace.createGroup}
          scopedProjects={workspace.scopedProjects}
          groups={workspace.groups}
          matchesSearch={workspace.matchesSearch}
        />
      )}
    />
  );
}