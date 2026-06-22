# 00 — Quy tắc cốt lõi

Chỉ đọc khi thực hiện task liên quan đến codebase này. Không tự load ở mọi cuộc trò chuyện.

**Automation stability (flaky / Playwright):** đọc `AUTOMATION_STABILITY_ROADMAP.md` thay vì bộ file `.ai/` (trừ khi đụng schema hoặc flow).

**Chỉ đọc file `.ai/` liên quan task** — xem `CODING_GUIDELINES.md` để biết file nào.

---

## Mục tiêu

* Không phá business rule
* Không phá dữ liệu
* Không duplicate logic
* Không hard-code
* Diff nhỏ, dễ review, dễ rollback

---

## 1. Thứ tự làm việc bắt buộc

Trước khi sửa code:

1. Hiểu nghiệp vụ
2. Hiểu dữ liệu
3. Hiểu flow
4. Search helper / logic có sẵn
5. Mới được sửa code

Nếu chưa trả lời được:

* Dữ liệu nào bị ảnh hưởng?
* Flow nào đang chạy?
* Business rule nào đang áp dụng?

=> Chưa được code.

---

## 2. Coding Rules

### 2.1 Diff nhỏ

Không:

* Rename hàng loạt
* Format cả file
* Refactor ngoài phạm vi task

### 2.2 Một nguồn sự thật

Business rule chỉ tồn tại một nơi.

Không tạo:

* calculateX
* computeX
* getX

nếu cùng một logic.

### 2.3 Không hard-code

Không hard-code:

* URL
* Secret
* Path
* API key
* Environment

Dùng:

* .env
* config/
* lib/api.ts

### 2.4 Không over-engineering

Không tạo:

* Wrapper một dòng
* Abstraction một lần dùng
* Pattern mới cho một case nhỏ

### 2.5 Không field dư

Không thêm field nếu có thể suy ra từ field hiện có.

Ưu tiên:

Derived value

hơn là:

Stored duplicate value

### 2.6 Feature mới

Trước khi code phải trả lời:

* Read gì?
* Create gì?
* Update gì?
* Delete gì?

---

## 3. Tạo File Mới

Được:

* Storage driver mới
* Screen mới
* Route mới
* Test mới

Không được:

* Một helper nhỏ
* Một panel UI nhỏ
* Script phụ user không yêu cầu
* Documentation phụ user không yêu cầu

*Ngoại lệ:* `AUTOMATION_STABILITY_ROADMAP.md` và script trong roadmap automation đã thống nhất.

---

## 4. Nếu Không Chắc

Ưu tiên:

1. Đọc service hiện tại
2. Đọc resolver/helper liên quan
3. Giữ nguyên behavior hiện có
4. Hỏi user

Không tự ý thay business rule.

---

## 5. Thứ Tự Đọc Code

Khi tìm hiểu module mới:

1. Data Model → xem `03-database-rules.md`
2. Data Invariants → xem `03-database-rules.md`
3. Resolver / Helper → xem `01-backend-rules.md`, `02-frontend-rules.md`
4. Service
5. Controller
6. Route
7. Frontend

Không đọc UI trước khi hiểu dữ liệu.

---

## 6. Search Helper Trước Khi Tạo Mới

Luôn search trước khi tạo mới (tìm tên hàm/logic trong `backend/` và `frontendnext/`).

Ưu tiên mở rộng helper hiện có. Không duplicate.

Chi tiết helper: `01-backend-rules.md`, `02-frontend-rules.md`.

---

## 7. Không Được Làm

Trừ khi user yêu cầu:

* git commit
* git push
* force push
* reset --hard
* đổi CI/CD
* đổi package manager
* tạo thêm markdown (trừ `AUTOMATION_STABILITY_ROADMAP.md` khi làm automation stability)
* tạo script phụ (trừ script trong roadmap automation đã thống nhất)

---

## 8. Checklist Nhanh

### Trước

* Hiểu nghiệp vụ
* Hiểu dữ liệu
* Hiểu flow
* Search helper
* Hiểu snapshot vs latest

### Trong

* Diff nhỏ
* Không duplicate
* Không hard-code
* Dùng helper sẵn có
* Mirror BE ↔ FE

### Sau

* Dọn dead code
* Test / lint — xem `04-testing-rules.md`
* Không phá snapshot
* Không phá versioning
* Không tạo duplicate logic
