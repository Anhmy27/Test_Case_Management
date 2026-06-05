"use client";

import { AdminWorkspaceShell } from "@/components/workspaceScreens/WorkspaceShell";

export default function AdminWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <AdminWorkspaceShell>{children}</AdminWorkspaceShell>;
}
