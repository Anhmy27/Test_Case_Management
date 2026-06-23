# 06 — Quy tắc Automation (Playwright trong sản phẩm)

Đọc khi sửa automation engine, cấu hình case, dry run, chạy run tự động, artifact.

**Làm stability / flaky (ổn định test):** đọc `AUTOMATION_STABILITY_ROADMAP.md` — file này không thay roadmap.

**Hướng dẫn viết step cho tester:** `AUTOMATION_USER_GUIDE.md`.

---

## 1. Automation Trong Dự Án Là Gì

Hệ thống chạy **test case do user khai báo** (bước goto, click, assert…) bằng **Playwright headless** trên backend — **không phải** file `frontendnext/e2e/*.spec.ts` (e2e đó test app TCM; xem `08-e2e-rules.md`).

---

## 2. Business Rule — Không Được Phá

| Rule | Chi tiết |
|------|----------|
| Case có chạy auto không | `testCase.automation.enabled` — **không** dùng `executionMode` |
| Base URL | `run.automationBaseUrl` **hoặc** `case.automation.baseUrl` — ít nhất một URL hợp lệ |
| TestRun | Snapshot — sửa engine **không** đổi kết quả run cũ trong DB |
| Dry run | Không tạo TestRun — chỉ thử / debug / đo flaky |
| URL | Qua `automationUrlPolicy.js`; production cần `AUTOMATION_ALLOWED_HOSTS` |

Chi tiết dữ liệu: `03-database-rules.md`. Flow backend: `01-backend-rules.md` mục 2–4.

---

## 3. Một Nguồn Engine — Không Duplicate

Dry run và run thật **cùng** đường:

```
executeSingleCaseAutomation (singleCaseExecutor.js)
  → runAutomationSteps (playwrightExecutor.js)
```

**Không** copy logic step sang service khác. Sửa flake ở `playwrightExecutor.js` (theo phase trong roadmap).

---

## 4. File Quan Trọng

| File | Vai trò |
|------|---------|
| `playwrightExecutor.js` | Engine — thực thi từng step |
| `assertTextStep.js` | P5 — assertText theo locator hoặc body + warning dry run |
| `locatorResolution.js` | P3 — strict locator |
| `stepRetry.js` | P4 — retry bước lỗi tạm |
| `singleCaseExecutor.js` | Wrapper 1 case + screenshot khi fail |
| `dryRunService.js` | Dry run API, không ghi TestRun |
| `runOrchestrator.js` | Chạy full TestRun |
| `automationJobRunner.js` | Queue background sau khi tạo run |
| `automationRunReconciler.js` | Tiếp tục run khi server restart |
| `failureScreenshotCapture.js` | Ảnh màn hình lúc fail |
| `artifactStorage/` | Lưu screenshot (local / s3) |
| `authManager.js` | Session Playwright theo `webId` + `userKey` |

**Frontend:**

| File | Vai trò |
|------|---------|
| `AutomationConfigPanel.tsx` | Form cấu hình step |
| `AutomationDryRunPanel.tsx` | Nút chạy thử + xem screenshot |
| `AutomationRunExecutionPanel.tsx` | Theo dõi run automation |
| `automationStepMeta.ts` | Định nghĩa loại step |
| `automationDryRun.ts` | Gọi API dry run |
| `automationArtifacts.ts` | Tải screenshot |

---

## 5. API & Quyền

| Endpoint | Quyền |
|----------|-------|
| `POST /automation/dry-run` | **admin** |
| `GET /automation/dry-runs/:id/failure-screenshot` | **admin** |
| Start run / cancel / retry automation | **admin**, **employee** |

Dry run chỉ admin — đừng mở quyền employee trừ khi user yêu cầu.

---

## 6. Script Hỗ Trợ (CLI)

Từ thư mục `backend/`:

```bash
# Đo flaky — Phase 0 roadmap
npm run automation:stability-probe -- --caseKeys AUTH3 --runs 10

# Seed 5 case demo web công khai
npm run automation:seed-demos
```

Report probe: `backend/reports/` (đã gitignore).

---

## 7. Artifact (file đính kèm)

* Dry run: `uploads/dry-run/{uuid}/`
* Run thật: `uploads/run/{runId}/{resultId}/`
* Dry run: namespace `dry-run/{uuid}/`
* Screenshot khi fail: **chỉ hoạt động** với `ARTIFACT_STORAGE=local` hiện tại

Config: `backend/src/config/automationArtifacts.js`.

---

## 8. Khi Sửa Automation — Checklist

1. Dry run và run thật còn dùng chung `executeSingleCaseAutomation`?
2. Mirror FE nếu đổi rule URL / partition — `02-frontend-rules.md`
3. `npm test` backend
4. Nếu sửa engine: chạy stability probe, so roadmap baseline
5. Cập nhật `AUTOMATION_USER_GUIDE.md` nếu đổi hành vi step (user-facing)
