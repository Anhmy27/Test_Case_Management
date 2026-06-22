/**
 * Automation step type definitions and action metadata.
 * Used by the AutomationConfigPanel editor and any component
 * that renders or validates automation step configurations.
 */

export type AutomationStep = {
  stepId: string;
  stepName: string;
  action: string;
  targetType: string;
  target: string;
  value: string;
  expected: string;
  /** Giây; để trống = dùng timeout mặc định của test case */
  timeoutMs: string;
};

export type AutomationForm = {
  enabled: boolean;
  webId: string;
  baseUrl: string;
  userKey: string;
  timeoutMs: string;
  steps: AutomationStep[];
};

export type ActionMeta = {
  label: string;
  description: string;
  targetTypes: string[];
  needsTarget: boolean;
  optionalTarget?: boolean;
  needsValue: boolean;
  needsExpected: boolean;
  targetPlaceholder: string;
  valuePlaceholder: string;
  expectedPlaceholder: string;
  valueLabel?: string;
};

export const TARGET_TYPE_LABELS: Record<string, string> = {
  css: "CSS",
  id: "ID",
  placeholder: "Placeholder",
  text: "Text",
  label: "Label",
  testid: "data-testid",
  url: "URL",
};

export function getValueFieldLabel(action: string): string {
  const meta = ACTION_META[action];
  if (meta?.valueLabel) return meta.valueLabel;
  switch (action) {
    case "goto":
      return "URL / path";
    case "press":
      return "Phím";
    case "dragTo":
      return "Phần tử đích";
    case "upload":
      return "Đường dẫn file";
    default:
      return "Giá trị";
  }
}

export function getStepFieldVisibility(action: string): {
  showTargetType: boolean;
  showTarget: boolean;
  showValue: boolean;
  showExpected: boolean;
} {
  if (action === "wait") {
    return { showTargetType: false, showTarget: false, showValue: false, showExpected: false };
  }

  const meta = ACTION_META[action] ?? ACTION_META.goto;

  // press: chỉ cần phím (value); selector tùy chọn — ẩn trong UI compact
  if (action === "press") {
    return {
      showTargetType: false,
      showTarget: false,
      showValue: meta.needsValue,
      showExpected: false,
    };
  }

  const showSelectorGroup = meta.needsTarget || Boolean(meta.optionalTarget);

  return {
    showTargetType: showSelectorGroup,
    // Target riêng khi vừa cần selector vừa cần value (type, select, dragTo...)
    showTarget: showSelectorGroup && meta.needsValue,
    showValue: meta.needsValue,
    showExpected: meta.needsExpected,
  };
}

/** Target-only actions (click, hover, waitFor...): nhập ở cột giá trị / mong đợi */
export function stepUsesTargetAsPrimaryInput(action: string): boolean {
  const v = getStepFieldVisibility(action);
  return v.showTargetType && !v.showTarget && !v.showValue && !v.showExpected;
}

/** @deprecated use getStepFieldVisibility */
export function stepShowsSelector(action: string): boolean {
  return getStepFieldVisibility(action).showTargetType;
}

/** @deprecated use getStepFieldVisibility */
export function stepExtraField(action: string): "value" | "expected" | null {
  const v = getStepFieldVisibility(action);
  if (v.showValue) return "value";
  if (v.showExpected) return "expected";
  if (stepUsesTargetAsPrimaryInput(action)) return "value";
  return null;
}

export const DEFAULT_AUTOMATION_TIMEOUT_SECONDS = "30";

export function parseOptionalTimeoutSeconds(value: string): number | null {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function normalizeAutomationStepsForApi(steps: AutomationStep[]) {
  return steps
    .filter((step) => String(step.action || "").trim())
    .map((step, index) => {
      const stepTimeoutSeconds = parseOptionalTimeoutSeconds(step.timeoutMs);
      const normalized = {
        stepId: String(step.stepId || "").trim() || String(index + 1),
        stepName: String(step.stepName || "").trim(),
        order: index + 1,
        action: String(step.action || "goto").trim(),
        targetType: String(step.targetType || "css"),
        target: String(step.target || ""),
        value: String(step.value || ""),
        expected: String(step.expected || ""),
      };

      if (stepTimeoutSeconds !== null) {
        return { ...normalized, timeoutMs: stepTimeoutSeconds * 1000 };
      }

      return normalized;
    });
}

export const ACTION_META: Record<string, ActionMeta> = {
  goto: {
    label: "Đi đến trang",
    description: "Mở URL hoặc path tương đối so với URL gốc",
    needsTarget: false, needsValue: true, needsExpected: false,
    targetTypes: [],
    targetPlaceholder: "",
    valuePlaceholder: "/login hoặc https://...",
    expectedPlaceholder: "",
    valueLabel: "URL / path",
  },
  click: {
    label: "Nhấn phần tử",
    description: "Click nút, link, ...",
    needsTarget: true, needsValue: false, needsExpected: false,
    targetTypes: ["css", "id", "text", "label", "testid"],
    targetPlaceholder: "#submit",
    valuePlaceholder: "",
    expectedPlaceholder: "",
  },
  type: {
    label: "Nhập văn bản",
    description: "Điền input/textarea",
    needsTarget: true, needsValue: true, needsExpected: false,
    targetTypes: ["css", "id", "placeholder", "label", "testid"],
    targetPlaceholder: "#email",
    valuePlaceholder: "Nội dung nhập",
    expectedPlaceholder: "",
  },
  select: {
    label: "Chọn dropdown",
    description: "Chọn option trong select",
    needsTarget: true, needsValue: true, needsExpected: false,
    targetTypes: ["css", "id", "label", "testid"],
    targetPlaceholder: "#status",
    valuePlaceholder: "active",
    expectedPlaceholder: "",
  },
  wait: {
    label: "Đợi trang",
    description: "Chờ trang load/domcontentloaded (dùng timeout chung của test case)",
    needsTarget: false, needsValue: false, needsExpected: false,
    targetTypes: [],
    targetPlaceholder: "",
    valuePlaceholder: "",
    expectedPlaceholder: "",
  },
  waitFor: {
    label: "Chờ phần tử",
    description: "Chờ phần tử hiện ra",
    needsTarget: true, needsValue: false, needsExpected: false,
    targetTypes: ["css", "id", "text", "testid"],
    targetPlaceholder: "#loading",
    valuePlaceholder: "",
    expectedPlaceholder: "",
  },
  assertText: {
    label: "Kiểm tra text",
    description: "Trang/phần tử chứa chuỗi mong đợi",
    needsTarget: false, needsValue: false, needsExpected: true,
    targetTypes: ["css", "id", "testid"],
    targetPlaceholder: "(trống = cả trang)",
    valuePlaceholder: "",
    expectedPlaceholder: "Đăng nhập thành công",
  },
  assertVisible: {
    label: "Kiểm tra hiển thị",
    description: "Phần tử đang visible",
    needsTarget: true, needsValue: false, needsExpected: false,
    targetTypes: ["css", "id", "text", "testid"],
    targetPlaceholder: "#dashboard",
    valuePlaceholder: "",
    expectedPlaceholder: "",
  },
  assertUrl: {
    label: "Kiểm tra URL",
    description: "URL hiện tại chứa chuỗi mong đợi",
    needsTarget: false, needsValue: false, needsExpected: true,
    targetTypes: [],
    targetPlaceholder: "",
    valuePlaceholder: "",
    expectedPlaceholder: "/dashboard",
  },
  assertTitle: {
    label: "Kiểm tra tiêu đề tab",
    description: "Title tab chứa chuỗi mong đợi",
    needsTarget: false, needsValue: false, needsExpected: true,
    targetTypes: [],
    targetPlaceholder: "",
    valuePlaceholder: "",
    expectedPlaceholder: "Trang chủ",
  },
  assertHidden: {
    label: "Kiểm tra ẩn",
    description: "Phần tử không hiển thị",
    needsTarget: true, needsValue: false, needsExpected: false,
    targetTypes: ["css", "id", "testid"],
    targetPlaceholder: "#error-message",
    valuePlaceholder: "",
    expectedPlaceholder: "",
  },
  assertEnabled: {
    label: "Kiểm tra enabled",
    description: "Nút/input không bị disabled",
    needsTarget: true, needsValue: false, needsExpected: false,
    targetTypes: ["css", "id", "testid"],
    targetPlaceholder: "#submit-btn",
    valuePlaceholder: "",
    expectedPlaceholder: "",
  },
  assertChecked: {
    label: "Kiểm tra checked",
    description: "Checkbox/radio đang được chọn",
    needsTarget: true, needsValue: false, needsExpected: false,
    targetTypes: ["css", "id", "testid", "label"],
    targetPlaceholder: "#agree",
    valuePlaceholder: "",
    expectedPlaceholder: "",
  },
  hover: {
    label: "Hover",
    description: "Di chuột để mở menu/tooltip",
    needsTarget: true, needsValue: false, needsExpected: false,
    targetTypes: ["css", "id", "text", "testid"],
    targetPlaceholder: "#avatar",
    valuePlaceholder: "",
    expectedPlaceholder: "",
  },
  press: {
    label: "Nhấn phím",
    description: "Nhấn phím trên trang hoặc trên phần tử đã chọn",
    optionalTarget: true,
    needsTarget: false, needsValue: true, needsExpected: false,
    targetTypes: ["css", "id", "testid"],
    targetPlaceholder: "Để trống = cả trang",
    valuePlaceholder: "Enter",
    expectedPlaceholder: "",
    valueLabel: "Phím",
  },
  upload: {
    label: "Upload file",
    description: "Chọn file qua input[type=file]",
    needsTarget: true, needsValue: true, needsExpected: false,
    targetTypes: ["css", "id", "testid"],
    targetPlaceholder: "#file-input",
    valuePlaceholder: "C:/path/file.pdf",
    expectedPlaceholder: "",
  },
  dragTo: {
    label: "Kéo thả",
    description: "Kéo Target → thả vào Value",
    needsTarget: true, needsValue: true, needsExpected: false,
    targetTypes: ["css", "id", "testid"],
    targetPlaceholder: "#item-1 (nguồn)",
    valuePlaceholder: "#drop-zone (đích)",
    expectedPlaceholder: "",
  },
};

export const ALL_TARGET_TYPES = ["css", "id", "placeholder", "text", "label", "testid", "url"] as const;

export const DEFAULT_AUTOMATION_STEP = (): AutomationStep => ({
  stepId: String(Date.now()),
  stepName: "",
  action: "goto",
  targetType: "css",
  target: "",
  value: "",
  expected: "",
  timeoutMs: "",
});

export const DEFAULT_AUTOMATION_FORM = (): AutomationForm => ({
  enabled: false,
  webId: "",
  baseUrl: "",
  userKey: "",
  timeoutMs: DEFAULT_AUTOMATION_TIMEOUT_SECONDS,
  steps: [],
});
