"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Dispatch, SetStateAction } from "react";
import { ActionButton, DataTable, SectionCard } from "./shared";

type RecordAny = Record<string, any>;

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
  testCases: RecordAny[];
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
  testCases,
  matchesSearch,
}: AdminGroupsScreenProps) {
  const isEditing = Boolean(editingGroupId);
  const groupsByProject = scopedProjects.map((project: RecordAny) => {
    const projectGroups = groups.filter((group: RecordAny) => String(group.project?._id || group.project) === String(project._id));
    return {
      project,
      groups: projectGroups,
    };
  });

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
            <ActionButton label={isEditing ? "Update group" : "Create group"} icon={isEditing ? "💾" : "＋"} variant="primary" />
            {isEditing && (
              <ActionButton label="Cancel" icon="↩" onClick={cancelGroupEdit} tooltip="Cancel editing" />
            )}
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Hierarchy Overview" subtitle="Project → group structure cho navigation nhanh hơn">
        {groupsByProject.length === 0 ? (
          <div className="workspace-empty">No groups in current scope</div>
        ) : (
          <div className="workspace-tree">
            {groupsByProject.map(({ project, groups: projectGroups }) => (
              <details key={project._id} className="workspace-tree__project" open>
                <summary>
                  <strong>{project.name}</strong>
                  <span>{projectGroups.length} groups</span>
                </summary>
                <div className="workspace-tree__branch">
                  {projectGroups.length === 0 ? (
                    <div className="workspace-empty">No groups under this project</div>
                  ) : (
                    projectGroups.map((group: RecordAny) => (
                      (() => {
                        const caseCount = testCases.filter((testCase: RecordAny) => String(testCase.group?._id || testCase.group) === String(group._id)).length;

                        return (
                      <div key={group._id} className="workspace-tree__node">
                        <div className="workspace-tree__node-main">
                          <strong>{group.name}</strong>
                          <span>{group.description || "No description"}</span>
                        </div>
                          <span className="workspace-pill">{caseCount} cases</span>
                        </div>
                        );
                      })()
                    ))
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
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
                  <ActionButton label="Edit" icon="✎" onClick={() => startGroupEdit(group)} />
                  <ActionButton label="Delete" icon="🗑" variant="danger" onClick={() => void deleteGroup(group._id)} />
                </div>
              </>
            ))}
          emptyText="No groups"
        />
      </SectionCard>
    </div>
  );
}