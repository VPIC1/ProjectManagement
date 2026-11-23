# Nội dung Việt–Trung và Excel hai dòng

## Nâng cấp

Local đã thêm 8 cột nullable bằng Database/010_bilingual_content.sql. Script có thể chạy lại và không thay đổi tên/mô tả đã có. Khi tự deploy lên server, chạy script này trên đúng DB trước khi chạy backend mới. Backend cũ vẫn tương thích các cột mới vì không xóa/đổi cột cũ.

## API và dữ liệu

- Dự án: projectNameVi, projectNameZh, descriptionVi, descriptionZh.
- Task: taskNameVi, taskNameZh, descriptionVi, descriptionZh.
- Mỗi tên ngôn ngữ tối đa 255 ký tự. Ít nhất một tên hoặc tên legacy hợp lệ.
- Trường projectName/taskName/description cũ giữ vai trò tương thích. Khi gửi các bản dịch, trường tương thích lấy VI rồi ZH nếu VI trống.
- Dữ liệu cũ giữ nguyên. Không chạy regex để tự cắt tên/mô tả ghép Việt–Trung. Khi mở chỉnh sửa, nội dung cũ được giữ trong ô Việt để người dùng tách lại theo ý muốn.
- Khi xem: bản dịch theo ngôn ngữ giao diện, nếu trống dùng ngôn ngữ còn lại, sau đó dùng nội dung cũ.
- Form hiện đồng thời ô tên và mô tả Tiếng Việt/中文, đặt cạnh nhau trên màn hình rộng và xếp dọc trên màn hình nhỏ. Chỉnh sửa trong cùng một form, không cần chuyển ngôn ngữ nội dung. Người, trạng thái, ngày và tiến độ dùng chung.
- Tìm kiếm chung tìm cả hai bản dịch. Import và xuất luôn giữ hai bản nội dung.

## Mẫu V2

Một sheet DuAn, phiên bản ở ô L1 (cột ẩn). Không thay đổi nhãn hoặc vị trí cột.

- Dòng 3 và 4: tên dự án VI/ZH, C:K.
- Dòng 7 và 8: mô tả dự án VI/ZH, C:K.
- Dòng 5: manager tại C:E, requester tại G:K.
- Dòng 6: khoảng ngày dự kiến tại C:E, thực tế tại G:K.
- Dòng 9: tên phòng ban tại C:K, phải khớp danh mục.
- Dòng 11: tiêu đề công việc.
- Từ dòng 12: mỗi công việc dùng một cặp dòng VI/中文. A=STT, B=ngôn ngữ, C=tên, D=mô tả, E=người thực hiện, F=trạng thái, G=tiến độ, H/I=ngày dự kiến, J/K=ngày thực tế.
- A và E:K gộp dọc qua hai dòng. Chỉ C và D nhập riêng cho mỗi ngôn ngữ. Khi thêm task trong Excel, sao chép cả cặp dòng để giữ ô gộp và nhãn VI/中文.
- Dòng VI có thể để trống tên nếu dòng 中文 đã có tên và ngược lại. Không tạo hai task cho hai bản dịch.
- Không bật AutoFilter cho vùng task gộp dọc để tránh sắp xếp tách cặp dòng.
- Import vẫn đọc được mẫu V1 trước đây. File V2 tối đa 12000 dòng, tối đa 5000 công việc, vẫn giới hạn 5 MB. Công thức, macro và file mã hóa không được nhận.
- Mô tả vượt giới hạn một ô Excel được giữ trong phần tiếp theo cuối sheet, có thể import lại đầy đủ.

## Kiểm tra

Backend: Tests/BilingualVerification.cs kiểm tra CRUD, tên chỉ có tiếng Trung, tìm theo bản dịch, xóa mô tả, cặp dòng Excel, nội dung dài, lỗi nhãn và công thức. Frontend: tests/localizedContent.test.js kiểm tra fallback và giữ đủ hai ngôn ngữ trong form/payload.
