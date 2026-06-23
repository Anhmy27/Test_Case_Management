"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  CSS_TEMPLATES,
  DRY_RUN_ERROR_ROWS,
  NESTED_SCENARIOS,
  P3_RULES_COPY,
  SELECTOR_CHOICE_ROWS,
  SELECTOR_PRIORITY_COPY,
} from "@/lib/automationStepGuideContent";
import {
  WORKBENCH_HINT_CLS,
  WORKBENCH_LABEL_CLS,
  WORKBENCH_META_CLS,
  WORKBENCH_SECTION_TITLE_CLS,
} from "@/components/workspaceScreens/shared";

type Props = {
  open: boolean;
  onClose: () => void;
};

function CopyButton({
  text,
  label = "Copy",
  className = "",
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className={`${WORKBENCH_META_CLS} shrink-0 rounded border border-emerald-200 bg-white px-1.5 py-px text-emerald-800 hover:bg-emerald-50 ${className}`}
      title={`Copy: ${text}`}
    >
      {copied ? "Đã copy" : label}
    </button>
  );
}

function GuideSection({
  title,
  hint,
  copyAll,
  children,
}: {
  title: string;
  hint?: string;
  copyAll?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-white/90 p-2">
      <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className={WORKBENCH_SECTION_TITLE_CLS}>{title}</div>
          {hint ? <div className={`${WORKBENCH_HINT_CLS} normal-case`}>{hint}</div> : null}
        </div>
        {copyAll ? <CopyButton text={copyAll} label="Copy cả khối" /> : null}
      </div>
      {children}
    </section>
  );
}

export default function AutomationStepGuideModal({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="automation-step-guide-title"
      >
        <div className="shrink-0 border-b border-slate-100 px-4 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 id="automation-step-guide-title" className="text-sm font-semibold text-slate-900">
                Hướng dẫn selector & bước tự động
              </h2>
              <p className={`${WORKBENCH_HINT_CLS} mt-0.5 normal-case`}>
                Bấm Copy bên cạnh từng dòng để dán vào ô Selector / Loại.
              </p>
            </div>
            <button
              type="button"
              className={`${WORKBENCH_META_CLS} rounded border border-slate-200 px-1.5 py-px text-slate-500 hover:bg-slate-50`}
              onClick={onClose}
              aria-label="Đóng"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3 text-[11px] text-slate-700">
          <GuideSection
            title="Thứ tự chọn (ưu tiên)"
            hint="Dừng ở bước đầu làm được — không cần CSS nếu có testid/label"
            copyAll={SELECTOR_PRIORITY_COPY}
          >
            <pre className="whitespace-pre-wrap rounded border border-slate-100 bg-slate-50 p-2 font-mono text-[10px] leading-relaxed text-slate-800">
              {SELECTOR_PRIORITY_COPY}
            </pre>
          </GuideSection>

          <GuideSection title="Chọn loại theo tình huống" hint="Copy cột Điền vào form">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] border-collapse text-left text-[10px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-1 pr-2 font-medium">Tình huống</th>
                    <th className="py-1 pr-2 font-medium">Loại</th>
                    <th className="py-1 pr-2 font-medium">Điền</th>
                    <th className="py-1 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {SELECTOR_CHOICE_ROWS.map((row) => (
                    <tr key={row.situation} className="border-b border-slate-50 align-top">
                      <td className="py-1.5 pr-2 text-slate-600">{row.situation}</td>
                      <td className="py-1.5 pr-2 font-medium text-slate-800">{row.type}</td>
                      <td className="py-1.5 pr-2">
                        <code className="rounded bg-slate-100 px-1 py-px font-mono text-[10px]">
                          {row.fill}
                        </code>
                      </td>
                      <td className="py-1.5 text-right">
                        <CopyButton text={row.copy} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GuideSection>

          <GuideSection
            title="5 mẫu CSS hay dùng"
            hint="Loại = CSS — dán vào ô Selector"
            copyAll={CSS_TEMPLATES.map((t) => `${t.label}: ${t.copy}`).join("\n")}
          >
            <ul className="space-y-1.5">
              {CSS_TEMPLATES.map((item) => (
                <li
                  key={item.copy}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-100 bg-slate-50/80 px-2 py-1"
                >
                  <div className="min-w-0">
                    <span className={WORKBENCH_LABEL_CLS}>{item.label}</span>
                    <code className="mt-0.5 block font-mono text-[10px] text-slate-900">{item.example}</code>
                  </div>
                  <CopyButton text={item.copy} />
                </li>
              ))}
            </ul>
          </GuideSection>

          <GuideSection title="Nhiều phần tử giống / lồng nhau" hint="Sau P3 — selector mơ hồ sẽ WARNING hoặc fail">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] border-collapse text-left text-[10px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-1 pr-2 font-medium">Tình huống</th>
                    <th className="py-1 pr-2 font-medium">CSS gợi ý</th>
                    <th className="py-1 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {NESTED_SCENARIOS.map((row) => (
                    <tr key={row.situation} className="border-b border-slate-50 align-top">
                      <td className="py-1.5 pr-2 text-slate-600">{row.situation}</td>
                      <td className="py-1.5 pr-2">
                        <code className="break-all rounded bg-emerald-50 px-1 py-px font-mono text-[10px] text-emerald-900">
                          {row.fill}
                        </code>
                      </td>
                      <td className="py-1.5 text-right">
                        <CopyButton text={row.copy} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GuideSection>

          <GuideSection title="Đọc log dry run" copyAll={P3_RULES_COPY}>
            <div className="mb-2 rounded border border-amber-100 bg-amber-50/80 px-2 py-1.5 text-[10px] leading-relaxed text-amber-950">
              {P3_RULES_COPY}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[10px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-1 pr-2 font-medium">Log</th>
                    <th className="py-1 pr-2 font-medium">Ý nghĩa</th>
                    <th className="py-1 pr-2 font-medium">Gợi ý sửa</th>
                    <th className="py-1 font-medium">Copy mẫu</th>
                  </tr>
                </thead>
                <tbody>
                  {DRY_RUN_ERROR_ROWS.map((row) => (
                    <tr key={row.log} className="border-b border-slate-50 align-top">
                      <td className="py-1.5 pr-2 font-mono text-rose-700">{row.log}</td>
                      <td className="py-1.5 pr-2 text-slate-600">{row.meaning}</td>
                      <td className="py-1.5 pr-2 text-slate-600">{row.fix}</td>
                      <td className="py-1.5 text-right">
                        <CopyButton text={row.copy} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GuideSection>
        </div>

        <div className="shrink-0 border-t border-slate-100 px-4 py-2 text-right">
          <button
            type="button"
            className={`${WORKBENCH_META_CLS} rounded border border-slate-200 bg-white px-3 py-1 hover:bg-slate-50`}
            onClick={onClose}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
