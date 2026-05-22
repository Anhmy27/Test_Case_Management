"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Dispatch, SetStateAction } from "react";
import { DataTable, SectionCard } from "./shared";

type RecordAny = Record<string, any>;

type Props = {
  planForm: any;
  setPlanForm: Dispatch<SetStateAction<any>>;
  createPlan: (event: React.FormEvent) => Promise<void>;
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
  saveAssignments: (event: React.FormEvent) => Promise<void>;
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
  const { planForm, setPlanForm, createPlan, scopedProjects, scopedVersions, planProjectGroups, planProjectCases, selectedPlanGroupIds, selectedPlanCaseIds, selectedPlanGroups, selectedPlanCasesByGroup, togglePlanGroup, togglePlanCase, users, currentUser, selectedPlanId, selectPlanForAssignment, assignDraft, setAssignDraft, saveAssignments, scopedPlans, editingPlanId, editingExecutionMode, setEditingPlanId, setEditingExecutionMode, updatePlanExecutionMode, userName, getId, matchesSearch } = props;

  return (
    <div className="workspace-stack">
      <SectionCard title="Test Plans" subtitle="Assign user va tao plan rieng biet">
        <form className="workspace-form" onSubmit={createPlan}>
          <div className="workspace-form__grid workspace-form__grid--two">
            <label><span>Project</span><select value={planForm.projectId} onChange={(e) => setPlanForm((prev: any) => ({ ...prev, projectId: e.target.value, versionId: "", selectedGroupIds: [], caseIds: [] }))} required><option value="">Select</option>{scopedProjects.map((project: RecordAny) => <option key={project._id} value={project._id}>{project.name}</option>)}</select></label>
            <label><span>Version</span><select value={planForm.versionId} onChange={(e) => setPlanForm((prev: any) => ({ ...prev, versionId: e.target.value }))} required><option value="">Select</option>{scopedVersions.filter((version: RecordAny) => getId(version.project) === planForm.projectId).map((version: RecordAny) => <option key={version._id} value={version._id}>{version.name}</option>)}</select></label>
          </div>
          <label><span>Execution Mode</span><select value={planForm.executionMode || "manual"} onChange={(e) => setPlanForm((prev: any) => ({ ...prev, executionMode: e.target.value }))}><option value="manual">Manual</option><option value="automation">Automation</option></select></label>
          <label><span>Name</span><input value={planForm.name} onChange={(e) => setPlanForm((prev: any) => ({ ...prev, name: e.target.value }))} required /></label>
          <label><span>Description</span><textarea rows={3} value={planForm.description} onChange={(e) => setPlanForm((prev: any) => ({ ...prev, description: e.target.value }))} /></label>
          <label><span>Groups</span><div className="workspace-checklist">{planProjectGroups.length === 0 ? <div className="workspace-checklist__empty">Chon project truoc de lay danh sach group.</div> : planProjectGroups.map((group: RecordAny) => { const groupId = String(group._id); const checked = selectedPlanGroupIds.has(groupId); const groupCaseCount = planProjectCases.filter((testCase: RecordAny) => String(getId(testCase.group)) === groupId).length; return <label key={groupId} className={`workspace-checklist__item${checked ? " is-checked" : ""}`}><input type="checkbox" checked={checked} onChange={() => togglePlanGroup(groupId)} /><span><strong>{group.name}</strong><small>{groupCaseCount} test cases</small></span></label>; })}</div></label>
          <div className="workspace-checklist__panel"><div className="workspace-checklist__panel-header"><div><span>Test cases</span><p>Chon nhieu test case tu cac group khac nhau bang checkbox.</p></div><strong>{planForm.caseIds.length} selected</strong></div>{selectedPlanGroups.length === 0 ? <div className="workspace-checklist__empty">Chon it nhat 1 group de hien test case.</div> : selectedPlanCasesByGroup.map(({ group, cases }: RecordAny) => { const groupId = String(group._id); return <div key={groupId} className="workspace-checklist__group"><div className="workspace-checklist__group-header"><strong>{group.name}</strong><span>{cases.length} cases</span></div><div className="workspace-checklist__case-list">{cases.length === 0 ? <div className="workspace-checklist__empty workspace-checklist__empty--inline">Group nay chua co test case.</div> : cases.map((testCase: RecordAny) => { const caseId = String(testCase._id); const checked = selectedPlanCaseIds.has(caseId); return <label key={caseId} className={`workspace-checklist__case${checked ? " is-checked" : ""}`}><input type="checkbox" checked={checked} onChange={() => togglePlanCase(groupId, caseId)} /><span><strong>{testCase.caseKey} - {testCase.title}</strong>{testCase.description ? <small>{testCase.description}</small> : <small>Khong co mo ta</small>}</span></label>; })}</div></div>; })}</div>
          <button className="workspace-primary" type="submit">Create test plan</button>
        </form>
      </SectionCard>

      <SectionCard title="Assign Assignees" subtitle="Owner se tu dong la admin dang thao tac"><form className="workspace-form" onSubmit={saveAssignments}><label><span>Test Plan</span><select value={selectedPlanId} onChange={(e) => selectPlanForAssignment(e.target.value)} required><option value="">Select plan</option>{scopedPlans.map((plan: RecordAny) => <option key={plan._id} value={plan._id}>{plan.name}</option>)}</select></label><div className="workspace-form__grid workspace-form__grid--two"><label><span>Assignees</span><select multiple value={assignDraft.assigneeIds} onChange={(e) => setAssignDraft((prev: any) => ({ ...prev, assigneeIds: Array.from(e.target.selectedOptions).map((option) => option.value) }))}>{users.map((user: RecordAny) => <option key={user._id} value={user._id}>{user.name} ({user.role})</option>)}</select></label></div><div className="workspace-banner">Owner will be saved as <strong>{currentUser?.name}</strong> ({currentUser?.role}).</div><button className="workspace-primary" type="submit">Save assignment</button></form></SectionCard>

      <SectionCard title="Test Plan List">{editingPlanId ? <div className="workspace-form"><label><span>Execution Mode</span><select value={editingExecutionMode} onChange={(e) => setEditingExecutionMode(e.target.value)}><option value="manual">Manual</option><option value="automation">Automation</option></select></label><div className="workspace-inline-actions"><button type="button" className="workspace-primary" onClick={() => { if (editingExecutionMode) { void updatePlanExecutionMode(editingPlanId, editingExecutionMode); } }}>Save</button><button type="button" className="workspace-secondary" onClick={() => { setEditingPlanId(""); setEditingExecutionMode(""); }}>Cancel</button></div></div> : <DataTable columns={["Plan", "Project", "Version", "Owner", "Mode", "Action"]} rows={scopedPlans.filter((plan: RecordAny) => matchesSearch(plan.name, plan.project?.name, plan.version?.name, userName(plan.owner))).map((plan: RecordAny) => <><div>{plan.name}</div><div>{plan.project?.name || "-"}</div><div>{plan.version?.name || "-"}</div><div>{userName(plan.owner)}</div><div><span className="workspace-pill">{plan.executionMode || "manual"}</span></div><div><button type="button" className="workspace-secondary" onClick={() => { setEditingPlanId(plan._id); setEditingExecutionMode(plan.executionMode || "manual"); }}>Update</button></div></>)} emptyText="No plans" />}</SectionCard>
    </div>
  );
}