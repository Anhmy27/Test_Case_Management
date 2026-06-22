# 08 — Quy tắc Test (3 Loại — Đừng Nhầm)

Dự án có **ba loại test khác nhau**. Đọc file này trước khi thêm/sửa test.

---

## 1. So Sánh Nhanh

| Loại | Ở đâu | Chạy thế nào | Test cái gì |
|------|-------|--------------|-------------|
| **Backend unit/integration** | `backend/test/` | `cd backend && npm test` | API, service, validator, policy |
| **Frontend E2E** | `frontendnext/e2e/*.spec.ts` | `cd frontendnext && npm run test:e2e` | **App TCM** (login, admin, employee UI) |
| **Automation engine** | `backend/src/services/automation/` | Dry run UI / probe / start run | **Website bên ngoài** theo step user khai báo |

**Nhầm lẫn thường gặp:** sửa `playwrightExecutor.js` để fix e2e app TCM — **sai**. E2E app dùng spec riêng trong `frontendnext/e2e/`.

---

## 2. Backend Test (`node --test`)

```bash
cd backend
npm test              # đầy đủ
npm run test:ci       # CI — skip test live Jira
npm run test:integration   # chỉ integration
```

* File: `backend/test/**/*.test.js`, `backend/test/integration/**/*.integration.test.js`
* Harness: `backend/test/helpers/integrationHarness.js`
* Fixture: `backend/test/helpers/executionFixtures.js`
* CI env: `JWT_SECRET`, `JIRA_VAULT_SECRET` tối thiểu 32 ký tự

**Quy tắc:** test mới đặt đúng thư mục; không gọi Jira/API live trong `test:ci` (dùng pattern `live` skip).

---

## 3. Frontend E2E (Playwright test app TCM)

```bash
cd frontendnext
npm run test:e2e          # local — tái dùng server đang chạy nếu có
npm run test:e2e:ci       # CI — strict
```

* Config: `frontendnext/playwright.config.ts`
* Spec hiện có: `auth.spec.ts`, `admin-audit-log.spec.ts`, `employee-execution.spec.ts`
* Tự bật backend (`e2eServer.js`) + frontend (`npm run dev`) qua `webServer`
* Port: `E2E_PORT` / `E2E_FRONTEND_PORT` (mặc định 5000 / 3000)
* Seed dữ liệu e2e: `backend/scripts/seedE2eExecution.js`

**Quy tắc:**

1. E2E test **luồng UI TCM**, không test website khách hàng.
2. `fullyParallel: false`, `workers: 1` — giữ nguyên trừ khi có lý do.
3. Thêm spec mới trong `frontendnext/e2e/`, đặt tên `*.spec.ts`.

---

## 4. Automation Stability Probe (không phải E2E app)

```bash
cd backend
npm run automation:stability-probe -- --caseKeys AUTH3 --runs 10
```

Thuộc automation engine — chi tiết `06-automation-rules.md` và `AUTOMATION_STABILITY_ROADMAP.md`.

---

## 5. Sau Khi Sửa — Chạy Gì

| Sửa gì | Chạy |
|--------|------|
| Backend service/validator | `cd backend && npm test` |
| Frontend component/API client | `cd frontendnext && npm run lint` |
| Luồng UI quan trọng | `cd frontendnext && npm run test:e2e` (spec liên quan) |
| `playwrightExecutor.js` | `npm run automation:stability-probe` + `npm test` |

Chi tiết chung: `04-testing-rules.md`.
