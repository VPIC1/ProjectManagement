# Hướng dẫn phát hành IT Project

Khi người dùng yêu cầu chuẩn bị hoặc phát hành phiên bản mới, đọc và làm theo [quy trình phát hành](release-notes/README.md). Dùng tag đã phát hành gần nhất làm mốc đối chiếu và viết ghi chú tiếng Việt theo những thay đổi người dùng thực sự thấy.

- Lưu chi tiết trong `release-notes/vX.Y.Z.md` và thêm dòng tổng hợp vào `CHANGELOG.md`.
- Tạo tag có chú thích tại đúng commit trên `main` chứa mã và ghi chú đã kiểm tra. Đăng GitHub Release từ tag đó, dùng nội dung của tệp ghi chú.
- Khi người dùng yêu cầu chuẩn bị, dừng sau khi chuẩn bị và kiểm tra. Khi được yêu cầu phát hành, xác minh tag và GitHub Release sau khi đăng. Giữ nguyên các tag đã công bố.
