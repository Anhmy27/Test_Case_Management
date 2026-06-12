"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import TestCaseExecutionHistoryPopup from "../workspaceScreens/TestCaseExecutionHistoryPopup";

type RecordAny = Record<string, any>;

type Props = {
  testCase?: RecordAny | null;
  projectId?: string;
};

export default function CaseHistoryButton({ testCase, projectId }: Props) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const caseKey = String(testCase?.caseKey || "").trim();
  const caseTitle = String(testCase?.title || "").trim();

  if (!caseKey) {
    return null;
  }

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          onClick={() => setHistoryOpen(true)}
        >
          History
        </button>
      </div>
      {historyOpen ? (
        <TestCaseExecutionHistoryPopup
          caseKey={caseKey}
          caseTitle={caseTitle || caseKey}
          projectId={projectId}
          onClose={() => setHistoryOpen(false)}
        />
      ) : null}
    </>
  );
}
