"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect } from "react";
import { getId } from "@/lib/api";
import type { ReactNode } from "react";

type RecordAny = Record<string, any>;
type WorkbenchMode = "edit" | "create";

type Props = {
  mode: WorkbenchMode;
  onClose: () => void;
  cases: RecordAny[];
  activeCaseId: string;
  onSelectCase: (testCase: RecordAny) => void;
  children: ReactNode;
};

const modeTitle: Record<WorkbenchMode, string> = {
  edit: "Edit test case",
  create: "New test case",
};

const modeSubtitle: Record<WorkbenchMode, string> = {
  edit: "Edit fields and save",
  create: "Create a new test case",
};

export default function TestCaseWorkbenchModal({
  mode,
  onClose,
  cases,
  activeCaseId,
  onSelectCase,
  children,
}: Props) {
  const activeIndex = cases.findIndex(
    (item) => getId(item) === String(activeCaseId),
  );
  const canNavigate = mode === "edit" && cases.length > 0;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const goToCase = (direction: -1 | 1) => {
    if (!canNavigate || activeIndex < 0) return;
    const nextIndex = activeIndex + direction;
    if (nextIndex < 0 || nextIndex >= cases.length) return;
    onSelectCase(cases[nextIndex]);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="test-case-workbench-title"
      >
        <div className="shrink-0 border-b border-slate-200 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div
                id="test-case-workbench-title"
                className="text-lg font-semibold text-slate-900"
              >
                {modeTitle[mode]}
              </div>
              <div className="text-xs text-slate-500">{modeSubtitle[mode]}</div>
            </div>

            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-400 hover:bg-slate-50"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {canNavigate ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Chọn test case
              </span>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <button
                  type="button"
                  disabled={activeIndex <= 0}
                  onClick={() => goToCase(-1)}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Previous test case"
                >
                  ‹
                </button>
                <select
                  value={activeCaseId}
                  onChange={(event) => {
                    const nextCase = cases.find(
                      (item) => getId(item) === event.target.value,
                    );
                    if (nextCase) onSelectCase(nextCase);
                  }}
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
                >
                  {cases.map((item) => (
                    <option key={getId(item)} value={getId(item)}>
                      {item.caseKey} · {item.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={activeIndex < 0 || activeIndex >= cases.length - 1}
                  onClick={() => goToCase(1)}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Next test case"
                >
                  ›
                </button>
                {activeIndex >= 0 ? (
                  <span className="shrink-0 text-[11px] font-semibold text-slate-500">
                    {activeIndex + 1}/{cases.length}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
