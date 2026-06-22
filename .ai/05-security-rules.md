# 05 — Quy tắc Security (Bảo Mật)

Đọc khi sửa auth, cookie, CSRF, URL policy automation.

---

## 1. Authentication

Hệ thống dùng:

* Cookie Authentication
* CSRF Protection

Frontend:

```
credentials: "include"
```

Không disable UI bằng:

```
token === ""
```

---

## 2. SSRF Protection — automationUrlPolicy.js

Dùng cho:

* assertAllowedBaseUrl

SSRF protection.

Helper nằm trong `backend/src/utils/automationUrlPolicy.js` — dùng trước khi chạy automation URL. Chi tiết helper backend: `01-backend-rules.md` mục 6.3.
