"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction, FormEvent } from "react";
import { DataTable, SectionCard } from "./shared";

type RecordAny = Record<string, any>;

type Props = {
  planForm: any;
  setPlanForm: Dispatch<SetStateAction<any>>;
  createPlan: (event: FormEvent) => Promise<void>;
  scopedProjects: RecordAny[];
  scopedVersions: RecordAny[];
  planProjectGroups: RecordAny[];
  planProjectCases: RecordAny[];
  selectedPlanGroupIds: Set<any>;
  selectedPlanCaseIds: Set<any>;
  selectedPlanGroups: Array<{ group: RecordAny; cases: RecordAny[] }>;
  selectedPlanCasesByGroup: Array<{ group: RecordAny; cases: RecordAny[] }>;
  togglePlanGroup: (groupId: string) => void;
  togglePlanCase: (groupId: string, caseId: string) => void;
  users: RecordAny[];
  currentUser: RecordAny | null;
  selectedPlanId: string;
  selectPlanForAssignment: (planId: string) => void;
  assignDraft: { ownerId: string; assigneeIds: string[] };
  setAssignDraft: Dispatch<SetStateAction<{ ownerId: string; assigneeIds: string[] }>>;
  saveAssignments: (event: FormEvent) => Promise<void>;
  scopedPlans: RecordAny[];
  editingPlanId: string;
  editingExecutionMode: string;
  setEditingPlanId: Dispatch<SetStateAction<string>>;
  setEditingExecutionMode: Dispatch<SetStateAction<string>>;
  updatePlanExecutionMode: (planId: string, mode: string) => Promise<void>;
  userName: (value: unknown) => string;
  getId: (value: unknown) => string;
  matchesSearch: (...values: Array<string | number | undefined | null>) => boolean;
};

export default function AdminTestPlansScreen(props: Props) {
  const {
    planForm,
    setPlanForm,
    createPlan,
    scopedProjects,
    scopedVersions,
    planProjectGroups,
    planProjectCases,
    selectedPlanGroupIds,
    selectedPlanCaseIds,
    selectedPlanGroups,
    selectedPlanCasesByGroup,
    togglePlanGroup,
    togglePlanCase,
    users,
    currentUser,
    selectedPlanId,
    selectPlanForAssignment,
    assignDraft,
    setAssignDraft,
    saveAssignments,
    scopedPlans,
    editingPlanId,
    editingExecutionMode,
    setEditingPlanId,
    setEditingExecutionMode,
    updatePlanExecutionMode,
    userName,
    getId,
    matchesSearch,
  } = props;

  const selectAllCasesRef = useRef<HTMLInputElement | null>(null);
  const [assigneeSearch, setAssigneeSearch] = useState("");

  const visibleCaseIds = useMemo(
    () =>
      selectedPlanCasesByGroup.flatMap(({ cases }) =>
        cases.map((testCase) => String(testCase._id)),
      ),
    [selectedPlanCasesByGroup],
  );

  const selectedVisibleCaseCount = visibleCaseIds.filter((caseId) =>
    selectedPlanCaseIds.has(caseId),
  ).length;
  const allVisibleCasesSelected =
    visibleCaseIds.length > 0 && selectedVisibleCaseCount === visibleCaseIds.length;
  const someVisibleCasesSelected =
    selectedVisibleCaseCount > 0 && !allVisibleCasesSelected;

  useEffect(() => {
    if (selectAllCasesRef.current) {
      selectAllCasesRef.current.indeterminate = someVisibleCasesSelected;
    }
  }, [someVisibleCasesSelected]);

  function toggleAllVisibleCases() {
    const nextCaseIds = allVisibleCasesSelected
      ? planForm.caseIds.filter((caseId: string) => !visibleCaseIds.includes(caseId))
      : Array.from(new Set([...planForm.caseIds, ...visibleCaseIds]));

    setPlanForm((prev: any) => ({
      ...prev,
      caseIds: nextCaseIds,
      selectedGroupIds: prev.selectedGroupIds,
    }));
  }

  const selectedGroupCount = selectedPlanGroups.length;
  const filteredUsers = useMemo(() => {
    const query = assigneeSearch.trim().toLowerCase();

    if (!query) {
      return users;
    }

    return users.filter((user: RecordAny) => {
      const name = String(user.name || "").toLowerCase();
      const role = String(user.role || "").toLowerCase();
      const email = String(user.email || "").toLowerCase();
      return name.includes(query) || role.includes(query) || email.includes(query);
    });
  }, [assigneeSearch, users]);

  const selectedAssignees = useMemo(
    () => users.filter((user: RecordAny) => assignDraft.assigneeIds.includes(String(user._id))),
    [assignDraft.assigneeIds, users],
  );

  const ownerName = currentUser?.name || "Current admin";
  const ownerRole = currentUser?.role || "admin";

  return (
    <div className="workspace-stack">
      <SectionCard title="Test Plans" subtitle="Assign user va tao plan rieng biet">
        <form className="workspace-form" onSubmit={createPlan}>
          <div className="workspace-form__grid workspace-form__grid--two">
            <label>
              <span>Project</span>
              <select
                value={planForm.projectId}
                onChange={(e) =>
                  setPlanForm((prev: any) => ({
                    ...prev,
                    projectId: e.target.value,
                    versionId: "",
                    selectedGroupIds: [],
                    caseIds: [],
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
              <span>Version</span>
              <select
                value={planForm.versionId}
                onChange={(e) =>
                  setPlanForm((prev: any) => ({
                    ...prev,
                    versionId: e.target.value,
                  }))
                }
                required
              >
                <option value="">Select</option>
                {scopedVersions
                  .filter((version: RecordAny) => getId(version.project) === planForm.projectId)
                  .map((version: RecordAny) => (
                    <option key={version._id} value={version._id}>
                      {version.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <label>
            <span>Execution Mode</span>
            <select
              value={planForm.executionMode || "manual"}
              onChange={(e) =>
                setPlanForm((prev: any) => ({
                  ...prev,
                  executionMode: e.target.value,
                }))
              }
            >
              <option value="manual">Manual</option>
              <option value="automation">Automation</option>
            </select>
          </label>

          <label>
            <span>Name</span>
            <input
              value={planForm.name}
              onChange={(e) =>
                setPlanForm((prev: any) => ({
                  ...prev,
                  name: e.target.value,
                }))
              }
              required
            />
          </label>

          <label>
            <span>Description</span>
            <textarea
              rows={3}
              value={planForm.description}
              onChange={(e) =>
                setPlanForm((prev: any) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
            />
          </label>

          <label>
            <span>Groups</span>
            <div className="workspace-checklist workspace-checklist--compact workspace-checklist--scrollable">
              {planProjectGroups.length === 0 ? (
                <div className="workspace-checklist__empty">
                  Chon project truoc de lay danh sach group.
                </div>
              ) : (
                planProjectGroups.map((group: RecordAny) => {
                  const groupId = String(group._id);
                  const checked = selectedPlanGroupIds.has(groupId);
                  const groupCaseCount = planProjectCases.filter(
                    (testCase: RecordAny) => String(getId(testCase.group)) === groupId,
                  ).length;

                  return (
                    <label
                      key={groupId}
                      className={`workspace-checklist__item workspace-checklist__item--compact workspace-checklist__item--singleline${checked ? " is-checked" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePlanGroup(groupId)}
                      />
                      <span className="workspace-checklist__item-main">
                        <strong>{group.name}</strong>
                        <small>{groupCaseCount} test cases</small>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </label>

          <div className="workspace-checklist__panel workspace-checklist__panel--compact">
            <div className="workspace-checklist__panel-header workspace-checklist__panel-header--compact">
              <div>
                <span>Test cases</span>
                <p>Chon nhieu test case tu cac group khac nhau bang checkbox.</p>
              </div>
              <div className="workspace-checklist__panel-actions">
                <label className="workspace-checklist__select-all">
                  <input
                    ref={selectAllCasesRef}
                    type="checkbox"
                    checked={allVisibleCasesSelected}
                    onChange={toggleAllVisibleCases}
                    disabled={visibleCaseIds.length === 0}
                  />
                  <span>All</span>
                </label>
                <strong>{selectedPlanCaseIds.size} selected</strong>
                <small>{selectedGroupCount} group(s)</small>
              </div>
            </div>

            {selectedPlanGroups.length === 0 ? (
              <div className="workspace-checklist__empty">
                Chon it nhat 1 group de hien test case.
              </div>
            ) : (
              <div className="workspace-checklist__scroll workspace-checklist__scroll--cases">
                {selectedPlanCasesByGroup.map(({ group, cases }) => {
                const groupId = String(group._id);

                return (
                  <div key={groupId} className="workspace-checklist__group">
                    <div className="workspace-checklist__group-header workspace-checklist__group-header--compact">
                      <strong>{group.name}</strong>
                      <span>{cases.length} cases</span>
                    </div>
                    <div className="workspace-checklist__case-list workspace-checklist__case-list--compact">
                      {cases.length === 0 ? (
                        <div className="workspace-checklist__empty workspace-checklist__empty--inline">
                          Group nay chua co test case.
                        </div>
                      ) : (
                        cases.map((testCase: RecordAny) => {
                          const caseId = String(testCase._id);
                          const checked = selectedPlanCaseIds.has(caseId);

                          return (
                            <label
                              key={caseId}
                              className={`workspace-checklist__case workspace-checklist__case--compact workspace-checklist__case--singleline${checked ? " is-checked" : ""}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePlanCase(groupId, caseId)}
                              />
                              <span className="workspace-checklist__case-main">
                                <strong>
                                  {testCase.caseKey} - {testCase.title}
                                </strong>
                                <small>{testCase.description || "Khong co mo ta"}</small>
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            )}
          </div>

          <button className="workspace-primary" type="submit">
            Create test plan
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Assign Assignees" subtitle="Owner se tu dong la admin dang thao tac">
        <form className="workspace-form workspace-form--assignments" onSubmit={saveAssignments}>
          <div className="workspace-assignments__section">
            <label>
              <span>Test Plan</span>
              <select value={selectedPlanId} onChange={(e) => selectPlanForAssignment(e.target.value)} required>
                <option value="">Select plan</option>
                {scopedPlans.map((plan: RecordAny) => (
                  <option key={plan._id} value={plan._id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="workspace-assignments__section">
            <div className="workspace-assignments__picker">
              <label>
                <span>Assign Members</span>
                <input
                  type="search"
                  value={assigneeSearch}
                  onChange={(e) => setAssigneeSearch(e.target.value)}
                  placeholder="Search users..."
                />
              </label>

              <div className="workspace-assignments__list" role="group" aria-label="Assignees">
                {filteredUsers.length === 0 ? (
                  <div className="workspace-checklist__empty">
                    No users found.
                  </div>
                ) : (
                  filteredUsers.map((user: RecordAny) => {
                    const userId = String(user._id);
                    const checked = assignDraft.assigneeIds.includes(userId);

                    return (
                      <label
                        key={userId}
                        className={`workspace-assignments__item${checked ? " is-checked" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setAssignDraft((prev: any) => ({
                              ...prev,
                              assigneeIds: checked
                                ? prev.assigneeIds.filter((id: string) => id !== userId)
                                : [...prev.assigneeIds, userId],
                            }));
                          }}
                        />
                        <span className="workspace-assignments__item-main">
                          <strong>{user.name}</strong>
                          <small>{user.role}</small>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="workspace-assignments__owner">
            <span>Owner</span>
            <strong>{ownerName}</strong>
            <span>({ownerRole})</span>
          </div>

          <div className="workspace-assignments__summary">
            <strong>{selectedAssignees.length}</strong>
            <span>selected members</span>
          </div>

          <button className="workspace-primary workspace-assignments__submit" type="submit">
            Save assignment
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Test Plan List">
        {editingPlanId ? (
          <div className="workspace-form">
            <label>
              <span>Execution Mode</span>
              <select
                value={editingExecutionMode}
                onChange={(e) => setEditingExecutionMode(e.target.value)}
              >
                <option value="manual">Manual</option>
                <option value="automation">Automation</option>
              </select>
            </label>
            <div className="workspace-inline-actions">
              <button
                type="button"
                className="workspace-primary"
                onClick={() => {
                  if (editingExecutionMode) {
                    void updatePlanExecutionMode(editingPlanId, editingExecutionMode);
                  }
                }}
              >
                Save
              </button>
              <button
                type="button"
                className="workspace-secondary"
                onClick={() => {
                  setEditingPlanId("");
                  setEditingExecutionMode("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <DataTable
            columns={["Plan", "Project", "Version", "Owner", "Mode", "Action"]}
            rows={scopedPlans
              .filter((plan: RecordAny) =>
                matchesSearch(plan.name, plan.project?.name, plan.version?.name, userName(plan.owner)),
              )
              .map((plan: RecordAny) => (
                <>
                  <div>{plan.name}</div>
                  <div>{plan.project?.name || "-"}</div>
                  <div>{plan.version?.name || "-"}</div>
                  <div>{userName(plan.owner)}</div>
                  <div>
                    <span className="workspace-pill">{plan.executionMode || "manual"}</span>
                  </div>
                  <div>
                    <button
                      type="button"
                      className="workspace-secondary"
                      onClick={() => {
                        setEditingPlanId(plan._id);
                        setEditingExecutionMode(plan.executionMode || "manual");
                      }}
                    >
                      Update
                    </button>
                  </div>
                </>
              ))}
            emptyText="No plans"
          />
        )}
      </SectionCard>
    </div>
  );
}
