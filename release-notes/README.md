# Ghi chú phiên bản IT Project

Mỗi phiên bản có một tệp theo số phiên bản, ví dụ [v0.0.5.md](v0.0.5.md). Khi phát hành, thêm một dòng lên đầu bảng trong [CHANGELOG.md](../CHANGELOG.md) với số phiên bản, ngày phát hành, tóm tắt và liên kết đến tệp chi tiết.

## 1. Chọn phạm vi và số phiên bản

Đồng bộ thông tin từ `origin`, xác nhận nhánh phát hành là `main` và tìm tag phát hành liền trước trong [GitHub Releases](https://github.com/VPIC1/ProjectManagement/releases). So sánh mã trong tag đó với bản dự kiến để xác định các thay đổi người dùng sẽ nhận được. Các lệnh dưới đây dùng `v0.0.5` làm mốc.

```powershell
git fetch origin --tags
git status --short --branch
git log --oneline v0.0.5..HEAD
git diff --stat v0.0.5 HEAD
```

- Tăng số cuối cho bản sửa lỗi, ví dụ `v0.0.5` → `v0.0.6`.
- Tăng số giữa cho bản có tính năng mới, ví dụ `v0.0.5` → `v0.1.0`.
- Khi có thay đổi không tương thích, ghi rõ ảnh hưởng và bước chuyển đổi. Từ `v1.0.0` trở đi, tăng số đầu cho loại thay đổi này. Chốt mốc `v1.0.0` khi dự án xác nhận bản ổn định đầu tiên.

## 2. Chuẩn bị ghi chú và kiểm thử

Với ví dụ `v0.0.6`, đồng bộ số `0.0.6` trong `project_management_fe/package.json` và `project_management_fe/package-lock.json`. Có thể chạy `npm version 0.0.6 --no-git-tag-version` trong thư mục frontend rồi kiểm tra diff. Tạo `release-notes/v0.0.6.md` và thêm dòng tương ứng ở đầu bảng trong `CHANGELOG.md`.

Mở đầu tệp chi tiết bằng số phiên bản, ngày phát hành và một câu tóm tắt. Mô tả những thay đổi so với bản liền trước và chỉ đưa vào những nhóm có nội dung.

- **Tính năng mới** ghi việc người dùng có thể làm thêm và nơi bắt đầu.
- **Cải tiến** ghi thao tác thay đổi ra sao và người dùng được lợi gì.
- **Sửa lỗi** ghi vấn đề người dùng từng gặp và kết quả sau khi sửa.
- **Trước khi nâng cấp** ghi thay đổi có thể ảnh hưởng đến dữ liệu, cấu hình hoặc quy trình, cùng việc cần làm.
- **Vấn đề đã biết** ghi hạn chế người dùng còn có thể gặp và cách xử lý tạm thời nếu có.

Dùng liên kết tuyệt đối đến mã theo tag trong ghi chú để liên kết hoạt động cả trên GitHub Releases. Đối chiếu ghi chú với bản thực tế và kiểm tra các liên kết. Chạy `npm run check` trong thư mục frontend và lệnh sau từ thư mục gốc.

```powershell
dotnet run --project ProjectManagement/Tests/ProjectManagement.ApiTests.csproj -c Release --no-launch-profile
```

Rà soát kết quả kiểm thử và các bước nâng cấp dữ liệu hoặc cấu hình nếu có. Đưa mã, số phiên bản và các tệp ghi chú vào cùng bản kiểm thử trước khi tạo tag.

## 3. Tạo và xác minh tag

Sau khi bản đã kiểm thử có trên `main`, xác nhận working tree sạch và HEAD là commit cần phát hành. Thay `v0.0.6` bằng số thực tế. Kiểm tra tag chưa tồn tại cả trên máy lẫn trên `origin` trước khi tạo. Nếu bản đã được tạo tag trong lần phát hành dở dang, đối chiếu commit của tag và tiếp tục từ bước còn thiếu.

```powershell
git status --short --branch
git log -1 --oneline
git tag --list v0.0.6
git ls-remote --tags origin refs/tags/v0.0.6
git push origin main
git tag -a v0.0.6 -m "IT Project v0.0.6" HEAD
git push origin refs/tags/v0.0.6
git rev-parse "v0.0.6^{commit}"
git ls-remote --tags origin "refs/tags/v0.0.6^{}"
```

Chỉ chạy tiếp khi lệnh trước thành công. SHA ở hai lệnh cuối phải trùng nhau và khớp commit đã kiểm thử. Giữ nguyên tag đã công bố.

## 4. Đăng GitHub Release

Mở [GitHub Releases](https://github.com/VPIC1/ProjectManagement/releases), chọn **Draft a new release**, chọn tag đã đẩy và đặt tiêu đề `IT Project v0.0.6`. Dán nội dung từ `release-notes/v0.0.6.md`, xem trước và chọn **Publish release**. Nếu GitHub CLI đã đăng nhập bằng tài khoản có quyền ghi, có thể chạy các lệnh dưới đây. [Tài liệu GitHub CLI](https://cli.github.com/manual/gh_release_create)

```powershell
gh release create v0.0.6 --repo VPIC1/ProjectManagement --verify-tag --title "IT Project v0.0.6" --notes-file release-notes/v0.0.6.md
gh release view v0.0.6 --repo VPIC1/ProjectManagement
```

Kiểm tra release đã đăng, đúng tag và đúng nội dung ghi chú. Khi triển khai, lấy mã từ cùng tag theo [hướng dẫn bảo trì](../ProjectManagement/docs/MAINTENANCE.md). Khi đính chính nội dung, cập nhật cả tệp ghi chú và GitHub Release. Khi sửa chức năng đã phát hành, tạo phiên bản kế tiếp.

`v0.0.5` là mốc ban đầu. Ghi chú của bản này được bổ sung sau khi tạo tag và có liên kết đến mã nguồn tại thời điểm phát hành.
