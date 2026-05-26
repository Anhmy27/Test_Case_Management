"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Dispatch, SetStateAction } from "react";

type RecordAny = Record<string, any>;

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="workspace-card">
      <div className="workspace-card__header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function DataTable({
  columns,
  rows,
  emptyText,
}: {
  columns: string[];
  rows: React.ReactNode[];
  emptyText: string;
}) {
  const columnStyle = {
    gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
  };

  return (
    <div className="workspace-table">
      <div className="workspace-table__head" style={columnStyle}>
        {columns.map((column) => (
          <div key={column}>{column}</div>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="workspace-table__empty">{emptyText}</div>
      ) : (
        <div className="workspace-table__body">
          {rows.map((row, index) => (
            <div key={index} className="workspace-table__row" style={columnStyle}>
              {row}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type AdminProjectsScreenProps = {
  editingProjectId: string;
  projectForm: { name: string; code: string; pid: string; description: string };
  setProjectForm: Dispatch<SetStateAction<{ name: string; code: string; pid: string; description: string }>>;
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
            <button className="workspace-primary" type="submit">
              {editingProjectId ? "Save project" : "Create project"}
            </button>
            {editingProjectId && (
              <button type="button" className="workspace-secondary" onClick={cancelProjectEdit}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Project List" subtitle="Card/table sach, riang">
        <DataTable
          columns={["Project", "Code", "Pid", "Action"]}
          rows={projects
            .filter((project: RecordAny) => matchesSearch(project.name, project.code))
            .map((project: RecordAny) => (
              <>
                <div>{project.name}</div>
                <div>{project.code}</div>
                <div>{project.pid || "-"}</div>
                <div className="workspace-inline-actions">
                  <button type="button" className="workspace-secondary" onClick={() => startProjectEdit(project)}>
                    Edit
                  </button>
                  <button type="button" className="workspace-danger" onClick={() => void deleteProject(project._id)}>
                    Delete
                  </button>
                </div>
              </>
            ))}
          emptyText="No projects"
        />
      </SectionCard>
    </div>
  );
}