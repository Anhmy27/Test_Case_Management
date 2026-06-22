# 09 — Quy tắc Workspace UI (Admin vs Employee)

Đọc khi thêm/sửa màn hình, route, navigation trong `frontendnext/`.

---

## 1. Hai Workspace

| Workspace | Route prefix | Đối tượng |
|-----------|--------------|-----------|
| **Admin** | `/workspace/admin/` | Quản trị — CRUD dữ liệu, cấu hình automation, audit |
| **Employee** | `/workspace/employee/` | Tester — chạy plan, execution, Jira profile |

Backend: `authorize('admin')` vs `authorize('admin', 'employee')` trên từng route.

---

## 2. Admin — Màn Hình & Nav

Nav định nghĩa: `frontendnext/components/workspaceScreens/adminNav.ts`

| Key | Màn hình |
|-----|----------|
| dashboard | Tổng quan |
| projects, issue-types, users, audit-log | Phạm vi **global** (không cần chọn project) |
| groups, test-cases, versions, test-plans, test-runs-execution | Phạm vi **project** (cần `selectedProjectId`) |

**Quy tắc:**

1. Màn global không phụ thuộc project selector.
2. Màn project phải xử lý khi chưa chọn project (disable hoặc nhắc chọn).

---

## 3. Employee — Luồng Chính

* **My test plans** — plan được giao
* **Running tests** — execution (manual + automation)
* **History** — lịch sử chạy
* **Jira profile** — cấu hình log bug

Employee **không** CRUD test case / test plan / automation config (API admin-only).

---

## 4. Quy ước Đặt File Frontend

```
frontendnext/
  app/workspace/admin/.../page.tsx     # route Next.js — mỏng, import Screen
  components/workspaceScreens/
    AdminXxxScreen.tsx                 # logic UI admin
    AdminXxxRoute.tsx                  # wrapper route (nếu có)
    EmployeeXxxScreen.tsx
```

**Quy tắc:**

1. Logic nặng trong `*Screen.tsx`, không nhồi vào `page.tsx`.
2. Gọi API qua `lib/api.ts` — không fetch URL cứng.
3. Business rule (partition automation, validate start run) dùng helper `api.ts` — `02-frontend-rules.md`.

---

## 5. Automation UI — Ai Dùng Gì

| Tính năng | UI | Ai |
|-----------|-----|-----|
| Cấu hình step automation | `AutomationConfigPanel` trong Edit Test Case | **Admin** |
| Dry run | `AutomationDryRunPanel` | **Admin** |
| Chạy / xem run automation | `AutomationRunExecutionPanel` | Admin + Employee (khi được giao run) |
| Chạy manual | `ManualRunExecutionPanel` | Admin + Employee |

---

## 6. Validation & Form

* Backend validate bằng **Zod** tại route (`validators/*Schemas.js`).
* Frontend validate trước submit qua helper trong `api.ts` (vd. `validateStartRunForm`).
* Đổi rule → mirror BE ↔ FE — `02-frontend-rules.md`.
