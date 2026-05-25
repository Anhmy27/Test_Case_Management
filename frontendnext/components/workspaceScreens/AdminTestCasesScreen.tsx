"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { DataTable, SectionCard } from "./shared";

type RecordAny = Record<string, any>;

type TestCaseForm = {
  projectId: string;
  groupId: string;
  caseKey: string;
  title: string;
  priority: string;
  severity: string;
  type: string;
  description: string;
  expected: string;
  steps: Array<{ action: string }>;
};

type AutomationStep = {
  action: string;
  targetType: string;
  target: string;
  value: string;
  expected: string;
  timeoutMs: string;
};

type Props = {
  editingTestCaseId: string;
  testCaseForm: TestCaseForm;
  setTestCaseForm: Dispatch<SetStateAction<TestCaseForm>>;
  automationForm: { enabled: boolean; baseUrl: string; userKey: string; steps: AutomationStep[] };
  setAutomationForm: Dispatch<SetStateAction<{ enabled: boolean; baseUrl: string; userKey: string; steps: AutomationStep[] }>>;
  addTestCaseStep: () => void;
  updateTestCaseStep: (index: number, key: string, value: string) => void;
  removeTestCaseStep: (index: number) => void;
  addAutomationStep: () => void;
  updateAutomationStep: (index: number, key: string, value: string) => void;
  removeAutomationStep: (index: number) => void;
  saveTestCase: (event: React.FormEvent) => Promise<void>;
  cancelTestCaseEdit: () => void;
  testCases: RecordAny[];
  matchesSearch: (...values: Array<string | number | undefined | null>) => boolean;
  startTestCaseEdit: (testCase: RecordAny) => void;
  deleteTestCase: (testCaseId: string) => void;
  scopedProjects: RecordAny[];
  scopedGroups: RecordAny[];
  selectedProjectId: string;
  downloadTestCaseTemplate: () => void;
  importTestCases: (file: File) => Promise<void>;
  importInputRef: MutableRefObject<HTMLInputElement | null>;
};

export default function AdminTestCasesScreen(props: Props) {
  const {
    editingTestCaseId,
    testCaseForm,
    setTestCaseForm,
    automationForm,
    setAutomationForm,
    addTestCaseStep,
    updateTestCaseStep,
    removeTestCaseStep,
    addAutomationStep,
    updateAutomationStep,
    removeAutomationStep,
    saveTestCase,
    cancelTestCaseEdit,
    testCases,
    matchesSearch,
    startTestCaseEdit,
    deleteTestCase,
    scopedProjects,
    scopedGroups,
    selectedProjectId,
    downloadTestCaseTemplate,
    importTestCases,
    importInputRef,
  } = props;

  return (
    <div className="workspace-stack">
      <SectionCard
        title={editingTestCaseId ? "Edit Test Case" : "Test Cases"}
        subtitle="Quan ly test case trong panel rieng"
        actions={
          <>
            <button type="button" className="workspace-secondary" onClick={downloadTestCaseTemplate}>
              Download Excel Template
            </button>
            <button type="button" className="workspace-primary" onClick={() => importInputRef.current?.click()} disabled={!selectedProjectId}>
              Import Excel
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: "none" }}
              onChange={async (event) => {
                const input = event.currentTarget as HTMLInputElement;
                const file = input.files?.[0];
                if (!file) return;
                await importTestCases(file);
                input.value = "";
              }}
            />
          </>
        }
      >
        <form className="workspace-form" onSubmit={saveTestCase}>
          <div className="workspace-form__grid workspace-form__grid--three">
            <label>
              <span>Project</span>
              <select
                value={testCaseForm.projectId}
                onChange={(e) =>
                  setTestCaseForm((prev) => ({ ...prev, projectId: e.target.value, groupId: "" }))
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
              <span>Group</span>
              <select
                value={testCaseForm.groupId}
                onChange={(e) => setTestCaseForm((prev) => ({ ...prev, groupId: e.target.value }))}
                required
              >
                <option value="">Select</option>
                {scopedGroups.map((group: RecordAny) => (
                  <option key={group._id} value={group._id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Case Key</span>
              <input
                value={testCaseForm.caseKey}
                onChange={(e) => setTestCaseForm((prev) => ({ ...prev, caseKey: e.target.value }))}
                required
              />
            </label>
          </div>
          <label>
            <span>Title</span>
            <input value={testCaseForm.title} onChange={(e) => setTestCaseForm((prev) => ({ ...prev, title: e.target.value }))} required />
          </label>
          <label>
            <span>Priority</span>
            <select value={testCaseForm.priority || "medium"} onChange={(e) => setTestCaseForm((prev) => ({ ...prev, priority: e.target.value }))}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="critical">critical</option>
            </select>
          </label>
          <label>
            <span>Severity</span>
            <select value={testCaseForm.severity || "major"} onChange={(e) => setTestCaseForm((prev) => ({ ...prev, severity: e.target.value }))}>
              <option value="minor">minor</option>
              <option value="major">major</option>
              <option value="critical">critical</option>
            </select>
          </label>
          <label>
            <span>Type</span>
            <select value={testCaseForm.type || "functional"} onChange={(e) => setTestCaseForm((prev) => ({ ...prev, type: e.target.value }))}>
              <option value="functional">functional</option>
              <option value="api">api</option>
              <option value="ui">ui</option>
              <option value="regression">regression</option>
              <option value="security">security</option>
              <option value="other">other</option>
            </select>
          </label>
          <label>
            <span>Description</span>
            <textarea rows={3} value={testCaseForm.description} onChange={(e) => setTestCaseForm((prev) => ({ ...prev, description: e.target.value }))} />
          </label>
          <div className="workspace-steps">
            <div className="workspace-steps__header">
              <span>Steps</span>
              <button type="button" className="workspace-secondary" onClick={addTestCaseStep}>Add step</button>
            </div>
            {testCaseForm.steps.map((step, index) => (
              <div className="workspace-steps__row" key={index}>
                <span className="workspace-steps__index">{index + 1}</span>
                <input value={step.action} onChange={(e) => updateTestCaseStep(index, "action", e.target.value)} placeholder="Step action" />
                <button type="button" className="workspace-secondary" onClick={() => removeTestCaseStep(index)}>Remove</button>
              </div>
            ))}
          </div>
          <label>
            <span>Expected result</span>
            <input value={testCaseForm.expected} onChange={(e) => setTestCaseForm((prev) => ({ ...prev, expected: e.target.value }))} required />
            <div className="workspace-banner">Manual steps stay for human-readable QA flow. Turn on automation below to store Playwright steps for the same test case.</div>
            <div className="workspace-form__grid workspace-form__grid--two">
              <label>
                <span>Automation enabled</span>
                <select value={automationForm.enabled ? "true" : "false"} onChange={(e) => setAutomationForm((prev) => ({ ...prev, enabled: e.target.value === "true" }))}>
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </label>
              <label>
                <span>Base URL</span>
                <input value={automationForm.baseUrl} onChange={(e) => setAutomationForm((prev) => ({ ...prev, baseUrl: e.target.value }))} placeholder="https://app.example.com" />
              </label>
            </div>
            <div className="workspace-form__grid workspace-form__grid--two">
              <label>
                <span>User (email/username)</span>
                <input value={automationForm.userKey} onChange={(e) => setAutomationForm((prev) => ({ ...prev, userKey: e.target.value }))} placeholder="tester@company.com" />
              </label>
            </div>
            <div className="workspace-steps">
              <div className="workspace-steps__header">
                <span>Playwright steps</span>
                <button type="button" className="workspace-secondary" onClick={addAutomationStep}>Add automation step</button>
              </div>
              {automationForm.steps.map((step, index) => (
                <div key={index} className="workspace-automation-step">
                  <div className="workspace-form__grid workspace-form__grid--three">
                    <label><span>Action</span><select value={step.action} onChange={(e) => updateAutomationStep(index, "action", e.target.value)}><option value="goto">goto</option><option value="click">click</option><option value="type">type</option><option value="select">select</option><option value="waitFor">waitFor</option><option value="assertText">assertText</option><option value="assertVisible">assertVisible</option><option value="assertUrl">assertUrl</option><option value="assertTitle">assertTitle</option><option value="assertHidden">assertHidden</option><option value="assertEnabled">assertEnabled</option><option value="assertChecked">assertChecked</option><option value="hover">hover</option><option value="press">press</option><option value="upload">upload</option><option value="dragTo">dragTo</option></select></label>
                    <label><span>Target type</span><select value={step.targetType} onChange={(e) => updateAutomationStep(index, "targetType", e.target.value)}><option value="css">css</option><option value="id">id</option><option value="placeholder">placeholder</option><option value="text">text</option><option value="label">label</option><option value="testid">testid</option><option value="url">url</option></select></label>
                    <label><span>Timeout ms</span><input type="number" min="0" value={step.timeoutMs} onChange={(e) => updateAutomationStep(index, "timeoutMs", e.target.value)} /></label>
                  </div>
                  <div className="workspace-form__grid workspace-form__grid--three">
                    <label><span>Target</span><input value={step.target} onChange={(e) => updateAutomationStep(index, "target", e.target.value)} placeholder="#login-button / email / Username / submit-btn" /></label>
                    <label><span>Value</span><input value={step.value} onChange={(e) => updateAutomationStep(index, "value", e.target.value)} placeholder="Text to type, option value, path, key combo, file path, drop target..." /></label>
                    <label><span>Expected</span><input value={step.expected} onChange={(e) => updateAutomationStep(index, "expected", e.target.value)} placeholder="Text, title or URL fragment to assert" /></label>
                  </div>
                  <div className="workspace-inline-actions workspace-inline-actions--right"><button type="button" className="workspace-secondary" onClick={() => removeAutomationStep(index)}>Remove automation step</button></div>
                </div>
              ))}
            </div>
          </label>
          <div className="workspace-inline-actions">
            <button className="workspace-primary" type="submit">{editingTestCaseId ? "Save test case" : "Create test case"}</button>
            {editingTestCaseId && <button type="button" className="workspace-secondary" onClick={cancelTestCaseEdit}>Cancel</button>}
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Test Case List" subtitle="Khong gom form CRUD tren cung mot page">
        <DataTable
          columns={["Case", "Project", "Group", "Action"]}
          rows={testCases.filter((testCase) => matchesSearch(testCase.caseKey, testCase.title, testCase.project?.name, testCase.group?.name)).map((testCase) => (
            <>
              <div>{testCase.caseKey} - {testCase.title}</div>
              <div>{testCase.project?.name || "-"}</div>
              <div>{testCase.group?.name || "-"}</div>
              <div className="workspace-inline-actions">
                <button type="button" className="workspace-secondary" onClick={() => startTestCaseEdit(testCase)}>Edit</button>
                <button type="button" className="workspace-danger" onClick={() => deleteTestCase(testCase._id)}>Delete</button>
              </div>
            </>
          ))}
          emptyText="No test cases"
        />
      </SectionCard>
    </div>
  );
}