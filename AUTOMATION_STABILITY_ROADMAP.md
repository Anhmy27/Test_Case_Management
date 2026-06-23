# Automation Stability Roadmap

Mục tiêu duy nhất trong vài tuần tới:

> **Cùng một test case automation — chạy 10 lần liên tiếp → 10 lần ra cùng một kết quả** (cùng pass hoặc cùng fail ở cùng step).

**Không làm trong giai đoạn này:** Docker app, Queue, Redis, Swagger, Monitoring, Environment Profile.

Đọc file này khi làm automation. Không cần mở `.ai/` hay `CODING_GUIDELINES.md` cho task automation stability (trừ khi đụng schema hoặc flow).

---

## Quy tắc làm việc (rút gọn)

### Trước khi sửa code

1. Hiểu flow: TestCase.automation → dry run / start run → `playwrightExecutor.js`
2. Search helper có sẵn trước khi tạo mới (`rg` trong `backend/src/services/automation/`)
3. Diff nhỏ — chỉ sửa đúng phase đang làm
4. Không duplicate logic giữa dry run và run thật — dùng chung `executeSingleCaseAutomation` / `playwrightExecutor`

### Automation — business rule không được phá

| Rule | Chi tiết |
|------|----------|
| Case auto hay không | `testCase.automation.enabled` quyết định — **không** dùng `executionMode` |
| Base URL | `run.automationBaseUrl` **hoặc** `case.automation.baseUrl` — ít nhất một nơi phải có URL hợp lệ |
| TestRun là snapshot | Sửa engine không đổi kết quả run cũ trong DB |
| Dry run | Không ghi TestRun — dùng để đo flaky và debug |
| SSRF | URL phải qua `automationUrlPolicy.js`; prod cần `AUTOMATION_ALLOWED_HOSTS` |

### Quy tắc viết step (sau Phase 1+)

- **Không** dùng step `wait` (sleep cố định) — dùng `waitFor` (chờ element visible)
- Sau `goto` nên có `waitFor` element quan trọng trước khi click
- Ưu tiên selector: `testid` > `label` > `css` — hạn chế `text` mơ hồ
- `assertText` phải assert đúng phần tử (có `target`), không assert cả `body` khi không cần
- Case chỉ đánh **Stable** khi dry-run / probe **10/10 cùng kết quả**

### File quan trọng

| File | Vai trò |
|------|---------|
| `backend/src/services/automation/playwrightExecutor.js` | Engine — sửa flake ở đây |
| `backend/src/services/automation/singleCaseExecutor.js` | Wrapper 1 case |
| `backend/src/services/automation/dryRunService.js` | Dry run + probe Phase 0 |
| `backend/src/services/automation/runOrchestrator.js` | Chạy full run |
| `backend/scripts/automationStabilityProbe.js` | Đo baseline Phase 0 |
| `frontendnext/components/automation/AutomationConfigPanel.tsx` | UI cấu hình step |

### Sau mỗi phase

```text
cd backend && npm test
cd frontendnext && npm run lint
```

Chạy lại stability probe (10 lần) và so sánh với baseline Phase 0.

---

## Tiến độ

| Phase | Tên | Trạng thái |
|-------|-----|------------|
| P0 | Đo mức flaky hiện tại | ✅ Xong (AUTH3 baseline); probe thêm case khác tùy chọn |
| P1 | Loại bỏ sleep cứng | ✅ Xong (user xác nhận 2026-06-22) |
| P2 | Sửa goto (`load` default) | ⬜ Chưa làm — **đang làm tiếp** |
| P3 | Sửa locator (bỏ `.first()` mù) | ⬜ Chưa làm |
| P4 | Retry từng step | ⬜ Chưa làm |
| P5 | Assert đúng phần tử | ⬜ Chưa làm |
| P6 | Screenshot + Trace khi fail | ⬜ Chưa làm |
| P7 | Dry run 3x = quality gate | ⬜ Chưa làm |
| P8 | Wait step theo điều kiện | ⬜ Chưa làm |
| P9 | Phân loại fail | ⬜ Chưa làm |
| P10 | Stability dashboard | ⬜ Chưa làm |

**Tiêu chí xong P1–P5:** Probe 10 lần → **10/10 cùng status** (pass hoặc fail đều được, miễn là giống nhau).

---

## Phase 0 — Đo mức flaky hiện tại

**Mục tiêu:** Biết đang tệ đến đâu trước khi sửa engine.

**Deliverable:**

- Script `backend/scripts/automationStabilityProbe.js`
- Báo cáo JSON trong `backend/reports/`
- Baseline ghi vào mục [Kết quả baseline](#kết-quả-baseline) bên dưới

### Chuẩn bị (1 lần)

1. Backend + MongoDB đang chạy (hoặc chỉ cần Mongo + `.env` cho script).
2. Có ít nhất 1 test case **bật automation**, có steps và base URL hợp lệ.
3. Ghi `caseKey` (ví dụ: `AUTH_01`, `AUTH3`) — xem trong màn Test Cases.

Khuyến nghị bộ đo (khi đã có đủ case):

- TC Login
- TC Create User
- TC Search
- TC Logout

Chưa có đủ 4 case thì chạy probe với **1 case đang flaky** trước.

### Cách chạy probe

Từ thư mục `backend/`:

```bash
# Một case theo caseKey, 10 lần
npm run automation:stability-probe -- --caseKeys AUTH3 --runs 10

# Nhiều case (PowerShell: dùng dấu phẩy KHÔNG có space, hoặc quote)
npm run automation:stability-probe -- --caseKeys AUTH3,SDF,AUTH_01 --runs 10

# PowerShell — nhiều case khi npm tách argument (cách an toàn):
npm run automation:stability-probe -- --caseKeys AUTH3 --caseKeys SDF --caseKeys AUTH_01 --runs 10

# Ghi đè base URL (khi case chưa có URL hoặc muốn cố định môi trường)
npm run automation:stability-probe -- --caseKeys AUTH3 --runs 10 --baseUrl https://your-app.example.com
```

**Lưu ý:** Mỗi lần chạy = 1 dry run thật (Playwright headless). 10 runs × 1 case ≈ vài phút tùy độ dài test.

### Đọc kết quả

Console in bảng tóm tắt. File chi tiết:

```text
backend/reports/automation-stability-<timestamp>.json
```

Ví dụ output:

```text
Case AUTH3 (Login flow)
  Run  1: PASS  (12.3s)
  Run  2: FAIL  (8.1s)  step assertText
  Run  3: PASS  (11.9s)
  ...
  Pass rate: 7/10 (70%)  => FLAKY
  Consistent: NO (mixed PASS/FAIL)
```

**Chỉ số quan trọng:**

| Chỉ số | Ý nghĩa |
|--------|---------|
| Pass rate | X/10 pass — tham khảo |
| **Consistent** | 10 lần cùng status (toàn PASS hoặc toàn FAIL) — **đây là mục tiêu** |
| Failed step | Step fail đầu tiên (nếu có) — để sửa ở phase sau |

### Khi nào được sang Phase 1

- [x] Script chạy được, có file report
- [ ] Bạn đã chạy probe với case thật của dự án
- [ ] Đã điền [Kết quả baseline](#kết-quả-baseline) vào file này
- [ ] Bạn xác nhận "ổn, sang P1"

---

## Kết quả baseline

> Điền sau khi chạy probe lần đầu. Giữ lại để so sánh sau mỗi phase.

| Ngày | Case keys | Runs | Pass | Fail | Consistent? | Ghi chú |
|------|-----------|------|------|------|-------------|---------|
| 2026-06-18 | AUTH3 | 10 | 0 | 10 | YES | STABLE_FAIL — luôn fail step #5 (~26s), không flaky |

Report file: `backend/reports/automation-stability-2026-06-18T03-09-46-987Z.json`

---

## Phase 1 — Loại bỏ sleep cứng

**Mục tiêu:** Không chờ theo thời gian — chỉ chờ theo điều kiện.

**Sửa trong:** `playwrightExecutor.js`

- Bỏ / thay `page.waitForTimeout` trong step `wait`
- Bỏ hardcoded 2500ms / 5000ms sau click
- Thay bằng `locator.waitFor`, `waitForURL`, `waitForLoadState`

**Test:** Chạy lại probe 10 lần — so với baseline.

- [x] Code xong (engine: không còn `waitForTimeout`)
- [x] Probe 10 lần so baseline
- [x] User xác nhận sang P2

---

## Phase 2 — Sửa goto

**Mục tiêu:** Trang load đủ trước khi interact.

- Default `waitUntil: 'load'` (không dùng chỉ `domcontentloaded`)
- Tùy chọn per-step: `load` | `domcontentloaded` (không default `networkidle` — dễ kẹt với SPA polling)

**Test:** Probe 10 lần.

- [ ] Xong
- [ ] User xác nhận sang P3

---

## Phase 3 — Sửa locator

**Mục tiêu:** Không click/assert nhầm element.

- Bỏ `.first()` im lặng
- Match > 1 element → FAIL (run thật) / WARNING (dry run)
- Sửa text-click: không chỉ `getByRole('button')`

**Test:** Probe 10 lần.

- [ ] Xong
- [ ] User xác nhận sang P4

---

## Phase 4 — Retry từng step

**Mục tiêu:** Network lag 1 lần không làm fail cả case.

- Default 2 retry cho lỗi transient (timeout, not actionable)
- **Không** retry khi assert sai (expected ≠ actual)

**Test:** Probe 10 lần.

- [ ] Xong
- [ ] User xác nhận sang P5

---

## Phase 5 — Assert đúng phần tử

**Mục tiêu:** Không pass giả vì text nằm ở chỗ khác trên trang.

- `assertText` + có `target` → assert trên locator
- Không `target` → assert body + warning trong dry run

**Test:** Probe 10 lần → mục tiêu **Consistent: YES**.

- [ ] Xong
- [ ] User xác nhận sang P6

---

## Phase 6 — Screenshot + Trace khi fail

**Mục tiêu:** Nhìn phát biết vì sao fail (không giảm flake, giúp debug).

- [ ] Xong

---

## Phase 7 — Dry run 3x quality gate

**Mục tiêu:** Chỉ đánh dấu case Stable khi 3 dry-run liên tiếp pass.

- [ ] Xong

---

## Phase 8 — Wait step đúng nghĩa

**Mục tiêu:** Deprecate sleep; mở rộng wait theo điều kiện.

- [ ] Xong

---

## Phase 9 — Phân loại fail

**Mục tiêu:** `TEST_FAILED` vs `AUTOMATION_ERROR`.

- [ ] Xong

---

## Phase 10 — Stability dashboard

**Mục tiêu:** Lịch sử pass rate 30 ngày, badge FLAKY.

- [ ] Xong

---

## Demo cases (public websites)

Script `npm run automation:seed-demos` tạo project **Automation Web Demos** với 5 case:

| caseKey | Site | Mô tả ngắn |
|---------|------|------------|
| DEMO-EX01 | example.com | Title + footer text |
| DEMO-INET | the-internet.herokuapp.com | Home + "Available Examples" |
| DEMO-HTTP | httpbin.org/html | Heading + "Melville" |
| DEMO-WIKI | wikipedia.org | Title + search input |
| DEMO-TODO | demo.playwright.dev/todomvc | Thêm todo item |

---

## Changelog

| Ngày | Phase | Ghi chú |
|------|-------|---------|
| 2026-06-18 | P0 | Probe AUTH3 10/10; fix PowerShell multi-caseKeys parsing |
| 2026-06-22 | P1 | Loại bỏ sleep cứng — user xác nhận xong; UI workbench manual/auto |
