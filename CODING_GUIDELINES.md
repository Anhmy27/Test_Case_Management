# Test Case Management — Repository Rules

Quy tắc riêng của dự án Test Case Management.

Chỉ đọc khi thực hiện task liên quan đến codebase này.
Không tự load ở mọi cuộc trò chuyện.

**Làm automation stability (flaky / Playwright):** đọc `AUTOMATION_STABILITY_ROADMAP.md` thay vì file này.

Mục tiêu:

* Không phá business rule
* Không phá dữ liệu
* Không duplicate logic
* Không hard-code
* Diff nhỏ, dễ review, dễ rollback

---

# 1. Thứ tự làm việc bắt buộc

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

# 2. Domain Model

Luồng nghiệp vụ chính:

Project
→ Version
→ TestCaseGroup
→ TestCase
→ TestPlan
→ TestRun

---

## Versioned Entities

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

## Snapshot Entities

Bao gồm:

* TestRun

Mục tiêu:

* Giữ nguyên kết quả tại thời điểm chạy

Không thay đổi khi:

* TestCase đổi
* TestPlan đổi
* Project đổi

---

# 3. Data Model & Identity Rules

## entityId vs _id

### entityId

Dùng cho:

* Stable identity
* Tham chiếu nghiệp vụ

Ví dụ:

* TestPlan.items.testCase
* TestRun.testPlanEntityId

---

### _id

Dùng cho:

* Version cụ thể
* Snapshot cụ thể

Ví dụ:

* TestPlan.items.testCaseVersionId
* TestRun.testPlan
* TestRun.results.testCase

---

## Quy tắc

Frontend:

* getId() ưu tiên entityId

Backend:

* Resolver phải hỗ trợ cả entityId và _id

Không dùng:

ObjectId.id

vì BSON ObjectId có thể trả Buffer.

---

# 4. Data Invariants (Luôn đúng)

Các điều sau phải luôn đúng.

---

## Versioning

* entityId không đổi giữa các version
* Chỉ có một document isLatest=true cho mỗi entityId
* Không sửa document isLatest=false

Mọi update versioned entity phải đi qua:

updateVersionedDocument()

---

## TestRun

* TestRun là snapshot
* TestRun không thay đổi khi TestCase thay đổi
* TestRun không thay đổi khi TestPlan thay đổi
* TestRun không thay đổi khi Project thay đổi

---

## Automation

* automation.enabled mới quyết định case có chạy Playwright hay không
* executionMode không quyết định điều đó

---

## Manual vs Automation

* Automation result không được sửa bằng manual flow
* updateRunResultService phải chặn automation result

---

# 5. Business Traps (Dễ hiểu sai)

## executionMode vs automation.enabled

|                  | executionMode        | automation.enabled               |
| ---------------- | -------------------- | -------------------------------- |
| Ý nghĩa          | Bulk mode / UI label | Case thực sự chạy automation     |
| Quyết định auto? | Không                | Có                               |
| Dùng cho         | UI, retry routing    | Partition, validation, execution |

---

Quy tắc:

Plan automation có thể không có case auto.

Plan manual vẫn có thể chứa case auto.

Không dùng executionMode để xác định case chạy Playwright.

---

## Base URL

Quy tắc:

caseBaseUrl =
run.automationBaseUrl
||
case.automation.baseUrl

Run-level URL là tùy chọn.

Chỉ bắt buộc nếu case automation không có URL hợp lệ ở cả hai nơi.

---

## Pin Version vs Latest

### Hiển thị Plan

attachTestPlanCases()

Ưu tiên:

testCaseVersionId

---

### Start Run

startTestRunService()

Luôn resolve:

Latest Test Case

Không dùng version pin.

---

### Run đã tạo

Giữ snapshot.

Không đổi theo version mới.

---

# 6. Important Flows

## Start Run

validateStartRunForm()
↓
startTestRunService()
↓
resolve latest plan
↓
findLatestTestCaseByReference()
↓
validate URL
↓
TestRun.create()
↓
scheduleAutomationRun()

---

## Automation Execution

automationJobRunner
↓
runOrchestrator
↓
Playwright
↓
persist artifacts
↓
updateAutomationProgress

---

## Manual Execution

updateRunResultService()

Quy tắc:

Không cho sửa automation result.

---

## Dry Run

* Không ghi DB
* Artifact lưu tại:

dry-run/{uuid}/

---

## Retry Failed

Automation:

* Reset in-place

Manual:

* Tạo run mới

---

# 7. Authentication

Hệ thống dùng:

* Cookie Authentication
* CSRF Protection

Frontend:

credentials: "include"

Không disable UI bằng:

token === ""

---

# 8. Reusable Helpers

Luôn search trước khi tạo mới (tìm tên hàm/logic trong `backend/` và `frontendnext/`).

Ưu tiên mở rộng helper hiện có. Không duplicate.

---

## Backend

### entityResolvers.js

Dùng cho:

* find*ByReference
* isPlanAssignedToUser
* repointVersionReferences

---

### runAutomationPartition.js

Dùng cho:

* automationCaseNeedsRunBaseUrl
* partitionResultsByAutomation
* getAutomationResultIds

---

### automationUrlPolicy.js

Dùng cho:

* assertAllowedBaseUrl

SSRF protection.

---

### versioningCore.js

Dùng cho:

* updateVersionedDocument
* buildVersionedList

---

### testManagementResolvers.js

Dùng cho:

* attachTestPlanCases
* ensure*Exists

---

## Frontend

lib/api.ts

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

# 9. Mirror Rules (Backend ↔ Frontend)

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

# 10. Coding Rules

## Diff nhỏ

Không:

* Rename hàng loạt
* Format cả file
* Refactor ngoài phạm vi task

---

## Một nguồn sự thật

Business rule chỉ tồn tại một nơi.

Không tạo:

* calculateX
* computeX
* getX

nếu cùng một logic.

---

## Không hard-code

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

---

## Không over-engineering

Không tạo:

* Wrapper một dòng
* Abstraction một lần dùng
* Pattern mới cho một case nhỏ

---

## Không field dư

Không thêm field nếu có thể suy ra từ field hiện có.

Ưu tiên:

Derived value

hơn là:

Stored duplicate value

---

## Feature mới

Trước khi code phải trả lời:

* Read gì?
* Create gì?
* Update gì?
* Delete gì?

---

# 11. Sửa Schema / API

Khi đổi schema:

Kiểm tra:

* Create
* Update
* List
* Attach
* Start Run
* Automation

---

attachTestPlanCases()

phải trả đủ field frontend cần.

---

Field mới:

Ưu tiên:

Backward Compatible

Hơn:

Breaking Change

---

# 12. Tạo File Mới

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

---

# 13. Nếu Không Chắc

Ưu tiên:

1. Đọc service hiện tại
2. Đọc resolver/helper liên quan
3. Giữ nguyên behavior hiện có
4. Hỏi user

Không tự ý thay business rule.

---

# 14. Thứ Tự Đọc Code

Khi tìm hiểu module mới:

1. Data Model
2. Data Invariants
3. Resolver / Helper
4. Service
5. Controller
6. Route
7. Frontend

Không đọc UI trước khi hiểu dữ liệu.

---

# 15. Sau Khi Code

Kiểm tra: tìm reference hàm vừa sửa trong toàn repo; chạy `npm test` trong `backend/`; chạy `npm run lint` trong `frontendnext/`.

---

Dọn:

* Import thừa
* Variable thừa
* Function chết
* Export chết

---

Không để:

* tempFunction
* OldCode_v2
* Code comment-out

---

Kiểm tra:

* Permission
* Automation worker
* Artifact storage
* API response
* UI consumer

---

# 16. Không Được Làm

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

# 17. Checklist Nhanh

## Trước

* Hiểu nghiệp vụ
* Hiểu dữ liệu
* Hiểu flow
* Search helper
* Hiểu snapshot vs latest

## Trong

* Diff nhỏ
* Không duplicate
* Không hard-code
* Dùng helper sẵn có
* Mirror BE ↔ FE

## Sau

* Dọn dead code
* Test / lint
* Không phá snapshot
* Không phá versioning
* Không tạo duplicate logic
