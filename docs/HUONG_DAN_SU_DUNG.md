# Hướng dẫn sử dụng — Test Case Management

Tài liệu này dành cho **Admin** và **Employee** dùng hệ thống quản lý test case hàng ngày. Không cần biết code.

---

## 1. Tổng quan

Hệ thống giúp team QA:

- Tạo và quản lý **test case** theo project → version → group
- Lập **test plan** (manual hoặc automation) và giao cho tester
- **Chạy test**, ghi kết quả (Pass / Fail / Blocked / Skip)
- Xem **lịch sử chạy** và **log bug lên Jira** khi case fail

### Hai vai trò

| Vai trò | Ai dùng | Quyền chính |
|---------|---------|-------------|
| **Admin** | QA lead, quản lý | Tạo project, case, plan, user; xem toàn bộ run và audit |
| **Employee** | Tester | Chạy plan được giao, xem run/history của mình, log bug |

---

## 2. Đăng nhập & giao diện chung

### 2.1 Đăng nhập / Đăng ký

1. Mở app (mặc định `http://192.168.111.41:3000`)
2. **Đăng nhập** bằng email + mật khẩu
3. Nếu công ty cho phép tự đăng ký: bấm **Register**, điền thông tin rồi đăng nhập

Sau đăng nhập, hệ thống tự chuyển vào workspace theo vai trò (Admin hoặc Employee).

### 2.2 Thanh trên (topbar)

- **Project scope** (dropdown): chọn project đang làm việc, hoặc **All projects**
- Một số màn có ô **tìm kiếm** / lọc nhanh
- Nút **Dark** ở sidebar: bật/tắt giao diện tối

> **Lưu ý:** Phạm vi project bạn chọn được lưu trên trình duyệt. Đổi project → sidebar và dữ liệu trên màn hình thay đổi theo.

### 2.3 Sidebar

Menu bên trái thay đổi theo vai trò và project đã chọn. Mục đang mở được highlight.

---

## 3. Quy trình chuẩn cho Admin

Thứ tự khuyến nghị khi setup project mới:

```
Project → Version → Group → Test Case → Test Plan → Chạy test → Xem history / Log bug
```

### 3.1 Tạo Project

1. Vào **Projects** (không cần chọn project scope)
2. Điền **Project name**, **Project code**
3. Bấm **Create project**
4. (Tuỳ chọn) Cấu hình khóa Jira của project nếu cần log bug

### 3.2 Tạo Version

1. Chọn **project** ở topbar
2. Vào **Versions**
3. Nhập tên version (vd: `v1.0`, `Sprint 12`)
4. Bấm **Create version**

### 3.3 Tạo Group (nhóm test case)

1. Vẫn trong project scope
2. Vào **Groups**
3. Nhập **Group key** (mã ngắn, vd: `AUTH`) và **Group name**
4. Bấm tạo group

### 3.4 Tạo Test Case

**Cách 1 — Trên web**

1. Vào **Test Cases**
2. Điền form: Group, Case Key, Title, Priority, Severity, Type, mô tả, các bước manual
3. Bấm **Save**

**Cách 2 — Import Excel (nhiều case cùng lúc)**

1. Vào **Test Cases**, chọn đúng **project** trước
2. Bấm **Download template**
3. Mở file Excel:
   - Tab **TestCases**: nhập dữ liệu (mỗi dòng = 1 case)
   - Tab **Hướng dẫn**: đọc quy tắc cột (không import tab này)
4. Bấm **Import Excel**, chọn file
5. Nếu có dòng lỗi: tải file lỗi, sửa và import lại

**Quy tắc import quan trọng**

| Cột | Ghi chú |
|-----|---------|
| Group Key **hoặc** Group Name | Chỉ cần một trong hai |
| Case Key, Title | Bắt buộc |
| Priority | `low` \| `medium` \| `high` \| `critical` |
| Severity | `minor` \| `major` \| `critical` |
| Type | `functional`, `api`, `ui`, ... |
| Step N Action / Step N Expected | Bước thủ công |
| **Automation** | **Không** nhập trong Excel — bật trên web sau khi import |

**Bật automation cho case (sau import hoặc tạo tay)**

1. Bấm **Edit** trên case
2. Bật automation, nhập Base URL và các bước Playwright (goto, click, type, assert...)
3. Lưu

### 3.5 Tạo Test Plan

1. Vào **Test Plans**
2. Chọn **Version**, đặt tên plan
3. Chọn loại: **Manual** hoặc **Automation**
4. Thêm test case vào plan (chọn từ danh sách)
5. Gán **Owner** và **Assignee** (employee sẽ thấy plan được giao)
6. Lưu plan

### 3.6 Chạy test (Admin)

1. Vào **Test Runs + Execution**
2. Chọn **Test plan** → hệ thống gợi ý tên run (có ngày giờ **giờ Việt Nam**)
3. Với plan automation: nhập **Base URL** nếu case cần
4. Bấm **Start run**

**Khi đang chạy manual run**

- Chọn từng case trong hàng đợi
- Đánh dấu **Pass / Fail / Blocked / Skip**
- Điền **Actual result** và **Notes**
- Case **Fail**: có thể bấm **Log Bug** hoặc upload screenshot lỗi
- Hết case: bấm **End run**

**Khi chạy automation run**

- Hệ thống tự chạy Playwright theo bước đã cấu hình
- Có thể **Cancel** hoặc **Retry failed** nếu được phép
- Xem screenshot khi step fail

### 3.7 Execution History

1. Chọn project → vào **Execution History**
2. **Search**: tìm theo case key hoặc tên
3. **Group**: lọc theo nhóm
4. Cột **Recent 1/2/3**: 3 lần chạy gần nhất
5. Bấm **View all** trên một case → xem toàn bộ lịch sử, mở lại run, xem screenshot, log bug

### 3.8 Log Bug lên Jira

Dùng khi case **Fail** (từ màn Execution hoặc Execution History).

1. Bấm **Log Bug**
2. Kiểm tra các ô:
   - **Issue type**, **Priority**
   - **Summary**, **Description** (đã điền sẵn tên run, case, steps, expected/actual)
3. Chỉnh nếu cần → bấm **Create bug**

**Trước khi log bug lần đầu**

- Admin: cấu hình Jira cho project
- Employee: vào **Jira Profile**, nhập tài khoản Jira cá nhân (hoặc dùng tài khoản dịch vụ của hệ thống)

Dòng `Run: ... - 2026-06-29 13:50` trong mô tả = **tên run + thời điểm bắt đầu (giờ Việt Nam)**.

### 3.9 Dashboard

- **All projects**: tổng quan nhiều project
- **Chọn 1 project**: số liệu theo project đó (plan, run, xu hướng)

### 3.10 Quản lý User (Admin)

Vào **Users** → tạo/sửa/xoá tài khoản, đổi role (admin/employee), reset mật khẩu.

### 3.11 Audit Log & Jira Bug Log

| Màn | Mục đích |
|-----|----------|
| **Audit Log** | Ai làm gì (tạo project, đăng nhập, start run...) |
| **Jira Bug Log** | Danh sách bug đã gửi lên Jira từ hệ thống |

---

## 4. Quy trình cho Employee (Tester)

### 4.1 Jira Profile

1. Vào **Jira Profile**
2. Nhập username/password Jira của bạn
3. Lưu — dùng khi **Log Bug**

### 4.2 Xem plan được giao

1. (Tuỳ chọn) Chọn **project** ở topbar
2. Vào **My Test Plans** → danh sách plan bạn là owner hoặc assignee
3. Bấm vào plan để mở màn **Run Test**

### 4.3 Chạy test

1. Vào **Run Test** (hoặc từ My Test Plans)
2. Chọn plan → **Start run**
3. Thực hiện từng case như mục [3.6](#36-chạy-test-admin) (Pass/Fail, ghi chú, Log Bug)
4. **End run** khi xong

### 4.4 Running Tests & History

| Màn | Nội dung |
|-----|----------|
| **Running Tests** | Các run đang mở — bấm để tiếp tục |
| **History** | Run đã hoàn thành của bạn |

Employee chỉ thấy run liên quan đến plan được giao và do chính mình bắt đầu (theo quy tắc hệ thống).

---

## 5. Automation — lưu ý nhanh

- Chỉ chạy được khi test plan loại **Automation** và case đã bật automation + có bước hợp lệ
- **Base URL**: URL gốc của app cần test; thường cần bước `goto` đầu tiên
- **Dry run** (Admin): thử chạy 1 case trước khi đưa vào plan lớn
- Site có CAPTCHA (Facebook, v.v.) thường **không** chạy automation ổn định — dùng site demo hoặc môi trường test nội bộ

**Locator thường dùng**

| Loại | Khi nào dùng |
|------|----------------|
| `placeholder` | Ô input có placeholder |
| `text` | Nút/link theo chữ hiển thị |
| `css` | Selector CSS cụ thể |
| `label` | Ô có nhãn |

---

## 6. Phím tắt thao tác thường gặp

| Việc cần làm | Đi tới |
|--------------|--------|
| Thêm case mới | Test Cases → form / Import |
| Giao việc cho tester | Test Plans → Assign |
| Chạy ngay | Test Runs + Execution hoặc Run Test |
| Xem case fail lần trước | Execution History → View all |
| Gửi Jira | Log Bug trên case fail |
| Xem ai sửa gì | Audit Log (admin) |

---

## 7. Câu hỏi thường gặp (FAQ)

**Không thấy menu Groups / Test Cases?**  
→ Chọn **project** ở topbar. Các mục này chỉ hiện khi đã scope project.

**Import Excel báo lỗi dòng?**  
→ Tải file lỗi, kiểm tra Group Key/Name, Case Key trùng, hoặc Priority/Severity/Type sai giá trị cho phép.

**Bấm Save/API báo 403?**  
→ Đăng xuất đăng nhập lại (session/CSRF hết hạn).

**Log Bug không tạo được issue?**  
→ Kiểm tra Jira Profile, project đã gắn Jira key, và tài khoản Jira còn quyền tạo bug.

**Tên run có giờ lạ?**  
→ Run mới dùng **giờ Việt Nam**. Run cũ tạo trước khi cập nhật có thể vẫn hiện giờ UTC.

**Automation fail ngay bước đầu?**  
→ Thiếu `goto` hoặc Base URL sai; kiểm tra locator (placeholder vs css vs text).

---

## 8. Liên hệ / Hỗ trợ kỹ thuật

- Lỗi hệ thống, không đăng nhập được: liên hệ Admin hoặc người vận hành server
- Cần thêm project, tài khoản, quyền admin: liên hệ QA lead
- Tài liệu kỹ thuật (cài đặt, API, CI): xem [README.md](../README.md)

---

*Tài liệu cập nhật: 2026-06-29 — khớp với phiên bản hiện tại của ứng dụng.*
