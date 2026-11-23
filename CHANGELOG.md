# Có gì mới trong IT Project?

Xem những thay đổi ảnh hưởng đến công việc hằng ngày và những việc cần làm khi nâng cấp. Các phiên bản được xếp từ mới đến cũ.

## v0.0.5 · 23/11/2026

Theo dõi tiến độ dự án và công việc, xem việc sắp đến hạn, nhập hoặc xuất dữ liệu bằng Excel.

### Tính năng nổi bật

- **Nắm tình hình từ tổng quan.** Xem dự án theo năm, trạng thái và phòng ban yêu cầu. Chọn một biểu đồ để mở danh sách dự án liên quan, hoặc xem dòng thời gian để đối chiếu lịch dự kiến với ngày thực tế.
- **Tìm và cập nhật dự án.** Tìm kiếm, lọc theo cột và mở chi tiết ngay từ mã dự án. Danh sách hiển thị tiến độ kế hoạch và tiến độ thực tế để bạn dễ đối chiếu.
- **Theo dõi từng công việc.** Cập nhật nhanh trạng thái và phần trăm hoàn thành. Khi đánh dấu hoàn thành, tiến độ tự chuyển thành 100%. Bạn có thể nhập và sửa ngày thực tế riêng với ngày dự kiến.
- **Xem việc cần chú ý.** Tổng quan hiển thị dự án quá hạn và dự án đến hạn trong vòng bảy ngày tới, để bạn biết việc nào cần theo dõi.
- **Làm việc với Excel.** Xem trước và chỉnh sửa bản nháp trước khi nhập. Khi xác nhận, hệ thống tạo dự án mới cùng các công việc trong tệp. Bản xuất có nhãn tiếng Việt và tiếng Trung.
- **Làm việc bằng tiếng Việt hoặc tiếng Trung.** Chuyển ngôn ngữ giao diện và nhập riêng tên, mô tả dự án và công việc cho từng ngôn ngữ.

### Trước khi nâng cấp

- Với cơ sở dữ liệu từ bản cũ, sao lưu và đối chiếu các bước nâng cấp theo schema đang dùng. Dữ liệu song ngữ cần được rà soát giữa hai bước chuyển đổi `010` và `011`. [Hướng dẫn chuyển đổi dữ liệu song ngữ](ProjectManagement/Database/README-bilingual.md)

Đây là mốc chức năng ban đầu. Các bản sau sẽ ghi rõ thay đổi so với bản liền trước.

## Cách ghi các bản cập nhật tiếp theo

Tạo mục cho bản sắp phát hành ở đầu nhật ký. Mỗi mục bắt đầu bằng số phiên bản, ngày phát hành và một câu tóm tắt. Chỉ đưa vào những nhóm có nội dung.

- **Tính năng mới** ghi việc người dùng có thể làm thêm và nơi bắt đầu.
- **Cải tiến** ghi thao tác thay đổi ra sao và người dùng được lợi gì.
- **Sửa lỗi** ghi vấn đề người dùng từng gặp và kết quả sau khi sửa.
- **Trước khi nâng cấp** ghi thay đổi có thể ảnh hưởng đến dữ liệu, cấu hình hoặc quy trình, cùng việc cần làm.
- **Vấn đề đã biết** ghi hạn chế còn gặp được và cách xử lý tạm thời, nếu có.

Chuyển mục sang phiên bản chính thức sau khi xác nhận nội dung đã có trong bản phát hành. Dùng cùng nội dung trên [GitHub Releases](https://github.com/VPIC1/ProjectManagement/releases) để người dùng mở từng phiên bản và đọc ghi chú của bản đó.
