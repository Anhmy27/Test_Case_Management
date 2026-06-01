# Lộ Trình Phát Triển Nghiệp Vụ Cho Hệ Thống Quản Lý Test Case

## Tầm nhìn

Mục tiêu là phát triển hệ thống từ một công cụ quản lý dữ liệu đơn thuần (CRUD + Versioning) thành một nền tảng quản lý kiểm thử hoàn chỉnh có khả năng:

* Theo dõi sức khỏe của Test Case.
* Phân tích lịch sử thực thi.
* Đo lường Coverage.
* Phát hiện vùng rủi ro.
* Phát hiện dữ liệu bị bỏ quên.
* Đánh giá mức độ sẵn sàng phát hành.
* Đưa ra gợi ý hỗ trợ người kiểm thử và quản lý dự án.

---

# Nguyên tắc thiết kế

* Mọi nghiệp vụ phải mang tính tổng quát, không phụ thuộc vào một dự án cụ thể.
* Dữ liệu Version và Snapshot là nền tảng của toàn hệ thống.
* Các chỉ số phải được tính từ dữ liệu thực tế thay vì gán thủ công.
* Toàn bộ nghiệp vụ phải tập trung ở tầng Service.
* Giao diện chỉ hiển thị dữ liệu đã được xử lý.
* Chưa đưa AI vào quá sớm, ưu tiên các luật và chỉ số xác định được trước.

---

# Capability 0: Chuẩn hóa dữ liệu và ý nghĩa Version

## Mục tiêu

Xác định rõ ý nghĩa của từng loại ID và cách hoạt động của Snapshot để tránh nhầm lẫn trong toàn bộ hệ thống.

## Công việc cần thực hiện

### Chuẩn hóa định danh

* `entityId`: định danh logic của một thực thể xuyên suốt vòng đời.
* `_id`: định danh của từng bản ghi Snapshot hoặc Version.

### Xác định rõ ý nghĩa của từng thực thể

* Project
* Version
* Test Case Group
* Test Case
* Test Plan

### Chuẩn hóa các hàm xử lý

* resolveLatestProjectSnapshot
* ensureProjectExists
* ensureVersionExists
* ensureGroupExists
* ensureTestCaseExists

### Chuẩn hóa trạng thái dữ liệu

* Đang hoạt động
* Bản lịch sử
* Đã xóa
* Đã khôi phục

## Kết quả mong muốn

* Có tài liệu mô tả chuẩn dữ liệu.
* Không còn nhầm lẫn giữa:

  * project
  * projectVersionId
  * group
  * groupVersionId
  * version
  * versionVersionId
* Mọi màn hình và API sử dụng cùng một quy tắc.

---

# Capability 1: Hệ thống đánh giá sức khỏe Test Case

## Mục tiêu

Xây dựng hồ sơ sức khỏe cho từng Test Case dựa trên lịch sử thực thi.

## Chỉ số cần tính

### Thống kê thực thi

* Số lần chạy
* Số lần Pass
* Số lần Fail
* Số lần Blocked

### Thời gian

* Lần chạy gần nhất
* Lần Pass gần nhất
* Lần Fail gần nhất

### Chất lượng

* Tỷ lệ Fail
* Điểm Flaky
* Điểm Rủi ro
* Điểm Cũ kỹ (Stale)

### Xu hướng

* Chuỗi Pass liên tiếp
* Chuỗi Fail liên tiếp

## Kết quả mong muốn

Mỗi Test Case đều có một hồ sơ đánh giá rõ ràng:

* Ổn định
* Không ổn định (Flaky)
* Rủi ro cao
* Lâu không được kiểm thử
* Chưa từng được chạy

---

# Capability 2: Hệ thống tổng hợp kết quả thực thi

## Mục tiêu

Tự động cập nhật thống kê sau mỗi lần hoàn thành Test Run.

## Công việc cần thực hiện

* Tạo một dịch vụ tổng hợp dùng chung.
* Dùng chung cho Manual Test và Automation Test.
* Cập nhật sức khỏe Test Case sau mỗi lần chạy.
* Tránh tính trùng dữ liệu khi chạy lại.
* Hỗ trợ tính toán lại toàn bộ dữ liệu khi cần.

## Kết quả mong muốn

* Chỉ cần hoàn thành Test Run là hệ thống tự cập nhật.
* Dashboard và các màn hình chỉ đọc dữ liệu đã tổng hợp.
* Không còn logic tính toán rải rác ở nhiều nơi.

---

# Capability 3: Lớp quan hệ nghiệp vụ

## Mục tiêu

Biến các bảng dữ liệu rời rạc thành một mạng lưới quan hệ có thể truy vết.

## Các quan hệ cần hỗ trợ

* Project ↔ Version
* Project ↔ Group
* Project ↔ Test Case
* Group ↔ Test Case
* Version ↔ Test Plan
* Test Plan ↔ Test Case
* Test Run ↔ Test Plan
* Test Run ↔ Kết quả thực thi
* Test Run ↔ Bug

## Chức năng cần có

### Phát hiện dữ liệu bị bỏ quên

* Test Case không thuộc Test Plan nào.
* Group không còn Test Case.
* Test Plan không còn Coverage.

### Phát hiện sai lệch

* Test Case đã thay đổi nhưng Test Plan chưa cập nhật.
* Test Plan đang sử dụng dữ liệu cũ.

### Theo dõi Coverage

* Theo Project
* Theo Version
* Theo Group

## Kết quả mong muốn

Người dùng có thể nhìn thấy toàn bộ mối quan hệ giữa các thực thể thay vì các danh sách rời rạc.

---

# Capability 4: Hệ thống phân tích Coverage

## Mục tiêu

Biết chính xác khu vực nào đã được kiểm thử và khu vực nào còn thiếu.

## Phân tích theo

* Project
* Version
* Group
* Test Plan

## Các thông tin cần cung cấp

* Test Case chưa từng chạy.
* Test Case ít được chạy.
* Khu vực thiếu Coverage.
* Khu vực có rủi ro cao.

## Kết quả mong muốn

* Có màn hình Coverage theo từng Version.
* Có danh sách khu vực cần ưu tiên kiểm thử.
* Hỗ trợ đánh giá chất lượng phát hành.

---

# Capability 5: Rule Engine cho nhãn nghiệp vụ

## Mục tiêu

Biến các nhãn đánh giá thành luật cấu hình thay vì viết cứng trong mã nguồn.

## Các nhãn

* Risky
* Flaky
* Stale
* Inactive
* Unstable
* High Failure

## Ví dụ

* Tỷ lệ Fail vượt ngưỡng → Risky.
* Pass và Fail xen kẽ nhiều lần → Flaky.
* Không chạy trong thời gian dài → Stale.
* Chưa từng chạy → Inactive.
* Fail liên tục nhiều lần → Unstable.

## Kết quả mong muốn

* Có thể thay đổi ngưỡng đánh giá mà không sửa mã nguồn.
* Có thể bổ sung luật mới dễ dàng.

---

# Capability 6: Luồng làm việc thông minh

## Mục tiêu

Hỗ trợ người dùng đưa ra quyết định dựa trên dữ liệu thực tế.

## Chức năng

### Gợi ý phạm vi Regression Test

Khi một Test Case lỗi, hệ thống gợi ý những Test Case liên quan cần chạy lại.

### Ưu tiên thực thi theo rủi ro

Test Case rủi ro cao được ưu tiên trước.

### Phân tích ảnh hưởng

Khi Test Case thay đổi:

* Test Plan nào bị ảnh hưởng.
* Version nào cần kiểm tra lại.

### Đánh giá mức độ sẵn sàng phát hành

Tính điểm sẵn sàng phát hành dựa trên:

* Coverage
* Tỷ lệ Pass
* Rủi ro
* Mức độ ổn định

## Kết quả mong muốn

Người dùng không cần tự suy đoán nên kiểm thử gì tiếp theo.

---

# Capability 7: Giao diện hỗ trợ ra quyết định

## Mục tiêu

Đưa toàn bộ thông tin nghiệp vụ lên giao diện theo cách dễ hiểu.

## Dashboard

Hiển thị:

* Tình trạng sức khỏe hệ thống
* Rủi ro
* Coverage
* Test Case không ổn định

## Màn hình Test Case

* Nhãn đánh giá
* Bộ lọc nâng cao
* Sắp xếp theo mức độ ưu tiên

## Màn hình Test Plan

* Coverage
* Mức độ sẵn sàng
* Các thay đổi ảnh hưởng

## Màn hình Test Run

* Dòng thời gian thực thi
* Thống kê kết quả
* Xu hướng Pass/Fail

## Màn hình Group và Version

* Cảnh báo thiếu Coverage
* Cảnh báo dữ liệu bị bỏ quên

---

# Capability 8: Quản trị dữ liệu và kiểm toán

## Mục tiêu

Đảm bảo mọi chỉ số luôn chính xác và có thể giải thích được.

## Công việc

### Đồng bộ dữ liệu cũ

* Tính lại sức khỏe Test Case.
* Tính lại Coverage.
* Tính lại thống kê.

### Ghi nhận lịch sử

* Thay đổi Rule.
* Khôi phục dữ liệu.
* Xóa dữ liệu.
* Tính lại chỉ số.

### Bảo vệ dữ liệu

* Không để dữ liệu đã xóa xuất hiện trong thống kê đang hoạt động.
* Không để dữ liệu lịch sử làm sai kết quả hiện tại.

---

# Capability 9: Chiến lược kiểm thử

## Mục tiêu

Đảm bảo mọi Capability mới đều có kiểm thử tương ứng.

## Thứ tự ưu tiên

1. Kiểm thử hệ thống tổng hợp dữ liệu.
2. Kiểm thử Rule Engine.
3. Kiểm thử Coverage.
4. Kiểm thử Version và Snapshot.
5. Kiểm thử giao diện.

## Kiểm thử cuối cùng

* Chạy Manual Test.
* Chạy Automation Test.
* Kiểm tra Snapshot.
* Kiểm tra Coverage.
* Kiểm tra các chỉ số sức khỏe.

---

# Thứ tự triển khai đề xuất

1. Chuẩn hóa dữ liệu và Version
2. Hệ thống đánh giá sức khỏe Test Case
3. Hệ thống tổng hợp kết quả thực thi
4. Lớp quan hệ nghiệp vụ
5. Hệ thống phân tích Coverage
6. Rule Engine
7. Luồng làm việc thông minh
8. Giao diện hỗ trợ ra quyết định
9. Quản trị dữ liệu và kiểm toán
10. Kiểm thử tổng thể

---

# Kết quả cuối cùng

Sau khi hoàn thành lộ trình này, hệ thống sẽ không còn là một công cụ CRUD quản lý Test Case đơn thuần.

Hệ thống sẽ trở thành một nền tảng quản lý kiểm thử có khả năng:

* Theo dõi chất lượng Test Case.
* Đánh giá mức độ rủi ro.
* Phân tích Coverage.
* Phát hiện dữ liệu bị bỏ quên.
* Hỗ trợ lập kế hoạch kiểm thử.
* Đánh giá mức độ sẵn sàng phát hành.
* Hỗ trợ ra quyết định dựa trên dữ liệu thực tế.
