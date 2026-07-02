# TCM Smart Recording Extension (pilot)

Chrome extension pilot for Smart Recording **SR-1.0**.

## What it does now (6.1–6.8)

- Captures click, input, change, select, file upload, submit, keypress, navigation.
- Builds payloads compatible with backend `recordedEventInputSchema`.
- Popup: nhập **API TCM**, **Project ID**, **Base URL**, test case entity ID (tùy chọn).
- **Bắt đầu ghi** → `POST /api/recording/sessions`
- Gửi event theo batch (debounce ~800ms, tối đa 100 event/lần) → `POST .../events`
- **Tạm dừng / Tiếp tục** → `POST .../pause` / `POST .../resume` (không bắt event khi tạm dừng)
- **Dừng ghi** → flush event còn lại → `POST .../stop`
- Auth: cookie `tcm_access_token` + `tcm_csrf` từ origin API; lỗi auth hiển thị rõ trên popup.
- Giữ log JSON local (20 event gần nhất) để debug.

## Prerequisites

1. Backend TCM chạy (mặc định `http://localhost:5000`)
2. Đăng nhập **admin** trên web TCM (`http://localhost:3000`) — cookie auth được set khi login qua API
3. Biết **Project ID** (Mongo ObjectId từ admin Projects)

## Install (Load unpacked)

1. Chrome → `chrome://extensions`
2. **Developer mode** ON
3. **Load unpacked** → chọn folder `recording-extension/`
4. Pin extension trên toolbar
5. Sau mỗi lần pull code mới → bấm **Reload** trên extension

## Smoke test (E2E thủ công)

| Bước | Việc làm | Kỳ vọng |
|------|----------|---------|
| 1 | Login admin trên TCM web (`http://localhost:3000`) | Vào được workspace admin |
| 2 | Mở extension → điền API `http://localhost:5000`, Project ID, Base URL | Form lưu được |
| 3 | **Bắt đầu ghi** | Status: `Đang ghi session ...` |
| 4 | Mở tab trang test → click / gõ vài thao tác | Event xuất hiện trong log local; `eventCount` trên server tăng |
| 5 | **Tạm dừng** → thao tác thêm trên trang | Không thêm event mới |
| 6 | **Tiếp tục** → thao tác thêm | Event mới được ghi lại |
| 7 | **Dừng ghi** | Status `ready_for_review`, eventCount khớp |
| 8 | (Tùy chọn) `GET /api/recording/sessions/:id` với cookie admin | `draftSteps` có bước từ pipeline |

### Pause / resume

- **Tạm dừng**: flush event đang chờ → gọi API pause → tắt capture trên tab (content script không gửi event).
- **Tiếp tục**: gọi API resume → bật capture lại.
- Phiên vẫn mở cho đến khi **Dừng ghi**.

## Auth troubleshooting

| Lỗi trên popup | Nguyên nhân | Cách xử lý |
|----------------|-------------|------------|
| Chưa đăng nhập TCM | Không có cookie `tcm_access_token` trên API origin | Login admin trên TCM web |
| Thiếu CSRF cookie | Chưa login hoặc cookie hết hạn | Đăng xuất → đăng nhập lại admin |
| CSRF không hợp lệ | Token lệch sau khi đổi session | Đăng xuất → đăng nhập lại |
| Phiên đăng nhập hết hạn | JWT hết hạn (401) | Login lại |
| Không đủ quyền (403) | Tài khoản không phải admin | Dùng tài khoản admin |

**Lưu ý:** Extension đọc cookie từ **API base URL** (vd. `http://localhost:5000`), không phải frontend `3000`. Login qua TCM web vẫn set cookie lên API khi frontend gọi `/api/auth/login`.

## Not yet

- Screenshot/DOM upload kèm event từ extension
- UI review trên TCM web (SR-4)

## Folder layout

```text
recording-extension/
  lib/           # payload, API client, batching, shared config
  background/    # session, flush queue, API calls
  content/       # DOM capture
  popup/         # config form + controls
```
