# 99 — Mẫu Giải Thích & Trả Lời User

Áp dụng khi user hỏi hiểu flow, phase, tính năng — đặc biệt automation và roadmap.

Không tự load trừ khi user cần giải thích, không cần khi chỉ implement code.

---

## 1. Nguyên Tắc Giải Thích

* **Ngắn gọn, đủ ý** — trả lời đúng câu hỏi; không lan man, không lặp lại đoạn đã nói.
* **Đời thường trước, thuật ngữ sau** — nói “làm gì / giống gì bên ngoài” trước khi đi sâu file hay code.
* **Mỗi từ tiếng Anh chuyên ngành** lần đầu xuất hiện: kèm nghĩa tiếng Việt ngắn trong ngoặc hoặc cùng dòng.

  Ví dụ: **dry run** (chạy thử, không ghi kết quả vào DB), **flaky** (lúc pass lúc fail), **baseline** (mốc đo ban đầu).

* **Ví von đời thường** khi giúp nhớ — một câu là đủ (máy đo huyết áp, chụp X-quang trước khi uống thuốc, nút “Thử ngay”…).
* **Bảng** khi liệt kê nhiều mục (đã làm gì / để làm gì / test thế nào).
* **Tách rõ** “code đã xong” vs “việc user còn phải làm tay” (chạy lệnh, điền baseline, xác nhận sang phase).

---

## 2. Cấu Trúc Trả Lời Gợi Ý

1. **Là gì?** — một đoạn, nói mục đích bằng lời thường.
2. **Đã làm gì?** — bảng hoặc bullet: tên (dịch) + để làm gì + giống gì.
3. **Test / kiểm tra thế nào?** — lệnh hoặc bước UI + “đúng nếu thấy gì”.
4. **Còn thiếu gì?** — chỉ phần chưa làm; không nhắc lại phần đã ổn.

---

## 3. Tránh

* Giải thích dài kiểu báo cáo kỹ thuật khi user chỉ cần hiểu nhanh.
* Chỉ liệt kê tên file / hàm mà không nói **việc đó phục vụ ai, làm gì**.
* Dùng thuật ngữ Anh liên tục không dịch (trừ tên file, lệnh, API giữ nguyên).
* Trích khối code dài khi một câu + bảng đã đủ.

---

## 4. Khi Nào Được Đi Sâu Code

Chỉ khi user hỏi “sửa ở đâu”, “bug ở đâu”, hoặc bắt đầu implement — lúc đó mới cite file / dòng, vẫn giữ câu dẫn bằng tiếng Việt đơn giản.

---

## 5. Mẫu Prompt Gợi Ý Cho User

**Hiểu tính năng:**

> Đọc `.ai/99-prompt-templates.md`. Giải thích [tên tính năng] theo cấu trúc: là gì → đã làm gì → test thế nào → còn thiếu gì. Dịch thuật ngữ Anh sang tiếng Việt.

**Sửa backend:**

> Đọc `.ai/00-core-rules.md`, `.ai/01-backend-rules.md`, và `.ai/03-database-rules.md` nếu đụng model. [Mô tả task].

**Sửa frontend:**

> Đọc `.ai/00-core-rules.md`, `.ai/02-frontend-rules.md`. Mirror BE ↔ FE nếu đổi business rule. [Mô tả task].

**Automation stability:**

> Đọc `AUTOMATION_STABILITY_ROADMAP.md` và phase đang làm. Giải thích theo mục 1–4 file này. Kiến trúc file: `.ai/06-automation-rules.md`.

**Sửa automation engine:**

> Đọc `.ai/00-core-rules.md`, `.ai/06-automation-rules.md`, `.ai/03-database-rules.md`. Sau sửa: `.ai/08-e2e-rules.md` mục 5 (probe). [Mô tả task].

**Sửa Docker / deploy:**

> Đọc `.ai/07-deployment-rules.md`. [Mô tả task].

**Thêm màn hình UI:**

> Đọc `.ai/09-workspace-rules.md`, `.ai/02-frontend-rules.md`. [Admin hay employee? Mô tả màn].

**Thêm test — chọn đúng loại:**

> Đọc `.ai/08-e2e-rules.md` mục 1. Backend test / E2E app TCM / automation probe — [chọn loại]. [Mô tả].
