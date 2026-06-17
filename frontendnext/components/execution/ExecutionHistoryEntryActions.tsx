"use client";

type HistoryEntry = {
  runId?: string;
  resultId?: string;
  status?: string;
  hasFailureScreenshot?: boolean;
};

type ExecutionHistoryEntryActionsProps = {
  entry: HistoryEntry;
  onOpenRun?: (runId: string, resultId: string) => void;
  onViewScreenshot?: (runId: string, resultId: string) => void;
  onLogBug?: (runId: string, resultId: string) => void;
  compact?: boolean;
};

export default function ExecutionHistoryEntryActions({
  entry,
  onOpenRun,
  onViewScreenshot,
  onLogBug,
  compact = false,
}: ExecutionHistoryEntryActionsProps) {
  const runId = String(entry.runId || "").trim();
  const resultId = String(entry.resultId || "").trim();
  const canAct = Boolean(runId && resultId);
  const isFail = entry.status === "fail";
  const canShowScreenshot = isFail && Boolean(entry.hasFailureScreenshot) && canAct;

  const buttonClass = compact
    ? "rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    : "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex flex-wrap gap-1.5">
      {onOpenRun ? (
        <button
          type="button"
          className={buttonClass}
          disabled={!canAct}
          title={canAct ? "Mở test run và chọn đúng kết quả này" : "Thiếu runId/resultId"}
          onClick={() => {
            if (!canAct) return;
            onOpenRun(runId, resultId);
          }}
        >
          Open run
        </button>
      ) : null}
      {onViewScreenshot ? (
        <button
          type="button"
          className={buttonClass}
          disabled={!canShowScreenshot}
          title={canShowScreenshot ? "Xem screenshot khi fail" : "Không có screenshot"}
          onClick={() => {
            if (!canShowScreenshot) return;
            onViewScreenshot(runId, resultId);
          }}
        >
          Screenshot
        </button>
      ) : null}
      {onLogBug ? (
        <button
          type="button"
          className={`${buttonClass} border-rose-200 text-rose-700 hover:border-rose-300 hover:bg-rose-50`}
          disabled={!canAct || !isFail}
          title={isFail ? "Log bug Jira cho kết quả fail này" : "Chỉ dùng cho case fail"}
          onClick={() => {
            if (!canAct || !isFail) return;
            onLogBug(runId, resultId);
          }}
        >
          Log bug
        </button>
      ) : null}
    </div>
  );
}
