"use client";

import { formatVietnamDateTime } from "@/lib/vietnamDateTime";
import {
  formatLocatorCandidate,
  formatRecordingReviewStatus,
  formatRecordingSessionStatus,
  getChosenLocatorCandidate,
  recordingReviewStatusClassName,
  sortRecordingDraftSteps,
  type RecordingDraftStep,
  type RecordingIntentBlock,
  type RecordingSession,
} from "@/lib/recordingSession";
import { SectionCard } from "./shared";

type Props = {
  session: RecordingSession | null;
  projectMismatch: boolean;
};

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-zinc-500">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-slate-900 dark:text-zinc-100">{value || "—"}</div>
    </div>
  );
}

function DraftStepRow({ step }: { step: RecordingDraftStep }) {
  const chosenLocator = getChosenLocatorCandidate(step);
  const isRejected = step.reviewStatus === "rejected";

  return (
    <tr className={isRejected ? "opacity-60" : undefined}>
      <td className="whitespace-nowrap px-3 py-2 text-sm text-slate-700 dark:text-zinc-300">{step.order}</td>
      <td className="px-3 py-2 text-sm font-medium text-slate-900 dark:text-zinc-100">
        {step.inferredAction || "—"}
      </td>
      <td className="px-3 py-2 text-sm text-slate-700 dark:text-zinc-300">
        <div>{step.targetType || "—"}</div>
        <div className="mt-0.5 break-all text-xs text-slate-500 dark:text-zinc-500">{step.target || "—"}</div>
      </td>
      <td className="px-3 py-2 text-sm break-all text-slate-700 dark:text-zinc-300">{step.value || "—"}</td>
      <td className="px-3 py-2 text-sm break-all text-slate-700 dark:text-zinc-300">{step.expected || "—"}</td>
      <td className="px-3 py-2">
        <span
          className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${recordingReviewStatusClassName(step.reviewStatus)}`}
        >
          {formatRecordingReviewStatus(step.reviewStatus)}
        </span>
      </td>
      <td className="px-3 py-2 text-sm text-slate-700 dark:text-zinc-300">
        {chosenLocator ? formatLocatorCandidate(chosenLocator) : "—"}
      </td>
      <td className="px-3 py-2 text-sm text-slate-700 dark:text-zinc-300">
        {step.autoWaitSuggestion ? (
          <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {step.autoWaitSuggestion}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-2 text-xs text-slate-600 dark:text-zinc-400">
        {(step.locatorCandidates || []).length === 0 ? (
          "—"
        ) : (
          <ul className="space-y-1">
            {(step.locatorCandidates || []).map((candidate, index) => (
              <li
                key={`${step.draftStepId}-${index}`}
                className={index === (step.chosenLocatorIndex ?? 0) ? "font-medium text-slate-900 dark:text-zinc-100" : undefined}
              >
                {index === (step.chosenLocatorIndex ?? 0) ? "★ " : "· "}
                {formatLocatorCandidate(candidate)}
                {typeof candidate.score === "number" ? ` (${candidate.score})` : ""}
              </li>
            ))}
          </ul>
        )}
      </td>
    </tr>
  );
}

function IntentBlocksPanel({
  intentBlocks,
  draftSteps,
}: {
  intentBlocks: RecordingIntentBlock[];
  draftSteps: RecordingDraftStep[];
}) {
  if (!intentBlocks.length) {
    return (
      <SectionCard title="Intent blocks" subtitle="Nhóm ý định sau pipeline SR-3.1">
        <p className="text-sm text-slate-500 dark:text-zinc-400">Chưa có intent block cho session này.</p>
      </SectionCard>
    );
  }

  const orderByStepId = new Map(
    draftSteps.map((step) => [step.draftStepId, step.order]),
  );

  return (
    <SectionCard title="Intent blocks" subtitle="Nhóm ý định sau pipeline SR-3.1">
      <div className="space-y-3">
        {intentBlocks.map((block) => (
          <div
            key={block.blockId}
            className="rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <div className="font-medium text-slate-900 dark:text-zinc-100">{block.label}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-zinc-500">{block.blockId}</div>
            <div className="mt-2 text-sm text-slate-700 dark:text-zinc-300">
              Bước nháp:{" "}
              {(block.draftStepIds || [])
                .map((stepId) => {
                  const order = orderByStepId.get(stepId);
                  return order ? `#${order}` : stepId;
                })
                .join(", ") || "—"}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

export default function AdminRecordingReviewScreen({ session, projectMismatch }: Props) {
  if (!session) {
    return (
      <SectionCard
        title="Recording review"
        subtitle="Nhập Session ID ở thanh trên và bấm Tải nháp để xem draft steps (read-only)"
      >
        <p className="text-sm text-slate-600 dark:text-zinc-400">
          Màn hình này chỉ xem nháp từ phiên ghi — chưa sửa hay Lưu vào test case (SR-4.5 / SR-4.6).
        </p>
      </SectionCard>
    );
  }

  const draftSteps = sortRecordingDraftSteps(session.draftSteps || []);
  const intentBlocks = session.intentBlocks || [];

  return (
    <div className="space-y-5">
      {projectMismatch ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          Session thuộc project khác với project đang chọn ở scope. Vẫn hiển thị read-only.
        </div>
      ) : null}

      <SectionCard
        title="Phiên ghi"
        subtitle="Metadata session — không ghi đè test case"
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetaItem label="Session ID" value={session.id} />
          <MetaItem label="Trạng thái" value={formatRecordingSessionStatus(session.status)} />
          <MetaItem label="Base URL" value={session.baseUrl} />
          <MetaItem label="Test case entity" value={session.testCaseEntityId || "—"} />
          <MetaItem label="Số event" value={String(session.eventCount ?? 0)} />
          <MetaItem
            label="Dừng lúc"
            value={session.stoppedAt ? formatVietnamDateTime(session.stoppedAt) : "—"}
          />
          <MetaItem label="Project ID" value={session.projectId} />
          <MetaItem
            label="Hết hạn nháp"
            value={session.expiresAt ? formatVietnamDateTime(session.expiresAt) : "Giữ (merged)"}
          />
        </div>
      </SectionCard>

      <IntentBlocksPanel intentBlocks={intentBlocks} draftSteps={draftSteps} />

      <SectionCard
        title="Draft steps"
        subtitle={`${draftSteps.length} bước nháp · read-only`}
      >
        {draftSteps.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-zinc-400">Chưa có draft step.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-700">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-zinc-700">
              <thead className="bg-slate-50 dark:bg-zinc-900/80">
                <tr>
                  {["#", "Action", "Target", "Value", "Expected", "Review", "Locator chọn", "Auto-wait", "Ứng viên locator"].map((heading) => (
                    <th
                      key={heading}
                      className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-500"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                {draftSteps.map((step) => (
                  <DraftStepRow key={step.draftStepId} step={step} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
