"use client";

import { useState } from "react";
import type { Dispatch, DragEvent, ReactNode, SetStateAction } from "react";
import {
  ACTION_META,
  ALL_TARGET_TYPES,
  TARGET_TYPE_LABELS,
  getValueFieldLabel,
} from "@/lib/automationStepMeta";
import type { AutomationForm, AutomationStep } from "@/lib/automationStepMeta";
import { WORKBENCH_HINT_CLS, WORKBENCH_INPUT_CLS, WORKBENCH_LABEL_CLS, WORKBENCH_META_CLS, WORKBENCH_SELECT_CLS, WorkbenchField, WorkbenchSection } from "@/components/workspaceScreens/shared";

const ACTION_SELECT_OPTIONS = (
  <>
    <optgroup label="Điều hướng">
      <option value="goto">Đi đến trang (goto)</option>
    </optgroup>
    <optgroup label="Tương tác">
      <option value="click">Nhấn vào phần tử (click)</option>
      <option value="type">Nhập văn bản (type)</option>
      <option value="select">Chọn dropdown (select)</option>
      <option value="hover">Di chuột vào (hover)</option>
      <option value="press">Nhấn phím (press)</option>
      <option value="upload">Upload file (upload)</option>
      <option value="dragTo">Kéo thả (dragTo)</option>
    </optgroup>
    <optgroup label="Chờ">
      <option value="wait">Chờ trang load (wait)</option>
      <option value="waitFor">Chờ phần tử / thời gian (waitFor)</option>
    </optgroup>
    <optgroup label="Assert">
      <option value="assertText">Kiểm tra văn bản (assertText)</option>
      <option value="assertVisible">Kiểm tra hiển thị (assertVisible)</option>
      <option value="assertHidden">Kiểm tra bị ẩn (assertHidden)</option>
      <option value="assertUrl">Kiểm tra URL (assertUrl)</option>
      <option value="assertTitle">Kiểm tra tiêu đề tab (assertTitle)</option>
      <option value="assertEnabled">Kiểm tra không bị khóa (assertEnabled)</option>
      <option value="assertChecked">Kiểm tra checkbox đã tích (assertChecked)</option>
    </optgroup>
  </>
);

type Props = {
  automationForm: AutomationForm;
  setAutomationForm: Dispatch<SetStateAction<AutomationForm>>;
  addAutomationStep: () => void;
  updateAutomationStep: (index: number, key: string, value: string) => void;
  removeAutomationStep: (index: number) => void;
  moveAutomationStep: (fromIndex: number, toIndex: number) => void;
};

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

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
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
      hint={automationForm.enabled ? "Auto" : "Tắt"}
      tone={automationForm.enabled ? "automation" : "default"}
      action={
        <select
          value={automationForm.enabled ? "true" : "false"}
          onChange={(e) =>
            setAutomationForm((prev) => ({
              ...prev,
              enabled: e.target.value === "true",
            }))
          }
          className={`${WORKBENCH_SELECT_CLS} w-auto shrink-0`}
        >
          <option value="false">Thủ công</option>
          <option value="true">Auto</option>
        </select>
      }
    >
      {automationForm.enabled && (
        <>
          <WorkbenchField label="URL gốc">
            <input
              value={automationForm.baseUrl}
              onChange={(e) =>
                setAutomationForm((prev) => ({ ...prev, baseUrl: e.target.value }))
              }
              className={WORKBENCH_INPUT_CLS}
              placeholder="https://app.example.com"
              title="Goto có thể dùng path tương đối (/login)"
            />
          </WorkbenchField>

          <div className="grid grid-cols-3 gap-1.5">
            <WorkbenchField label="Web ID">
              <input
                value={automationForm.webId}
                onChange={(e) =>
                  setAutomationForm((prev) => ({ ...prev, webId: e.target.value }))
                }
                className={WORKBENCH_INPUT_CLS}
                placeholder="my-app-staging"
              />
            </WorkbenchField>

            <WorkbenchField label="Profile user">
              <input
                value={automationForm.userKey}
                onChange={(e) =>
                  setAutomationForm((prev) => ({ ...prev, userKey: e.target.value }))
                }
                className={WORKBENCH_INPUT_CLS}
                placeholder="admin"
              />
            </WorkbenchField>

            <WorkbenchField label="Timeout (s)">
              <input
                type="number"
                min="1"
                value={automationForm.timeoutMs}
                onChange={(e) =>
                  setAutomationForm((prev) => ({ ...prev, timeoutMs: e.target.value }))
                }
                className={WORKBENCH_INPUT_CLS}
                placeholder="30"
                title="Mặc định 30s khi bước không khai timeout riêng"
              />
            </WorkbenchField>
          </div>

          <div className="mt-1 flex items-center justify-between gap-2 border-t border-slate-100 pt-1">
            <span className={WORKBENCH_HINT_CLS}>Bước tự động — kéo ≡</span>
            <button
              type="button"
              className={`${WORKBENCH_META_CLS} rounded border border-slate-200 bg-white px-1.5 py-px hover:bg-slate-50`}
              onClick={addAutomationStep}
            >
              + Thêm bước
            </button>
          </div>

          <div className="mt-1.5 space-y-1 rounded-md border border-emerald-200/60 bg-emerald-50/50 p-1.5">
            {automationForm.steps.map((step, index) => (
              <AutomationStepRow
                key={step.stepId || index}
                step={step}
                index={index}
                onUpdate={updateAutomationStep}
                onRemove={removeAutomationStep}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={() => setDraggingStep(null)}
              />
            ))}
          </div>

          {automationForm.steps.length === 0 && (
            <div className={`${WORKBENCH_META_CLS} mt-1.5 rounded border border-dashed border-slate-200 py-1.5 text-center text-slate-500`}>
              Chưa có bước nào. Nhấn &quot;+ Thêm bước&quot; để bắt đầu.
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
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (index: number, event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
};

const FIELD_FULL = WORKBENCH_INPUT_CLS;
const TIMEOUT_COL_W = "w-[2.25rem] shrink-0";

function StepFieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className={`mb-0.5 block truncate ${WORKBENCH_LABEL_CLS}`}>
      {children}
    </span>
  );
}

function StepTimeoutInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="number"
      min="1"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${WORKBENCH_INPUT_CLS} ${TIMEOUT_COL_W} px-1 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
      placeholder="—"
      title="Timeout bước (giây). Để trống = dùng timeout mặc định của test case."
    />
  );
}

/** Một ô timeout cố định cột phải — chỉ hiện ở hàng tham số đầu tiên của bước */
function StepTimeoutCell({
  show,
  value,
  onChange,
}: {
  show: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  if (!show) {
    return <div className={TIMEOUT_COL_W} aria-hidden />;
  }
  return (
    <div className={TIMEOUT_COL_W}>
      <StepFieldLabel>
        <span className="block text-right">T.s</span>
      </StepFieldLabel>
      <StepTimeoutInput value={value} onChange={onChange} />
    </div>
  );
}

function AutomationStepRow({
  step,
  index,
  onUpdate,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: StepRowProps) {
  const meta = ACTION_META[step.action] ?? ACTION_META.goto;
  const allowedTargetTypes =
    meta.targetTypes.length > 0 ? meta.targetTypes : [...ALL_TARGET_TYPES];
  const isWaitStep = step.action === "wait";
  const showSelectorGroup =
    !isWaitStep && (meta.needsTarget || Boolean(meta.optionalTarget));
  const selectorRequired = meta.needsTarget;
  const showValue = !isWaitStep && meta.needsValue;
  const showExpected = !isWaitStep && meta.needsExpected;
  const valueLabel = getValueFieldLabel(step.action);
  const selectorLabel =
    step.action === "dragTo" ? "Phần tử nguồn" : "Selector / text";

  const timeoutOnSelector = showSelectorGroup;
  const timeoutOnValue = !showSelectorGroup && showValue;
  const timeoutOnExpected = !showSelectorGroup && !showValue && showExpected;
  const timeoutOnAction = isWaitStep || (!showSelectorGroup && !showValue && !showExpected);

  const setTimeout = (value: string) => onUpdate(index, "timeoutMs", value);

  return (
    <div
      className="rounded-md border border-emerald-300/70 bg-emerald-50/90 p-1.5"
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(index, e)}
    >
      {/* Hàng tiêu đề bước */}
      <div className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-1.5">
        <button
          type="button"
          className={`${WORKBENCH_META_CLS} cursor-grab rounded border border-slate-200 px-1 py-px text-slate-500 hover:text-slate-700`}
          draggable
          onDragStart={(e) => onDragStart(index, e)}
          onDragEnd={onDragEnd}
          aria-label="Kéo để sắp xếp lại"
        >
          ≡
        </button>
        <span className="w-3 text-center text-[10px] font-medium tabular-nums text-slate-600">
          {index + 1}
        </span>
        <input
          value={step.stepName}
          onChange={(e) => onUpdate(index, "stepName", e.target.value)}
          placeholder={`Tên — ${meta.label}`}
          className={FIELD_FULL}
        />
        <button
          type="button"
          className={`${WORKBENCH_META_CLS} rounded border border-rose-100 px-1.5 py-px text-rose-600 hover:bg-rose-50`}
          onClick={() => onRemove(index)}
        >
          Xóa
        </button>
      </div>

      {/* Khối tham số — grid 3 cột: loại selector | field chính | timeout */}
      <div className="mt-1 space-y-1 rounded-md border border-emerald-200/80 bg-white/80 p-1.5">
        <div className="grid grid-cols-[3.75rem_minmax(0,1fr)_2.25rem] items-end gap-x-1.5 gap-y-1">
          {/* Hàng hành động — cột 1 trống, select span cột 2 */}
          <div aria-hidden />
          <div className="min-w-0">
            <StepFieldLabel>Hành động</StepFieldLabel>
            <select
              value={step.action}
              onChange={(e) => onUpdate(index, "action", e.target.value)}
              className={WORKBENCH_SELECT_CLS}
            >
              {ACTION_SELECT_OPTIONS}
            </select>
          </div>
          <StepTimeoutCell
            show={timeoutOnAction}
            value={step.timeoutMs}
            onChange={setTimeout}
          />

          {isWaitStep && (
            <p className={`${WORKBENCH_META_CLS} col-span-3 leading-snug text-amber-900`}>
              Chờ trang load — không cần selector.
            </p>
          )}

          {showSelectorGroup && (
            <>
              <div className="min-w-0">
                <StepFieldLabel>Loại</StepFieldLabel>
                <select
                  value={step.targetType}
                  onChange={(e) => onUpdate(index, "targetType", e.target.value)}
                  className={`${WORKBENCH_SELECT_CLS} font-mono`}
                  title="Loại selector"
                  aria-label="Loại selector"
                >
                  {allowedTargetTypes.map((t) => (
                    <option key={t} value={t}>
                      {TARGET_TYPE_LABELS[t] ?? t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <StepFieldLabel>
                  {selectorLabel}
                  {selectorRequired ? " *" : ""}
                </StepFieldLabel>
                <input
                  value={step.target}
                  onChange={(e) => onUpdate(index, "target", e.target.value)}
                  placeholder={meta.targetPlaceholder}
                  className={FIELD_FULL}
                />
              </div>
              <StepTimeoutCell
                show={timeoutOnSelector}
                value={step.timeoutMs}
                onChange={setTimeout}
              />
            </>
          )}

          {showValue && (
            <>
              <div aria-hidden />
              <div className="min-w-0">
                <StepFieldLabel>{valueLabel} *</StepFieldLabel>
                <input
                  value={step.value}
                  onChange={(e) => onUpdate(index, "value", e.target.value)}
                  placeholder={meta.valuePlaceholder}
                  className={FIELD_FULL}
                />
              </div>
              <StepTimeoutCell
                show={timeoutOnValue}
                value={step.timeoutMs}
                onChange={setTimeout}
              />
            </>
          )}

          {showExpected && (
            <>
              <div aria-hidden />
              <div className="min-w-0">
                <StepFieldLabel>Chuỗi mong đợi *</StepFieldLabel>
                <input
                  value={step.expected}
                  onChange={(e) => onUpdate(index, "expected", e.target.value)}
                  placeholder={meta.expectedPlaceholder}
                  className={FIELD_FULL}
                />
              </div>
              <StepTimeoutCell
                show={timeoutOnExpected}
                value={step.timeoutMs}
                onChange={setTimeout}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
