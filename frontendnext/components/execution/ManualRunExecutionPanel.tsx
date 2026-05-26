"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Dispatch, SetStateAction } from "react";

type RecordAny = Record<string, any>;

interface ManualRunExecutionPanelProps {
  selectedRun: RecordAny | null;
  myItems: RecordAny[];
  selectedItemId: string;
  setSelectedItemId: Dispatch<SetStateAction<string>>;
  selectedItem?: RecordAny;
  notes: Record<string, string>;
  setNotes: Dispatch<SetStateAction<Record<string, string>>>;
  onUpdateResult: (
    resultId: string,
    status: "pass" | "fail" | "blocked" | "skip",
    note: string,
    notes: string,
  ) => void;
  onEndRun: () => void;
  canEditRun: boolean;
  onLogBug?: (run: RecordAny, result: RecordAny) => void;
}

export default function ManualRunExecutionPanel({
  selectedRun,
  myItems,
  selectedItemId,
  setSelectedItemId,
  selectedItem,
  notes,
  setNotes,
  onUpdateResult,
  onEndRun,
  canEditRun,
  onLogBug,
}: ManualRunExecutionPanelProps) {
  const getExpectedResultText = (testCase: RecordAny) => {
    const steps = Array.isArray(testCase?.steps) ? testCase.steps : [];
    const uniqueExpected = Array.from(
      new Set(
        steps
          .map((step: RecordAny) => String(step.expected || "").trim())
          .filter(Boolean),
      ),
    );

    if (uniqueExpected.length > 0) {
      return uniqueExpected.join("\n");
    }

    return testCase?.expected || "N/A";
  };

  const currentIndex = myItems.findIndex((item: RecordAny) => item._id === selectedItemId);
  const nextItem = currentIndex >= 0
    ? myItems.slice(currentIndex + 1).find((item: RecordAny) => item.status !== "pass") || myItems[currentIndex + 1]
    : undefined;
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
  const canLogBug = selectedRun?.status === "completed" && selectedItem?.status === "fail";

  const goToNextItem = async () => {
    if (!nextItem) {
      return;
    }

    setSelectedItemId(nextItem._id);
  };

  return (
    <div className="execution-grid">
      <section className="execution-list">
        <div className="workspace-card workspace-card--flush">
          <div className="workspace-card__header">
            <div>
              <h2>Test Cases</h2>
              <p>Chon testcase dang execute</p>
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
              <p>Title, steps, expected, actual result</p>
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
                  <span className="workspace-chip">Priority: {selectedItem.testCase?.priority || "n/a"}</span>
                  <span className="workspace-chip">Result owner: {selectedItem.tester?.name || selectedItem.owner?.name || "-"}</span>
                  {selectedItem.executedAt ? <span className="workspace-chip">Updated: {new Date(selectedItem.executedAt).toLocaleString()}</span> : null}
                  {canLogBug && onLogBug && (
                    <button type="button" className="workspace-secondary" onClick={() => onLogBug(selectedRun, selectedItem)}>
                      Log Bug
                    </button>
                  )}
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
                <p style={{ whiteSpace: "pre-line" }}>
                  {getExpectedResultText(selectedItem.testCase)}
                </p>
              </div>
              <div className="workspace-form">
                <label>
                  <span>Actual result</span>
                  <textarea
                    rows={4}
                    value={notes[selectedItem._id] ?? selectedItem.note ?? ""}
                    readOnly={!canEditRun}
                    onChange={(e) =>
                      canEditRun &&
                      setNotes((prev) => ({
                        ...prev,
                        [selectedItem._id]: e.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Notes</span>
                  <textarea
                    rows={3}
                    value={notes[`${selectedItem._id}:notes`] ?? selectedItem.notes ?? ""}
                    readOnly={!canEditRun}
                    onChange={(e) =>
                      canEditRun &&
                      setNotes((prev) => ({
                        ...prev,
                        [`${selectedItem._id}:notes`]: e.target.value,
                      }))
                    }
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </section>

      {canEditRun && (
        <div className="execution-actions">
          <div className="execution-actions__main">
            <div className="execution-actions__row execution-actions__row--nav">
              <button
                type="button"
                className="workspace-secondary"
                disabled={!nextItem}
                onClick={() => nextItem && setSelectedItemId(nextItem._id)}
              >
                Next case
              </button>
            </div>

            <div className="execution-actions__row execution-actions__row--results">
              <button
                type="button"
                className={selectedItem?.status === "pass" ? "workspace-primary is-selected" : "workspace-primary"}
                onClick={async () => {
                  if (!selectedItemId) return;
                  await onUpdateResult(selectedItemId, "pass", notes[selectedItemId] || "", notes[`${selectedItemId}:notes`] || "");
                  void goToNextItem();
                }}
              >
                Pass
              </button>
              <button
                type="button"
                className={selectedItem?.status === "fail" ? "workspace-danger is-selected" : "workspace-danger"}
                onClick={async () => {
                  if (!selectedItemId) return;
                  await onUpdateResult(selectedItemId, "fail", notes[selectedItemId] || "", notes[`${selectedItemId}:notes`] || "");
                  void goToNextItem();
                }}
              >
                Fail
              </button>
              <button
                type="button"
                className={selectedItem?.status === "blocked" ? "workspace-secondary is-selected" : "workspace-secondary"}
                onClick={async () => {
                  if (!selectedItemId) return;
                  await onUpdateResult(selectedItemId, "blocked", notes[selectedItemId] || "", notes[`${selectedItemId}:notes`] || "");
                  void goToNextItem();
                }}
              >
                Blocked
              </button>
              <button
                type="button"
                className={selectedItem?.status === "skip" ? "workspace-secondary is-selected" : "workspace-secondary"}
                onClick={async () => {
                  if (!selectedItemId) return;
                  await onUpdateResult(selectedItemId, "skip", notes[selectedItemId] || "", notes[`${selectedItemId}:notes`] || "");
                  void goToNextItem();
                }}
              >
                Skip
              </button>
            </div>
          </div>

          {selectedRun?.status === "running" && (
            <div className="execution-actions__side">
              <button type="button" className="workspace-danger execution-actions__end" onClick={onEndRun}>
                End current run
              </button>
            </div>
          )}
        </div>
      )}

      <div className="workspace-note">
        <strong>Pass</strong> = case chạy đúng như mong đợi. <strong>Fail</strong> = case lỗi so với expected. <strong>Blocked</strong> = bị kẹt do thiếu dữ liệu, môi trường hoặc phụ thuộc. <strong>Skip</strong> = tạm bỏ qua, chưa chạy ở lượt này.
      </div>
    </div>
  );
}