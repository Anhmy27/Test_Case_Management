# 07 — Quy tắc Deploy & Môi Trường

Đọc khi sửa Docker, `.env`, CORS, chạy local vs container.

**Giai đoạn automation stability (roadmap):** không làm Docker app / environment profile — trừ khi user yêu cầu riêng.

---

## 1. Cấu Trúc Deploy

| Thành phần | Vị trí |
|------------|--------|
| Backend API | `backend/` — port **5000** |
| Frontend Next.js | `frontendnext/` — port **3000** |
| MongoDB | Docker profile `local-mongo` — host **27018** → container 27017 |
| Compose | `docker-compose.yml` ở root |

---

## 2. Docker Compose — Hai Cách Dùng

### Chỉ MongoDB (dev thường gặp)

```bash
docker compose --profile local-mongo up -d mongodb
```

Backend + frontend chạy **npm** trên máy host; `MONGO_URI` trỏ `localhost:27018`.

### Cả app trong container

```bash
docker compose up -d --build
```

* Backend: `tcm-backend`, env từ `TCM_ENV_FILE` (mặc định `./backend/.env`)
* Frontend build arg: `NEXT_PUBLIC_API_BASE=http://localhost:5000`
* Volume `tcm_uploads` — giữ artifact automation giữa restart container

---

## 3. Biến Môi Trường Quan Trọng

| Biến | Ý nghĩa |
|------|---------|
| `MONGO_URI` | Kết nối MongoDB |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Session JWT (mặc định 8h) |
| `CORS_ORIGIN` | Origin frontend được phép (vd. `http://localhost:3000`) |
| `NEXT_PUBLIC_API_BASE` | URL API mà frontend gọi — **build-time** cho Docker image |
| `AUTOMATION_ALLOWED_HOSTS` | Whitelist host automation (production) |
| `ARTIFACT_STORAGE` | `local` hoặc `s3` — screenshot fail cần `local` hiện tại |
| `TRUST_PROXY` | `1` khi sau reverse proxy — ảnh hưởng rate limit IP |

**Không commit** `backend/.env` — đã trong `.gitignore`.

---

## 4. Quy Tắc Khi Sửa Deploy

1. Đổi port / URL → cập nhật **cả** `CORS_ORIGIN`, `NEXT_PUBLIC_API_BASE`, và `docker-compose.yml` nếu cần.
2. Secret chỉ qua `.env` hoặc env CI — không hard-code trong Dockerfile.
3. Frontend Docker: nhớ `NEXT_PUBLIC_*` là lúc **build**, không đổi runtime container.
4. Upload/automation artifact: volume `tcm_uploads` hoặc path `uploads/` — đừng ghi vào image layer.

---

## 5. CI (GitHub Actions)

File: `.github/workflows/ci.yml`

* Backend: `npm run test:ci` (không cần Mongo thật cho phần lớn test)
* Frontend: build + lint
* E2E smoke: Playwright — xem `08-e2e-rules.md`

Không đổi CI trừ khi user yêu cầu — `00-core-rules.md` mục 7.
