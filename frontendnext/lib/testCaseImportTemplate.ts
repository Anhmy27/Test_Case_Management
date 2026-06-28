import * as XLSX from "xlsx";

export const MANUAL_STEP_COLUMNS = 5;
export const TEST_CASE_IMPORT_SHEET_NAME = "TestCases";
export const TEST_CASE_GUIDE_SHEET_NAME = "Hướng dẫn";

export const PRIORITY_VALUES = ["low", "medium", "high", "critical"] as const;
export const SEVERITY_VALUES = ["minor", "major", "critical"] as const;
export const TYPE_VALUES = ["functional", "api", "ui", "regression", "security", "other"] as const;

function buildManualStepHeaders(count: number): string[] {
  const headers: string[] = [];
  for (let index = 1; index <= count; index += 1) {
    headers.push(`Step ${index} Action`, `Step ${index} Expected`);
  }
  return headers;
}

export function buildTestCaseImportHeaders(manualStepCount = MANUAL_STEP_COLUMNS): string[] {
  return [
    "Group Key",
    "Group Name",
    "Case Key",
    "Title",
    "Priority",
    "Severity",
    "Type",
    "Description",
    ...buildManualStepHeaders(manualStepCount),
    "Expected Result",
  ];
}

export function buildTestCaseImportWorkbookBuffer(
  rows: Record<string, string>[],
  options: { includeGuideSheet?: boolean; sheetOrder?: "data-first" | "guide-first" } = {},
): Buffer {
  const { includeGuideSheet = true, sheetOrder = "data-first" } = options;
  const headers = buildTestCaseImportHeaders();
  const workbook = XLSX.utils.book_new();
  const dataSheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  const guideSheet = XLSX.utils.aoa_to_sheet([["Hướng dẫn"]]);

  if (sheetOrder === "guide-first") {
    if (includeGuideSheet) {
      XLSX.utils.book_append_sheet(workbook, guideSheet, TEST_CASE_GUIDE_SHEET_NAME);
    }
    XLSX.utils.book_append_sheet(workbook, dataSheet, TEST_CASE_IMPORT_SHEET_NAME);
  } else {
    XLSX.utils.book_append_sheet(workbook, dataSheet, TEST_CASE_IMPORT_SHEET_NAME);
    if (includeGuideSheet) {
      XLSX.utils.book_append_sheet(workbook, guideSheet, TEST_CASE_GUIDE_SHEET_NAME);
    }
  }

  return Buffer.from(XLSX.write(workbook, { bookType: "xlsx", type: "array" }));
}

const TEMPLATE_ROWS: Record<string, string>[] = [
  {
    "Group Key": "AUTH",
    "Group Name": "Authentication",
    "Case Key": "LOGIN_001",
    Title: "Login with valid credentials",
    Priority: "high",
    Severity: "major",
    Type: "functional",
    Description: "User can log in with a valid email and password.",
    "Step 1 Action": "Open login page",
    "Step 1 Expected": "Login form is displayed",
    "Step 2 Action": "Enter valid email and password",
    "Step 2 Expected": "Fields accept input",
    "Step 3 Action": "Click Login",
    "Step 3 Expected": "Submit request is sent",
    "Step 4 Action": "",
    "Step 4 Expected": "",
    "Step 5 Action": "",
    "Step 5 Expected": "",
    "Expected Result": "User is redirected to dashboard",
  },
];

function buildGuideSheetRows(): string[][] {
  const allowedPriority = PRIORITY_VALUES.join(" | ");
  const allowedSeverity = SEVERITY_VALUES.join(" | ");
  const allowedType = TYPE_VALUES.join(" | ");

  return [
    ["HƯỚNG DẪN NHẬP TEST CASE (IMPORT EXCEL)"],
    [""],
    ["1. Nhập dữ liệu ở tab TestCases — mỗi dòng là một test case."],
    ["2. Hệ thống chỉ đọc tab TestCases khi import; tab Hướng dẫn chỉ để xem, không import."],
    ["3. Chọn project trên web trước khi bấm Import (project không nhập trong file)."],
    ["4. Tên cột phải KHỚP CHÍNH XÁC. Không đổi tên cột tùy ý."],
    [
      "5. Cần thêm bước 6, 7...: đổi chữ ở ô header (ví dụ Expected Result) thành Step 6 Action, Step 6 Expected, rồi đặt lại Expected Result ở ô trống kế tiếp.",
    ],
    ["6. Automation (Playwright) KHÔNG nhập trong Excel. Sau import, mở Edit trên web để bật automation."],
    [""],
    ["Tên cột", "Bắt buộc", "Giá trị cho phép", "Hướng dẫn", "Ví dụ"],
    [
      "Group Key",
      "Một trong hai (Key hoặc Name)",
      "Key group đã tạo trên web",
      "Dùng key ngắn (ví dụ AUTH). Nếu có Group Key thì không cần Group Name.",
      "AUTH",
    ],
    [
      "Group Name",
      "Một trong hai (Key hoặc Name)",
      "Tên group đã tạo trên web",
      "Dùng khi không biết Group Key. Chỉ cần một trong Group Key hoặc Group Name.",
      "Authentication",
    ],
    [
      "Case Key",
      "Có",
      "Chuỗi unique trong group",
      "Mã định danh test case, không trùng trong cùng group.",
      "LOGIN_001",
    ],
    [
      "Title",
      "Có",
      "Văn bản tự do",
      "Tên hiển thị của test case.",
      "Login with valid credentials",
    ],
    [
      "Priority",
      "Không (mặc định: medium)",
      allowedPriority,
      "CHỈ được chọn một giá trị trong danh sách. Giá trị khác sẽ bị lỗi khi import.",
      "high",
    ],
    [
      "Severity",
      "Không (mặc định: major)",
      allowedSeverity,
      "CHỈ được chọn một giá trị trong danh sách. Giá trị khác sẽ bị lỗi khi import.",
      "major",
    ],
    [
      "Type",
      "Không (mặc định: functional)",
      allowedType,
      "CHỈ được chọn một giá trị trong danh sách. Giá trị khác sẽ bị lỗi khi import.",
      "functional",
    ],
    [
      "Description",
      "Không",
      "Văn bản tự do",
      "Mô tả ngắn về mục đích test case.",
      "User can log in with valid email and password.",
    ],
    [
      "Step N Action",
      "Ít nhất 1 bước",
      "Văn bản tự do",
      "N = 1, 2, 3... Cột phải tên đúng Step N Action (ví dụ Step 1 Action, Step 6 Action).",
      "Click Login",
    ],
    [
      "Step N Expected",
      "Không",
      "Văn bản tự do",
      "Kết quả mong đợi từng bước. Tên cột: Step N Expected (KHÔNG dùng Step N Expected Result).",
      "Login form is displayed",
    ],
    [
      "Expected Result",
      "Có",
      "Văn bản tự do",
      "Kết quả tổng thể của cả test case (sau các bước).",
      "User is redirected to dashboard",
    ],
    [""],
    ["GIÁ TRỊ CỐ ĐỊNH — PRIORITY"],
    ["low", "Độ ưu tiên thấp"],
    ["medium", "Độ ưu tiên trung bình (mặc định)"],
    ["high", "Độ ưu tiên cao"],
    ["critical", "Độ ưu tiên rất cao"],
    [""],
    ["GIÁ TRỊ CỐ ĐỊNH — SEVERITY"],
    ["minor", "Lỗi nhẹ"],
    ["major", "Lỗi nghiêm trọng (mặc định)"],
    ["critical", "Lỗi nghiêm trọng nhất"],
    [""],
    ["GIÁ TRỊ CỐ ĐỊNH — TYPE"],
    ["functional", "Chức năng (mặc định)"],
    ["api", "API"],
    ["ui", "Giao diện"],
    ["regression", "Hồi quy"],
    ["security", "Bảo mật"],
    ["other", "Khác"],
  ];
}

function applyGuideSheetLayout(sheet: XLSX.WorkSheet): void {
  sheet["!cols"] = [
    { wch: 22 },
    { wch: 18 },
    { wch: 42 },
    { wch: 58 },
    { wch: 34 },
  ];
}

export function downloadTestCaseImportTemplate(filename = "test-case-template.xlsx"): void {
  const headers = buildTestCaseImportHeaders();
  const workbook = XLSX.utils.book_new();

  const dataSheet = XLSX.utils.json_to_sheet(TEMPLATE_ROWS, { header: headers });
  XLSX.utils.book_append_sheet(workbook, dataSheet, TEST_CASE_IMPORT_SHEET_NAME);

  const guideSheet = XLSX.utils.aoa_to_sheet(buildGuideSheetRows());
  applyGuideSheetLayout(guideSheet);
  XLSX.utils.book_append_sheet(workbook, guideSheet, TEST_CASE_GUIDE_SHEET_NAME);

  // SheetJS supports activeTab at runtime; bundled WBView types omit it.
  workbook.Workbook = {
    Views: [{ activeTab: 0 }],
  } as unknown as NonNullable<XLSX.WorkBook["Workbook"]>;

  const data = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

type ImportErrorRow = { row?: number; error?: string };

export function downloadImportErrorsExcel(errors: ImportErrorRow[], filename = "import-errors.xlsx"): void {
  if (!Array.isArray(errors) || errors.length === 0) {
    return;
  }

  const workbook = XLSX.utils.book_new();
  const rows = errors.map((entry) => ({
    Row: entry.row ?? "",
    Error: entry.error ?? "",
  }));
  const sheet = XLSX.utils.json_to_sheet(rows, { header: ["Row", "Error"] });
  XLSX.utils.book_append_sheet(workbook, sheet, "ImportErrors");

  const data = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
