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
  /** Chỉ dùng cho goto: load (mặc định) | domcontentloaded */
  waitUntil: string;
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

/** Chip gợi ý ô cần điền — khớp form gốc, timeout bước là tùy chọn */
export function getActionRequiredHints(action: string): string[] {
  const meta = ACTION_META[action] ?? ACTION_META.goto;

  if (action === "wait") {
    return ["Chờ trang ổn định"];
  }

  const hints: string[] = [];

  if (meta.needsValue) {
    hints.push(getValueFieldLabel(action));
  }
  if (meta.needsTarget) {
    hints.push("Selector");
  } else if (meta.optionalTarget) {
    hints.push("Selector (tùy chọn)");
  }
  if (meta.needsExpected) {
    hints.push("Chuỗi mong đợi");
  }

  return hints;
}

export function stepHasParameterFields(action: string): boolean {
  if (action === "wait") return false;
  const meta = ACTION_META[action] ?? ACTION_META.goto;
  return meta.needsValue || meta.needsExpected || meta.needsTarget || Boolean(meta.optionalTarget);
}

export const DEFAULT_AUTOMATION_TIMEOUT_SECONDS = "30";

export const GOTO_WAIT_UNTIL_OPTIONS = [
  { value: "load", label: "Chờ trang load xong (load — mặc định)" },
  { value: "domcontentloaded", label: "Chờ HTML sẵn sàng (domcontentloaded — nhanh hơn)" },
] as const;

export function normalizeGotoWaitUntilForForm(value: string): "load" | "domcontentloaded" {
  return String(value || "").trim().toLowerCase() === "domcontentloaded"
    ? "domcontentloaded"
    : "load";
}

function parseOptionalTimeoutSeconds(value: string): number | null {
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
        const withTimeout = { ...normalized, timeoutMs: stepTimeoutSeconds * 1000 };
        if (
          String(step.action || "").trim().toLowerCase() === "goto" &&
          normalizeGotoWaitUntilForForm(step.waitUntil) === "domcontentloaded"
        ) {
          return { ...withTimeout, waitUntil: "domcontentloaded" as const };
        }
        return withTimeout;
      }

      if (
        String(step.action || "").trim().toLowerCase() === "goto" &&
        normalizeGotoWaitUntilForForm(step.waitUntil) === "domcontentloaded"
      ) {
        return { ...normalized, waitUntil: "domcontentloaded" as const };
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
    targetPlaceholder: "#submit · Đăng nhập (text)",
    valuePlaceholder: "",
    expectedPlaceholder: "",
  },
  type: {
    label: "Nhập văn bản",
    description: "Điền input/textarea",
    needsTarget: true, needsValue: true, needsExpected: false,
    targetTypes: ["css", "id", "placeholder", "label", "testid"],
    targetPlaceholder: "#email · Email (placeholder)",
    valuePlaceholder: "Nội dung nhập",
    expectedPlaceholder: "",
  },
  select: {
    label: "Chọn dropdown",
    description: "Chọn option trong select",
    needsTarget: true, needsValue: true, needsExpected: false,
    targetTypes: ["css", "id", "label", "testid"],
    targetPlaceholder: "#status · Trạng thái (label)",
    valuePlaceholder: "active · completed",
    expectedPlaceholder: "",
  },
  wait: {
    label: "Đợi",
    description: "Chờ trang load/domcontentloaded — dùng timeout của test case hoặc bước",
    needsTarget: false, needsValue: false, needsExpected: false,
    targetTypes: [],
    targetPlaceholder: "",
    valuePlaceholder: "",
    expectedPlaceholder: "",
  },
  waitFor: {
    label: "Chờ phần tử",
    description: "Chờ phần tử hiện ra trước bước tiếp theo",
    needsTarget: true, needsValue: false, needsExpected: false,
    targetTypes: ["css", "id", "text", "testid"],
    targetPlaceholder: "#loading · Đang tải (text)",
    valuePlaceholder: "",
    expectedPlaceholder: "",
  },
  assertText: {
    label: "Kiểm tra text",
    description: "Phần tử (hoặc cả trang) chứa chuỗi mong đợi",
    needsTarget: false, optionalTarget: true, needsValue: false, needsExpected: true,
    targetTypes: ["css", "id", "text", "testid", "label"],
    targetPlaceholder: "#toast · .message (trống = cả trang)",
    valuePlaceholder: "",
    expectedPlaceholder: "Đăng nhập thành công",
  },
  assertVisible: {
    label: "Kiểm tra hiển thị",
    description: "Phần tử đang visible",
    needsTarget: true, needsValue: false, needsExpected: false,
    targetTypes: ["css", "id", "text", "testid"],
    targetPlaceholder: "#dashboard · Chào mừng (text)",
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
    targetPlaceholder: "#agree · Đồng ý (label)",
    valuePlaceholder: "",
    expectedPlaceholder: "",
  },
  hover: {
    label: "Hover",
    description: "Di chuột để mở menu/tooltip",
    needsTarget: true, needsValue: false, needsExpected: false,
    targetTypes: ["css", "id", "text", "testid"],
    targetPlaceholder: "#avatar · Tài khoản (text)",
    valuePlaceholder: "",
    expectedPlaceholder: "",
  },
  press: {
    label: "Nhấn phím",
    description: "Nhấn phím trên trang hoặc trên phần tử đã chọn",
    optionalTarget: true,
    needsTarget: false, needsValue: true, needsExpected: false,
    targetTypes: ["css", "id", "testid"],
    targetPlaceholder: "Để trống = nhấn trên cả trang",
    valuePlaceholder: "Enter · Tab · Escape",
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
  waitUntil: "load",
});

export const DEFAULT_AUTOMATION_FORM = (): AutomationForm => ({
  enabled: false,
  webId: "",
  baseUrl: "",
  userKey: "",
  timeoutMs: DEFAULT_AUTOMATION_TIMEOUT_SECONDS,
  steps: [],
});
