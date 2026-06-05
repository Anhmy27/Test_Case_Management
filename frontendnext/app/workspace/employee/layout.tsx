"use client";

import { EmployeeWorkspaceShell } from "@/components/workspaceScreens/WorkspaceShell";

export default function EmployeeWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <EmployeeWorkspaceShell>{children}</EmployeeWorkspaceShell>;
}
