# Test Case Management — Quy tắc dự án

Quy tắc đã tách vào `.ai/` — **chỉ đọc file liên quan task** để tiết kiệm token.

| File | Khi nào đọc |
|------|-------------|
| [`.ai/AI-DELIVERY-WORKFLOW.md`](.ai/AI-DELIVERY-WORKFLOW.md) | **Mỗi lần AI làm feature:** code → tự kiểm tra → test → xong phần |
| [`.ai/MASTER-PROFILE.md`](.ai/MASTER-PROFILE.md) | Profile đầy đủ — đọc kèm workflow |
| [`.ai/00-core-rules.md`](.ai/00-core-rules.md) | Luôn đọc trước: thứ tự làm việc, coding rules, checklist, git/CI |
| [`.ai/01-backend-rules.md`](.ai/01-backend-rules.md) | Service, controller, route, flow chạy test, helper backend |
| [`.ai/02-frontend-rules.md`](.ai/02-frontend-rules.md) | Component, `lib/api.ts`, mirror BE↔FE |
| [`.ai/03-database-rules.md`](.ai/03-database-rules.md) | Model, schema, versioning, TestRun snapshot, business trap |
| [`.ai/04-testing-rules.md`](.ai/04-testing-rules.md) | Sau khi sửa: test, lint, dọn code |
| [`.ai/05-security-rules.md`](.ai/05-security-rules.md) | Auth, CSRF, SSRF URL automation |
| [`.ai/06-automation-rules.md`](.ai/06-automation-rules.md) | Engine Playwright, dry run, artifact, script probe |
| [`.ai/07-deployment-rules.md`](.ai/07-deployment-rules.md) | Docker, `.env`, CORS, compose |
| [`.ai/08-e2e-rules.md`](.ai/08-e2e-rules.md) | Phân biệt 3 loại test — đừng nhầm automation vs e2e app |
| [`.ai/09-workspace-rules.md`](.ai/09-workspace-rules.md) | Admin vs employee UI, đặt file Screen/Route |
| [`.ai/99-prompt-templates.md`](.ai/99-prompt-templates.md) | Cách giải thích cho user, mẫu prompt |

**Automation stability (flaky):** `AUTOMATION_STABILITY_ROADMAP.md` — phase P0–P10, không duplicate trong `.ai/06`.

**Viết step automation (cho tester):** `AUTOMATION_USER_GUIDE.md`.
