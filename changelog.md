# Changelog

## 2026-06-01

### Capability 0 - Thiết lập cơ chế theo dõi roadmap
- Tạo file `roadmap.md` làm bản gốc bất biến của roadmap nghiệp vụ.
- Tạo file `current-state.md` để theo dõi trạng thái làm việc hiện tại.
- Tạo file `changelog.md` để ghi lại lịch sử thay đổi theo ngày.
- Thiết lập quy tắc tracking để AI có thể đọc lại tiến độ qua nhiều phiên làm việc.
- Kết quả kiểm thử: chưa áp dụng, đây là bước thiết lập tài liệu tracking.

### Capability 0 - Sửa semantic snapshot trong service
- Sửa `backend/src/services/testManagementService.js` để `updateTestCase` resolve cả `entityId` và `_id`.
- Sửa `TestPlan.updateMany` khi cập nhật test case để giữ `testCase` là logical reference và `testCaseVersionId` là snapshot reference.
- Sửa `deleteProject` để đếm related records theo cả logical project id và toàn bộ snapshot _id.
- Kết quả kiểm thử: `get_errors` trên `backend/src/services/testManagementService.js` không báo lỗi.

### Capability 0 - Audit tiếp theo
- Audit thêm 5 model chính và các luồng create/update/delete/restore/list liên quan.
- Phát hiện còn 2 điểm semantic cần tiếp tục xử lý: duplicate-check/restore của Project chưa đồng nhất hoàn toàn với `isLatest`, và còn một số query active/latest cần rà thêm để tránh lệch legacy data.
- Tạo checklist `Capability 0 DONE conditions` trong `current-state.md` để theo dõi trạng thái pass/fail rõ ràng.

### Capability 0 - Hoàn tất snapshot semantics
- Sửa `createProject`, `updateProject`, `restoreProject` để duplicate-check chỉ xét active latest.
- Sửa `restoreVersion` để duplicate-check chỉ xét active latest.
- Thêm restore guards cho `TestCaseGroup`, `TestCase`, `TestPlan` trước khi restore snapshot chain.
- Dọn `deletedAt` khai báo tay trong `Project.js` và `Version.js` để tránh redundancy với `applyVersioning`.
- Kết quả kiểm thử: `get_errors` trên `backend/src/services/testManagementService.js`, `backend/src/models/Project.js`, `backend/src/models/Version.js` đều không báo lỗi.

### Capability 0 - Sửa đổi tên Version
- Sửa `updateVersion` để resolve version theo cả `entityId` và `_id`.
- Sửa duplicate-check của `updateVersion` để dùng active latest project refs và snapshot semantics nhất quán.
- Kết quả kiểm thử: `get_errors` trên `backend/src/services/testManagementService.js` không báo lỗi.
