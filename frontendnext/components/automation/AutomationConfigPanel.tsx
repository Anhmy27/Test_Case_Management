"use client";

import { useState } from "react";
import type { Dispatch, DragEvent, SetStateAction } from "react";
import { ACTION_META, ALL_TARGET_TYPES, TARGET_TYPE_LABELS, getActionRequiredHints, getValueFieldLabel, stepHasParameterFields } from "@/lib/automationStepMeta";
import type { AutomationForm, AutomationStep } from "@/lib/automationStepMeta";

type Props = {
  automationForm: AutomationForm;
  setAutomationForm: Dispatch<SetStateAction<AutomationForm>>;
  addAutomationStep: () => void;
  updateAutomationStep: (index: number, key: string, value: string) => void;
  removeAutomationStep: (index: number) => void;
  moveAutomationStep: (fromIndex: number, toIndex: number) => void;
};

type DragPayload = { index: number };

export default function AutomationConfigPanel({
  automationForm,
  setAutomationForm,
  addAutomationStep,
  updateAutomationStep,
  removeAutomationStep,
  moveAutomationStep,
}: Props) {
  const [draggingStep, setDraggingStep] = useState<DragPayload | null>(null);

  const parseDragIndex = (data: string): number | null => {
    const index = Number(data);
    return Number.isInteger(index) ? index : null;
  };

  const handleDragStart = (index: number, event: DragEvent<HTMLElement>) => {
    setDraggingStep({ index });
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
      draggingStep?.index ?? parseDragIndex(event.dataTransfer.getData("text/plain"));
    if (fromIndex === null || fromIndex === toIndex) return;
    moveAutomationStep(fromIndex, toIndex);
    setDraggingStep(null);
  };

  const handleDragEnd = () => setDraggingStep(null);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Automation
        </div>
        {automationForm.enabled && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            Bật
          </span>
        )}
      </div>

      <div className="mt-2 grid gap-3">
        {/* Toggle */}
        <label className="text-xs font-semibold text-slate-500">
          Bật automation cho test case này?
          <select
            value={automationForm.enabled ? "true" : "false"}
            onChange={(e) =>
              setAutomationForm((prev) => ({
                ...prev,
                enabled: e.target.value === "true",
              }))
            }
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="false">Không — chạy thủ công</option>
            <option value="true">Có — chạy tự động bằng Playwright</option>
          </select>
        </label>

        {/* Config fields — shown when enabled */}
        {automationForm.enabled && (
          <>
            <label className="text-xs font-semibold text-slate-500">
              URL gốc
              <input
                value={automationForm.baseUrl}
                onChange={(e) =>
                  setAutomationForm((prev) => ({ ...prev, baseUrl: e.target.value }))
                }
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="https://app.example.com"
              />
              <span className="mt-1 block text-[11px] font-normal text-slate-400">
                Goto có thể dùng path tương đối (/login).
              </span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-slate-500">
                Web ID
                <input
                  value={automationForm.webId}
                  onChange={(e) =>
                    setAutomationForm((prev) => ({ ...prev, webId: e.target.value }))
                  }
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="my-app-staging"
                />
                <span className="mt-1 block text-[11px] font-normal text-slate-400">
                  Khóa session theo app/môi trường.
                </span>
              </label>

              <label className="text-xs font-semibold text-slate-500">
                Profile user
                <input
                  value={automationForm.userKey}
                  onChange={(e) =>
                    setAutomationForm((prev) => ({ ...prev, userKey: e.target.value }))
                  }
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="admin"
                />
                <span className="mt-1 block text-[11px] font-normal text-slate-400">
                  Tái sử dụng phiên đăng nhập.
                </span>
              </label>

              <label className="text-xs font-semibold text-slate-500">
                Timeout mặc định (giây)
                <input
                  type="number"
                  min="1"
                  value={automationForm.timeoutMs}
                  onChange={(e) =>
                    setAutomationForm((prev) => ({ ...prev, timeoutMs: e.target.value }))
                  }
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="30"
                />
                <span className="mt-1 block text-[11px] font-normal text-slate-400">
                  Áp dụng cho cả test case.
                </span>
              </label>
            </div>
          </>
        )}
      </div>

      {/* Step list — shown when enabled */}
      {automationForm.enabled && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-600">Các bước tự động</div>
              <div className="text-[11px] text-slate-500">Kéo ≡ để đổi thứ tự</div>
            </div>
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50"
              onClick={addAutomationStep}
            >
              + Thêm bước
            </button>
          </div>

          <AutomationQuickGuide />

          <div className="mt-3 space-y-3">
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
                onDragEnd={handleDragEnd}
              />
            ))}
          </div>

          {automationForm.steps.length === 0 && (
            <div className="mt-2 rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
              Chưa có bước nào. Nhấn &quot;+ Thêm bước&quot; để bắt đầu.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline quick guide (full doc: AUTOMATION_USER_GUIDE.md)
// ---------------------------------------------------------------------------

function AutomationQuickGuide() {
  return (
    <details className="mt-3 rounded-lg border border-sky-200 bg-sky-50/80 text-[11px] text-slate-700">
      <summary className="cursor-pointer select-none px-3 py-2 font-semibold text-sky-900">
        Hướng dẫn sử dụng automation (bấm để mở)
      </summary>
      <div className="space-y-3 border-t border-sky-100 px-3 py-3">
        <p>
          <strong>press</strong> = nhấn <strong>phím bàn phím</strong> (keyboard), không phải click màn hình.
          Muốn bấm nút dùng <strong>click</strong>. Phím Escape viết <code className="rounded bg-white px-1">Escape</code> (không dùng <code className="rounded bg-white px-1">Esc</code>).
          Ví dụ: <code className="rounded bg-white px-1">Enter</code>, <code className="rounded bg-white px-1">Tab</code>, <code className="rounded bg-white px-1">Escape</code>.
        </p>

        <div>
          <div className="mb-1 font-semibold text-slate-800">Loại selector — ý nghĩa ngắn</div>
          <div className="overflow-x-auto rounded border border-sky-100 bg-white">
            <table className="w-full min-w-[520px] text-left text-[10px]">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-2 py-1">Loại</th>
                  <th className="px-2 py-1">Điền gì</th>
                  <th className="px-2 py-1">Ví dụ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr><td className="px-2 py-1">CSS</td><td className="px-2 py-1">Selector CSS</td><td className="px-2 py-1">#submit, .btn</td></tr>
                <tr><td className="px-2 py-1">ID</td><td className="px-2 py-1">Giá trị id (không có #)</td><td className="px-2 py-1">username</td></tr>
                <tr><td className="px-2 py-1">Placeholder</td><td className="px-2 py-1">Text placeholder</td><td className="px-2 py-1">Email address</td></tr>
                <tr><td className="px-2 py-1">Text</td><td className="px-2 py-1">Chữ trên trang</td><td className="px-2 py-1">Đăng nhập</td></tr>
                <tr><td className="px-2 py-1">Label</td><td className="px-2 py-1">Nhãn form</td><td className="px-2 py-1">Username</td></tr>
                <tr><td className="px-2 py-1">data-testid</td><td className="px-2 py-1">Thuộc tính test id</td><td className="px-2 py-1">login-btn</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="mb-1 font-semibold text-slate-800">Loại selector theo hành động</div>
          <div className="overflow-x-auto rounded border border-sky-100 bg-white">
            <table className="w-full min-w-[520px] text-left text-[10px]">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-2 py-1">Hành động</th>
                  <th className="px-2 py-1">Selector hỗ trợ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr><td className="px-2 py-1">click, hover</td><td className="px-2 py-1">CSS, ID, Text, Label, data-testid</td></tr>
                <tr><td className="px-2 py-1">type</td><td className="px-2 py-1">CSS, ID, Placeholder, Label, data-testid</td></tr>
                <tr><td className="px-2 py-1">select</td><td className="px-2 py-1">CSS, ID, Label, data-testid</td></tr>
                <tr><td className="px-2 py-1">waitFor, assertVisible</td><td className="px-2 py-1">CSS, ID, Text, data-testid</td></tr>
                <tr><td className="px-2 py-1">assertChecked</td><td className="px-2 py-1">CSS, ID, Label, data-testid</td></tr>
                <tr><td className="px-2 py-1">press (tùy chọn), assertHidden, assertEnabled, upload, dragTo</td><td className="px-2 py-1">CSS, ID, data-testid</td></tr>
                <tr><td className="px-2 py-1">goto, assertText, assertUrl, assertTitle, wait</td><td className="px-2 py-1">Không dùng selector</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-slate-600">
          Bản đầy đủ trong repo: <code className="rounded bg-white px-1">AUTOMATION_USER_GUIDE.md</code>
        </p>
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Step row sub-component
// ---------------------------------------------------------------------------

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

function RequiredBadge({ required }: { required: boolean }) {
  if (required) {
    return (
      <span className="ml-1 rounded bg-rose-100 px-1 py-0.5 text-[9px] font-bold uppercase text-rose-600">
        Bắt buộc
      </span>
    );
  }
  return (
    <span className="ml-1 rounded bg-slate-100 px-1 py-0.5 text-[9px] font-semibold uppercase text-slate-500">
      Tùy chọn
    </span>
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
  const meta = ACTION_META[step.action] ?? ACTION_META["goto"];
  const allowedTargetTypes = meta.targetTypes.length > 0 ? meta.targetTypes : [...ALL_TARGET_TYPES];
  const isWaitStep = step.action === "wait";
  const showSelectorGroup = !isWaitStep && (meta.needsTarget || Boolean(meta.optionalTarget));
  const selectorRequired = meta.needsTarget;
  const showValue = !isWaitStep && meta.needsValue;
  const showExpected = !isWaitStep && meta.needsExpected;
  const hasParameterBlock = stepHasParameterFields(step.action);
  const requiredHints = getActionRequiredHints(step.action);
  const valueLabel = getValueFieldLabel(step.action);

  return (
    <div
      className="rounded-lg border border-slate-200 bg-white p-3"
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(index, e)}
    >
      {/* Row header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="cursor-grab rounded border border-slate-200 px-1.5 py-1 text-xs text-slate-400 hover:border-slate-300 hover:text-slate-600"
            draggable
            onDragStart={(e) => onDragStart(index, e)}
            onDragEnd={onDragEnd}
            aria-label="Kéo để sắp xếp lại"
            title="Kéo để sắp xếp lại"
          >
            ≡
          </button>
          <span className="text-[11px] font-semibold text-slate-400">Bước {index + 1}</span>
        </div>
        <button
          type="button"
          className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600 hover:border-rose-300 hover:bg-rose-100"
          onClick={() => onRemove(index)}
        >
          Xóa
        </button>
      </div>

      {/* Step name */}
      <div className="mt-2">
        <label className="text-[11px] font-semibold text-slate-500">
          Tên bước
          <span className="ml-1 font-normal text-slate-400">(mô tả, không ảnh hưởng chạy test)</span>
          <input
            value={step.stepName}
            onChange={(e) => onUpdate(index, "stepName", e.target.value)}
            placeholder={meta.label}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      {/* ── Khối 1: Hành động + Timeout (luôn đi cùng nhau) ── */}
      <div className="mt-3 overflow-hidden rounded-lg border border-indigo-200 bg-indigo-50/60">
        <div className="border-b border-indigo-100 bg-indigo-100/50 px-3 py-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-700">
              Thiết lập hành động
            </span>
            <div className="flex flex-wrap gap-1">
              {requiredHints.map((hint) => (
                <span
                  key={hint}
                  className="rounded-full border border-indigo-200 bg-white px-2 py-0.5 text-[9px] font-medium text-indigo-700"
                >
                  {hint}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-600">
            Hành động
            <RequiredBadge required />
            <select
              value={step.action}
              onChange={(e) => onUpdate(index, "action", e.target.value)}
              className="mt-1 w-full rounded-lg border border-indigo-200 bg-white px-2 py-1.5 text-sm"
            >
              <optgroup label="── Điều hướng ──">
                <option value="goto">Đi đến trang (goto)</option>
              </optgroup>
              <optgroup label="── Tương tác ──">
                <option value="click">Nhấn vào phần tử (click)</option>
                <option value="type">Nhập văn bản (type)</option>
                <option value="select">Chọn dropdown (select)</option>
                <option value="hover">Di chuột vào (hover)</option>
                <option value="press">Nhấn phím (press)</option>
                <option value="upload">Upload file (upload)</option>
                <option value="dragTo">Kéo thả (dragTo)</option>
              </optgroup>
              <optgroup label="── Chờ ──">
                <option value="wait">Đợi (wait)</option>
                <option value="waitFor">Chờ phần tử (waitFor)</option>
              </optgroup>
              <optgroup label="── Kiểm tra (Assert) ──">
                <option value="assertText">Kiểm tra văn bản (assertText)</option>
                <option value="assertVisible">Kiểm tra hiển thị (assertVisible)</option>
                <option value="assertHidden">Kiểm tra bị ẩn (assertHidden)</option>
                <option value="assertUrl">Kiểm tra URL (assertUrl)</option>
                <option value="assertTitle">Kiểm tra tiêu đề tab (assertTitle)</option>
                <option value="assertEnabled">Kiểm tra không bị khóa (assertEnabled)</option>
                <option value="assertChecked">Kiểm tra checkbox đã tích (assertChecked)</option>
              </optgroup>
            </select>
            <span className="mt-1 block text-[10px] font-normal text-indigo-800/80">{meta.description}</span>
          </label>

          <label className="text-xs font-semibold text-slate-600">
            {isWaitStep ? "Thời gian đợi (giây)" : "Timeout bước (giây)"}
            <RequiredBadge required />
            <input
              type="number"
              min="1"
              value={step.timeoutMs}
              onChange={(e) => onUpdate(index, "timeoutMs", e.target.value)}
              className="mt-1 w-full rounded-lg border border-indigo-200 bg-white px-2 py-1.5 text-sm"
              placeholder={isWaitStep ? "3" : "15"}
            />
            <span className="mt-1 block text-[10px] font-normal text-indigo-800/80">
              {isWaitStep
                ? "Đi kèm hành động Đợi — chờ đủ số giây này."
                : "Đi kèm mọi hành động — quá hạn thì bước fail."}
            </span>
          </label>
        </div>
      </div>

      {/* ── Khối 2: Tham số theo hành động đã chọn ── */}
      {isWaitStep && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
          <span className="font-semibold">Đợi (wait):</span> chỉ cần khối trên — không cần selector hay giá trị thêm.
        </div>
      )}

      {hasParameterBlock && (
        <div className="relative mt-2 overflow-hidden rounded-lg border border-emerald-200 bg-emerald-50/50">
          <div className="absolute left-4 top-0 h-2 w-px bg-emerald-300" aria-hidden />
          <div className="border-b border-emerald-100 bg-emerald-100/40 px-3 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
              Tham số cho {meta.label}
            </span>
            <span className="mt-0.5 block text-[10px] font-normal text-emerald-700/90">
              Các ô dưới đây thuộc hành động đã chọn — điền theo chip &quot;Bắt buộc&quot; ở trên.
            </span>
          </div>

          <div className="space-y-3 p-3">
            {showSelectorGroup && (
              <div className="rounded-lg border border-emerald-200/80 bg-white p-2.5">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  Tìm phần tử trên trang
                  <RequiredBadge required={selectorRequired} />
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-slate-600">
                    Loại selector
                    {selectorRequired && <RequiredBadge required />}
                    <select
                      value={step.targetType}
                      onChange={(e) => onUpdate(index, "targetType", e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    >
                      {allowedTargetTypes.map((t) => (
                        <option key={t} value={t}>
                          {TARGET_TYPE_LABELS[t] ?? t}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-xs font-semibold text-slate-600">
                    {step.action === "dragTo" ? "Phần tử nguồn" : "Selector / text"}
                    {selectorRequired && <RequiredBadge required />}
                    <input
                      value={step.target}
                      onChange={(e) => onUpdate(index, "target", e.target.value)}
                      placeholder={meta.targetPlaceholder}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    />
                  </label>
                </div>
              </div>
            )}

            {showValue && (
              <div className="rounded-lg border border-emerald-200/80 bg-white p-2.5">
                <label className="text-xs font-semibold text-slate-600">
                  {valueLabel}
                  <RequiredBadge required />
                  <input
                    value={step.value}
                    onChange={(e) => onUpdate(index, "value", e.target.value)}
                    placeholder={meta.valuePlaceholder}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                  {step.action === "goto" && (
                    <span className="mt-1 block text-[10px] text-slate-500">
                      Ghép với URL gốc ở trên. Ví dụ baseUrl + <code className="text-emerald-700">/login</code>
                    </span>
                  )}
                </label>
              </div>
            )}

            {showExpected && (
              <div className="rounded-lg border border-emerald-200/80 bg-white p-2.5">
                <label className="text-xs font-semibold text-slate-600">
                  Chuỗi mong đợi
                  <RequiredBadge required />
                  <input
                    value={step.expected}
                    onChange={(e) => onUpdate(index, "expected", e.target.value)}
                    placeholder={meta.expectedPlaceholder}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                  <span className="mt-1 block text-[10px] text-slate-500">
                    Kiểm tra <em>chứa</em> chuỗi này — không cần khớp 100%.
                  </span>
                </label>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
