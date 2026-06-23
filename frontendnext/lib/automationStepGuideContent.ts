/** Nội dung bảng hướng dẫn selector — dùng trong modal Automation (copy từng dòng). */

export type GuideCopyRow = {
  situation: string;
  type: string;
  fill: string;
  copy: string;
};

export type GuideTemplate = {
  label: string;
  example: string;
  copy: string;
};

export type GuideErrorRow = {
  log: string;
  meaning: string;
  fix: string;
  copy: string;
};

export const SELECTOR_PRIORITY_COPY = `1. data-testid (nếu dev đã gắn)
2. ID hoặc CSS #id
3. Label (ô input có nhãn)
4. Placeholder (chỉ bước type)
5. Text (click — button hoặc link, một nút trên trang)
6. CSS (mẫu bên dưới hoặc F12 Copy selector)`;

export const SELECTOR_CHOICE_ROWS: GuideCopyRow[] = [
  {
    situation: "Gõ vào ô có nhãn Email",
    type: "Label",
    fill: "Email",
    copy: "Email",
  },
  {
    situation: "Gõ vào ô chỉ có chữ mờ trong ô",
    type: "Placeholder",
    fill: "Nhập email",
    copy: "Nhập email",
  },
  {
    situation: "Bấm nút chỉ có chữ (một nút trên trang)",
    type: "Text (click)",
    fill: "Đăng nhập",
    copy: "Đăng nhập",
  },
  {
    situation: "Dev đã gắn data-testid",
    type: "data-testid",
    fill: "login-submit",
    copy: "login-submit",
  },
  {
    situation: "Có id duy nhất submit",
    type: "ID",
    fill: "submit",
    copy: "submit",
  },
  {
    situation: "Nhiều nút .btn — thu hẹp CSS",
    type: "CSS",
    fill: "#login-form button[type=\"submit\"]",
    copy: "#login-form button[type=\"submit\"]",
  },
];

export const CSS_TEMPLATES: GuideTemplate[] = [
  { label: "Theo id", example: "#login-form", copy: "#login-form" },
  { label: "Input theo name", example: 'input[name="email"]', copy: 'input[name="email"]' },
  { label: "Nút Gửi form", example: "button[type=\"submit\"]", copy: "button[type=\"submit\"]" },
  { label: "Link theo href", example: 'a[href="/dashboard"]', copy: 'a[href="/dashboard"]' },
  { label: "Link chứa chữ trong URL", example: 'a[href*="login"]', copy: 'a[href*="login"]' },
  { label: "Nút trong form (cha + con)", example: "#login-form button", copy: "#login-form button" },
  { label: "Id là số (CSS)", example: '[id="5"]', copy: '[id="5"]' },
];

export const NESTED_SCENARIOS: GuideCopyRow[] = [
  {
    situation: "2 form, mỗi form có nút Gửi",
    type: "CSS",
    fill: "#form-a button[type=\"submit\"]",
    copy: "#form-a button[type=\"submit\"]",
  },
  {
    situation: "Header và footer đều có .btn",
    type: "CSS",
    fill: "header .btn-save",
    copy: "header .btn-save",
  },
  {
    situation: "Nhiều dòng bảng, xóa dòng id 101",
    type: "CSS",
    fill: '.order-card[data-id="101"] .btn-delete',
    copy: '.order-card[data-id="101"] .btn-delete',
  },
  {
    situation: "Nút trong modal",
    type: "CSS",
    fill: "#confirm-dialog .btn-primary",
    copy: "#confirm-dialog .btn-primary",
  },
  {
    situation: "Link trong menu",
    type: "CSS",
    fill: 'nav a[href="/settings"]',
    copy: 'nav a[href="/settings"]',
  },
];

export const DRY_RUN_ERROR_ROWS: GuideErrorRow[] = [
  {
    log: "matched 0 elements",
    meaning: "Không tìm thấy phần tử",
    fix: "Sửa selector; thêm bước waitFor trước",
    copy: "matched 0 elements",
  },
  {
    log: "matched 2 elements",
    meaning: "Selector trùng (dry run: WARNING)",
    fix: "Thu hẹp CSS theo bảng lồng nhau",
    copy: "#login-form button[type=\"submit\"]",
  },
  {
    log: "matched N elements",
    meaning: "Run thật sẽ FAIL",
    fix: "Bắt buộc selector chỉ khớp 1 phần tử",
    copy: "form#login button[type=\"submit\"]",
  },
];

export const P3_RULES_COPY = `Engine cần đúng 1 phần tử khớp selector.
- Khớp 0 → fail
- Khớp > 1 → run thật: fail; dry run: WARNING trong log
- click + Text: tìm button hoặc link (<a>), không phải <span>
- Không dán HTML vào ô Selector
- Lỗi tạm (timeout, chưa bấm được…) → thử lại tối đa 2 lần; assert sai kết quả thì không retry
- assertText: có selector → kiểm tra đúng phần tử; trống → cả trang (dry run: WARNING)`;
