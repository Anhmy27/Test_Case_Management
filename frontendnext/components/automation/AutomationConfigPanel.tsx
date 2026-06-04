"use client";

import { useState } from "react";
import type { Dispatch, DragEvent, SetStateAction } from "react";
import { ACTION_META, ALL_TARGET_TYPES } from "@/lib/automationStepMeta";
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
              URL gốc của ứng dụng
              <input
                value={automationForm.baseUrl}
                onChange={(e) =>
                  setAutomationForm((prev) => ({ ...prev, baseUrl: e.target.value }))
                }
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="https://app.example.com"
              />
              <span className="mt-1 block text-[11px] font-normal text-slate-400">
                Địa chỉ trang web cần test. Các bước goto sẽ ghép với URL này nếu chỉ nhập đường dẫn tương đối như /login.
              </span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-slate-500">
                Web ID (tùy chọn)
                <input
                  value={automationForm.webId}
                  onChange={(e) =>
                    setAutomationForm((prev) => ({ ...prev, webId: e.target.value }))
                  }
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="my-app-staging"
                />
                <span className="mt-1 block text-[11px] font-normal text-slate-400">
                  Khóa nhóm session đăng nhập. Dùng khi cùng URL nhưng nhiều môi trường hoặc nhiều app khác nhau.
                </span>
              </label>

              <label className="text-xs font-semibold text-slate-500">
                Profile người dùng (tùy chọn)
                <input
                  value={automationForm.userKey}
                  onChange={(e) =>
                    setAutomationForm((prev) => ({ ...prev, userKey: e.target.value }))
                  }
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="admin · tester@company.com"
                />
                <span className="mt-1 block text-[11px] font-normal text-slate-400">
                  Tên định danh phiên đăng nhập. Nếu đã đăng nhập trước, Playwright sẽ tái sử dụng session.
                </span>
              </label>

              <label className="text-xs font-semibold text-slate-500">
                Thời gian chờ mặc định (giây)
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
                  Tổng thời gian chờ tối đa cho toàn bộ test case này (giây). Mặc định: 30.
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
              <div className="text-[11px] text-slate-500">Kéo nút ≡ để sắp xếp lại thứ tự bước</div>
            </div>
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50"
              onClick={addAutomationStep}
            >
              + Thêm bước
            </button>
          </div>

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
  const showTarget = meta.needsTarget || Boolean(step.target);
  const showValue = meta.needsValue || Boolean(step.value);
  const showExpected = meta.needsExpected || Boolean(step.expected);

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
          Tên bước (ghi chú cho dễ nhớ)
          <input
            value={step.stepName}
            onChange={(e) => onUpdate(index, "stepName", e.target.value)}
            placeholder={`Ví dụ: ${meta.label}`}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      {/* Action + timeout */}
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <label className="font-semibold text-slate-500">
          Hành động
          <select
            value={step.action}
            onChange={(e) => onUpdate(index, "action", e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
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
              <option value="waitFor">Chờ phần tử / thời gian (waitFor)</option>
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
          <span className="mt-1 block text-[10px] font-normal text-slate-400">{meta.description}</span>
        </label>

        <label className="font-semibold text-slate-500">
          Thời gian chờ bước này (giây)
          <input
            type="number"
            min="1"
            value={step.timeoutMs}
            onChange={(e) => onUpdate(index, "timeoutMs", e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
            placeholder="15"
          />
          <span className="mt-1 block text-[10px] font-normal text-slate-400">
            Nếu bước không xong trong thời gian này (giây), coi là thất bại.
          </span>
        </label>
      </div>

      {/* Target type + target selector */}
      {(showTarget || meta.targetTypes.length > 0) && (
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <label className="font-semibold text-slate-500">
            Loại xác định phần tử
            <select
              value={step.targetType}
              onChange={(e) => onUpdate(index, "targetType", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
            >
              {allowedTargetTypes.map((t) => (
                <option key={t} value={t}>
                  {t === "css" ? "CSS Selector (.class / #id)"
                    : t === "id" ? "ID thuộc tính (id=...)"
                    : t === "placeholder" ? "Placeholder ô input"
                    : t === "text" ? "Văn bản hiển thị"
                    : t === "label" ? "Nhãn (label)"
                    : t === "testid" ? "data-testid"
                    : t === "url" ? "URL"
                    : t}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[10px] font-normal text-slate-400">Cách tìm phần tử trên trang</span>
          </label>

          {showTarget && (
            <label className="font-semibold text-slate-500">
              {step.action === "dragTo" ? "Phần tử nguồn" : "Tên / địa chỉ phần tử"}
              <input
                value={step.target}
                onChange={(e) => onUpdate(index, "target", e.target.value)}
                placeholder={meta.targetPlaceholder}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
              />
              <span className="mt-1 block text-[10px] font-normal text-slate-400">
                {meta.targetPlaceholder || "Nhập địa chỉ phần tử theo loại đã chọn"}
              </span>
            </label>
          )}
        </div>
      )}

      {/* Value field */}
      {showValue && (
        <div className="mt-2 text-xs">
          <label className="font-semibold text-slate-500">
            {step.action === "goto" ? "URL hoặc đường dẫn"
              : step.action === "press" ? "Phím cần nhấn"
              : step.action === "dragTo" ? "Phần tử đích (thả vào đây)"
              : step.action === "upload" ? "Đường dẫn file"
              : "Nội dung / Giá trị"}
            <input
              value={step.value}
              onChange={(e) => onUpdate(index, "value", e.target.value)}
              placeholder={meta.valuePlaceholder}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
            />
            {meta.valuePlaceholder && (
              <span className="mt-1 block text-[10px] font-normal text-slate-400">
                Ví dụ: {meta.valuePlaceholder}
              </span>
            )}
          </label>
        </div>
      )}

      {/* Expected field */}
      {showExpected && (
        <div className="mt-2 text-xs">
          <label className="font-semibold text-slate-500">
            Kết quả mong đợi (cần chứa chuỗi này)
            <input
              value={step.expected}
              onChange={(e) => onUpdate(index, "expected", e.target.value)}
              placeholder={meta.expectedPlaceholder}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
            />
            {meta.expectedPlaceholder && (
              <span className="mt-1 block text-[10px] font-normal text-slate-400">
                Ví dụ: {meta.expectedPlaceholder}
              </span>
            )}
          </label>
        </div>
      )}
    </div>
  );
}
