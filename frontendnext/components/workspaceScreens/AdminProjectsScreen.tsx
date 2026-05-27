"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Dispatch, SetStateAction } from "react";
import { ActionButton, DataTable, SectionCard } from "./shared";

type RecordAny = Record<string, any>;

type AdminProjectsScreenProps = {
  editingProjectId: string;
  projectForm: { name: string; code: string; pid: string; jiraProductKey: string; description: string };
  setProjectForm: Dispatch<SetStateAction<{ name: string; code: string; pid: string; jiraProductKey: string; description: string }>>;
  saveProject: (event: React.FormEvent) => Promise<void>;
  cancelProjectEdit: () => void;
  projects: RecordAny[];
  matchesSearch: (...values: Array<string | number | undefined | null>) => boolean;
  startProjectEdit: (project: RecordAny) => void;
  deleteProject: (projectId: string) => Promise<void>;
};

export default function AdminProjectsScreen({
  editingProjectId,
  projectForm,
  setProjectForm,
  saveProject,
  cancelProjectEdit,
  projects,
  matchesSearch,
  startProjectEdit,
  deleteProject,
}: AdminProjectsScreenProps) {
  return (
    <div className="workspace-stack">
      <SectionCard title={editingProjectId ? "Edit Project" : "Projects"} subtitle="Tao, sua, xoa project trong mot workspace rieng">
        <form className="workspace-form" onSubmit={saveProject}>
          <div className="workspace-form__grid">
            <label>
              <span>Name</span>
              <input
                value={projectForm.name}
                onChange={(e) =>
                  setProjectForm((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                required
              />
            </label>
            <label>
              <span>Code</span>
              <input
                value={projectForm.code}
                onChange={(e) =>
                  setProjectForm((prev) => ({
                    ...prev,
                    code: e.target.value,
                  }))
                }
                required
              />
            </label>
            <label>
              <span>Jira pid</span>
              <input
                value={projectForm.pid}
                onChange={(e) =>
                  setProjectForm((prev) => ({
                    ...prev,
                    pid: e.target.value,
                  }))
                }
                placeholder="11500"
              />
            </label>
            <label>
              <span>Jira Product Key</span>
              <input
                value={projectForm.jiraProductKey}
                onChange={(e) =>
                  setProjectForm((prev) => ({
                    ...prev,
                    jiraProductKey: e.target.value,
                  }))
                }
                placeholder="CED"
              />
            </label>
          </div>
          <label>
            <span>Description</span>
            <textarea
              rows={3}
              value={projectForm.description}
              onChange={(e) =>
                setProjectForm((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
            />
          </label>
          <div className="workspace-inline-actions">
            <ActionButton
              label={editingProjectId ? "Save project" : "Create project"}
              icon={editingProjectId ? "💾" : "＋"}
              variant="primary"
            />
            {editingProjectId && (
              <ActionButton label="Cancel" icon="↩" onClick={cancelProjectEdit} tooltip="Cancel editing" />
            )}
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Project List" subtitle="Card/table sach, riang">
        <DataTable
          columns={["Project", "Code", "Pid", "Jira Key", "Action"]}
          rows={projects
            .filter((project: RecordAny) => matchesSearch(project.name, project.code))
            .map((project: RecordAny) => (
              <>
                <div>{project.name}</div>
                <div>{project.code}</div>
                <div>{project.pid || "-"}</div>
                <div>{project.jiraProjectKey || project.jiraProductKey || project.Jiraproduckeys || project.JiraProductKey || "-"}</div>
                <div className="workspace-inline-actions">
                  <ActionButton label="Edit" icon="✎" onClick={() => startProjectEdit(project)} />
                  <ActionButton label="Delete" icon="🗑" variant="danger" onClick={() => void deleteProject(project._id)} />
                </div>
              </>
            ))}
          emptyText="No projects"
        />
      </SectionCard>
    </div>
  );
}