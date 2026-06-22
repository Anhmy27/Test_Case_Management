"use client";

import { useState } from "react";
import type { Dispatch, DragEvent, SetStateAction } from "react";
import {
  ACTION_META,
  TARGET_TYPE_LABELS,
  getStepFieldVisibility,
  getValueFieldLabel,
  stepUsesTargetAsPrimaryInput,
} from "@/lib/automationStepMeta";
import type { AutomationForm, AutomationStep } from "@/lib/automationStepMeta";
import { WORKBENCH_INPUT_CLS, WorkbenchSection } from "@/components/workspaceScreens/shared";

type Props = {
  automationForm: AutomationForm;
  setAutomationForm: Dispatch<SetStateAction<AutomationForm>>;
  addAutomationStep: () => void;
  updateAutomationStep: (index: number, key: string, value: string) => void;
  removeAutomationStep: (index: number) => void;
  moveAutomationStep: (fromIndex: number, toIndex: number) => void;
};

const ACTION_OPTIONS = (
  <>
    <optgroup label="Điều hướng">
      <option value="goto">goto</option>
    </optgroup>
    <optgroup label="Tương tác">
      <option value="click">click</option>
      <option value="type">type</option>
      <option value="select">select</option>
      <option value="hover">hover</option>
      <option value="press">press</option>
      <option value="upload">upload</option>
      <option value="dragTo">dragTo</option>
    </optgroup>
    <optgroup label="Chờ">
      <option value="wait">wait</option>
      <option value="waitFor">waitFor</option>
    </optgroup>
    <optgroup label="Assert">
      <option value="assertText">assertText</option>
      <option value="assertVisible">assertVisible</option>
      <option value="assertHidden">assertHidden</option>
      <option value="assertUrl">assertUrl</option>
      <option value="assertTitle">assertTitle</option>
      <option value="assertEnabled">assertEnabled</option>
      <option value="assertChecked">assertChecked</option>
    </optgroup>
  </>
);

const STEP_GRID =
  "grid grid-cols-[22px_24px_minmax(96px,0.9fr)_52px_64px_minmax(80px,1fr)_minmax(80px,1fr)_24px] items-center gap-1";

export default function AutomationConfigPanel({
  automationForm,
  setAutomationForm,
  addAutomationStep,
  updateAutomationStep,
  removeAutomationStep,
  moveAutomationStep,
}: Props) {
  const [draggingStep, setDraggingStep] = useState<number | null>(null);

  const handleDragStart = (index: number, event: DragEvent<HTMLElement>) => {
    setDraggingStep(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  };

  const handleDrop = (toIndex: number, event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const fromIndex =
      draggingStep ?? Number(event.dataTransfer.getData("text/plain"));
    if (!Number.isInteger(fromIndex) || fromIndex === toIndex) return;
    moveAutomationStep(fromIndex, toIndex);
    setDraggingStep(null);
  };

  return (
    <WorkbenchSection
      title="Automation"
      hint={automationForm.enabled ? "Playwright" : "Tắt"}
      action={
        <select
          value={automationForm.enabled ? "true" : "false"}
          onChange={(e) =>
            setAutomationForm((prev) => ({
              ...prev,
              enabled: e.target.value === "true",
            }))
          }
          className={`${WORKBENCH_INPUT_CLS} w-auto min-w-[120px] py-1`}
        >
          <option value="false">Tắt</option>
          <option value="true">Bật</option>
        </select>
      }
    >
      {automationForm.enabled && (
        <>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-0.5 sm:col-span-2 lg:col-span-4">
              <span className="text-[10px] text-slate-400">URL gốc</span>
              <input
                value={automationForm.baseUrl}
                onChange={(e) =>
                  setAutomationForm((prev) => ({ ...prev, baseUrl: e.target.value }))
                }
                className={WORKBENCH_INPUT_CLS}
                placeholder="https://app.example.com"
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-400">Web ID</span>
              <input
                value={automationForm.webId}
                onChange={(e) =>
                  setAutomationForm((prev) => ({ ...prev, webId: e.target.value }))
                }
                className={WORKBENCH_INPUT_CLS}
                placeholder="my-app-staging"
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-400">Profile user</span>
              <input
                value={automationForm.userKey}
                onChange={(e) =>
                  setAutomationForm((prev) => ({ ...prev, userKey: e.target.value }))
                }
                className={WORKBENCH_INPUT_CLS}
                placeholder="admin"
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-400">Timeout mặc định (s)</span>
              <input
                type="number"
                min="1"
                value={automationForm.timeoutMs}
                onChange={(e) =>
                  setAutomationForm((prev) => ({ ...prev, timeoutMs: e.target.value }))
                }
                className={WORKBENCH_INPUT_CLS}
                placeholder="30"
              />
            </label>
          </div>

          <div className="mt-1.5 flex justify-end">
            <button
              type="button"
              className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600 hover:bg-slate-100"
              onClick={addAutomationStep}
            >
              + Bước
            </button>
          </div>

          {automationForm.steps.length > 0 ? (
            <div className="mt-1 overflow-x-auto rounded border border-slate-200 bg-white">
              <div className="min-w-[680px]">
                <div
                  className={`${STEP_GRID} border-b border-slate-100 bg-slate-50/80 px-1 py-0.5 text-[9px] uppercase tracking-wide text-slate-400`}
                >
                  <span />
                  <span>#</span>
                  <span>Hành động</span>
                  <span title="Timeout riêng (giây)">T</span>
                  <span>Loại</span>
                  <span>Selector</span>
                  <span>Giá trị / mong đợi</span>
                  <span />
                </div>
                {automationForm.steps.map((step, index) => (
                  <AutomationStepRow
                    key={step.stepId || index}
                    step={step}
                    index={index}
                    onUpdate={updateAutomationStep}
                    onRemove={removeAutomationStep}
                    onDragStart={handleDragStart}
                    onDrop={handleDrop}
                    onDragEnd={() => setDraggingStep(null)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-1.5 rounded border border-dashed border-slate-200 py-2 text-center text-[10px] text-slate-400">
              Chưa có bước automation
            </div>
          )}
        </>
      )}
    </WorkbenchSection>
  );
}

type StepRowProps = {
  step: AutomationStep;
  index: number;
  onUpdate: (index: number, key: string, value: string) => void;
  onRemove: (index: number) => void;
  onDragStart: (index: number, event: DragEvent<HTMLElement>) => void;
  onDrop: (index: number, event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
};

function AutomationStepRow({
  step,
  index,
  onUpdate,
  onRemove,
  onDragStart,
  onDrop,
  onDragEnd,
}: StepRowProps) {
  const meta = ACTION_META[step.action] ?? ACTION_META.goto;
  const fields = getStepFieldVisibility(step.action);
  const targetAsPrimary = stepUsesTargetAsPrimaryInput(step.action);
  const allowedTargetTypes = meta.targetTypes.length > 0 ? meta.targetTypes : [];

  const primaryPlaceholder = (() => {
    if (fields.showValue) {
      return step.action === "press"
        ? "Enter, Tab, Escape..."
        : meta.valuePlaceholder || getValueFieldLabel(step.action);
    }
    if (fields.showExpected) return meta.expectedPlaceholder;
    if (targetAsPrimary) return meta.targetPlaceholder || "#submit · Đăng nhập (text)";
    return "";
  })();

  const primaryValue = fields.showValue
    ? step.value
    : fields.showExpected
      ? step.expected
      : targetAsPrimary
        ? step.target
        : "";

  const handlePrimaryChange = (raw: string) => {
    if (fields.showValue) onUpdate(index, "value", raw);
    else if (fields.showExpected) onUpdate(index, "expected", raw);
    else if (targetAsPrimary) onUpdate(index, "target", raw);
  };

  const showPrimaryInput =
    fields.showValue || fields.showExpected || targetAsPrimary;

  return (
    <div
      className={`${STEP_GRID} border-b border-slate-50 px-1 py-0.5 last:border-b-0 hover:bg-slate-50/50`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onDrop(index, e)}
      title={meta.description}
    >
      <button
        type="button"
        className="flex h-5 w-5 cursor-grab items-center justify-center text-[10px] text-slate-300 hover:text-slate-500"
        draggable
        onDragStart={(e) => onDragStart(index, e)}
        onDragEnd={onDragEnd}
        aria-label="Kéo để sắp xếp"
      >
        ≡
      </button>

      <span className="text-center text-[10px] text-slate-300">{index + 1}</span>

      <select
        value={step.action}
        onChange={(e) => onUpdate(index, "action", e.target.value)}
        className={WORKBENCH_INPUT_CLS}
      >
        {ACTION_OPTIONS}
      </select>

      <input
        type="number"
        min="1"
        value={step.timeoutMs}
        onChange={(e) => onUpdate(index, "timeoutMs", e.target.value)}
        placeholder="—"
        title="Để trống = timeout mặc định"
        className={`${WORKBENCH_INPUT_CLS} text-center`}
      />

      {fields.showTargetType ? (
        <select
          value={step.targetType}
          onChange={(e) => onUpdate(index, "targetType", e.target.value)}
          className={WORKBENCH_INPUT_CLS}
        >
          {allowedTargetTypes.map((t) => (
            <option key={t} value={t}>
              {TARGET_TYPE_LABELS[t] ?? t}
            </option>
          ))}
        </select>
      ) : (
        <span className="text-center text-[10px] text-slate-200">—</span>
      )}

      {fields.showTarget ? (
        <input
          value={step.target}
          onChange={(e) => onUpdate(index, "target", e.target.value)}
          placeholder={meta.targetPlaceholder}
          className={WORKBENCH_INPUT_CLS}
        />
      ) : (
        <span className="text-center text-[10px] text-slate-200">—</span>
      )}

      {showPrimaryInput ? (
        <input
          value={primaryValue}
          onChange={(e) => handlePrimaryChange(e.target.value)}
          placeholder={primaryPlaceholder}
          className={WORKBENCH_INPUT_CLS}
        />
      ) : (
        <span className="truncate px-0.5 text-[9px] text-slate-300">—</span>
      )}

      <button
        type="button"
        className="flex h-5 w-5 items-center justify-center text-xs text-rose-400 hover:text-rose-600"
        onClick={() => onRemove(index)}
        aria-label="Xóa bước"
      >
        ×
      </button>
    </div>
  );
}
