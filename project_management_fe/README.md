# IT Project · Frontend

React, Vite, Ant Design, Tailwind CSS và ApexCharts. Giao diện tiếng Việt/tiếng Trung, giữ tên sản phẩm IT Project.

## Chạy và kiểm tra

```powershell
npm ci
npm run dev
npm run check
```

`check` chạy toàn bộ `tests/*.test.js`, lint và build. Có thể dùng riêng `npm run test`, `npm run test:i18n`, `npm run test:dashboard`, `npm run lint` hoặc `npm run build`.

## Format mã nguồn

`npm run format` format code theo `.prettierrc`; `npm run format:check` kiểm tra định dạng. Dùng 2 dấu cách, dấu nháy kép, dấu chấm phẩy và xuống dòng LF. Các thư mục build, dependencies và lockfile được bỏ qua theo `.prettierignore`.

## Cấu hình môi trường

| Môi trường  | Base              | API                        |
| ----------- | ----------------- | -------------------------- |
| Development | /                 | https://localhost:7223/api |
| Production  | /it-project-demo/ | /it-project-demo/api       |

Giá trị đặt trong `.env.development` và `.env.production`. Biến `VITE_*` công khai trong bundle, không đặt mật khẩu hoặc API key ở đây. File `.env.*.local` có thể ghi đè cấu hình. Khởi động lại Vite sau khi sửa môi trường.

`npm run build` xóa toàn bộ nội dung `../ProjectManagement/wwwroot` rồi tạo lại bản build mới. Các tệp tĩnh cần giữ phải đặt trong `public/` để Vite tự sao chép lại. Khi bấm Publish trong Visual Studio hoặc chạy `dotnet publish`, backend tự chạy `npm run build`, lấy các file frontend mới và làm sạch `wwwroot` ở thư mục publish. Các file ngoài `wwwroot` ở nơi publish không bị xóa bởi bước này. Máy publish cần Node.js/npm; khi chưa có `node_modules`, quy trình tự chạy `npm ci`. Production dùng `/it-project-demo/dashboard` và `/it-project-demo/project`. Khi đổi alias, sửa VITE_BASE_PATH, VITE_API_URL và Hosting:PathBase của backend cùng nhau.

## Tổ chức mã nguồn

| Thư mục/file                    | Trách nhiệm                                             |
| ------------------------------- | ------------------------------------------------------- |
| src/pages/Project               | Component chỉ phục vụ quản lý dự án, cùng cấp index.jsx |
| src/pages/Dashboard             | Biểu đồ, timeline, drawer, danh sách liên quan          |
| src/components                  | Component dùng chung giữa nhiều trang                   |
| src/layouts                     | Header và khung trang                                   |
| src/contexts, src/hooks         | Ngôn ngữ, danh mục nhân viên và vòng đời tải dữ liệu    |
| src/utils/api.js                | Axios, response.data và cancellation GET dùng chung     |
| src/utils/endpoint.js           | Hàm API, trường payload và whitelist query              |
| src/utils/dashboardPaging.js    | Phiên tải thêm, khử trùng, hủy truy vấn cũ              |
| src/utils/projectDetailUtils.js | Form, ngày, payload và lỗi                              |
| src/utils/projectTaskData.js    | Tải toàn bộ task và trung bình tiến độ                  |
| src/locales                     | Từ điển Việt/Trung và dịch lỗi server                   |
| src/index.css                   | CSS bổ sung tập trung, có comment theo nhóm             |

## Quy ước sửa code

- Ưu tiên Tailwind, CSS cần selector AntD hoặc dùng chung đặt trong index.css. Không tạo CSS riêng cho từng component.
- Component của Project giữ cùng cấp index.jsx. Logic thuần tách utils, vòng đời tải dữ liệu tách hook khi dùng lại hoặc phức tạp.
- API helper trả thẳng data, không đọc `.data` thêm lần nữa. GET trùng không có signal riêng chuyển caller cũ sang kết quả mới nhất. Khi tự quản lý vòng đời, truyền AbortController.signal.
- Hàm endpoint giới hạn trường được gửi. Form chuyển ngày sang yyyy-MM-dd, gửi null để xóa ngày. Không dùng toISOString cho DateOnly.
- Người phụ trách/task lưu mã, hiển thị mã - tên. Mã chưa có danh mục hiển thị mã. Task chỉ chọn từ manager của dự án.
- Giao diện dùng `t("Khóa tiếng Việt")`. Thêm khóa tương ứng trong bộ từ điển, không dịch mã trạng thái, mã nhân viên hoặc dữ liệu người dùng.
- Comment giải thích quy tắc, lý do hoặc giới hạn. Không lặp lại ý nghĩa của từng dòng JSX.

## Luồng đang sử dụng

Dashboard hiện có biểu đồ trạng thái, phòng ban yêu cầu, xu hướng tháng, thông báo và timeline dự án tải thêm khi cuộn. Chọn biểu đồ mở danh sách dự án liên quan. Mở dự án xem drawer, sau đó chuyển sang modal chi tiết để cập nhật. Timeline có thanh lịch kế hoạch/thực tế, vạch hôm nay và phóng to/thu nhỏ.

Trang Dự án có tìm kiếm, filter trong cột, phân trang và tên tối đa hai dòng. Cột tiến độ hiển thị kế hoạch ở trên, thực tế ở dưới. Mã dự án mở modal chi tiết. Người phụ trách trong tooltip mỗi người một dòng.

Modal thông tin dùng Descriptions có border. Bấm Chỉnh sửa mới hiện form, giữ cảnh báo khi bỏ thay đổi. Task hiển thị dạng list, cập nhật trạng thái nhanh và thanh tiến độ. COMPLETE tự điền 100%. Ngày dự kiến và thực tế độc lập, cho phép xóa ngày thực tế.

Import dùng mẫu Excel mới, preview và chỉnh sửa bản nháp trước khi xác nhận. Preview chưa lưu DB. Xác nhận tạo mới dự án cùng task, không ghi đè dự án đang có. Xuất Excel tải một sheet nhãn Việt–Trung.

## Nội dung Việt–Trung riêng biệt

Tên và mô tả dự án/công việc đã có hai bản Việt–Trung riêng. Form hiện đồng thời ô Việt–Trung cạnh nhau; khi xem theo ngôn ngữ giao diện, thiếu bản dịch dùng bản còn lại rồi nội dung cũ. Dữ liệu cũ được giữ nguyên, không tự tách. Mẫu Excel mới dùng cặp dòng VI/中文 cho mỗi task, gộp dọc thông tin dùng chung; vẫn nhập được mẫu cũ.

Trước khi deploy backend mới lên server, chạy Database/010_bilingual_content.sql trên đúng DB. Hướng dẫn chi tiết nằm trong backend docs/BILINGUAL_CONTENT.md.
