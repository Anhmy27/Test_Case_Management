# 03 — Quy tắc Database & Domain Model

Đọc khi sửa model Mongoose, schema, versioning, TestRun snapshot, business rule dữ liệu.

---

## 1. Domain Model — Luồng Nghiệp Vụ

```
Project
→ Version
→ TestCaseGroup
→ TestCase
→ TestPlan
→ TestRun
```

---

## 2. Versioned Entities

Có:

* entityId
* isLatest
* deletedAt

Bao gồm:

* Project
* Version
* TestCaseGroup
* TestCase
* TestPlan

Khi update:

* Tạo version mới
* Không sửa lịch sử

---

## 3. Snapshot Entities

Bao gồm:

* TestRun

Mục tiêu:

* Giữ nguyên kết quả tại thời điểm chạy

Không thay đổi khi:

* TestCase đổi
* TestPlan đổi
* Project đổi

---

## 4. entityId vs _id

### 4.1 entityId

Dùng cho:

* Stable identity
* Tham chiếu nghiệp vụ

Ví dụ:

* TestPlan.items.testCase
* TestRun.testPlanEntityId

### 4.2 _id

Dùng cho:

* Version cụ thể
* Snapshot cụ thể

Ví dụ:

* TestPlan.items.testCaseVersionId
* TestRun.testPlan
* TestRun.results.testCase

### 4.3 Quy tắc

Frontend:

* getId() ưu tiên entityId

Backend:

* Resolver phải hỗ trợ cả entityId và _id

Không dùng:

ObjectId.id

vì BSON ObjectId có thể trả Buffer.

---

## 5. Data Invariants (Luôn Đúng)

### 5.1 Versioning

* entityId không đổi giữa các version
* Chỉ có một document isLatest=true cho mỗi entityId
* Không sửa document isLatest=false

Mọi update versioned entity phải đi qua:

```
updateVersionedDocument()
```

### 5.2 TestRun

* TestRun là snapshot
* TestRun không thay đổi khi TestCase thay đổi
* TestRun không thay đổi khi TestPlan thay đổi
* TestRun không thay đổi khi Project thay đổi

### 5.3 Automation

* automation.enabled mới quyết định case có chạy Playwright hay không
* executionMode không quyết định điều đó

### 5.4 Manual vs Automation

* Automation result không được sửa bằng manual flow
* updateRunResultService phải chặn automation result

---

## 6. Business Traps (Dễ Hiểu Sai)

### 6.1 executionMode vs automation.enabled

|                  | executionMode        | automation.enabled               |
| ---------------- | -------------------- | -------------------------------- |
| Ý nghĩa          | Bulk mode / UI label | Case thực sự chạy automation     |
| Quyết định auto? | Không                | Có                               |
| Dùng cho         | UI, retry routing    | Partition, validation, execution |

Quy tắc:

Plan automation có thể không có case auto.

Plan manual vẫn có thể chứa case auto.

Không dùng executionMode để xác định case chạy Playwright.

### 6.2 Base URL

Quy tắc:

```
caseBaseUrl = run.automationBaseUrl || case.automation.baseUrl
```

Run-level URL là tùy chọn.

Chỉ bắt buộc nếu case automation không có URL hợp lệ ở cả hai nơi.

### 6.3 Pin Version vs Latest

#### Hiển thị Plan

`attachTestPlanCases()`

Ưu tiên:

```
testCaseVersionId
```

#### Start Run

`startTestRunService()`

Luôn resolve:

Latest Test Case

Không dùng version pin.

#### Run đã tạo

Giữ snapshot.

Không đổi theo version mới.
