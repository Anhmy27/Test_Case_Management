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
  needsValue: boolean;
  needsExpected: boolean;
  targetPlaceholder: string;
  valuePlaceholder: string;
  expectedPlaceholder: string;
};

export const ACTION_META: Record<string, ActionMeta> = {
  goto: {
    label: "Đi đến trang",
    description: "Mở URL hoặc path (/login)",
    needsTarget: false, needsValue: true, needsExpected: false,
    targetTypes: [],
    targetPlaceholder: "",
    valuePlaceholder: "/login hoặc https://...",
    expectedPlaceholder: "",
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
    description: "Chờ X giây, không thao tác — dùng ô timeout bên cạnh",
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
    description: "Enter, Tab, Escape... Target trống = toàn trang",
    needsTarget: false, needsValue: true, needsExpected: false,
    targetTypes: ["css", "id", "testid"],
    targetPlaceholder: "(tùy chọn)",
    valuePlaceholder: "Enter · Tab · Escape",
    expectedPlaceholder: "",
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
  timeoutMs: "15",
});

export const DEFAULT_AUTOMATION_FORM = (): AutomationForm => ({
  enabled: false,
  webId: "",
  baseUrl: "",
  userKey: "",
  timeoutMs: "30",
  steps: [],
});
