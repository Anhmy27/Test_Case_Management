"use client";

import TestCaseManagementApp from "@/components/TestCaseManagementApp";
import AdminUsersScreen from "@/components/workspaceScreens/AdminUsersScreen";

export default function AdminUsersPage() {
  return (
    <TestCaseManagementApp
      screenRenderer={(workspace) => (
        <AdminUsersScreen
          newUserForm={workspace.newUserForm}
          setNewUserForm={workspace.setNewUserForm}
          createUser={workspace.createUser}
          users={workspace.users}
          matchesSearch={workspace.matchesSearch}
        />
      )}
    />
  );
}