# Smart Recording — Lộ trình ghi bước automation (TCM)

> **Mục tiêu đời thường:** Tester **làm trên web như bình thường** (click, gõ, chọn…) → hệ thống **tự ghi lại** → tester **xem lại, sửa chút** → **Lưu** thành test case auto.  
> **Vẫn giữ** cách nhập tay hiện tại. **Chưa dùng AI** cho đến SR-5.

**Cập nhật:** 2026-06-29  
**Liên quan:** `AUTOMATION_STABILITY_ROADMAP.md` (P0–P6 xong; P7–P10 ⏸ tạm hoãn)

---

## Đánh giá & chỉnh từ review ngoài (tóm tắt)

| Góp ý | Quyết định |
|-------|------------|
| Hai track Stability / Smart Record | ✅ Giữ — đúng hướng |
| Ghi = bản nháp, merge sau | ✅ Giữ — cốt lõi |
| Tách SR-1→SR-6, không nhảy AI sớm | ✅ Giữ |
| Lọc nhiễu + gom bước | ✅ Giữ |
| Ảnh/DOM khi ghi | ✅ Giữ |
| Event nhúng DB dễ đầy | ✅ Thêm **ngưỡng tách bảng** (mục 4.8) |
| Bảng điểm locator cố định | ✅ Thêm (mục SR-2) |
| Cách chạy locator `role` trên Playwright | ✅ Thêm spec rõ (mục SR-2) |
| Lớp “hành động có nghĩa” (semantic) | ✅ Thêm pipeline (mục SR-1 / SR-3) |
| Gom theo “cụm việc” (login, upload…) | ✅ Thêm SR-3 |
| So sánh DOM trước/sau click | ✅ Thêm SR-3 (tùy chọn) |
| Xem thử draft trước khi Lưu | ✅ Thêm SR-4 |
| **Tự đổi locator khi chạy fail** (self-healing) | ❌ **Không làm sớm** — chỉ lưu nhiều lựa chọn để tester **chọn lúc review**; chạy thật vẫn 1 locator đã chọn (giống manual). Retry lỗi mạng xem track Stability P4. |

---

## 0. Hai đường song song (không phá cái cũ)

**Ví dụ đời thường:** Nhà bạn đang ổn điện nước (chạy test ổn). Giờ lắp thêm máy ghi hình (smart record) — **không đụng** đường điện cũ; chỉ khi bạn **duyệt** thì mới nối vào hệ thống.

| Đường | File | Trạng thái |
|-------|------|------------|
| **Ổn định khi chạy** (flaky, trace…) | `AUTOMATION_STABILITY_ROADMAP.md` | P0–P6 ✅; P7–P10 ⏸ |
| **Ghi bước thông minh** | File này | Bắt đầu từ schema → SR-1 |

**Ba quy tắc vàng:**

1. Danh sách bước trong test case (`automation.steps`) vẫn là **thứ engine đọc khi chạy** — không đổi.
2. Lúc ghi chỉ tạo **bản nháp** — chưa đụng test case thật.
3. Chỉ sau **Xem lại + Lưu** mới ghi vào test case (tạo version mới, không sửa lịch sử).

---

## 1. Các giai đoạn SR-0 → SR-6 (kèm ví dụ)

### SR-0 — Giữ cách làm cũ (manual)

**Ví dụ:** Tester vẫn tự chọn `click`, tự điền CSS `#login-btn` như hôm nay.

**Mục tiêu:** Production không hỏng; ai quen nhập tay vẫn dùng được.

**Xong khi:** Form edit test case hoạt động y như trước.

---

### SR-1 — Ghi hành vi + làm sạch (chưa “thông minh” lắm)

**Ví dụ đời thường:** Bạn quay video tay trên điện thoại, nhưng **không lưu từng cái rung chuột**. Chỉ giữ: “bấm nút Đăng nhập”, “gõ admin vào ô user”, “chuyển sang trang Dashboard”.

**Làm gì:**

1. Mở trang (URL gốc) → bắt đầu ghi.
2. Thu thập: click, gõ chữ, chọn dropdown, chuyển trang, upload file…
3. **Bỏ rác:** di chuột lia lia, scroll vô thưởng vô phạt, click đúp nhầm.
4. **Gom:** gõ `a` `d` `m` `i` `n` từng chữ → một bước “Điền username = admin”.
5. Đặt tên việc đơn giản (lớp **semantic** — xem pipeline bên dưới): ví dụ `CLICK_LOGIN`, `FILL_USERNAME`.

**Chưa làm:** Tự đoán “đây là flow đăng nhập”; chưa AI.

**Ra gì:** Bảng **bản nháp bước** còn thô nhưng đã sạch hơn log thuần.

---

### SR-2 — Tự tìm “địa chỉ” nút/ô trên trang (locator)

**Ví dụ:** Thay vì bắt tester mò `#app > div:nth-child(3) > button`, hệ thống thử lần lượt: có `data-testid` không? có nhãn “Đăng nhập” không? có `id` không? — rồi **chấm điểm** cái nào ổn nhất.

**Thứ ưu tiên & điểm mặc định:**

| Cách tìm phần tử | Điểm | Ghi chú |
|------------------|------|---------|
| `data-testid` | 100 | Ổn định nhất nếu dev có gắn |
| role + tên hiển thị (nút “Đăng nhập”) | 90 | Playwright: `getByRole('button', { name: 'Đăng nhập' })` |
| `id` | 80 | Hay đổi trên SPA |
| `label` / placeholder | 75 | Form |
| Text hiển thị | 70 | Dễ trùng |
| CSS | 50 | Dễ vỡ khi đổi giao diện |
| XPath | 30 | Chỉ khi bí |

**Khi chạy thật (sau khi Lưu):** Mỗi bước chỉ dùng **một** locator tester đã chấp nhận (mặc định điểm cao nhất). Các lựa chọn khác **lưu kèm để đổi lúc review**, không tự đổi lúc chạy (tránh self-healing sớm).

**Cách map `role` vào engine (bắt buộc rõ trước code):**

```text
targetType = 'role'
target       = 'button'      // loại phần tử
value        = 'Đăng nhập'   // tên hiển thị
→ playwright: page.getByRole(target, { name: value })
```

**Bonus:** Chụp ảnh màn hình trước mỗi bước (lưu file như screenshot dry-run).

---

### SR-3 — Hiểu thêm một chút (gom “cụm việc”)

**Ví dụ:** Thay vì 5 dòng “click ô user / gõ a / gõ d / … / click Đăng nhập”, tester thấy một **cụm “Đăng nhập”** với 3 bước gọn.

**Nâng cấp so với SR-1:**

1. **Gom cụm (intent block):** login, tìm kiếm, upload file… — dựa trên URL + loại control, không cần AI.
2. **Gợi ý chờ:** Sau click mở popup → gợi ý thêm bước “chờ ô X hiện ra”.
3. **So DOM trước/sau (tùy chọn):** Click xong trang đổi hẳn → biết là chuyển trang, không phải click hụt.

**Ra gì:** Bản nháp **gần giống** người viết test case.

---

### SR-4 — Tester xem lại, sửa, rồi mới Lưu

**Ví dụ:** Giống xem lại đơn hàng trước khi thanh toán — sửa số lượng, bỏ món, rồi **Xác nhận**.

**UI:**

- Danh sách bước nháp
- Sửa giá trị (password, file…)
- Đổi locator (chọn ứng viên thứ 2 nếu cần)
- Bỏ / giữ từng bước
- **Xem thử (replay preview):** chạy thử đúng các bước nháp **trước** khi ghi vào test case — giống dry run nhưng từ session ghi, chưa merge
- **Lưu vào test case** → tạo version mới test case

**Ra gì:** `TestCase.automation.steps[]` — format **y hệt** hiện tại, engine cũ chạy được.

---

### SR-5 — AI hỗ trợ nhẹ (sau SR-4 ổn)

**Ví dụ:** Gợi ý tên case “Đăng nhập thành công”, gợi ý expected “Thấy menu Dashboard” — tester vẫn quyết định.

**Không thay** máy ghi; không tự sửa locator lúc chạy.

---

### SR-6 — Mô tả bằng lời → full test (tương lai)

**Ví dụ:** Gõ “User đăng nhập đúng mật khẩu thì vào dashboard” → hệ thống tự sinh bước.

**Chỉ làm** khi SR-1–4 đã dùng được trong pilot.

---

## 2. Pipeline dữ liệu (dễ hình dung)

**Ví dụ:** Ghi âm → phiên âm → gạch đầu dòng → biên tập → in sách.

```text
Hành động trên web (click, gõ…)
        ↓
[Lớp 1] Sự kiện thô (lưu tạm, có thể bỏ rác)
        ↓
[Lớp 2] Việc có tên (semantic): FILL_USERNAME, CLICK_LOGIN…
        ↓
[Lớp 3] Bước nháp: click / type / goto + locator + giá trị
        ↓
[Lớp 4] Tester review + xem thử
        ↓
[Lớp 5] Bước trong test case (format cũ) → dry run / chạy run
```

**Lưu ý:** Lớp 1–4 nằm trong **phiên ghi** (`RecordingSession`). Lớp 5 mới vào Mongo test case.

---

## 3. Sơ đồ hệ thống (ngắn)

```text
Màn hình Test Case
  [Nhập tay]          [Ghi] [Xem nháp] [Xem thử] [Lưu]
        │                    │
        │                    ▼
        │            Backend: phiên ghi + làm sạch + locator
        │                    │
        └──────────── merge ──┘
                    ▼
        automation.steps (như hiện tại) → Playwright chạy
```

---

## 4. Schema — đã có gì, cần thêm gì

### 4.1 Đang có (không phá)

**Test case** đã có:

```text
automation: { enabled, baseUrl, webId, userKey, timeoutMs, steps[] }
```

Mỗi **bước** có: `action`, `targetType`, `target`, `value`, … — engine đọc trực tiếp.

### 4.2 Cần thêm — phiên ghi `RecordingSession`

**Ví dụ:** Giống **phiên chat nháp** — chưa gửi vào hộp thư chính (test case).

| Thông tin | Ý nghĩa |
|-----------|---------|
| `status` | đang ghi / xong chờ duyệt / đã lưu / đã hủy |
| `baseUrl`, người ghi, project | Ngữ cảnh |
| `events[]` | Nhật ký đã làm sạch |
| `semanticActions[]` | *(SR-1+)* Tên việc: FILL_USERNAME… |
| `draftSteps[]` | Bước nháp để review |
| `intentBlocks[]` | *(SR-3)* Cụm: login, search… |

**Tự xóa sau ~7 ngày** nếu không merge (tránh đầy DB).

### 4.3 Khi nào tách event ra bảng riêng (quan trọng)

**SR-1:** Event nhúng trong session — đủ cho pilot (vài chục bước).

**Tự động tách** khi một trong các điều kiện:

- Hơn **300** event trong một phiên, hoặc
- Ước tính document **> 4 MB**, hoặc
- Ghi **> 15 phút** liên tục

→ Chuyển sang bảng `RecordingEvent` (cùng `sessionId`), session chỉ giữ số đếm + link.

**Không chờ** đụng giới hạn 16 MB Mongo mới xử lý.

### 4.4 Bổ sung nhẹ trên test case (sau SR-4)

```text
authoringSource: 'manual' | 'recorded' | 'hybrid'
lastRecordedAt, lastRecordingSessionId
```

Chỉ để biết case từ đâu — **không ảnh hưởng** cách chạy.

### 4.5 Ảnh / file khi ghi

| Loại | Đường lưu |
|------|-----------|
| Ảnh từng bước | `uploads/recording/{sessionId}/steps/...png` |
| DOM (tùy chọn) | `uploads/recording/{sessionId}/dom/...html` |

Tách hẳn với ảnh dry-run / run fail.

---

## 5. API (sơ bộ)

| Khi nào | Việc |
|---------|------|
| SR-1 | Bắt đầu ghi / gửi event / Dừng ghi / Xem phiên |
| SR-4 | Sửa bước nháp / **Xem thử nháp** / **Lưu vào test case** |

Quyền: giống dry-run (admin trước; mở employee khi pilot ổn).

---

## 6. Cách bắt sự kiện trên trình duyệt (chọn 1 trước SR-1 code)

| Cách | Giống đời thường | Phù hợp |
|------|------------------|---------|
| **A. Extension Chrome** | Cắm “ống nghe” vào tab đang test | Tester không có source |
| **B. Browser do server mở** | Máy chủ mở Chrome, tester xem qua màn hình từ xa | Dev/admin trên server |

**Pilot tester:** ưu tiên **A**.

---

## 7. Thứ tự làm (schema trước, code sau)

```text
1. [x] Bạn duyệt schema trong file này
2. [x] Tạo model RecordingSession (+ event, draft, semantic, intentBlock)
3. [x] Đường lưu ảnh recording/*
4. [x] API phiên ghi (start / events / stop / pause / resume / discard / get)
5. [x] Lọc rác + gom gõ + semantic cơ bản (SR-1) — có test unit + integration
6. [x] Spike extension Chrome (SR-1.0 pilot 6.1–6.8) — chưa screenshot/DOM từ extension
7. [ ] Locator + bảng điểm (SR-2) + role trong engine          ← TIẾP THEO
8. [ ] Gom cụm + gợi ý chờ (SR-3)
9. [ ] UI review + xem thử + lưu (SR-4)
10. [ ] SR-5, SR-6 sau
```

### Tiến độ chi tiết (cập nhật 2026-07-02)

| Lô | Nội dung | Trạng thái |
|----|----------|------------|
| Backend 2.8 | Externalize events (>300 / >4MB / >15 phút) | ✅ |
| Backend 2.9 | Pause / resume API | ✅ |
| Backend 2.10 | Screenshot/DOM artifact khi append | ✅ |
| Ext 6.1–6.3 | Scaffold MV3, capture DOM, payload schema | ✅ |
| Ext 6.4–6.6 | Popup config, start/stop, batch events + CSRF | ✅ (commit `c379448`) |
| Ext 6.7–6.8 | Pause/resume extension, auth errors, smoke test README | ✅ code xong, **chưa commit** |
| SR-2 | Locator scoring + `role` trong Playwright engine | ❌ chưa làm |
| SR-3 | Intent blocks | ❌ chưa làm |
| SR-4 | Merge/preview API + UI review/Lưu | ❌ chưa làm |

**Đích pilot hiện tại:** SR-1.0 extension ghi → nháp trên server (`ready_for_review`) — chưa có UI TCM review/Lưu.

Mỗi bước: `cd backend && npm test` — case cũ vẫn import/chạy được.

---

## 8. Cố ý KHÔNG làm (tránh fail dự án)

- ❌ AI / prompt-to-test trước SR-4
- ❌ Bỏ form nhập tay
- ❌ **Tự đổi locator khi chạy** (self-healing) — chỉ chọn lúc review
- ❌ Ghi thẳng click chuột thô vào test case
- ❌ Sửa TestRun để chứa bản ghi
- ❌ Làm P7–P10 stability song song SR-1 (trừ hotfix)

**Retry khi mạng chập chờn** (khác self-healing): xem `AUTOMATION_STABILITY_ROADMAP.md` P4 — đã có retry bước, không đổi locator.

---

## 9. Mức trưởng thành sản phẩm (tham khảo)

| Mức | Mô tả |
|-----|--------|
| Cơ bản | Nhập CSS tay |
| Trung bình | Form step + dry run |
| **Nâng cao (đích SR-1–4)** | Ghi → nháp → xem thử → lưu |
| Chuyên sâu | AI gợi ý (SR-5) |
| Tương lai | Mô tả bằng lời → full test (SR-6) |

---

## 10. Tài liệu liên quan

| File | Khi nào đọc |
|------|-------------|
| `AUTOMATION_STABILITY_ROADMAP.md` | Flaky, trace, retry khi chạy |
| `AUTOMATION_USER_GUIDE.md` | Hướng dẫn tester (sẽ bổ sung Manual vs Ghi) |
| `.ai/03-database-rules.md` | Version test case |
| `backend/src/models/AutomationStep.js` | Format bước khi chạy |

---

## 11. Chi tiết kỹ thuật (cho dev — có thể bỏ qua lúc đọc lần đầu)

<details>
<summary>Mở rộng: sub-schema & enum (click để xem)</summary>

### RecordingSession (fields chính)

```javascript
status: ['starting','recording','paused','processing','ready_for_review','merged','discarded','failed']
events: [RecordedEvent]
semanticActions: [{ semanticId, label, sourceEventIds }]  // SR-1+
draftSteps: [RecordedStepDraft]
intentBlocks: [{ blockId, label, draftStepIds }]         // SR-3+
```

### RecordedEvent.rawType

`click`, `input`, `change`, `submit`, `navigation`, `file_upload`, `select_change`, `keypress`, … — bỏ `mousemove`, scroll vô ích.

### RecordedStepDraft

`inferredAction`, `targetType`, `target`, `value`, `locatorCandidates[]`, `chosenLocatorIndex`, `reviewStatus`, `screenshotKey`, `autoWaitSuggestion`.

### LocatorCandidate

`strategy`, `value`, `score` (theo bảng SR-2), `uniqueOnPage`.

### TestCase.automation (thêm optional)

`authoringSource`, `lastRecordingSessionId`, `lastRecordedAt`, `lastRecordedBy`.

### AutomationStep.recordMeta (optional, engine bỏ qua)

`source`, `recordingSessionId`, `locatorCandidates`, `screenshotKey`.

</details>

---

## 12. Changelog

| Ngày | Ghi chú |
|------|---------|
| 2026-06-29 | Khởi tạo SR-0→SR-6; schema; P7–P10 stability tạm hoãn |
| 2026-06-29 | Viết lại dễ hiểu + ví dụ; thêm semantic layer, điểm locator, ngưỡng tách DB, replay preview, intent block; **không** thêm self-healing lúc chạy |
| 2026-07-02 | Đánh dấu tiến độ mục 7: backend recording + extension pilot 6.1–6.8 xong; SR-2 là bước tiếp theo |
