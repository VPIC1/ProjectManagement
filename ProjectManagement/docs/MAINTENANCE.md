# Bàn giao và bảo trì IT Project

## Phạm vi

Giữ API nghiệp vụ và schema hiện tại. Không tự chạy các script seed/reset khi khởi động. SOP PowerPoint đi kèm hướng dẫn thao tác người dùng và triển khai thủ công.

## Trình tự sửa một chức năng

1. Đọc Contracts và endpoint.js để xác định payload/filter.
2. Sửa quy tắc ở backend trước. Progress dùng Models/ProjectProgress, ngày báo cáo dùng BusinessDate.
3. Sửa form/payload hoặc component ở đúng trang. Comment lý do khi có quy tắc đặc biệt.
4. Chạy bộ test backend bằng SQLite trong bộ nhớ và `npm run check` frontend.
5. Build frontend vào wwwroot, publish backend thành một thư mục mới.
6. Ghi lại thay đổi, kết quả kiểm tra và hướng dẫn nâng cấp DB nếu có.

## Database

Các bảng nghiệp vụ: projects, tasks, project_users, departments và project_code_counters. projects liên hệ tasks qua project_code. manager/pic dùng danh sách mã CSV và không có cột supporter.

Database/001 và 006–009 là các script cấp mã/nâng cấp theo tính năng. Phải đọc từng script và đối chiếu schema đang có trước khi chạy. Chưa có một script baseline đầy đủ để tạo toàn bộ DB mới từ đầu.

Database/002, 004 tạo hoặc thay dữ liệu mẫu. Database/005 làm trống dữ liệu để release. Các script này không thuộc quy trình triển khai thường lệ. Không chạy vào DB đang sử dụng chỉ vì thấy số thứ tự liền nhau.

## Triển khai thủ công lên IIS

1. Ghi phiên bản, đường dẫn ứng dụng và thông tin App Pool đang dùng.
2. Sao lưu DB nếu nâng cấp schema. Giữ bản publish đang hoạt động để quay lại.
3. Chạy kiểm tra/build frontend rồi publish backend sang thư mục mới.
4. Xác nhận server có .NET 8 Hosting Bundle. IIS Application alias it-project dùng App Pool riêng No Managed Code.
5. Dừng riêng ứng dụng/App Pool IT Project. Copy toàn bộ bản publish vào thư mục triển khai, giữ cấu hình kết nối của server và quyền ghi Logs.
6. Chỉ chạy script nâng cấp schema đã xác định cho phiên bản này, nếu có. Bản chuẩn hóa này không yêu cầu đổi DB.
7. Khởi động ứng dụng. Mở /it-project-demo/dashboard, /it-project-demo/project và /it-project-demo/health/db.
8. Kiểm tra tạo/sửa một bản ghi kiểm thử theo quy trình nội bộ, xem lại log, sau đó xử lý bản ghi kiểm thử có chủ đích.

## Quay lại bản trước

Nếu ứng dụng mới lỗi, dừng riêng App Pool rồi phục hồi thư mục publish cũ và cấu hình server. Nếu đã đổi schema không tương thích, phối hợp phục hồi DB từ backup hoặc dùng script rollback đã chuẩn bị. Không tự giả định đổi lại DLL sẽ đảo ngược DB.

## Chẩn đoán

| Hiện tượng | Kiểm tra |
|---|---|
| Trang trắng hoặc assets 404 | Base path /it-project-demo/, file wwwroot/assets, bản publish và cache trình duyệt |
| IIS 500.31 | Runtime/Hosting Bundle phù hợp net8.0 và kiến trúc tiến trình |
| PUT/DELETE trả 405 | web.config của đúng application, WebDAV và Request Filtering |
| API 400 | errors trong ProblemDetails, ngày/người thực hiện/phòng ban |
| API 503 | Cấu hình kết nối và /health/db, mạng SQL Server |
| Cổng 7223 bận | Xác định tiến trình trước khi dừng, không chạy hai backend cùng cổng |
| Hủy request | Bình thường khi đổi bộ lọc. Client ngắt có thể ghi 499, không thể trả body tới client đã rời đi |

Dùng traceId, thời điểm và URL để tra Logs/app-yyyyMMdd.log. Không đưa mật khẩu, connection string hoặc toàn bộ dữ liệu riêng vào ảnh chụp lỗi.
