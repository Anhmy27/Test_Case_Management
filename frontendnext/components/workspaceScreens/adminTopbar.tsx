"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ReactNode } from "react";
import { TOPBAR_INPUT_CLS } from "@/components/workspaceScreens/shared";
import { getId } from "@/lib/api";

type RecordAny = Record<string, any>;

type AdminProjectScopeSelectProps = {
  projects: RecordAny[];
  selectedProjectId: string;
  onChange: (projectId: string) => void;
  className?: string;
};

export function AdminProjectScopeSelect({
  projects,
  selectedProjectId,
  onChange,
  className = "",
}: AdminProjectScopeSelectProps) {
  return (
    <select
      value={selectedProjectId}
      onChange={(event) => onChange(event.target.value)}
      className={`min-w-[148px] ${TOPBAR_INPUT_CLS} ${className}`.trim()}
      aria-label="Project scope"
    >
      <option value="">All projects</option>
      {projects.map((project) => {
        const projectId = getId(project);
        return (
          <option key={projectId || project.code || project.name} value={projectId}>
            {project.name}
          </option>
        );
      })}
    </select>
  );
}

export function composeAdminTopbar(content: ReactNode, scopeSelect: ReactNode) {
  return (
    <div className="flex w-full flex-wrap items-center gap-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">{content}</div>
      <div className="ml-auto shrink-0">{scopeSelect}</div>
    </div>
  );
}
