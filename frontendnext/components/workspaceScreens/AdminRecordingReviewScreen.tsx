"use client";

import { useEffect, useState } from "react";
import { formatVietnamDateTime } from "@/lib/vietnamDateTime";
import {
  formatLocatorCandidate,
  formatRecordingReviewStatus,
  formatRecordingSessionStatus,
  recordingReviewStatusClassName,
  sortRecordingDraftSteps,
  type RecordingDraftStep,
  type RecordingDraftStepPatch,
  type RecordingIntentBlock,
  type RecordingPreviewResult,
  type RecordingSession,
} from "@/lib/recordingSession";
import DryRunResultView from "@/components/automation/DryRunResultView";
import { Button, SectionCard, WorkbenchField, WORKBENCH_INPUT_CLS, WORKBENCH_SELECT_CLS } from "./shared";

type Props = {
  session: RecordingSession | null;
  projectMismatch: boolean;
  onSaveDraft: (patches: RecordingDraftStepPatch[]) => Promise<boolean>;
  saving: boolean;
  onPreview: (options: { baseUrl?: string; webId?: string; userKey?: string }) => Promise<RecordingPreviewResult | null>;
  previewing: boolean;
  onMerge: (testCaseId: string) => Promise<boolean>;
  merging: boolean;
};

type PatchableField = keyof Omit<RecordingDraftStepPatch, "draftStepId">;
type DraftPatchMap = Record<string, RecordingDraftStepPatch>;

/** Merge one field edit into the patch map — drops the field/entry when it matches the baseline again. */
function withDraftFieldChange(
  prev: DraftPatchMap,
  step: RecordingDraftStep,
  field: PatchableField,
  value: string | number,
): DraftPatchMap {
  const baseline = (step as unknown as Record<string, unknown>)[field];
  const entry: Record<string, unknown> = { ...(prev[step.draftStepId] || { draftStepId: step.draftStepId }) };

  if (value === baseline) {
    delete entry[field];
  } else {
    entry[field] = value;
  }

  const next = { ...prev };
  const hasFields = Object.keys(entry).some((key) => key !== "draftStepId");
  if (hasFields) {
    next[step.draftStepId] = entry as RecordingDraftStepPatch;
  } else {
    delete next[step.draftStepId];
  }
  return next;
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-zinc-500">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-slate-900 dark:text-zinc-100">{value || "—"}</div>
    </div>
  );
}

function DraftStepRow({
  step,
  editable,
  patch,
  onFieldChange,
  onReviewStatusChange,
}: {
  step: RecordingDraftStep;
  editable: boolean;
  patch?: RecordingDraftStepPatch;
  onFieldChange: (field: PatchableField, value: string | number) => void;
  onReviewStatusChange: (reviewStatus: string) => void;
}) {
  const candidates = Array.isArray(step.locatorCandidates) ? step.locatorCandidates : [];
  const effectiveReviewStatus = patch?.reviewStatus ?? step.reviewStatus;
  const effectiveChosenLocatorIndex = patch?.chosenLocatorIndex ?? step.chosenLocatorIndex ?? 0;
  const chosenLocator = candidates[effectiveChosenLocatorIndex] || candidates[0] || null;
  const isRejected = effectiveReviewStatus === "rejected";

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
      <td className="px-3 py-2 text-sm text-slate-700 dark:text-zinc-300">
        {editable ? (
          <input
            className={WORKBENCH_INPUT_CLS}
            value={patch?.value ?? step.value ?? ""}
            onChange={(event) => onFieldChange("value", event.target.value)}
          />
        ) : (
          <span className="break-all">{step.value || "—"}</span>
        )}
      </td>
      <td className="px-3 py-2 text-sm text-slate-700 dark:text-zinc-300">
        {editable ? (
          <input
            className={WORKBENCH_INPUT_CLS}
            value={patch?.expected ?? step.expected ?? ""}
            onChange={(event) => onFieldChange("expected", event.target.value)}
          />
        ) : (
          <span className="break-all">{step.expected || "—"}</span>
        )}
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${recordingReviewStatusClassName(effectiveReviewStatus)}`}
          >
            {formatRecordingReviewStatus(effectiveReviewStatus)}
          </span>
          {editable ? (
            <>
              <button
                type="button"
                onClick={() => onReviewStatusChange("accepted")}
                className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-500 hover:border-emerald-300 hover:text-emerald-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
              >
                Giữ
              </button>
              <button
                type="button"
                onClick={() => onReviewStatusChange("rejected")}
                className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-500 hover:border-rose-300 hover:text-rose-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
              >
                Bỏ
              </button>
            </>
          ) : null}
        </div>
      </td>
      <td className="px-3 py-2 text-sm text-slate-700 dark:text-zinc-300">
        {editable && candidates.length > 0 ? (
          <select
            className={WORKBENCH_SELECT_CLS}
            value={effectiveChosenLocatorIndex}
            onChange={(event) => onFieldChange("chosenLocatorIndex", Number(event.target.value))}
          >
            {candidates.map((candidate, index) => (
              <option key={index} value={index}>
                {formatLocatorCandidate(candidate)}
              </option>
            ))}
          </select>
        ) : (
          (chosenLocator ? formatLocatorCandidate(chosenLocator) : "—")
        )}
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
        {candidates.length === 0 ? (
          "—"
        ) : (
          <ul className="space-y-1">
            {candidates.map((candidate, index) => (
              <li
                key={`${step.draftStepId}-${index}`}
                className={index === effectiveChosenLocatorIndex ? "font-medium text-slate-900 dark:text-zinc-100" : undefined}
              >
                {index === effectiveChosenLocatorIndex ? "★ " : "· "}
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

/** SR-4.6 — xem thử (dry run từ draft) rồi lưu vào test case (merge), đóng SR-4. */
function PreviewMergeSection({
  session,
  pendingEditsCount,
  projectMismatch,
  onPreview,
  previewing,
  onMerge,
  merging,
}: {
  session: RecordingSession;
  pendingEditsCount: number;
  projectMismatch: boolean;
  onPreview: (options: { baseUrl?: string; webId?: string; userKey?: string }) => Promise<RecordingPreviewResult | null>;
  previewing: boolean;
  onMerge: (testCaseId: string) => Promise<boolean>;
  merging: boolean;
}) {
  const [baseUrlOverride, setBaseUrlOverride] = useState("");
  const [webId, setWebId] = useState("");
  const [userKey, setUserKey] = useState("");
  const [testCaseIdInput, setTestCaseIdInput] = useState(session.testCaseEntityId || "");
  const [previewResult, setPreviewResult] = useState<RecordingPreviewResult | null>(null);

  useEffect(() => {
    setPreviewResult(null);
    setTestCaseIdInput(session.testCaseEntityId || "");
  }, [session.id, session.testCaseEntityId]);

  if (session.status === "merged") {
    return (
      <SectionCard title="Đã lưu vào test case" subtitle="Session đã merge — không sửa/xem thử được nữa">
        <p className="text-sm text-slate-700 dark:text-zinc-300">
          Test case entity: <span className="font-medium">{session.testCaseEntityId || "—"}</span>
        </p>
      </SectionCard>
    );
  }

  const canAct =
    !projectMismatch
    && session.status === "ready_for_review"
    && pendingEditsCount === 0;
  const hasTestCaseTarget = Boolean(testCaseIdInput.trim());

  return (
    <SectionCard
      title="Xem thử & Lưu"
      subtitle={
        projectMismatch
          ? "Session lệch project scope — chỉ xem, không chạy thử / lưu"
          : pendingEditsCount > 0
            ? "Lưu nháp trước khi xem thử hoặc lưu vào test case"
            : "Chạy thử các bước nháp (Playwright) rồi lưu vào test case khi ổn"
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <WorkbenchField label="Base URL ghi đè">
          <input
            className={WORKBENCH_INPUT_CLS}
            value={baseUrlOverride}
            onChange={(event) => setBaseUrlOverride(event.target.value)}
            placeholder={session.baseUrl}
          />
        </WorkbenchField>
        <WorkbenchField label="Web ID (đăng nhập)">
          <input
            className={WORKBENCH_INPUT_CLS}
            value={webId}
            onChange={(event) => setWebId(event.target.value)}
            placeholder="tuỳ chọn"
          />
        </WorkbenchField>
        <WorkbenchField label="User key (đăng nhập)">
          <input
            className={WORKBENCH_INPUT_CLS}
            value={userKey}
            onChange={(event) => setUserKey(event.target.value)}
            placeholder="tuỳ chọn"
          />
        </WorkbenchField>
      </div>

      <div className="mt-3">
        <Button
          variant="secondary"
          size="sm"
          disabled={!canAct}
          loading={previewing}
          onClick={async () => {
            const nextResult = await onPreview({ baseUrl: baseUrlOverride, webId, userKey });
            setPreviewResult(nextResult);
          }}
        >
          Chạy thử
        </Button>
      </div>

      {previewResult ? (
        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-zinc-800">
          <DryRunResultView result={previewResult} />
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3 dark:border-zinc-800">
        <WorkbenchField label="Test case entity ID" className="min-w-[220px]">
          <input
            className={WORKBENCH_INPUT_CLS}
            value={testCaseIdInput}
            onChange={(event) => setTestCaseIdInput(event.target.value)}
            placeholder={session.testCaseEntityId ? undefined : "Bắt buộc nếu session chưa gắn test case"}
          />
        </WorkbenchField>
        <Button
          variant="primary"
          size="sm"
          disabled={!canAct || !hasTestCaseTarget}
          loading={merging}
          onClick={() => onMerge(testCaseIdInput)}
        >
          Lưu vào test case
        </Button>
      </div>
    </SectionCard>
  );
}

export default function AdminRecordingReviewScreen({
  session,
  projectMismatch,
  onSaveDraft,
  saving,
  onPreview,
  previewing,
  onMerge,
  merging,
}: Props) {
  const [drafts, setDrafts] = useState<DraftPatchMap>({});

  // Loading a different session (topbar / URL change) must discard unsaved edits from the previous one.
  useEffect(() => {
    setDrafts({});
  }, [session?.id]);

  if (!session) {
    return (
      <SectionCard
        title="Recording review"
        subtitle="Nhập Session ID ở thanh trên và bấm Tải nháp để xem draft steps"
      >
        <p className="text-sm text-slate-600 dark:text-zinc-400">
          Màn hình này xem và sửa nháp từ phiên ghi — chưa ghi vào test case cho đến khi Lưu (SR-4.6).
        </p>
      </SectionCard>
    );
  }

  const draftSteps = sortRecordingDraftSteps(session.draftSteps || []);
  const intentBlocks = session.intentBlocks || [];
  const editable = session.status === "ready_for_review" && !projectMismatch;
  const pendingCount = Object.keys(drafts).length;

  const handleFieldChange = (step: RecordingDraftStep, field: PatchableField, value: string | number) => {
    setDrafts((prev) => withDraftFieldChange(prev, step, field, value));
  };

  const handleSave = async () => {
    const patches = Object.values(drafts);
    if (!patches.length) {
      return;
    }
    const success = await onSaveDraft(patches);
    if (success) {
      setDrafts({});
    }
  };

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
        subtitle={
          editable
            ? `${draftSteps.length} bước nháp · sửa value, locator, hoặc bỏ bước rồi bấm Lưu nháp`
            : projectMismatch
              ? `${draftSteps.length} bước nháp · chỉ xem (lệch project scope)`
              : `${draftSteps.length} bước nháp · chỉ xem (session đang ${formatRecordingSessionStatus(session.status)})`
        }
        actions={
          editable ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDrafts({})}
                disabled={pendingCount === 0 || saving}
              >
                Hủy sửa
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                disabled={pendingCount === 0}
                loading={saving}
              >
                {pendingCount > 0 ? `Lưu nháp (${pendingCount})` : "Lưu nháp"}
              </Button>
            </>
          ) : undefined
        }
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
                  <DraftStepRow
                    key={step.draftStepId}
                    step={step}
                    editable={editable}
                    patch={drafts[step.draftStepId]}
                    onFieldChange={(field, value) => handleFieldChange(step, field, value)}
                    onReviewStatusChange={(reviewStatus) => handleFieldChange(step, "reviewStatus", reviewStatus)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <PreviewMergeSection
        session={session}
        pendingEditsCount={pendingCount}
        projectMismatch={projectMismatch}
        onPreview={onPreview}
        previewing={previewing}
        onMerge={onMerge}
        merging={merging}
      />
    </div>
  );
}
