"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Dispatch, SetStateAction } from "react";
import { Button, DataTable, Field, INPUT_CLS, SectionCard } from "./shared";
import { getId } from "@/lib/api";

type RecordAny = Record<string, any>;

type AdminProjectsScreenProps = {
  editingProjectId: string;
  projectForm: { name: string; code: string; pid: string; jiraProjectKey: string; description: string };
  setProjectForm: Dispatch<SetStateAction<{ name: string; code: string; pid: string; jiraProjectKey: string; description: string }>>;
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
    <div className="space-y-5">
      <SectionCard title={editingProjectId ? "Edit Project" : "Projects"} subtitle="Tạo, sửa, xóa project">
        <form className="space-y-4" onSubmit={saveProject}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <input
                className={INPUT_CLS}
                value={projectForm.name}
                onChange={(e) => setProjectForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </Field>
            <Field label="Code">
              <input
                className={INPUT_CLS}
                value={projectForm.code}
                onChange={(e) => setProjectForm((prev) => ({ ...prev, code: e.target.value }))}
                required
              />
            </Field>
            <Field label="Jira pid">
              <input
                className={INPUT_CLS}
                value={projectForm.pid}
                onChange={(e) => setProjectForm((prev) => ({ ...prev, pid: e.target.value }))}
                placeholder="11500"
              />
            </Field>
            <Field label="Jira Project Key">
              <input
                className={INPUT_CLS}
                value={projectForm.jiraProjectKey}
                onChange={(e) => setProjectForm((prev) => ({ ...prev, jiraProjectKey: e.target.value }))}
                placeholder="CED"
              />
            </Field>
          </div>
          <Field label="Description">
            <textarea
              rows={3}
              className={INPUT_CLS}
              value={projectForm.description}
              onChange={(e) => setProjectForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant="primary">
              {editingProjectId ? "💾 Save project" : "＋ Create project"}
            </Button>
            {editingProjectId && (
              <Button type="button" variant="secondary" onClick={cancelProjectEdit}>
                ↩ Cancel
              </Button>
            )}
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Project List">
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
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => startProjectEdit(project)}>✎ Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => void deleteProject(getId(project))}>🗑 Delete</Button>
                </div>
              </>
            ))}
          emptyText="No projects"
        />
      </SectionCard>
    </div>
  );
}
