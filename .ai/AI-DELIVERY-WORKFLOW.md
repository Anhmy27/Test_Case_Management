# AI Delivery Workflow — Code → Tự kiểm tra → Test → Xong phần đó

> **Mục đích:** Mỗi lần AI làm một phần việc, đọc file này để **làm xong thật** — không bỏ dở, không lệch số, không để rác.  
> **Đọc kèm:** `.ai/MASTER-PROFILE.md` (bản đầy đủ thói quen & domain).

**Cập nhật:** 2026-06-29

---

## 1. Mô hình làm việc (user yêu cầu)

```text
Đọc quy tắc → Code một phần nhỏ → Tự kiểm tra → Test → Báo user → Sang phần tiếp
```

**Làm đến đâu xong đến đấy** — không nhảy phần, không gom nhiều phase một lần trừ khi user bảo.

---

## 2. TRƯỚC KHI CODE — AI phải đọc

| Bước | Đọc gì |
|------|--------|
| Luôn luôn | File này + `.ai/MASTER-PROFILE.md` |
| Backend / API | `.ai/01-backend-rules.md` |
| Model / schema | `.ai/03-database-rules.md` |
| Frontend | `.ai/02-frontend-rules.md` + `.ai/09-workspace-rules.md` |
| Auth / bảo mật | `.ai/05-security-rules.md` |
| Automation engine | `AUTOMATION_STABILITY_ROADMAP.md` + `.ai/06-automation-rules.md` |
| Smart Recording | `AUTOMATION_SMART_RECORD_ROADMAP.md` |
| Deploy / Docker | `.ai/07-deployment-rules.md` |

### Trả lời nội bộ trước khi gõ code

1. Phần này **là gì** (nháp vs chính thức, snapshot vs latest)?
2. **Read / Create / Update / Delete** cái gì?
3. Có **helper** sẵn không? (`rg` trước, không tạo trùng)
4. **Không được phá** rule nào? (versioning, TestRun snapshot, `automation.enabled`…)

Chưa trả lời được → **chưa code**.

---

## 3. QUY TẮC CODE (tóm tắt bắt buộc)

| Quy tắc | Ý nghĩa |
|---------|---------|
| Diff nhỏ | Chỉ sửa đúng phạm vi phần đang làm |
| Một nguồn sự thật | Không duplicate logic BE/FE |
| Không hard-code | URL, secret, path → `.env` / config |
| Không over-engineer | Không wrapper 1 dòng, không file phụ cho helper nhỏ |
| Tái sử dụng | `entityResolvers`, `artifactStorage`, `lib/api.ts`… |
| Versioned entity | Update qua `updateVersionedDocument()` — không sửa lịch sử |
| TestRun = snapshot | Không đổi kết quả run cũ |
| Smart Record | `RecordingSession` = nháp; `automation.steps` = chính thức sau Lưu (SR-4) |
| Field mới | Backward compatible khi có thể |
| Validate | Zod tại route (`validators/*Schemas.js`) |

### Không làm (trừ khi user yêu cầu)

* `git commit` / `git push`
* Markdown / script ngoài roadmap hoặc ngoài phần user yêu cầu
* Refactor / format cả file ngoài scope
* Tự seed admin lúc startup

---

## 4. SAU MỖI PHẦN — TỰ KIỂM TRA (Verification)

AI **tự chạy**, không chỉ hướng dẫn user — trừ khi cần xác nhận UI mắt người.

### 4.1 Checklist logic & số liệu

- [ ] **Đếm khớp:** `eventCount` = `events.length`; `sequence` tăng 0,1,2… không nhảy
- [ ] **Nháp tách chính thức:** ghi recording **không** đổi `TestCase.automation.steps` cho đến merge
- [ ] **Artifact tách namespace:** `recording/` ≠ `dry-run/` ≠ `run/`
- [ ] **Quyền:** admin vs employee đúng spec (recording = admin như dry-run)
- [ ] **SSRF:** `baseUrl` qua `assertAllowedBaseUrl`
- [ ] **Ownership:** user chỉ xem/sửa session của mình
- [ ] **Status machine:** không append khi `merged` / `discarded` / `ready_for_review` (trừ spec sau này)

### 4.2 Checklist hồi quy (regression)

- [ ] Test cũ vẫn pass (`npm run test:ci` backend)
- [ ] Luồng liên quan không vỡ: dry-run, start run, import case, auth
- [ ] Không duplicate index / model overwrite Mongoose

### 4.3 Checklist giải thích cho user

- [ ] Tiếng Việt, **đời thường trước** (nháp vs đơn chính thức)
- [ ] Tách **đã xong** vs **user làm tay** (nếu có)
- [ ] Báo kết quả test (số pass/fail), không chỉ “bạn tự chạy”

---

## 5. QUY TẮC TEST — chạy gì sau mỗi phần

| Sửa | Lệnh tối thiểu |
|-----|----------------|
| Backend (model, service, API) | `cd backend && npm run test:ci` |
| Chỉ file recording | `node --test test/recording-unit.test.js test/integration/recording-session.integration.test.js` |
| Frontend | `cd frontendnext && npm run lint` |
| UI flow quan trọng | `cd frontendnext && npm run test:e2e` |
| Playwright engine | `npm run automation:stability-probe` + `npm test` |

**178+** test backend CI phải **0 fail** trước khi báo “xong phần”.

---

## 6. QUY TẮC XÓA & DỌN DẸP

### 6.1 Trong code

* Xóa import / biến / function / export **chết**
* Không để `temp*`, `OldCode_v2`, code comment-out
* Không tạo file mới nếu đã có module làm việc đó — **search trước**

### 6.2 Dữ liệu & file (Smart Recording)

| Đối tượng | Khi nào xóa | Cách |
|-----------|-------------|------|
| `RecordingSession` chưa merge | ~7 ngày | TTL `expiresAt` (Mongo) |
| Session `merged` | Giữ (không TTL) | `expiresAt = null` |
| Session `discarded` | API discard | `deleteSessionArtifacts(sessionId)` + status discarded |
| Smoke script | Sau test | Script tự `deleteOne` / `rm` — không để rác |
| `automation.steps` | Chỉ SR-4 merge | Version mới test case — **không** xóa lịch sử |

### 6.3 Git

* **Không** commit / push trừ khi user yêu cầu
* **Không** commit `.env`, credential

---

## 7. Smart Recording — kiểm tra riêng mỗi phần

| Phần | Xong khi | Test |
|------|----------|------|
| SR schema | Model lưu/đọc được | `recording-unit.test.js` |
| Artifact path | File đúng `uploads/recording/{sessionId}/...` | `recording-unit.test.js` |
| API phiên ghi | start → events → stop → get | `recording-session.integration.test.js` |
| SR-1 pipeline | Lọc rác, gom gõ, semantic | Unit test pipeline (sắp tới) |
| SR-4 merge | Nháp → `automation.steps` version mới | Integration + không đổi run cũ |

---

## 8. Mẫu prompt user copy cho AI

**Bắt đầu phần mới:**
```text
Đọc .ai/AI-DELIVERY-WORKFLOW.md + .ai/MASTER-PROFILE.md + [roadmap nếu có].
Làm [phần X]. Tự test và dọn code trước khi báo xong.
Giải thích tiếng Việt: đời thường trước, nháp vs chính thức.
```

**Sau khi AI báo xong — user chỉ cần:**
```text
OK, làm phần tiếp theo.
```

---

## 9. Tham chiếu nhanh file gốc

| File | Nội dung |
|------|----------|
| `.ai/MASTER-PROFILE.md` | Profile đầy đủ |
| `.ai/00-core-rules.md` | Core, git, checklist |
| `.ai/04-testing-rules.md` | Testing sau sửa |
| `AUTOMATION_SMART_RECORD_ROADMAP.md` | Lộ trình SR-0→SR-6 |
| `CODING_GUIDELINES.md` | Index → `.ai/` |
