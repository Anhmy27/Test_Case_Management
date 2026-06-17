"use client";

import FailureScreenshot from "./FailureScreenshot";

type ExecutionHistoryScreenshotModalProps = {
  runId: string;
  resultId: string;
  caseLabel?: string;
  onClose: () => void;
};

export default function ExecutionHistoryScreenshotModal({
  runId,
  resultId,
  caseLabel,
  onClose,
}: ExecutionHistoryScreenshotModalProps) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
          aria-label="Close"
        >
          ✕
        </button>
        <div className="mb-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Failure screenshot</div>
          {caseLabel ? <div className="mt-1 text-sm font-semibold text-slate-900">{caseLabel}</div> : null}
        </div>
        <FailureScreenshot
          runId={runId}
          resultId={resultId}
          status="fail"
          failureScreenshot="available"
        />
      </div>
    </div>
  );
}
