"use client";

import TestCaseManagementApp from "@/components/TestCaseManagementApp";
import AdminTestCasesDetailScreen from "@/components/workspaceScreens/AdminTestCasesDetailScreen";

export default function AdminTestCasesDetailPage() {
  return (
    <TestCaseManagementApp
      screenRenderer={(workspace) => (
        <AdminTestCasesDetailScreen
          selectedProjectId={workspace.selectedProjectId}
          detailGroupId={workspace.detailGroupId}
          setDetailGroupId={workspace.setDetailGroupId}
          scopedGroups={workspace.scopedGroups}
          detailLoading={workspace.detailLoading}
          detailRows={workspace.detailRows}
          matchesSearch={workspace.matchesSearch}
        />
      )}
    />
  );
}