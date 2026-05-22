# Test Case Management System (TCM)

A concise guide to run the TCM app locally (backend + frontend) and the bundled MongoDB from Docker Compose.

**Quick summary**
- Backend: runs on port `5000` (http://localhost:5000)
- Frontend: runs on port `3000` (http://localhost:3000)
- MongoDB (via Docker Compose): container listens on `27017`, exposed to host as `27018` (`27018:27017`)

## Prerequisites
- Node.js 18+ and npm
- Docker & Docker Compose (optional but recommended for MongoDB)

## Starter (recommended)
1. From project root, start MongoDB with Docker Compose:

   docker compose up -d

2. Start backend:

   cd backend
   npm install
   copy or create a `.env` file (see example below)
   npm start

3. Start frontend:

   cd frontend
   npm install
   npm run dev

Open the frontend at http://localhost:3000

## Important MongoDB connection notes
- The compose service maps host port `27018` to container port `27017` (`27018:27017`).
- Inside the Docker network the MongoDB server listens on `27017` and is reachable by the service name `mongodb`.
- The admin/root user is created in the `admin` database by the image init scripts. When connecting with credentials, you must specify the authentication database (authSource).

Examples for `MONGO_URI` in backend/.env:
- From host (app running on host, connecting to Docker-exposed port):
  mongodb://admin:admin123@localhost:27018/Test_Case_Management?authSource=admin
- From inside Docker (when the app runs as another service in same compose):
  mongodb://admin:admin123@mongodb:27017/Test_Case_Management?authSource=admin

If you omit `?authSource=admin`, the driver will try to authenticate against the `Test_Case_Management` database and authentication will fail.

## Example backend `.env` (backend/.env)

MONGO_URI=mongodb://admin:admin123@localhost:27018/Test_Case_Management?authSource=admin
PORT=5000
JWT_SECRET=super-secret-change-me
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3000

# Optional admin seeding (used by seedAdmin.js on first run)
ADMIN_NAME=Admin Root
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=12345678

## Start backend
cd backend
npm install
npm start

The backend will log a successful MongoDB connection and start the Express server (port 5000 by default).

## Start frontend
cd frontend
npm install
npm run dev

## Docker compose healthcheck detail
The `healthcheck` for the MongoDB service runs inside the container, so it must target `localhost:27017` (container port). The host mapping `27018` is irrelevant to the healthcheck because that mapping exists on the host side only.

## Useful Docker commands
- Start services: `docker compose up -d`
- Stop: `docker compose down`
- Remove volumes/data: `docker compose down -v`
- View logs: `docker compose logs -f mongodb`

## API (high level)
The backend exposes REST endpoints under `/api`. Key endpoints include:
- Auth: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- Projects: `GET /api/projects`, `POST /api/projects`, `PUT /api/projects/:id`, `DELETE /api/projects/:id`
- Test cases: `GET /api/test-cases`, `POST /api/test-cases`, `GET /api/test-cases/:id`
- Test plans & runs: `GET /api/test-plans`, `POST /api/test-plans`, `POST /api/test-runs`

## Hướng Dẫn Auto Test

Phần auto test của hệ thống lưu các bước kiểm thử ngay trong từng test case và chạy bằng Playwright (thư viện tự động hóa trình duyệt). Mục tiêu là để người dùng dựng step trong giao diện thật dễ đọc, sau đó chạy chúng như thao tác trình duyệt thực tế.

### 1. Auto test nằm ở đâu
- Mở một test case trong màn hình Test Cases.
- Bật automation (chế độ tự động) cho test case đó.
- Nhập base URL (URL gốc) nếu ứng dụng đang test dùng đường dẫn tương đối.
- Thêm một hoặc nhiều automation step (bước tự động).
- Lưu test case.
- Tạo hoặc chạy test run từ một test plan đang ở automation mode.

### 2. Cấu trúc của một step
Mỗi step có các trường sau:
- Action: hành động mà trình duyệt cần thực hiện.
- Target type: cách Playwright (thư viện tự động hóa trình duyệt) tìm phần tử hoặc mục tiêu trên trang.
- Target: selector chính, text của label, hoặc text dùng để định vị.
- Value: dữ liệu bổ sung mà một số action sẽ dùng.
- Expected: text, title, hoặc một đoạn URL dùng cho các bước assert (bước kiểm tra).
- Timeout ms: số mili giây chờ tối đa trước khi báo lỗi.

### 3. Các action đang hỗ trợ
- `goto`: mở một trang hoặc một đường dẫn.
- `click`: bấm vào một phần tử.
- `type`: nhập text vào ô input.
- `select`: chọn một option trong thẻ select.
- `waitFor`: chờ phần tử hiện ra, hoặc chờ hết thời gian nếu không có target.
- `assertText`: kiểm tra text hiển thị có xuất hiện trên trang.
- `assertVisible`: kiểm tra phần tử đang hiển thị.
- `assertUrl`: kiểm tra URL có chứa một đoạn mong đợi.
- `assertTitle`: kiểm tra title của trang có chứa một đoạn mong đợi.
- `assertHidden`: kiểm tra phần tử đã ẩn.
- `assertEnabled`: kiểm tra phần tử đang bật/tương tác được.
- `assertChecked`: kiểm tra checkbox hoặc switch đang được chọn.
- `hover`: rê chuột lên phần tử.
- `press`: gửi một tổ hợp phím.
- `upload`: tải lên một hoặc nhiều file vào file input.
- `dragTo`: kéo một phần tử sang một phần tử khác.

### 4. Các target type đang hỗ trợ
- `css`: selector CSS thông thường. Ví dụ: `#email`, `.btn-primary`, `input[name="email"]`.
- `id`: dạng rút gọn cho id của phần tử. Ví dụ target: `email`.
- `placeholder`: tìm theo placeholder text.
- `text`: tìm theo text hiển thị.
- `label`: tìm control theo label của nó.
- `testid`: tìm theo `data-testid`.
- `url`: dùng cho các step liên quan đến URL.

### 5. Cách điền từng trường
- Với `goto`, nhập path hoặc URL vào Value hoặc Target. Ví dụ: Value = `/login`.
- Với `click`, `type`, `select`, `hover`, `assertVisible`, `assertHidden`, `assertEnabled`, `assertChecked`, nhập selector của phần tử vào Target.
- Với `type`, nhập nội dung cần gõ vào Value.
- Với `select`, nhập value của option vào Value.
- Với `press`, nhập key combination (tổ hợp phím) vào Value, hoặc vào Target nếu bạn muốn.
- Với `upload`, nhập đường dẫn file vào Value. Có thể nhập nhiều file, ngăn cách bằng dấu phẩy hoặc xuống dòng.
- Với `dragTo`, nhập source locator (định vị phần tử kéo đi) vào Target và destination locator (định vị phần tử thả tới) vào Value.
- Với `assertText`, `assertUrl`, và `assertTitle`, nhập phần nội dung mong đợi vào Expected. Nếu muốn nhập nhanh, có thể dùng Value.

### 6. Mẫu sử dụng khuyến nghị

#### Luồng đăng nhập
1. `goto` với Value là `/login`
2. `type` ô username với Value là `admin@example.com`
3. `type` ô password với Value là `your-password`
4. `click` nút submit
5. `assertUrl` với Expected là `/dashboard`

#### Luồng kiểm tra validate form
1. `goto` trang form
2. `click` nút submit khi chưa nhập gì
3. `assertText` với Expected là nội dung lỗi validate
4. `assertVisible` cho phần tử hiển thị lỗi

#### Luồng upload file
1. `goto` trang upload
2. `upload` vào selector của file input
3. Điền Value bằng đường dẫn file trên máy, ví dụ `C:\\files\\sample.pdf`
4. Dùng `assertText` hoặc `assertVisible` để kiểm tra kết quả upload

#### Luồng drag and drop
1. Dùng `dragTo` khi trang cần kéo thẻ, mục, hoặc widget từ phần tử này sang phần tử khác.
2. Target là phần tử nguồn.
3. Value là selector của phần tử đích.

### 7. Ví dụ selector thường dùng
- Input có id: chọn Target type là `id`, Target là `email`.
- Input có label: chọn Target type là `label`, Target là `Infrastructure Identifier`.
- Input dùng CSS selector: chọn Target type là `css`, Target là `#email`.
- Input có placeholder: chọn Target type là `placeholder`, Target là `Enter username`.
- Button theo text: chọn Target type là `text`, Target là `Login`.

### 8. Cách dùng tốt nhất
- Ưu tiên `id`, `label`, hoặc `testid` khi có thể. Đây là các locator ổn định hơn so với CSS chain dài.
- Dùng `css` khi không có id hoặc label ổn định.
- Mỗi step nên chỉ làm một hành động rõ ràng.
- Sau các action làm đổi trạng thái trang, nên thêm một bước assert (bước kiểm tra) để lỗi dễ đọc hơn.
- Chỉ tăng timeout khi trang chậm hoặc đang upload file.
- Dùng `baseUrl` cho các đường dẫn tương đối để test case dễ mang sang môi trường khác.

### 9. Xử lý lỗi thường gặp
- Nếu step báo không tìm thấy selector, hãy kiểm tra lại target type trước.
- Nếu upload file lỗi, hãy নিশ্চিত bảo target là file input thật hoặc label có liên kết với file input.
- Nếu drag and drop không chạy, hãy kiểm tra source và destination có đang hiển thị và kéo-thả được hay không.
- Nếu điều hướng bị lỗi chứng chỉ (certificate error), runner hiện đã bỏ qua lỗi HTTPS certificate trong Playwright context.
- Nếu assert quá chặt, hãy dùng một đoạn fragment (đoạn con) thay vì so khớp toàn bộ text hoặc title.

### 10. Quy trình viết step khuyến nghị
1. Xây luồng với số step ít nhất nhưng vẫn mô tả đúng nghiệp vụ.
2. Thêm một bước assert sau mỗi điểm thay đổi trạng thái quan trọng.
3. Ưu tiên locator ổn định trước.
4. Lưu test case.
5. Chạy test từ test plan rồi tinh chỉnh selector hoặc timeout nếu có step bị flaky (lúc đúng lúc sai).

## Troubleshooting
- "Authentication failed" when connecting to MongoDB: ensure `authSource=admin` is present and Docker compose is running.
- Backend can't reach Mongo: confirm `docker compose up` and `docker compose ps` show the mongodb service healthy.
- Seeded admin not created: verify `ADMIN_*` vars in backend/.env and check server logs on startup.

If you'd like, I can also update `backend/.env.example` and add a short `CONTRIBUTING.md` with quick run steps.
- `POST /api/users` - Create new user (admin only)

## User Roles

### Admin
- Full access to all features
- Can manage projects, test cases, users, and all test plans
- Views portfolio-wide dashboards and analytics

### Employee
- Can view and execute assigned test plans
- Can view project-specific dashboards when scoped
- Cannot create or delete projects/test cases
- Limited to personal test run history

## Token Management

Authentication uses JWT tokens stored in `localStorage`:
- **Token Key**: `tcm_token`
- **Token Storage**: Browser's `localStorage`
- **Token Verification**: Tokens are verified on app load and API requests
- **Auto-logout**: Token expiration triggers automatic redirect to login

## Development Notes

### Code Standards
- Frontend: TypeScript with strict null checks
- Backend: JavaScript with JSDoc comments
- Styling: CSS with BEM naming convention
- Components: Functional React components with hooks

### Common Tasks

**Clear User Session:**
```javascript
localStorage.removeItem('tcm_token');
// Then refresh the page or navigate to login
```

**Import Test Cases Template:**
- Use the "Download Template" button in Test Cases tab
- Fill in the XLSX file with test case data
- Use "Import Test Cases" to bulk upload

## Troubleshooting

### "Connection Refused" on API calls
- Ensure backend is running on `http://localhost:5000`
- Check `NEXT_PUBLIC_API_BASE` environment variable in frontend

### "User is not available" error
- Token may be expired; log out and log in again
- Check backend logs for authentication issues

### MongoDB Connection Error
- Verify MongoDB is running
- Check `MONGO_URI` in backend `.env` file
- Ensure correct connection string format

### Frontend not loading
- Clear browser cache (Ctrl+Shift+Delete)
- Delete `.next` folder and `npm run dev` again
- Check console for TypeScript errors

## Support

For issues or questions, contact your development team or refer to project documentation.

---

**Version**: 1.0.0  
**Last Updated**: May 2026
