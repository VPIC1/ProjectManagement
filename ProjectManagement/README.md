# IT Project · Backend

ASP.NET Core 8, EF Core SQL Server, ClosedXML và Serilog. Backend phục vụ cả API và bản React đã build trong `wwwroot`.

## Khởi động local

Khi clone kho mã lần đầu, sao chép `appsettings.example.json` thành `appsettings.json` trong thư mục backend.

1. Cài .NET SDK 8 và cấu hình `ConnectionStrings:DefaultConnection` bằng user secrets hoặc biến môi trường `ConnectionStrings__DefaultConnection`.
2. Dùng schema hiện có. Đọc script SQL và sao lưu trước khi nâng cấp. Ứng dụng không tự tạo hoặc sửa schema khi chạy.
3. Chạy `dotnet run --project ProjectManagement.csproj --launch-profile https` từ thư mục backend. Kiểm tra profile trong `Properties/launchSettings.json` nếu thay đổi cổng.
4. Frontend dev chạy riêng tại `http://localhost:5173`, gọi API tại `https://localhost:7223/api`.
5. Sau khi build frontend, mở `https://localhost:7223/it-project-demo/dashboard` để dùng bản trong `wwwroot`.

`GET /health/db` kiểm tra kết nối SQL Server, không xác nhận schema. Khi dùng PathBase, có thể gọi `/it-project-demo/health/db`.

## Cấu trúc

| Thư mục | Trách nhiệm |
|---|---|
| Controllers | API và điều phối truy vấn, validation, transaction |
| Contracts | DTO, bộ lọc, validation và projection response |
| Models | Entity, trạng thái, quy tắc tiến độ và ngày nghiệp vụ |
| Data | Mapping SQL Server và query dùng chung |
| Services | Cấp mã dự án, import/export Excel, danh mục nhân viên |
| Diagnostics | ProblemDetails, traceId, logger và health check |
| Routing | Giới hạn SPA fallback để API không trả nhầm HTML |
| Database | Script nâng cấp và script thao tác dữ liệu có chủ đích |
| Tests | Bộ kiểm thử API với SQLite trong bộ nhớ, không dùng DB thật |
| wwwroot | Kết quả build frontend |

## Quy tắc nghiệp vụ

- Mã dự án tự sinh `ITyyMMnnn`, ví dụ `IT2611001`. Bộ đếm riêng theo prefix/tháng có khóa trong transaction. Request tạo thất bại sau khi giữ mã có thể để lại khoảng trống.
- `manager` và `pic` lưu chuỗi mã nhân viên, cách bằng dấu phẩy, giữ số 0 đầu. `requester` là văn bản tự do. Phòng ban lưu ID từ danh mục `departments`.
- Task mới hoặc đổi người thực hiện phải thuộc manager của dự án. Phân công cũ được giữ khi chỉ sửa nội dung/trạng thái.
- Trạng thái API giữ nguyên `PENDING`, `COMPLETE`, `HOLD`, `CANCEL`. Giao diện dịch tương ứng Đang thực hiện, Đã hoàn thành, Đang chờ, Đã hủy.
- Task có progress nguyên 0–100. Chọn COMPLETE luôn ghi 100. Ngày thực tế do người dùng cập nhật, không tự suy từ trạng thái.
- Tiến độ thực tế dự án là trung bình progress của toàn bộ task, cùng trọng số, làm tròn 1 chữ số. Không có task trả 0%.
- Tiến độ kế hoạch dự án là trung bình tiến độ theo lịch dự kiến của từng task. Mỗi task tăng tuyến tính từ start_date tới end_date, giới hạn 0–100%. Thiếu/ngược ngày ở bất kỳ task nào, không có task hoặc dự án CANCEL thì kế hoạch chưa xác định, trả null.
- Ngày nghiệp vụ theo UTC+7 qua `BusinessDate`. CreatedDate/UpdatedDate dành cho theo dõi kỹ thuật, không dùng đếm xu hướng dashboard.
- Xóa dự án xóa cả task trong cùng transaction, có retry cho toàn giao dịch.

## Dashboard

`GET /api/projects/dashboard?year=2026&view=active&projectPage=1&projectPageSize=20`

- `view`: active, all, complete, hold, cancel, late, soon.
- Năm danh mục: dự án đang mở đã bắt đầu trước cuối năm chọn, gồm cả chuyển tiếp từ năm trước. Thiếu start_date dùng end_date, thiếu cả hai chỉ đưa vào năm hiện tại.
- Dự án COMPLETE/CANCEL thuộc danh mục năm theo end_date dự kiến. Đây khác với biểu đồ hoàn thành thực tế.
- Xu hướng tháng: bắt đầu theo start_date; hoàn thành theo actual_end_date và trạng thái COMPLETE, bỏ ngày hoàn thành tương lai.
- Quá hạn: PENDING/HOLD có end_date trước hôm nay. Sắp đến hạn: end_date từ hôm nay tới 7 ngày tiếp theo.
- `overview`, phòng ban, xu hướng và thông báo độc lập với tab lọc danh sách. Lọc departmentId chỉ thu hẹp danh sách dự án/summary liên quan; overview vẫn toàn danh mục năm.
- Trình duyệt tải thêm danh sách theo trang, khử trùng ID. Không dùng created_date/updated_date thay cho ngày nghiệp vụ.

## API chính

| Method | Đường dẫn | Mục đích |
|---|---|---|
| GET | /api/projects, /api/tasks | Danh sách lọc/phân trang |
| GET | /api/projects/{id}, /api/tasks/{id} | Chi tiết |
| POST | /api/projects, /api/tasks | Tạo |
| PUT | /api/projects/{id}, /api/tasks/{id} | Cập nhật |
| DELETE | /api/projects/{id}, /api/tasks/{id} | Xóa |
| GET | /api/projects/dashboard | Dashboard theo năm |
| GET | /api/projects/statistics | Thống kê theo khoảng start_date |
| GET | /api/project-users, /api/departments | Danh mục lựa chọn |
| GET | /api/projects/template | Mẫu Excel |
| GET | /api/projects/{id}/export | Xuất dự án và task |
| POST | /api/projects/import/preview | Đọc file, chưa ghi DB |
| POST | /api/projects/import/draft | Ghi bản nháp đã chỉnh sửa |
| POST | /api/projects/import | Import trực tiếp file hợp lệ |

JSON dùng camelCase, ngày `yyyy-MM-dd`, status chuỗi. GET list dùng pageNumber từ 1, pageSize 1–100, sortBy và sortDirection. Nhiều status gửi lặp `status=PENDING&status=HOLD`. Các điều kiện khác kết hợp AND. PUT thay thế các trường nullable bằng null nếu bỏ trống theo DTO. Chi tiết payload và các bộ lọc có trong `Contracts`, `ProjectManagement.http` và JSDoc của frontend `src/utils/endpoint.js`. OpenAPI ở `/openapi/v1.json` trong Development.

## Excel

Mẫu mới dùng sheet `DuAn`. Preview không tạo dữ liệu. Xác nhận import tạo dự án mới có mã tự sinh và lưu toàn bộ task cùng giao dịch SaveChanges. Import lại cùng file sẽ tạo dự án mới, vì vậy cần kiểm tra trước khi xác nhận.

Nhân sự chấp nhận `28405`, `#28405` hoặc `28405 - Tên`. Nhiều người dùng dấu phẩy. Mã chưa có danh mục được giữ nguyên và hiển thị mã. Không tự tạo hồ sơ nhân viên từ tên trong Excel.

Giới hạn file .xlsx 5 MB, 6000 dòng, không công thức ở vùng dữ liệu, không macro hoặc mật khẩu. Bản xuất có một sheet, nhãn Việt–Trung, không created_date/updated_date. Mô tả dài có phần tiếp theo để giữ nội dung. Dùng mẫu mới khi import, không đổi vị trí nhãn/cột.

## Kiểm tra và triển khai

```powershell
dotnet run --project Tests/ProjectManagement.ApiTests.csproj -c Release --no-launch-profile
dotnet build ProjectManagement.csproj -c Release --nologo
dotnet publish ProjectManagement.csproj -c Release -o .\artifacts\publish
```

Trước publish, chạy `npm run check` ở frontend để cập nhật wwwroot. IIS dùng Application alias `it-project`, App Pool riêng No Managed Code và .NET 8 Hosting Bundle. Copy thư mục publish gồm web.config và wwwroot, không chỉ copy wwwroot. Chỉ dừng ứng dụng/App Pool này trong thời gian thay file. Chi tiết bàn giao: [docs/MAINTENANCE.md](docs/MAINTENANCE.md).

Log ở `Logs/app-yyyyMMdd.log`, xoay theo ngày hoặc 10 MB, giữ tối đa 30 file. Tài khoản chạy app cần quyền ghi Logs. Lỗi API dùng ProblemDetails và traceId. Không đưa connection string, mật khẩu hoặc dữ liệu riêng vào tài liệu bàn giao.


## Nội dung Việt–Trung riêng biệt

Tên và mô tả dự án/công việc đã có hai bản Việt–Trung riêng. Form hiện đồng thời ô Việt–Trung cạnh nhau; khi xem theo ngôn ngữ giao diện, thiếu bản dịch dùng bản còn lại rồi nội dung cũ. Dữ liệu cũ được giữ nguyên, không tự tách. Mẫu Excel mới dùng cặp dòng VI/中文 cho mỗi task, gộp dọc thông tin dùng chung; vẫn nhập được mẫu cũ.

Trước khi deploy backend mới lên server, chạy Database/010_bilingual_content.sql trên đúng DB. Hướng dẫn chi tiết nằm trong backend docs/BILINGUAL_CONTENT.md.
