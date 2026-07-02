"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { ActionButton, Field, INPUT_CLS, SCROLLABLE_LIST_COMPACT_MAX_HEIGHT, ScrollableListBody, ScopedProjectField, SectionCard } from "./shared";
import { getId } from "@/lib/api";

type RecordAny = Record<string, any>;

type AdminGroupsScreenProps = {
  groupForm: { projectId: string; name: string; description: string };
  setGroupForm: Dispatch<
    SetStateAction<{ projectId: string; name: string; description: string }>
  >;
  createGroup: (event: React.FormEvent) => Promise<void>;
  editingGroupId: string;
  startGroupEdit: (group: RecordAny) => void;
  cancelGroupEdit: () => void;
  deleteGroup: (groupId: string) => Promise<void>;
  scopedProjects: RecordAny[];
  groups: RecordAny[];
  testCases: RecordAny[];
  startTestCaseEdit: (testCase: RecordAny) => void;
  isProjectScoped: boolean;
  scopedProjectName?: string;
  searchTerm: string;
  matchesSearch: (
    ...values: Array<string | number | undefined | null>
  ) => boolean;
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
  isProjectScoped,
  scopedProjectName,
  searchTerm,
  matchesSearch,
}: AdminGroupsScreenProps) {
  const isEditing = Boolean(editingGroupId);
  const editingGroupKey = useMemo(() => {
    if (!editingGroupId) {
      return "";
    }
    const editingGroup = groups.find((group: RecordAny) => getId(group) === editingGroupId);
    return String(editingGroup?.key || "").trim();
  }, [editingGroupId, groups]);
  const [hierarchyPage, setHierarchyPage] = useState(1);
  const hierarchyPageSize = 4;

  useEffect(() => {
    setHierarchyPage(1);
  }, [searchTerm]);

  const filteredGroups = useMemo(() => {
    return groups.filter((group: RecordAny) =>
      matchesSearch(group.name, group.key, group.project?.name, group.description),
    );
  }, [groups, matchesSearch]);

  const groupsByProject = useMemo(() => {
    return scopedProjects
      .map((project: RecordAny) => {
        const projectGroups = filteredGroups.filter(
          (group: RecordAny) => getId(group.project) === getId(project),
        );
        const projectMatches = matchesSearch(project.name);

        if (!projectMatches && projectGroups.length === 0) {
          return null;
        }

        return {
          project,
          groups: projectGroups,
        };
      })
      .filter(Boolean) as Array<{ project: RecordAny; groups: RecordAny[] }>;
  }, [filteredGroups, matchesSearch, scopedProjects]);

  const totalHierarchyPages = Math.max(
    1,
    Math.ceil(groupsByProject.length / hierarchyPageSize),
  );
  const safeHierarchyPage = Math.min(hierarchyPage, totalHierarchyPages);
  const visibleHierarchyProjects = groupsByProject.slice(
    (safeHierarchyPage - 1) * hierarchyPageSize,
    (safeHierarchyPage - 1) * hierarchyPageSize + hierarchyPageSize,
  );

  const copyGroupKey = async (key: string) => {
    const value = String(key || "").trim();
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  };

  const renderGroupKeyRow = (key: string, compact = false) => {
    const normalizedKey = String(key || "").trim();
    if (!normalizedKey) {
      return null;
    }

    return (
      <div
        className={`flex flex-wrap items-center gap-2 ${compact ? "" : "mt-1"}`}
        onClick={(event) => event.stopPropagation()}
      >
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
          Group Key
        </span>
        <code className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-xs font-semibold text-slate-800 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100">
          {normalizedKey}
        </code>
        <button
          type="button"
          className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          onClick={() => void copyGroupKey(normalizedKey)}
          title="Copy Group Key for Excel import"
        >
          Copy
        </button>
      </div>
    );
  };

  const renderProjectGroup = (group: RecordAny) => {
    const groupId = getId(group);
    const groupCases = testCases.filter(
      (testCase: RecordAny) => getId(testCase.group) === groupId,
    );
    const shouldScrollCases = groupCases.length >= 4;

    return (
      <details
        key={getId(group)}
        className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-800/60"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold text-slate-900 dark:text-zinc-50">{group.name}</div>
            {renderGroupKeyRow(group.key, true)}
            <div className="truncate text-xs text-slate-500 dark:text-zinc-400">
              {group.description || "No description"}
            </div>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
            {groupCases.length} cases
          </span>
        </summary>

        <div
          className="mt-3 flex shrink-0 items-center justify-end gap-2"
          onClick={(event) => event.stopPropagation()}
        >
          <ActionButton
            label="Edit"
            icon="✎"
            onClick={() => startGroupEdit(group)}
          />
          <ActionButton
            label="Delete"
            icon="🗑"
            variant="danger"
            onClick={() => void deleteGroup(getId(group))}
          />
        </div>

        <div className="mt-3 border-l border-slate-200 pl-3 dark:border-zinc-600">
          {groupCases.length === 0 ? (
            <div className="py-4 text-center text-sm text-slate-400 dark:text-zinc-500">
              No test cases in this group
            </div>
          ) : shouldScrollCases ? (
            <ScrollableListBody maxHeightClass={SCROLLABLE_LIST_COMPACT_MAX_HEIGHT} className="space-y-2 pr-1">
              {groupCases.map((testCase: RecordAny) => (
                <button
                  key={getId(testCase)}
                  type="button"
                  className="w-full rounded-lg border border-white bg-white px-3 py-2 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
                  onClick={(event) => {
                    event.stopPropagation();
                    startTestCaseEdit(testCase);
                  }}
                >
                  <div className="font-semibold text-slate-900 dark:text-zinc-50">
                    {testCase.caseKey} - {testCase.title}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-zinc-400">
                    {testCase.description || "No description"}
                  </div>
                </button>
              ))}
            </ScrollableListBody>
          ) : (
            <div className="space-y-2">
              {groupCases.map((testCase: RecordAny) => (
                <button
                  key={getId(testCase)}
                  type="button"
                  className="w-full rounded-lg border border-white bg-white px-3 py-2 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
                  onClick={(event) => {
                    event.stopPropagation();
                    startTestCaseEdit(testCase);
                  }}
                >
                  <div className="font-semibold text-slate-900 dark:text-zinc-50">
                    {testCase.caseKey} - {testCase.title}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-zinc-400">
                    {testCase.description || "No description"}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </details>
    );
  };

  return (
    <div className="space-y-5">
      <SectionCard
        title="Test Case Groups"
        subtitle="Tạo nhóm test case theo project"
      >
        <form className="space-y-4" onSubmit={createGroup}>
          <div className="grid gap-4 sm:grid-cols-2">
            <ScopedProjectField
              isProjectScoped={isProjectScoped}
              scopedProjectName={scopedProjectName}
              projectId={groupForm.projectId}
              projects={scopedProjects}
              onProjectChange={(projectId) =>
                setGroupForm((prev) => ({ ...prev, projectId }))
              }
              getId={getId}
            />
            <Field label="Name">
              <input
                className={INPUT_CLS}
                value={groupForm.name}
                onChange={(e) => setGroupForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </Field>
          </div>
          {isEditing && editingGroupKey ? (
            <Field label="Group Key">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className={`${INPUT_CLS} font-mono uppercase`}
                  value={editingGroupKey}
                  readOnly
                />
                <ActionButton
                  type="button"
                  label="Copy"
                  icon="⧉"
                  onClick={() => void copyGroupKey(editingGroupKey)}
                  tooltip="Copy for Excel Group Key column"
                />
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                Dùng giá trị này trong cột <strong>Group Key</strong> khi import test case Excel.
              </p>
            </Field>
          ) : null}
          <Field label="Description">
            <textarea
              rows={3}
              className={INPUT_CLS}
              value={groupForm.description}
              onChange={(e) => setGroupForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton
              type="submit"
              label={isEditing ? "Update group" : "Create group"}
              icon={isEditing ? "💾" : "＋"}
              variant="primary"
            />
            {isEditing && (
              <ActionButton label="Cancel" icon="↩" onClick={cancelGroupEdit} tooltip="Cancel editing" />
            )}
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Group List" subtitle="Nhóm theo project">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
            {filteredGroups.length} groups
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
            Scoped by project selection
          </span>
          {totalHierarchyPages > 1 ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
              Page {safeHierarchyPage}/{totalHierarchyPages}
            </span>
          ) : null}
        </div>
        <ScrollableListBody className="space-y-3 pr-1">
          {visibleHierarchyProjects.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400 dark:text-zinc-500">No groups</div>
          ) : (
            visibleHierarchyProjects.map(
                  ({ project, groups: projectGroups }) => (
                    <details
                      key={`list-${getId(project)}`}
                      className="group rounded-2xl border border-slate-200 bg-white/90 shadow-sm transition hover:border-slate-300 dark:border-zinc-700 dark:bg-zinc-900/90 dark:hover:border-zinc-600"
                      open
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-900 transition group-open:rounded-b-none group-open:border-b group-open:border-slate-200 dark:text-zinc-50 dark:group-open:border-zinc-700">
                        <span className="flex items-center gap-3">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                            {String(project.name || "?")
                              .slice(0, 1)
                              .toUpperCase()}
                          </span>
                          <span>
                            <strong className="block text-slate-900 dark:text-zinc-50">
                              {project.name}
                            </strong>
                            <span className="block text-xs font-normal text-slate-500 dark:text-zinc-400">
                              {project.code || "Project"}
                            </span>
                          </span>
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {projectGroups.length} groups
                        </span>
                      </summary>

                      <div className="space-y-2 px-4 pb-4 pt-3">
                        {projectGroups.length === 0 ? (
                          <div className="py-4 text-center text-sm text-slate-400 dark:text-zinc-500">
                            No groups under this project
                          </div>
                        ) : (
                          projectGroups.map(renderProjectGroup)
                        )}
                      </div>
                    </details>
                  ),
                )
          )}
        </ScrollableListBody>
          {totalHierarchyPages > 1 ? (
            <div className="flex items-center justify-end gap-2">
              <ActionButton
                label="Previous"
                disabled={safeHierarchyPage <= 1}
                onClick={() => setHierarchyPage((page) => Math.max(1, page - 1))}
              />
              <ActionButton
                label="Next"
                disabled={safeHierarchyPage >= totalHierarchyPages}
                onClick={() =>
                  setHierarchyPage((page) => Math.min(totalHierarchyPages, page + 1))
                }
              />
            </div>
          ) : null}
      </SectionCard>
    </div>
  );
}
