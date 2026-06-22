# 02 — Quy tắc Frontend

Đọc khi sửa `frontendnext/`, component, `lib/api.ts`, form validation phía client.

---

## 1. Helper Frontend — lib/api.ts

Ưu tiên tái sử dụng:

* apiRequest
* getId
* validateStartRunForm
* countPlanAutomationCases
* planAutomationCasesNeedRunBaseUrl
* partitionRunItemsByAutomation
* summarizeRunResults
* isAutomationWorkerActive

---

## 2. Mirror Rules (Backend ↔ Frontend)

Nếu sửa business rule:

Phải sửa cả hai phía.

| Rule                 | Backend                       | Frontend                          |
| -------------------- | ----------------------------- | --------------------------------- |
| Base URL validation  | automationCaseNeedsRunBaseUrl | planAutomationCasesNeedRunBaseUrl |
| Automation partition | partitionResultsByAutomation  | partitionRunItemsByAutomation     |
| Progress calculation | computeRunProgress            | summarizeRunResults               |
| Plan populate        | attachTestPlanCases           | Consumer UI                       |

Không được để hai phía dùng công thức khác nhau.

---

## 3. getId() — Identity Phía Frontend

Frontend:

* getId() ưu tiên entityId

Chi tiết entityId vs _id: `03-database-rules.md` mục 4.

---

## 4. Authentication Phía Frontend

Frontend:

* credentials: "include"

Không disable UI bằng:

* token === ""

Chi tiết hệ thống auth: `05-security-rules.md` mục 1.
