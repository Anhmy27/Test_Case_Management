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
    description: "Điều hướng đến một URL. Ví dụ: /login hoặc https://...",
    needsTarget: false, needsValue: true, needsExpected: false,
    targetTypes: [],
    targetPlaceholder: "",
    valuePlaceholder: "/login hoặc https://app.example.com/dashboard",
    expectedPlaceholder: "",
  },
  click: {
    label: "Nhấn vào phần tử",
    description: "Click vào nút, link hoặc bất kỳ phần tử nào",
    needsTarget: true, needsValue: false, needsExpected: false,
    targetTypes: ["css", "id", "text", "label", "testid"],
    targetPlaceholder: "Đăng nhập (text) · #submit-btn (css) · login-btn (testid)",
    valuePlaceholder: "",
    expectedPlaceholder: "",
  },
  type: {
    label: "Nhập văn bản",
    description: "Điền nội dung vào ô input hoặc textarea",
    needsTarget: true, needsValue: true, needsExpected: false,
    targetTypes: ["css", "id", "placeholder", "label", "testid"],
    targetPlaceholder: "Email (placeholder) · #username (css) · Họ tên (label)",
    valuePlaceholder: "Nội dung cần nhập vào ô",
    expectedPlaceholder: "",
  },
  select: {
    label: "Chọn dropdown",
    description: "Chọn một option trong thẻ select box",
    needsTarget: true, needsValue: true, needsExpected: false,
    targetTypes: ["css", "id", "label", "testid"],
    targetPlaceholder: "#status-select (css) · Trạng thái (label)",
    valuePlaceholder: "Giá trị option: active · completed",
    expectedPlaceholder: "",
  },
  waitFor: {
    label: "Chờ phần tử / thời gian",
    description: "Chờ phần tử hiện ra, hoặc để trống để chờ theo giây đặt ở Timeout",
    needsTarget: false, needsValue: false, needsExpected: false,
    targetTypes: ["css", "id", "text", "testid"],
    targetPlaceholder: "#loading-spinner (để trống = chờ đủ thời gian timeout)",
    valuePlaceholder: "",
    expectedPlaceholder: "",
  },
  assertText: {
    label: "Kiểm tra văn bản trên trang",
    description: "Xác nhận trang có chứa đoạn text nhất định",
    needsTarget: false, needsValue: false, needsExpected: true,
    targetTypes: ["css", "id", "testid"],
    targetPlaceholder: "(để trống = kiểm tra toàn bộ trang)",
    valuePlaceholder: "",
    expectedPlaceholder: "Đăng nhập thành công · Xin chào Admin",
  },
  assertVisible: {
    label: "Kiểm tra phần tử hiển thị",
    description: "Xác nhận phần tử đang nhìn thấy được trên màn hình",
    needsTarget: true, needsValue: false, needsExpected: false,
    targetTypes: ["css", "id", "text", "testid"],
    targetPlaceholder: "#dashboard (css) · Chào mừng (text)",
    valuePlaceholder: "",
    expectedPlaceholder: "",
  },
  assertUrl: {
    label: "Kiểm tra URL trang",
    description: "Xác nhận URL hiện tại có chứa chuỗi mong đợi",
    needsTarget: false, needsValue: false, needsExpected: true,
    targetTypes: [],
    targetPlaceholder: "",
    valuePlaceholder: "",
    expectedPlaceholder: "/dashboard · ?logged=true",
  },
  assertTitle: {
    label: "Kiểm tra tiêu đề tab",
    description: "Xác nhận tiêu đề tab trình duyệt có chứa chuỗi mong đợi",
    needsTarget: false, needsValue: false, needsExpected: true,
    targetTypes: [],
    targetPlaceholder: "",
    valuePlaceholder: "",
    expectedPlaceholder: "Trang chủ | Hệ thống",
  },
  assertHidden: {
    label: "Kiểm tra phần tử bị ẩn",
    description: "Xác nhận phần tử không hiển thị (đã bị ẩn hoặc không tồn tại)",
    needsTarget: true, needsValue: false, needsExpected: false,
    targetTypes: ["css", "id", "testid"],
    targetPlaceholder: "#error-message (css)",
    valuePlaceholder: "",
    expectedPlaceholder: "",
  },
  assertEnabled: {
    label: "Kiểm tra phần tử không bị khóa",
    description: "Xác nhận nút hoặc input không ở trạng thái disabled",
    needsTarget: true, needsValue: false, needsExpected: false,
    targetTypes: ["css", "id", "testid"],
    targetPlaceholder: "#submit-btn (css)",
    valuePlaceholder: "",
    expectedPlaceholder: "",
  },
  assertChecked: {
    label: "Kiểm tra checkbox đã tích",
    description: "Xác nhận checkbox hoặc radio đang được chọn",
    needsTarget: true, needsValue: false, needsExpected: false,
    targetTypes: ["css", "id", "testid", "label"],
    targetPlaceholder: "#agree-terms (css) · Đồng ý điều khoản (label)",
    valuePlaceholder: "",
    expectedPlaceholder: "",
  },
  hover: {
    label: "Di chuột vào phần tử",
    description: "Hover chuột để hiện tooltip hoặc menu dropdown",
    needsTarget: true, needsValue: false, needsExpected: false,
    targetTypes: ["css", "id", "text", "testid"],
    targetPlaceholder: "#user-avatar (css) · Tài khoản (text)",
    valuePlaceholder: "",
    expectedPlaceholder: "",
  },
  press: {
    label: "Nhấn phím",
    description: "Nhấn phím tắt như Enter, Tab, Escape... Để trống Target = nhấn toàn trang",
    needsTarget: false, needsValue: true, needsExpected: false,
    targetTypes: ["css", "id", "testid"],
    targetPlaceholder: "(để trống = nhấn phím trên toàn trang)",
    valuePlaceholder: "Enter · Tab · Escape · ArrowDown · Control+A",
    expectedPlaceholder: "",
  },
  upload: {
    label: "Upload file",
    description: "Chọn file để upload qua ô input[type=file]",
    needsTarget: true, needsValue: true, needsExpected: false,
    targetTypes: ["css", "id", "testid"],
    targetPlaceholder: "input[type=file] (css) · #file-input (id)",
    valuePlaceholder: "C:/path/to/file.pdf · /home/user/img.png",
    expectedPlaceholder: "",
  },
  dragTo: {
    label: "Kéo thả phần tử",
    description: "Kéo phần tử nguồn (Target) và thả vào phần tử đích (Value). Cả hai dùng cùng Target type.",
    needsTarget: true, needsValue: true, needsExpected: false,
    targetTypes: ["css", "id", "testid"],
    targetPlaceholder: "#item-1 (phần tử nguồn)",
    valuePlaceholder: "#drop-zone (phần tử đích — cùng loại với Target type)",
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
