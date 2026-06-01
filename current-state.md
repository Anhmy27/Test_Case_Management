# Current State

## Đang làm
- Capability 0: DONE

## Đang xử lý chi tiết
- Capability 0 đã hoàn tất.
- Không còn task con đang dở trong phạm vi snapshot/versioning.

## Đã hoàn thành
- Thiết lập cơ chế tracking roadmap với 3 file chuẩn.
- Tạo `roadmap.md` làm tài liệu gốc bất biến.
- Tạo `current-state.md` để phản ánh trạng thái hiện tại.
- Tạo `changelog.md` để ghi lịch sử thay đổi.
- Áp dụng patch semantic đầu tiên cho Capability 0 trong `testManagementService.js`.
- Hoàn tất batch fix cuối cho Capability 0: project/version duplicate-check, restore guard, và snapshot consistency.

## Quyết định đã chốt
- `entityId` là định danh logic xuyên suốt vòng đời của một thực thể.
- `_id` là định danh của từng snapshot/version cụ thể.
- `projectVersionId`, `groupVersionId`, `versionVersionId` là snapshot reference, không phải logical identity.
- Mọi query active/latest phải tôn trọng `isLatest` và `deletedAt`.
- Nghiệp vụ phải ưu tiên đặt ở Service, không hardcode ở UI.
- Không đưa AI/rule suy diễn sớm trước khi có dữ liệu health và relationship chuẩn.
- Restore/update/delete đã được chuẩn hóa theo snapshot semantics ở phạm vi Capability 0.

## Quy tắc bất biến (ABSOLUTE RULES)
- `roadmap.md` là source of truth, không sửa logic roadmap trong file này.
- `current-state.md` là nơi duy nhất phản ánh trạng thái hiện tại.
- `changelog.md` là lịch sử thay đổi, không dùng để suy luận trạng thái hiện tại.
- Không phá semantics snapshot/versioning đã chốt.
- Không hardcode logic theo một dự án hoặc một website cụ thể.
- Không đếm dữ liệu lịch sử đã xóa như dữ liệu active.
- Không để UI tự tính lại logic nghiệp vụ cốt lõi nếu Service đã xử lý.

## Vấn đề mở
- Không còn vấn đề mở trong phạm vi Capability 0.

## Capability 0 DONE conditions
- [x] `entityId` được dùng như logical identity xuyên suốt vòng đời.
- [x] `_id` được dùng như snapshot/version identity.
- [x] `projectVersionId`, `groupVersionId`, `versionVersionId`, `testCaseVersionId` được dùng như snapshot reference.
- [x] `Project`, `Version`, `TestCaseGroup`, `TestCase`, `TestPlan` đều có versioning fields qua `applyVersioning`.
- [x] `isLatest` và `deletedAt` tồn tại ở các model versioned và được dùng trong query active/latest chính.
- [x] Restore logic tồn tại cho Project, Version, TestCaseGroup, TestCase, TestPlan.
- [x] Luồng create/update chính của Group, TestCase, TestPlan đang lưu logical reference + snapshot reference đúng hướng.
- [x] Luồng update TestCase đã được sửa để không phá logical reference trong TestPlan.
- [x] Luồng delete Project đã được sửa để không bỏ sót record dùng logical id hoặc snapshot id.
- [x] Mọi duplicate-check / active-check đều đã đồng nhất với snapshot semantics, đặc biệt ở Project create/update/restore.
- [x] Không còn query nào chỉ dựa vào `_id` hoặc chỉ dựa vào `entityId` khi legacy data có thể dùng cả hai.
- [x] Không còn redundancy/ambiguity cần dọn ở các model versioned.
- [x] Audit cuối cùng không còn lỗi semantic nào trong 5 model và các luồng CRUD/restore/list liên quan.
