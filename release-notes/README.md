# Ghi chú phiên bản IT Project

Mỗi phiên bản có một tệp theo số phiên bản, ví dụ [v0.0.5.md](v0.0.5.md). Khi phát hành, thêm một dòng lên đầu bảng trong [CHANGELOG.md](../CHANGELOG.md) với số phiên bản, ngày phát hành, tóm tắt và liên kết đến tệp chi tiết.

## Đồng bộ với mã phát hành

1. Khi làm thay đổi ảnh hưởng đến người dùng, cập nhật ghi chú của bản sắp phát hành cùng nhánh với thay đổi. Nếu nhiều thay đổi được gom vào một bản, ghép các ghi chú vào cùng một tệp trước khi phát hành.
2. Trước khi tạo tag, so sánh bản chuẩn bị phát hành với tag liền trước. Đối chiếu từng mục ghi chú với chức năng có trong bản đã kiểm thử. Ghi rõ các bước nâng cấp và các vấn đề đã biết nếu có.
3. Chốt số phiên bản, ngày phát hành và dòng tổng hợp trong `CHANGELOG.md`. Lưu ghi chú cùng mã trong bản đã kiểm thử, sau đó tạo tag tại commit đó. Trong ghi chú, liên kết đến mã nguồn theo tag của phiên bản.
4. Đăng nội dung từ tệp chi tiết lên [GitHub Releases](https://github.com/VPIC1/ProjectManagement/releases) cho đúng tag và lấy bản triển khai từ cùng tag. Khi đính chính nội dung, cập nhật cả tệp chi tiết và ghi chú trên GitHub. Khi sửa chức năng, gom thay đổi vào phiên bản tiếp theo.

`v0.0.5` là mốc ban đầu. Ghi chú của bản này được bổ sung sau khi tạo tag và có liên kết đến mã nguồn tại thời điểm phát hành.

## Nội dung ghi chú

Mở đầu tệp chi tiết bằng số phiên bản, ngày phát hành và một câu tóm tắt. Mô tả những thay đổi so với bản liền trước và chỉ đưa vào những nhóm có nội dung.

- **Tính năng mới** ghi việc người dùng có thể làm thêm và nơi bắt đầu.
- **Cải tiến** ghi thao tác thay đổi ra sao và người dùng được lợi gì.
- **Sửa lỗi** ghi vấn đề người dùng từng gặp và kết quả sau khi sửa.
- **Trước khi nâng cấp** ghi thay đổi có thể ảnh hưởng đến dữ liệu, cấu hình hoặc quy trình, cùng việc cần làm.
- **Vấn đề đã biết** ghi hạn chế người dùng còn có thể gặp và cách xử lý tạm thời nếu có.
