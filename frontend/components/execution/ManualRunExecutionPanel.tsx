"use client";

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
  ) => void;
  onEndRun: () => void;
  canEditRun: boolean;
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
}: ManualRunExecutionPanelProps) {
  return (
    <div className="execution-grid">
      <section className="execution-list">
        <div className="workspace-card workspace-card--flush">
          <div className="workspace-card__header">
            <div>
              <h2>Test Cases</h2>
              <p>Chon testcase dang execute</p>
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
              <div className="execution-meta">
                <div className="execution-meta__head">
                  <h3>{selectedItem.testCase?.title}</h3>
                  <span className={`workspace-pill status-${selectedItem.status}`}>
                    {selectedItem.status}
                  </span>
                </div>
                <p>{selectedItem.testCase?.description || "No description"}</p>
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
                    value={notes[`${selectedItem._id}:notes`] ?? ""}
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
          <button
            type="button"
            className={selectedItem?.status === "pass" ? "workspace-primary is-selected" : "workspace-primary"}
            onClick={() => selectedItemId && onUpdateResult(selectedItemId, "pass", notes[selectedItemId] || "")}
          >
            Pass
          </button>
          <button
            type="button"
            className={selectedItem?.status === "fail" ? "workspace-danger is-selected" : "workspace-danger"}
            onClick={() => selectedItemId && onUpdateResult(selectedItemId, "fail", notes[selectedItemId] || "")}
          >
            Fail
          </button>
          <button
            type="button"
            className={selectedItem?.status === "blocked" ? "workspace-secondary is-selected" : "workspace-secondary"}
            onClick={() => selectedItemId && onUpdateResult(selectedItemId, "blocked", notes[selectedItemId] || "")}
          >
            Blocked
          </button>
          <button
            type="button"
            className={selectedItem?.status === "skip" ? "workspace-secondary is-selected" : "workspace-secondary"}
            onClick={() => selectedItemId && onUpdateResult(selectedItemId, "skip", notes[selectedItemId] || "")}
          >
            Skip
          </button>
        </div>
      )}

      {canEditRun && selectedRun?.status === "running" && (
        <div className="workspace-inline-actions workspace-inline-actions--right">
          <button type="button" className="workspace-danger" onClick={onEndRun}>
            End current run
          </button>
        </div>
      )}

      <div className="workspace-note">
        <strong>Pass</strong> = case chạy đúng như mong đợi. <strong>Fail</strong> = case lỗi so với expected. <strong>Blocked</strong> = bị kẹt do thiếu dữ liệu, môi trường hoặc phụ thuộc. <strong>Skip</strong> = tạm bỏ qua, chưa chạy ở lượt này.
      </div>
    </div>
  );
}