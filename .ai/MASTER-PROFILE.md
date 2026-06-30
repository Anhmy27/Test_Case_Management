# MASTER PROFILE — Quy tắc & thói quen coding (TCM)

> **Mục đích:** Đọc **một file này** trước khi sửa code / giải thích cho user.  
> Chi tiết gốc nằm rải trong `.ai/00`–`09` và `CODING_GUIDELINES.md`. File này là bản gộp + bổ sung thực tế vận hành.

**Cập nhật:** 2026-06-29

---

## 0. Khi nào đọc file nào

| Tình huống | Đọc |
|------------|-----|
| Mọi task code | File này + `.ai/AI-DELIVERY-WORKFLOW.md` + `.ai/00-core-rules.md` |
| Backend / API / service | `.ai/01-backend-rules.md` |
| Frontend / component | `.ai/02-frontend-rules.md` + `.ai/09-workspace-rules.md` |
| Model / schema / versioning | `.ai/03-database-rules.md` |
| Sau khi sửa code | `.ai/04-testing-rules.md` |
| Auth / CSRF / SSRF | `.ai/05-security-rules.md` |
| Automation engine (Playwright trong sản phẩm) | `AUTOMATION_STABILITY_ROADMAP.md` + `.ai/06-automation-rules.md` |
| **Automation stability / flaky** | **Chỉ** `AUTOMATION_STABILITY_ROADMAP.md` (không mở hết `.ai/` trừ khi đụng schema/flow) |
| **Smart Recording / ghi step** | **Chỉ** `AUTOMATION_SMART_RECORD_ROADMAP.md` |
| Docker / `.env` / deploy | `.ai/07-deployment-rules.md` |
| Thêm/sửa test | `.ai/08-e2e-rules.md` |
| Giải thích cho user (tiếng Việt) | `.ai/99-prompt-templates.md` |
| Viết step automation cho tester | `AUTOMATION_USER_GUIDE.md` |

---

## 1. Triết lý cốt lõi

* **Không phá** business rule, dữ liệu, snapshot, versioning.
* **Không duplicate** logic — một nguồn sự thật.
* **Không hard-code** URL, secret, path, API key — dùng `.env` / config / `lib/api.ts`.
* **Diff nhỏ** — dễ review, dễ rollback.
* **Không over-engineering** — không wrapper một dòng, abstraction một lần dùng.
* **Không thêm field** nếu suy ra được từ field hiện có (ưu tiên derived > stored duplicate).

---

## 2. Thứ tự làm việc bắt buộc (trước khi code)

1. Hiểu **nghiệp vụ**
2. Hiểu **dữ liệu** (model, invariant, snapshot vs latest)
3. Hiểu **flow** (API → service → DB → UI)
4. **Search helper** có sẵn (`rg` trong `backend/`, `frontendnext/`)
5. Mới được sửa code

Chưa trả lời được: *dữ liệu nào bị ảnh hưởng? flow nào? rule nào?* → **chưa được code**.

### Thứ tự đọc module mới

1. Data Model (`03-database-rules`)
2. Data Invariants
3. Resolver / Helper
4. Service
5. Controller / Route
6. Frontend UI

**Không đọc UI trước khi hiểu dữ liệu.**

### Feature mới — trả lời trước

* Read gì? Create gì? Update gì? Delete gì?

---

## 3. Những việc KHÔNG được làm (trừ khi user yêu cầu)

* `git commit`, `git push`, `force push`, `reset --hard`
* Đổi CI/CD, đổi package manager
* Tạo markdown / script phụ (ngoại lệ: `AUTOMATION_STABILITY_ROADMAP.md`, `AUTOMATION_SMART_RECORD_ROADMAP.md` và script trong roadmap automation)
* Rename hàng loạt, format cả file, refactor ngoài phạm vi task
* Tạo file mới cho helper nhỏ, panel UI nhỏ
* Tự ý thay business rule — **hỏi user** nếu không chắc
* Tự seed admin lúc startup — user chạy tay `npm run seed:admin` khi cần

---

## 4. Kiến trúc dự án

```
backend/          Express + MongoDB + automation Playwright
frontendnext/     Next.js (frontend active — không có frontend/ legacy)
docker-compose.yml
.ai/              Quy tắc cho AI / dev
```

| Port | Service |
|------|---------|
| 3000 | Frontend |
| 5000 | Backend API |
| 27018 | MongoDB (Docker host → container 27017) |
| 8081 | mongo-express (nếu đã thêm vào compose — GUI xem DB) |

---

## 5. Domain model & dữ liệu

### Luồng nghiệp vụ

```
Project → Version → TestCaseGroup → TestCase → TestPlan → TestRun
```

### Versioned entities (có `entityId`, `isLatest`, `deletedAt`)

Project, Version, TestCaseGroup, TestCase, TestPlan.

* Update = **tạo version mới**, không sửa lịch sử.
* Mọi update versioned phải qua `updateVersionedDocument()`.
* Chỉ **một** document `isLatest=true` mỗi `entityId`.

### Snapshot entities

**TestRun** — giữ nguyên kết quả tại thời điểm chạy. Không đổi khi TestCase / TestPlan / Project đổi sau đó.

### entityId vs _id

| | entityId | _id |
|---|----------|-----|
| Dùng cho | Identity ổn định, tham chiếu nghiệp vụ | Version/snapshot cụ thể |
| Ví dụ | `TestPlan.items.testCase`, `TestRun.testPlanEntityId` | `testCaseVersionId`, `TestRun.results.testCase` |

* Frontend: `getId()` **ưu tiên entityId**.
* Backend resolver: hỗ trợ **cả** entityId và _id.
* Không dùng `ObjectId.id` (BSON có thể trả Buffer).

### Business traps (dễ hiểu sai)

| Chủ đề | Quy tắc |
|--------|---------|
| **automation.enabled vs executionMode** | Chỉ `automation.enabled` quyết định case chạy Playwright. `executionMode` = label/UI/bulk — **không** dùng để partition automation. |
| **Base URL** | `caseBaseUrl = run.automationBaseUrl \|\| case.automation.baseUrl` — run-level tùy chọn; bắt buộc nếu case không có URL hợp lệ. |
| **Pin version vs latest** | UI plan: ưu tiên `testCaseVersionId`. **Start run:** luôn resolve **latest** test case. Run đã tạo: giữ snapshot. |
| **Manual vs automation result** | `updateRunResultService()` **không** cho sửa automation result. |

---

## 6. Backend

### Luồng chính

**Start run:**
```
validateStartRunForm → startTestRunService → resolve latest plan
→ findLatestTestCaseByReference → validate URL → TestRun.create → scheduleAutomationRun
```

**Automation:**
```
automationJobRunner → runOrchestrator → Playwright → persist artifacts → updateAutomationProgress
```

**Dry run:** Không ghi DB. Artifact: `dry-run/{uuid}/`.

**Retry failed:** Automation = reset in-place. Manual = tạo run mới.

### Helper quan trọng (mở rộng, không duplicate)

| File | Vai trò |
|------|---------|
| `entityResolvers.js` | find*ByReference, isPlanAssignedToUser, repointVersionReferences |
| `runAutomationPartition.js` | automationCaseNeedsRunBaseUrl, partitionResultsByAutomation |
| `automationUrlPolicy.js` | assertAllowedBaseUrl — SSRF protection |
| `versioningCore.js` | updateVersionedDocument, buildVersionedList |
| `testManagementResolvers.js` | attachTestPlanCases, ensure*Exists |

### API / schema

* Validate bằng **Zod** tại route (`validators/*Schemas.js`).
* Đổi schema → kiểm tra Create, Update, List, Attach, Start Run, Automation.
* `attachTestPlanCases()` phải trả đủ field frontend cần.
* Field mới: ưu tiên **backward compatible**.

### Admin seed

* Script: `cd backend && npm run seed:admin`
* Đọc `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` từ `.env`
* **Không** tự gọi trong `index.js` lúc startup (user tự chạy khi cần)
* Nếu admin đã tồn tại → không đổi password

---

## 7. Frontend

### Helper — `lib/api.ts` (tái sử dụng)

`apiRequest`, `getId`, `validateStartRunForm`, `countPlanAutomationCases`, `planAutomationCasesNeedRunBaseUrl`, `partitionRunItemsByAutomation`, `summarizeRunResults`, `isAutomationWorkerActive`

### Mirror BE ↔ FE (bắt buộc khi đổi business rule)

| Rule | Backend | Frontend |
|------|---------|----------|
| Base URL validation | automationCaseNeedsRunBaseUrl | planAutomationCasesNeedRunBaseUrl |
| Automation partition | partitionResultsByAutomation | partitionRunItemsByAutomation |
| Progress | computeRunProgress | summarizeRunResults |
| Plan populate | attachTestPlanCases | Consumer UI |

### Auth phía FE

* `credentials: "include"` (cookie)
* Không disable UI vì `token === ""`

### Cấu trúc file UI

```
app/workspace/admin/.../page.tsx     # route mỏng
components/workspaceScreens/
  AdminXxxScreen.tsx                 # logic nặng
  EmployeeXxxScreen.tsx
```

* Logic nặng trong `*Screen.tsx`, không nhồi `page.tsx`.
* Gọi API qua `lib/api.ts` — không fetch URL cứng.

### Workspace

| | Admin `/workspace/admin/` | Employee `/workspace/employee/` |
|---|---------------------------|-----------------------------------|
| Quyền | CRUD, automation config, audit | Chạy plan, execution, Jira profile |
| Nav | `adminNav.ts` | My plans, running tests, history, Jira |

Màn **global** (projects, users…) không phụ thuộc project selector. Màn **project** phải xử lý khi chưa chọn project.

---

## 8. Security

* **Cookie auth + CSRF** — mutating request cần cookie + `tcm_csrf`.
* **SSRF:** automation URL qua `automationUrlPolicy.js`; production cần `AUTOMATION_ALLOWED_HOSTS`.
* Secret chỉ trong `.env` — **không commit** `backend/.env`.
* `TRUST_PROXY=1` khi sau reverse proxy (rate limit IP).

---

## 9. Automation (Playwright trong sản phẩm)

> **Không nhầm** với `frontendnext/e2e/*.spec.ts` (e2e test app TCM).

### Một engine — dry run và run thật dùng chung

```
executeSingleCaseAutomation (singleCaseExecutor.js) → runAutomationSteps (playwrightExecutor.js)
```

### File quan trọng

`playwrightExecutor.js`, `locatorResolution.js`, `stepRetry.js`, `assertTextStep.js`, `singleCaseExecutor.js`, `dryRunService.js`, `runOrchestrator.js`, `automationJobRunner.js`, `automationRunReconciler.js`, `failureScreenshotCapture.js`, `artifactStorage/`

### API quyền

| Endpoint | Quyền |
|----------|-------|
| Dry run, failure screenshot | **admin** |
| Start/cancel/retry automation | admin + employee |

### Artifact

* Dry run: `uploads/dry-run/{uuid}/`
* Run thật: `uploads/run/{runId}/{resultId}/`
* Screenshot fail: cần `ARTIFACT_STORAGE=local` hiện tại

### CLI

```bash
cd backend
npm run automation:stability-probe -- --caseKeys AUTH3 --runs 10
npm run automation:seed-demos
```

Report: `backend/reports/` (gitignore).

### Checklist sau sửa automation

1. Dry run + run thật còn chung engine?
2. Mirror FE nếu đổi rule URL/partition?
3. `npm test` backend
4. Stability probe + so baseline
5. Cập nhật `AUTOMATION_USER_GUIDE.md` nếu đổi hành vi step (user-facing)

---

## 10. Testing — 3 loại (đừng nhầm)

| Loại | Ở đâu | Lệnh | Test cái gì |
|------|-------|------|-------------|
| Backend unit/integration | `backend/test/` | `cd backend && npm test` | API, service, validator |
| Frontend E2E | `frontendnext/e2e/*.spec.ts` | `cd frontendnext && npm run test:e2e` | **App TCM** (UI login, admin, employee) |
| Automation stability probe | `backend/scripts/automationStabilityProbe.js` | `npm run automation:stability-probe` | **Website ngoài** theo step user khai báo |

**Sai lầm thường gặp:** sửa `playwrightExecutor.js` để fix e2e app TCM.

### Sau khi sửa — chạy gì

| Sửa | Chạy |
|-----|------|
| Backend | `npm test` |
| Frontend | `npm run lint` |
| UI flow quan trọng | `npm run test:e2e` |
| playwrightExecutor | probe + `npm test` |

### Dọn code sau sửa

* Xóa import/variable/function/export chết
* Không để `tempFunction`, `OldCode_v2`, code comment-out

---

## 11. Deploy & vận hành

### Hai cách chạy

**A. Dev local (đang code):**
```bash
docker compose --profile local-mongo up -d mongodb   # chỉ DB (tùy chọn)
cd backend && npm run dev
cd frontendnext && npm run dev
```
`MONGO_URI` local Docker: `mongodb://admin:admin123@localhost:27018/...?authSource=admin`  
`MONGO_URI` Mongo cài máy: `mongodb://localhost:27017/...`

**B. Full Docker:**
```bash
docker compose --profile local-mongo up -d --build   # hoặc compose đã gộp full stack
```
* `NEXT_PUBLIC_API_BASE` = **build-time** cho frontend image
* Backend trong container: `MONGO_URI` trỏ hostname `mongodb:27017`
* Volume `tcm_uploads` giữ artifact automation

### Lệnh Docker thường dùng

| Mục đích | Lệnh |
|----------|------|
| Chạy nền | `docker compose up -d` |
| Build lại sau đổi code | `docker compose up -d --build` hoặc `--build backend` |
| Tắt | `docker compose down` |
| Kiểm tra đang chạy | `docker compose ps` |
| Xem log | `docker compose logs -f` |

**Lưu ý:** Port 3000/5000 — Docker và `npm run dev` **không** chạy cùng lúc trên cùng port.

### Biến môi trường quan trọng

`MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`, `NEXT_PUBLIC_API_BASE`, `AUTOMATION_ALLOWED_HOSTS`, `ARTIFACT_STORAGE`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `JIRA_*`

### Giai đoạn automation stability

**Không làm** Docker app / environment profile trong roadmap — trừ khi user yêu cầu riêng.

---

## 12. Cách giải thích cho user (thói quen giao tiếp)

* **Tiếng Việt**, ngắn gọn, đủ ý — trả lời đúng câu hỏi.
* **Đời thường trước, thuật ngữ sau** — mỗi từ Anh lần đầu kèm nghĩa ngắn (vd. *dry run* = chạy thử không ghi DB).
* Dùng **bảng** khi liệt kê nhiều mục.
* Tách rõ **“code đã xong”** vs **“việc user làm tay”** (chạy lệnh, probe, xác nhận phase).
* Chỉ cite code/file khi user hỏi “sửa ở đâu” hoặc bắt đầu implement.
* Không kết bài bằng gợi ý lan man — hỏi trực tiếp nếu cần quyết định.

### Cấu trúc trả lời gợi ý

1. **Là gì?** — mục đích bằng lời thường  
2. **Đã làm gì?** — bảng/bullet  
3. **Test thế nào?** — lệnh hoặc bước UI  
4. **Còn thiếu gì?** — chỉ phần chưa xong  

---

## 13. Checklist nhanh

### Trước code
- [ ] Hiểu nghiệp vụ, dữ liệu, flow
- [ ] Search helper có sẵn
- [ ] Hiểu snapshot vs latest, automation.enabled vs executionMode

### Trong code
- [ ] Diff nhỏ
- [ ] Không duplicate / hard-code
- [ ] Mirror BE ↔ FE nếu đổi rule
- [ ] Dùng helper sẵn có

### Sau code
- [ ] Dọn dead code
- [ ] Test / lint đúng loại
- [ ] Không phá snapshot / versioning
- [ ] Không commit/push trừ khi user yêu cầu

---

## 14. Mẫu prompt cho AI (copy nhanh)

```
Đọc .ai/MASTER-PROFILE.md + [file .ai liên quan]. [Mô tả task].
```

```
Đọc AUTOMATION_STABILITY_ROADMAP.md phase đang làm. Giải thích: là gì → đã làm → test → còn thiếu. Tiếng Việt.
```

---

## 15. Tham chiếu file gốc

| File | Nội dung |
|------|----------|
| `.ai/AI-DELIVERY-WORKFLOW.md` | **Code → tự kiểm tra → test → xong phần** (đọc mỗi lần làm feature) |
| `.ai/00-core-rules.md` | Core, checklist, git/CI |
| `.ai/01-backend-rules.md` | Flow backend, helper |
| `.ai/02-frontend-rules.md` | api.ts, mirror |
| `.ai/03-database-rules.md` | Model, invariant, traps |
| `.ai/04-testing-rules.md` | Sau sửa code |
| `.ai/05-security-rules.md` | Auth, SSRF |
| `.ai/06-automation-rules.md` | Engine, artifact, API |
| `.ai/07-deployment-rules.md` | Docker, env |
| `.ai/08-e2e-rules.md` | 3 loại test |
| `.ai/09-workspace-rules.md` | Admin vs employee UI |
| `.ai/99-prompt-templates.md` | Giải thích user |
| `AUTOMATION_STABILITY_ROADMAP.md` | Phase P0–P10 (stability) |
| `AUTOMATION_SMART_RECORD_ROADMAP.md` | Smart Recording SR-0–SR-6 |
| `AUTOMATION_USER_GUIDE.md` | Hướng dẫn viết step |
| `CODING_GUIDELINES.md` | Index ngắn → `.ai/` |
