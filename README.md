# <img src="project_management_fe/public/it-project-icon-transparent.png" width="44" alt="" /> IT Project

IT Project giúp các nhóm theo dõi dự án và công việc từ kế hoạch đến hoàn thành. Tổng quan cho biết dự án nào đang trễ, dự án nào sắp đến hạn và tiến độ thực tế đang ở đâu so với kế hoạch.

[Ghi chú phát hành](https://github.com/VPIC1/ProjectManagement/releases) · [Lịch sử phiên bản](CHANGELOG.md) · [Chạy trên máy](#chạy-trên-máy)

## Chức năng chính

| Chức năng | Bạn có thể làm gì |
| --- | --- |
| **Tổng quan dự án** | Xem tình hình theo năm, trạng thái và phòng ban yêu cầu. Mở danh sách dự án từ biểu đồ hoặc đối chiếu lịch trên dòng thời gian. |
| **Dự án và công việc** | Tìm kiếm, lọc, phân công và cập nhật trạng thái, phần trăm hoàn thành và ngày thực tế. |
| **Nhập và xuất Excel** | Xem trước và chỉnh sửa bản nháp trước khi nhập. Xuất dự án và công việc với nhãn tiếng Việt và tiếng Trung. |
| **Giao diện Việt–Trung** | Chuyển ngôn ngữ giao diện và lưu riêng nội dung dự án, công việc bằng hai ngôn ngữ. |

## Chạy trên máy

Cần .NET SDK 8, Node.js tương thích với phiên bản Vite của dự án và một cơ sở dữ liệu SQL Server có schema của ứng dụng.

1. Trong thư mục [backend](ProjectManagement/README.md), sao chép `appsettings.example.json` thành `appsettings.json` và cấu hình chuỗi kết nối theo hướng dẫn. Khởi động API bằng lệnh sau.

   ```powershell
   dotnet run --project ProjectManagement.csproj --launch-profile https
   ```

2. Mở terminal khác trong thư mục [frontend](project_management_fe/README.md), cài thư viện và khởi động Vite.

   ```powershell
   npm ci
   npm run dev
   ```

3. Mở địa chỉ Vite hiển thị trong terminal, thường là `http://localhost:5173`.

## Tài liệu dự án

| Tài liệu | Nội dung |
| --- | --- |
| [Backend](ProjectManagement/README.md) | ASP.NET Core, SQL Server, quy tắc nghiệp vụ và API. |
| [Frontend](project_management_fe/README.md) | React, Vite, cấu hình môi trường và kiểm thử. |
| [Triển khai và bảo trì](ProjectManagement/docs/MAINTENANCE.md) | Build, triển khai IIS và kiểm tra sau nâng cấp. |
| [Ghi chú từng phiên bản](release-notes/) | Tính năng mới, cải tiến, lỗi đã sửa và lưu ý nâng cấp. |
