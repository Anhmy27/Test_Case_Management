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

type AdminGroupsScreenProps = {
  groupForm: { projectId: string; name: string; description: string };
  setGroupForm: Dispatch<SetStateAction<{ projectId: string; name: string; description: string }>>;
  createGroup: (event: React.FormEvent) => Promise<void>;
  editingGroupId: string;
  startGroupEdit: (group: RecordAny) => void;
  cancelGroupEdit: () => void;
  deleteGroup: (groupId: string) => Promise<void>;
  scopedProjects: RecordAny[];
  groups: RecordAny[];
  matchesSearch: (...values: Array<string | number | undefined | null>) => boolean;
};

export default function AdminGroupsScreen({
  groupForm,
  setGroupForm,
  createGroup,
  editingGroupId,
  startGroupEdit,
  cancelGroupEdit,
  deleteGroup,
  scopedProjects,
  groups,
  matchesSearch,
}: AdminGroupsScreenProps) {
  const isEditing = Boolean(editingGroupId);

  return (
    <div className="workspace-stack">
      <SectionCard title="Test Case Groups" subtitle="Tao nhom test case trong section rieng">
        <form className="workspace-form" onSubmit={createGroup}>
          <div className="workspace-form__grid workspace-form__grid--two">
            <label>
              <span>Project</span>
              <select
                value={groupForm.projectId}
                onChange={(e) =>
                  setGroupForm((prev) => ({
                    ...prev,
                    projectId: e.target.value,
                  }))
                }
                required
              >
                <option value="">Select</option>
                {scopedProjects.map((project: RecordAny) => (
                  <option key={project._id} value={project._id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Name</span>
              <input
                value={groupForm.name}
                onChange={(e) =>
                  setGroupForm((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                required
              />
            </label>
          </div>
          <label>
            <span>Description</span>
            <textarea
              rows={3}
              value={groupForm.description}
              onChange={(e) =>
                setGroupForm((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
            />
          </label>
          <div className="workspace-inline-actions">
            <button className="workspace-primary" type="submit">
              {isEditing ? "Update group" : "Create group"}
            </button>
            {isEditing && (
              <button type="button" className="workspace-secondary" onClick={cancelGroupEdit}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Group List" subtitle="Nhom theo project">
        <DataTable
          columns={["Group", "Project", "Description", "Actions"]}
          rows={groups
            .filter((group: RecordAny) =>
              matchesSearch(group.name, group.project?.name, group.description),
            )
            .map((group: RecordAny) => (
              <>
                <div>{group.name}</div>
                <div>{group.project?.name || "-"}</div>
                <div>{group.description || "-"}</div>
                <div className="workspace-inline-actions">
                  <button type="button" className="workspace-secondary" onClick={() => startGroupEdit(group)}>
                    Edit
                  </button>
                  <button type="button" className="workspace-danger" onClick={() => void deleteGroup(group._id)}>
                    Delete
                  </button>
                </div>
              </>
            ))}
          emptyText="No groups"
        />
      </SectionCard>
    </div>
  );
}