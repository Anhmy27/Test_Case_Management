"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { ActionButton, SectionCard } from "./shared";
import { getId } from "@/lib/api";

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
  startTestCaseEdit: (testCase: RecordAny) => void;
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
  startTestCaseEdit,
  matchesSearch,
}: AdminGroupsScreenProps) {
  const isEditing = Boolean(editingGroupId);
  const [searchTerm, setSearchTerm] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [hierarchyPage, setHierarchyPage] = useState(1);
  const hierarchyPageSize = 4;

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const matchesLocalSearch = useCallback(
    (...values: Array<string | number | undefined | null>) => {
      if (!normalizedSearch) {
        return true;
      }

      return values.some((value) => String(value || "").toLowerCase().includes(normalizedSearch));
    },
    [normalizedSearch],
  );

  const filteredGroups = useMemo(() => {
    return groups.filter((group: RecordAny) => {
      const groupProjectId = getId(group.project) || "";
      if (projectFilter && groupProjectId !== projectFilter) {
        return false;
      }

      return matchesSearch(group.name, group.project?.name, group.description) && matchesLocalSearch(group.name, group.project?.name, group.description);
    });
  }, [groups, matchesLocalSearch, matchesSearch, projectFilter]);

  const groupsByProject = useMemo(() => {
    return scopedProjects
      .map((project: RecordAny) => {
        if (projectFilter && getId(project) !== projectFilter) {
          return null;
        }

        const projectGroups = filteredGroups.filter((group: RecordAny) => getId(group.project) === getId(project));
        const projectMatches = matchesSearch(project.name) && matchesLocalSearch(project.name);

        if (!projectMatches && projectGroups.length === 0) {
          return null;
        }

        return {
          project,
          groups: projectGroups,
        };
      })
      .filter(Boolean) as Array<{ project: RecordAny; groups: RecordAny[] }>;
  }, [filteredGroups, matchesLocalSearch, matchesSearch, projectFilter, scopedProjects]);

  const totalHierarchyPages = Math.max(1, Math.ceil(groupsByProject.length / hierarchyPageSize));
  const safeHierarchyPage = Math.min(hierarchyPage, totalHierarchyPages);
  const visibleHierarchyProjects = groupsByProject.slice(
    (safeHierarchyPage - 1) * hierarchyPageSize,
    (safeHierarchyPage - 1) * hierarchyPageSize + hierarchyPageSize,
  );

  const renderProjectGroup = (group: RecordAny) => {
    const groupId = getId(group);
    const groupCases = testCases.filter((testCase: RecordAny) => getId(testCase.group) === groupId);
    const shouldScrollCases = groupCases.length >= 4;

    return (
      <details key={getId(group)} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold text-slate-900">{group.name}</div>
            <div className="truncate text-xs text-slate-500">{group.description || "No description"}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="workspace-pill bg-white">{groupCases.length} cases</span>
            <ActionButton label="Edit" icon="✎" onClick={() => startGroupEdit(group)} />
            <ActionButton label="Delete" icon="🗑" variant="danger" onClick={() => void deleteGroup(getId(group))} />
          </div>
        </summary>

        <div className="mt-3 border-l border-slate-200 pl-3">
          {groupCases.length === 0 ? (
            <div className="workspace-empty">No test cases in this group</div>
          ) : (
            <div className={`space-y-2 ${shouldScrollCases ? "max-h-[240px] overflow-y-auto pr-1" : ""}`}>
              {groupCases.map((testCase: RecordAny) => (
                <button
                  key={getId(testCase)}
                  type="button"
                  className="w-full rounded-lg border border-white bg-white px-3 py-2 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                  onClick={(event) => {
                    event.stopPropagation();
                    startTestCaseEdit(testCase);
                  }}
                >
                  <div className="font-semibold text-slate-900">{testCase.caseKey} - {testCase.title}</div>
                  <div className="text-xs text-slate-500">{testCase.description || "No description"}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </details>
    );
  };

  const filterBar = (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
      <label className="grid min-w-[240px] flex-1 gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Search</span>
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => {
            setSearchTerm(event.target.value);
            setHierarchyPage(1);
          }}
          placeholder="Search group, project, description..."
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
        />
      </label>
      <label className="grid min-w-[220px] gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Project filter</span>
        <select
          value={projectFilter}
          onChange={(event) => {
            setProjectFilter(event.target.value);
            setHierarchyPage(1);
          }}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
        >
          <option value="">All projects</option>
                {scopedProjects.map((project: RecordAny) => (
            <option key={getId(project)} value={getId(project)}>
              {project.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
        onClick={() => {
          setSearchTerm("");
          setProjectFilter("");
          setHierarchyPage(1);
        }}
      >
        Reset filters
      </button>
    </div>
  );

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
                  <option key={getId(project)} value={getId(project)}>
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
            <ActionButton type="submit" label={isEditing ? "Update group" : "Create group"} icon={isEditing ? "💾" : "＋"} variant="primary" />
            {isEditing && (
              <ActionButton label="Cancel" icon="↩" onClick={cancelGroupEdit} tooltip="Cancel editing" />
            )}
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Group List" subtitle="Nhom theo project">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
            {filteredGroups.length} groups
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
            {projectFilter ? "Filtered by project" : "All projects"}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
            Scroll or page through the list
          </span>
        </div>
        <div className="space-y-3">
          {filterBar}
          <div className="max-h-[620px] overflow-y-auto pr-1">
            {visibleHierarchyProjects.length === 0 ? (
              <div className="workspace-empty">No groups</div>
            ) : (
              <div className="space-y-3">
                {visibleHierarchyProjects.map(({ project, groups: projectGroups }) => (
                  <details key={`list-${getId(project)}`} className="group rounded-2xl border border-slate-200 bg-white/90 shadow-sm transition hover:border-slate-300" open>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-900 transition group-open:rounded-b-none group-open:border-b group-open:border-slate-200">
                      <span className="flex items-center gap-3">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                          {String(project.name || "?").slice(0, 1).toUpperCase()}
                        </span>
                        <span>
                          <strong className="block text-slate-900">{project.name}</strong>
                          <span className="block text-xs font-normal text-slate-500">{project.code || "Project"}</span>
                        </span>
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {projectGroups.length} groups
                      </span>
                    </summary>

                    <div className="space-y-2 px-4 pb-4 pt-3">
                      {projectGroups.length === 0 ? (
                        <div className="workspace-empty">No groups under this project</div>
                      ) : (
                        projectGroups.map(renderProjectGroup)
                      )}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}