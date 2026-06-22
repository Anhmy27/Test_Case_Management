# 01 — Quy tắc Backend

Đọc khi sửa service, controller, route, resolver, automation runner, API.

---

## 1. Luồng Start Run

```
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
```

---

## 2. Luồng Automation Execution

```
automationJobRunner
↓
runOrchestrator
↓
Playwright
↓
persist artifacts
↓
updateAutomationProgress
```

---

## 3. Luồng Manual Execution

`updateRunResultService()`

Quy tắc:

Không cho sửa automation result.

---

## 4. Dry Run

* Không ghi DB
* Artifact lưu tại:

```
dry-run/{uuid}/
```

---

## 5. Retry Failed

Automation:

* Reset in-place

Manual:

* Tạo run mới

---

## 6. Helper Backend

### 6.1 entityResolvers.js

Dùng cho:

* find*ByReference
* isPlanAssignedToUser
* repointVersionReferences

### 6.2 runAutomationPartition.js

Dùng cho:

* automationCaseNeedsRunBaseUrl
* partitionResultsByAutomation
* getAutomationResultIds

### 6.3 automationUrlPolicy.js

Dùng cho:

* assertAllowedBaseUrl

SSRF protection.

### 6.4 versioningCore.js

Dùng cho:

* updateVersionedDocument
* buildVersionedList

### 6.5 testManagementResolvers.js

Dùng cho:

* attachTestPlanCases
* ensure*Exists

---

## 7. Sửa Schema / API

Khi đổi schema:

Kiểm tra:

* Create
* Update
* List
* Attach
* Start Run
* Automation

---

`attachTestPlanCases()`

phải trả đủ field frontend cần.

---

Field mới:

Ưu tiên:

Backward Compatible

Hơn:

Breaking Change
