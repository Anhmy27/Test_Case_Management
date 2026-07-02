# TCM Smart Recording Extension (pilot)

Chrome extension pilot for Smart Recording **SR-1.0**.

## What it does now (6.1–6.6)

- Captures click, input, change, select, file upload, submit, keypress, navigation.
- Builds payloads compatible with backend `recordedEventInputSchema`.
- Popup: nhập **API TCM**, **Project ID**, **Base URL**, test case entity ID (tùy chọn).
- **Bắt đầu ghi** → `POST /api/recording/sessions`
- Gửi event theo batch (debounce ~800ms, tối đa 100 event/lần) → `POST .../events`
- **Dừng ghi** → flush event còn lại → `POST .../stop`
- Giữ log JSON local (20 event gần nhất) để debug.

## Prerequisites

1. Backend TCM chạy (mặc định `http://localhost:5000`)
2. Đăng nhập **admin** trên web TCM (`http://localhost:3000`) — cookie auth nằm trên origin API
3. Biết **Project ID** (Mongo ObjectId từ admin Projects)

## Install (Load unpacked)

1. Chrome → `chrome://extensions`
2. **Developer mode** ON
3. **Load unpacked** → chọn folder `recording-extension/`
4. Pin extension trên toolbar

## Quick manual test

1. Login admin trên TCM web.
2. Mở extension → điền API / Project ID / Base URL.
3. **Bắt đầu ghi** → mở tab trang cần test → click/gõ vài thao tác.
4. **Dừng ghi** → kiểm tra status `ready_for_review` trong popup.
5. (Tùy chọn) `GET /api/recording/sessions/:id` bằng cookie admin để xem draft.

## Not yet (6.7+)

- Pause/resume qua extension
- Screenshot/DOM upload kèm event
- UI review trên TCM web (SR-4)

## Folder layout

```text
recording-extension/
  lib/           # payload, API client, batching, shared config
  background/    # session, flush queue, API calls
  content/       # DOM capture
  popup/         # config form + controls
```
