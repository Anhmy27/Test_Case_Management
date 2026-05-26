"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Dispatch, SetStateAction } from "react";

type RecordAny = Record<string, any>;

interface AutomationRunExecutionPanelProps {
  selectedRun: RecordAny | null;
  myItems: RecordAny[];
  selectedItemId: string;
  setSelectedItemId: Dispatch<SetStateAction<string>>;
  selectedItem?: RecordAny;
  notes: Record<string, string>;
  setNotes: Dispatch<SetStateAction<Record<string, string>>>;
}

export default function AutomationRunExecutionPanel({
  selectedRun,
  myItems,
  selectedItemId,
  setSelectedItemId,
  selectedItem,
  notes,
  setNotes,
}: AutomationRunExecutionPanelProps) {
  const summary = myItems.reduce(
    (acc, item: RecordAny) => {
      const status = String(item.status || "untested");
      if (status === "pass") acc.pass += 1;
      else if (status === "fail") acc.fail += 1;
      else if (status === "blocked") acc.blocked += 1;
      else if (status === "skip") acc.skip += 1;
      else acc.pending += 1;
      return acc;
    },
    { pass: 0, fail: 0, blocked: 0, skip: 0, pending: 0 },
  );

  return (
    <div className="execution-grid">
      <section className="execution-list">
        <div className="workspace-card workspace-card--flush">
          <div className="workspace-card__header">
            <div>
              <h2>Test Cases</h2>
              <p>Automation run chi hien thi testcase va ket qua hien tai</p>
            </div>
            <div className="workspace-inline-actions">
              <span className="workspace-pill">{summary.pass} pass</span>
              <span className="workspace-pill">{summary.fail} fail</span>
              <span className="workspace-pill">{summary.blocked} blocked</span>
              <span className="workspace-pill">{summary.pending} pending</span>
            </div>
          </div>
          <div className="execution-list__items">
            {myItems.map((item: RecordAny) => {
              const active = item._id === selectedItemId;
              return (
                <button
                  key={item._id}
                  type="button"
                  className={active ? "execution-item is-active" : "execution-item"}
                  onClick={() => setSelectedItemId(item._id)}
                >
                  <span className="execution-item__status">{item.status}</span>
                  <strong>
                    {item.testCase?.caseKey || "TC"} - {item.testCase?.title || "Untitled"}
                  </strong>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="execution-detail">
        <div className="workspace-card workspace-card--flush">
          <div className="workspace-card__header">
            <div>
              <h2>Case Detail</h2>
              <p>Automation runs are read-only until result import is connected</p>
            </div>
          </div>

          {!selectedItem ? (
            <div className="workspace-empty">Chon mot testcase ben trai</div>
          ) : (
            <div className="execution-detail__body">
              <div className="execution-meta execution-meta--hero">
                <div className="execution-meta__head">
                  <div>
                    <h3>{selectedItem.testCase?.caseKey || "TC"} - {selectedItem.testCase?.title}</h3>
                    <p>{selectedItem.testCase?.description || "No description"}</p>
                  </div>
                  <span className={`workspace-pill status-${selectedItem.status}`}>
                    {selectedItem.status}
                  </span>
                </div>
                <div className="workspace-inline-actions">
                  <span className="workspace-chip">Automation review mode</span>
                  <span className="workspace-chip">Plan: {selectedRun?.testPlan?.name || selectedRun?.name || "-"}</span>
                </div>
              </div>
              <div className="execution-block">
                <strong>Steps</strong>
                <ol>
                  {(selectedItem.testCase?.steps || []).map((step: RecordAny, index: number) => (
                    <li key={index}>{step.action || step}</li>
                  ))}
                </ol>
              </div>
              <div className="execution-block">
                <strong>Expected result</strong>
                <p>{selectedItem.testCase?.expected || "N/A"}</p>
              </div>
              <div className="execution-block execution-block--muted">
                <strong>Execution note</strong>
                <p>{selectedItem.note || notes[selectedItem._id] || "No execution note yet"}</p>
              </div>
              <div className="workspace-form">
                <label>
                  <span>Current result note</span>
                  <textarea
                    rows={4}
                    value={notes[selectedItem._id] ?? selectedItem.note ?? ""}
                    readOnly
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="workspace-note">
        <strong>{selectedRun?.name || "Automation run"}</strong> is view only. Pass/fail/block/skip and end-run actions will be enabled after automated result import is connected.
      </div>
    </div>
  );
}