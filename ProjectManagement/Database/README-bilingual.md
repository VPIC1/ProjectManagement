# Hai bản nội dung Việt–Trung

`projects` chỉ lưu `project_name_vi`, `project_name_zh`, `description_vi`, `description_zh`.
`tasks` chỉ lưu `task_name_vi`, `task_name_zh`, `description_vi`, `description_zh`.

Đối với DB cũ: sao lưu, chạy 010, rà soát và điền bản dịch, sau đó chạy 011 và dùng phiên bản backend tương ứng. 011 dừng nếu tên hoặc mô tả còn chỉ tồn tại ở cột cũ; mọi thay đổi chạy trong giao dịch. Ứng dụng không tự nâng cấp DB khi khởi động.

`ProjectName`, `TaskName`, `Description` trong model là accessor `[NotMapped]`, không có cột thứ ba. API vẫn trả tên/mô tả mặc định lấy từ VI rồi ZH để giữ tương thích với các client cũ. Tìm kiếm kiểm tra cả hai ngôn ngữ; sắp tên dùng VI, dự phòng ZH. Dữ liệu ghi từ API cũ được lưu vào bản VI; API song ngữ ghi riêng từng bản và hỗ trợ xóa nội dung rõ ràng.

Các script seed/reset lịch sử 002, 004, 005 dùng cấu trúc cũ: không chạy chúng sau 011. Không dùng seed/reset khi khởi động ứng dụng.
