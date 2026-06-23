# Đánh giá dự án Test Case Management (Senior Review)

**Ngày đánh giá:** 23/06/2026  
**Phạm vi:** `backend/`, `frontendnext/`, Docker/CI  
**Góc nhìn:** Senior full-stack — kiến trúc, logic nghiệp vụ, bảo mật, UX, test, vận hành

---

## 1. Kết luận nhanh

| Tiêu chí | Đánh giá | Ghi chú |
|----------|----------|---------|
| **Sẵn sàng dùng nội bộ (MVP+)** | ✅ **Ổn** | Luồng admin cấu hình → assign plan → employee chạy test → log bug Jira hoạt động end-to-end |
| **Sẵn sàng production công khai** | ⚠️ **Chưa** | Còn lỗ hổng authorization ở vài API read, Jira phụ thuộc mạng nội bộ, automation in-process |
| **Chất lượng code** | ✅ **Khá tốt** | Tách route/service/model rõ; Zod validate; integration test backend đáng tin |
| **Frontend** | ✅ **Ổn cho nội bộ** | Next.js App Router, shell admin/employee tách bạch; thiếu test unit, auth chỉ client-side |
| **Tài liệu & CI** | ✅ **Có** | README chi tiết, GitHub Actions, Playwright e2e (3 spec) |

**Tóm lại:** Dự án **đủ dùng cho team QA nội bộ** với admin + employee, manual + automation cơ bản, dashboard và audit. Chưa nên coi là “xong” nếu mục tiêu là multi-tenant, deploy cloud với Jira on-prem, hoặc scale nhiều instance backend.

---

## 2. Tổng quan kiến trúc

```
┌─────────────┐     cookie JWT + CSRF     ┌──────────────────┐
│  Next.js 16 │ ◄──────────────────────► │  Express 5 API   │
│  frontend   │     REST /api/*           │  + Mongoose 9    │
└─────────────┘                           └────────┬─────────┘
                                                   │
                    ┌──────────────────────────────┼──────────────────────────────┐
                    ▼                              ▼                              ▼
              MongoDB                    Playwright (automation + Jira)    Artifact storage
```

### Backend
- Entry: `backend/index.js` → `src/app.js`
- Router chính: `src/routes/testManagementRoutes.js`, `authRoutes.js`, `jiraRoutes.js`
- Business logic: `testPlanService.js`, `testRunLifecycleService.js`, `testCaseService.js`, automation trong `src/services/automation/`
- Auth: JWT httpOnly cookie, CSRF double-submit, `tokenVersion` revoke session, rate limit login/register (MongoDB)

### Frontend
- Pattern: `app/**/page.tsx` (mỏng) → `*Route.tsx` (data) → `*Screen.tsx` (UI)
- Shell: `WorkspaceShell.tsx` — admin có project scope; employee có scope filter client-side
- API client: `frontendnext/lib/api.ts` — CSRF, cache GET ngắn, `credentials: 'include'`

### Luồng nghiệp vụ chính (đã có và hợp lý)

1. Admin tạo **Project → Version → Groups → Test Cases** (có versioning `entityId`)
2. Admin tạo **Test Plan**, chọn cases, **Assign members** (`PUT /api/test-plans/:id/assign`)
3. Employee thấy plan ở **My Test Plans**, **Start run** → execution workbench (Pass/Fail/Blocked/Skip, Log bug, End run)
4. Admin xem **Test Runs + Execution**, dashboard, execution history, export XLSX
5. Automation: dry-run (admin), chạy Playwright in-process hoặc ingest CI qua secret header
6. Jira: profile per-user, log bug → lưu `LogBug` + tạo issue (Playwright scrape)

---

## 3. Điểm mạnh

### 3.1 Nghiệp vụ & mô hình dữ liệu
- **Versioning** test case / test plan (`entityId`, `isLatest`) — phù hợp QA theo release
- **Snapshot** assignment khi start run (`owner`, `assignees`, `assigneeSnapshot`) — trace được ai được chạy case nào
- **Tách manual vs automation** ở cả BE và FE (`partitionRunItemsByAutomation`)
- **Admin edit completed run** (đổi tên run, sửa kết quả) — có test integration
- **Audit log** cho thao tác admin quan trọng
- **Soft delete** project/case/plan có test integration

### 3.2 Bảo mật (đã làm tốt)
- JWT httpOnly + CSRF trên mutation
- Rate limit auth (IP + email), register chỉ đếm tạo thành công
- Automation URL allowlist (chống SSRF cơ bản)
- Production: chặn JWT secret yếu, sanitize lỗi
- Automation ingest: secret header hoặc admin JWT

### 3.3 Test & CI
- Backend: **~93** test (`npm run test:ci`) — auth, execution chain, automation ingest, soft delete, audit, Jira log schema
- E2E Playwright: auth, employee execution, admin audit log
- Live DB smoke script (`scripts/liveDbSmoke.js`) — bổ sung hữu ích cho QA thủ công

### 3.4 UX (đã cải thiện gần đây)
- Toast thống nhất (`WorkspaceNotice`)
- Project scope trên topbar admin
- Execution workbench: queue, keyboard shortcuts, log bug không cần end run
- Dark mode (một phần)

---

## 4. Vấn đề logic & bảo mật (ưu tiên)

### 🔴 Cao — nên sửa trước khi mở rộng user / deploy rộng

| # | Vấn đề | Mô tả | Bằng chứng |
|---|--------|--------|------------|
| 1 | **Rò rỉ `results` trong `my-items`** | API trả `results` đã filter cho employee, nhưng object `testRun` vẫn spread **toàn bộ** `testRun.results` (chưa filter). Client đọc nhầm field có thể thấy case của người khác. | `backend/src/services/testRunLifecycleService.js` (~517–546) |
| 2 | **GET test plan by ID không check assign** | Employee có thể đọc chi tiết plan nếu biết `testPlanId`, dù không nằm trong list đã assign. | `testPlanController.js` / `getTestPlanService` |
| 3 | **`my-items` không check quyền trên run** | User chưa assign vẫn có thể gọi API và nhận metadata run (project, plan, Jira keys) — `results` rỗng nhưng metadata lộ. | `getMyRunItemsService` |
| 4 | **Jira API không gắn project/run permission** | Mọi user đã login có thể `log-bug` / list log bugs theo `projectId` tùy ý (nếu biết ID). | `src/routes/jiraRoutes.js` |
| 5 | **Đăng ký tự do tạo employee** | Không cần admin duyệt — rủi ro nếu app expose internet. | `authService.js`, `POST /api/auth/register` |

### 🟡 Trung — logic nghiệp vụ / edge case

| # | Vấn đề | Mô tả |
|---|--------|--------|
| 6 | **Assign chỉ cập nhật plan-level** | Schema `TestPlan.items[]` có `owner`/`assignees` per item nhưng `assignTestPlanItemsService` chỉ set plan `assignees` — per-case assign chưa dùng hết. |
| 7 | **Automation ingest hoàn thành run dù item invalid** | `applyAutomationResultsService` có thể `continue` bỏ qua item lỗi rồi vẫn set `status: completed`. |
| 8 | **Start run với case đã soft-delete** | Test ghi nhận resolver vẫn fallback snapshot đã xóa — có thể chạy case “đã xóa”. |
| 9 | **Employee Running Tests vs History filter khác nhau** | `filterMyRuns` (OR startedBy/assignee) vs History (AND startedBy + assign). Cùng user có thể thấy run ở tab này không thấy ở tab kia. |
| 10 | **Automation job in-memory** | `activeRunIds` không survive restart đa process — cần reconciler; không scale horizontal. |

### 🟢 Thấp — chất lượng / nhất quán

| # | Vấn đề |
|---|--------|
| 11 | `note` vs `notes` trên run result — field trùng ý nghĩa |
| 12 | Progress % duplicate formula BE/FE — comment “phải sync” dễ lệch |
| 13 | `createTestPlanBodySchema` `.passthrough()` — body thừa im lặng |
| 14 | Frontend auth không có middleware — flash skeleton trước redirect |
| 15 | Employee poll automation lỗi bị nuốt (admin có toast) |

---

## 5. Thiếu sót tính năng (so với TCM điển hình)

Không phải bug — là gap product nếu so với TestRail / Zephyr / qTest:

| Tính năng | Trạng thái |
|-----------|------------|
| Per-test-case assign trong plan (UI + API đồng bộ) | Schema có, UI/API chưa đầy đủ |
| Test run scheduling / due date | Chưa có |
| Báo cáo PDF / email notification | Chỉ export XLSX, dashboard web |
| Requirement / traceability matrix | Chưa có |
| Comment / @mention trên case | Chưa có |
| Bulk re-assign run đang chạy | Chưa có |
| Admin approval đăng ký user | Chưa có |
| API versioning (`/api/v1`) | Chưa có |
| Webhook / integration ngoài Jira | Chưa có |
| Employee: sửa tên run / edit completed run | Chỉ admin |
| Xóa / archive test run | Chưa thấy API xóa run (chỉ end) |
| Notification khi assign plan | Chưa có |
| i18n thống nhất | Việt + Anh lẫn lộn |

### Jira & deploy
- Jira qua **Playwright scrape** `rd.cytech.ai` — **không chạy được trên Render/Vercel** nếu Jira chỉ trong VPN công ty (đã gặp thực tế).
- Cần **Jira bridge on-prem** hoặc Jira Cloud + REST chính thức nếu muốn deploy cloud.

---

## 6. Frontend — đánh giá riêng

### Đã ổn
- Tách admin / employee workspace rõ
- Execution screen dùng chung — giảm duplicate
- Validation start run phía client (`validateStartRunForm`)
- Build production pass (TypeScript strict)

### Cần cải thiện
- **Không có unit test** frontend (chỉ 3 e2e)
- Typing yếu (`Record<string, any>` phổ biến); `tcmTypes.ts` ít dùng
- **Assign test plan** khó discover (nút trong Plan detail sau khi focus row) — UX không phải bug logic
- Redirect employee: login → `my-test-plans` nhưng `/workspace/employee` → `jira-profile` — không nhất quán
- Dark mode chưa phủ hết employee topbar
- `Started by: Unassigned` trên employee execution — **đã fix** (thiếu prop `userName`)

---

## 7. Testing — độ phủ

| Lớp | Phủ | Thiếu |
|-----|-----|-------|
| Backend unit/schema | Tốt | — |
| Backend integration | Tốt cho core flows | Dashboard, import Excel, screenshot, user admin CRUD, authz gaps |
| Frontend | Gần như không | Chỉ Playwright 3 flow |
| Load / concurrency | Không | Automation multi-worker |

---

## 8. DevOps & vận hành

- `docker-compose.yml`: chỉ MongoDB — backend/frontend chạy tay hoặc Dockerfile riêng
- CI: backend test + frontend build/lint + e2e
- README cập nhật khá đầy đủ (auth rate limit, env vars)
- **Khuyến nghị:** document rõ “Jira chỉ hoạt động khi backend có đường tới Jira nội bộ”

---

## 9. Ma trận ưu tiên khuyến nghị

### Phase 1 — Sửa đúng / an toàn (1–2 tuần)
1. Strip `results` khỏi `testRun` trong `getMyRunItems` (hoặc chỉ trả field cần thiết)
2. Thêm check assign/plan membership cho `GET /api/test-plans/:id` và `GET .../my-items`
3. Gắn permission project/run cho Jira log-bug APIs
4. Thống nhất filter run employee (Running vs History)
5. Tắt hoặc gate `POST /register` trên production (`ALLOW_PUBLIC_REGISTER=false`)

### Phase 2 — Cứng hóa sản phẩm (2–4 tuần)
1. Next.js middleware hoặc server component check session
2. Frontend unit test cho `lib/api.ts`, validation, permission helpers
3. Hoàn thiện per-item assign hoặc bỏ field thừa trong schema
4. Automation: queue durable (Bull/Redis) nếu cần scale
5. i18n / copy thống nhất

### Phase 3 — Mở rộng (tùy roadmap)
1. Jira REST thay scrape; hoặc bridge service nội bộ
2. Notification assign / run completed
3. Báo cáo, traceability
4. Horizontal scale backend + sticky session hoặc stateless automation worker

---

## 10. Checklist “OK để team dùng hàng ngày?”

| Câu hỏi | Trả lời |
|---------|---------|
| Admin tạo project, case, plan, assign được không? | ✅ |
| Employee chỉ thấy plan được assign? | ✅ (list); ⚠️ (GET by ID) |
| Chạy manual test, pass/fail, end run? | ✅ |
| Log bug Jira khi fail (mạng công ty)? | ✅ (phụ thuộc hạ tầng) |
| Automation chạy / ingest CI? | ✅ (single instance) |
| Dashboard / export / audit? | ✅ |
| Build production frontend? | ✅ |
| An toàn khi expose internet không VPN? | ⚠️ Chưa đủ |
| Scale nhiều user đồng thời automation nặng? | ⚠️ Cần queue |

---

## 11. Tài liệu tham chiếu nhanh

| Khu vực | File chính |
|---------|------------|
| API routes | `backend/src/routes/testManagementRoutes.js` |
| Run lifecycle | `backend/src/services/testRunLifecycleService.js` |
| Test plans | `backend/src/services/testPlanService.js` |
| Auth | `backend/src/middlewares/authMiddleware.js` |
| Execution UI | `frontendnext/components/workspaceScreens/ExecutionScreen.tsx` |
| Admin nav / scope | `frontendnext/components/workspaceScreens/adminNav.ts` |
| Employee nav | `frontendnext/components/workspaceScreens/employeeNav.tsx` |
| API client | `frontendnext/lib/api.ts` |

---

*Đánh giá dựa trên đọc mã nguồn và test hiện có, không thay thế pentest hoặc review hạ tầng triển khai thực tế.*
