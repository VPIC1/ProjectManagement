// Chỉ dịch thông báo chuẩn của hệ thống; không dùng hàm này cho tên/mô tả người dùng nhập.
export function localizeServerMessage(message, code, t, language) {
  const text = String(message ?? "");
  const bilingual = text.match(/^([\s\S]+?)\s+\/\s+([\s\S]*[\u3400-\u9fff][\s\S]*)$/);
  if (bilingual) return language === "zh" ? bilingual[2].trim() : bilingual[1].trim();
  const known = {
    "StartDateTo must be on or after StartDateFrom.":
      "Ngày kết thúc không được trước ngày bắt đầu.",
    "EndDateTo must be on or after EndDateFrom.": "Ngày kết thúc không được trước ngày bắt đầu.",
    "CreatedDateTo must be on or after CreatedDateFrom.":
      "Ngày kết thúc không được trước ngày bắt đầu.",
    "UpdatedDateTo must be on or after UpdatedDateFrom.":
      "Ngày kết thúc không được trước ngày bắt đầu.",
    "EndDate must be on or after StartDate.": "Ngày kết thúc không được trước ngày bắt đầu.",
    "Project was not found.": "Không tìm thấy dữ liệu.",
    "Task was not found.": "Không tìm thấy dữ liệu.",
    "The referenced project changed or was deleted. Refresh and retry.":
      "Dữ liệu đã thay đổi. Vui lòng tải lại và thử lại.",
    "The data changed during this request. Refresh and retry.":
      "Dữ liệu đã thay đổi. Vui lòng tải lại và thử lại.",
    "ProjectCode does not reference an existing project.": "Không tìm thấy dữ liệu.",
    "Generated project code conflicts with existing data. Retry the request.":
      "Mã dự án bị trùng. Vui lòng thử lại.",
    "Status must be PENDING, COMPLETE, HOLD or CANCEL.": "Vui lòng chọn trạng thái hợp lệ.",
    "Employee codes must contain 1 to 50 characters.": "Mã nhân viên phải có từ 1 đến 50 ký tự.",
    "Requested page offset is too large.": "Số trang yêu cầu quá lớn.",
    "The operation was cancelled before it completed.": "Thao tác đã bị hủy.",
    "A record with the same unique value already exists.": "Dữ liệu đã tồn tại.",
    "The operation conflicts with related data or a database constraint.":
      "Thao tác không phù hợp với dữ liệu liên quan.",
    "The database connection has not been configured.":
      "Không kết nối được cơ sở dữ liệu. Vui lòng thử lại sau.",
    "The database is temporarily unavailable. Try again later.":
      "Không kết nối được cơ sở dữ liệu. Vui lòng thử lại sau.",
    "The database is temporarily unavailable.":
      "Không kết nối được cơ sở dữ liệu. Vui lòng thử lại sau.",
    "The database operation timed out. Try again later.":
      "Hết thời gian chờ. Hãy tải lại dữ liệu để kiểm tra trước khi thử lại.",
    "The operation timed out. Try again later.":
      "Hết thời gian chờ. Hãy tải lại dữ liệu để kiểm tra trước khi thử lại.",
    "An unexpected error occurred. Contact support with the traceId.":
      "Có lỗi hệ thống. Vui lòng liên hệ bộ phận hỗ trợ.",
    "The request could not be processed.": "Dữ liệu không hợp lệ.",
    "The request could not be completed.": "Không thể thực hiện thao tác. Vui lòng thử lại.",
    "One or more validation errors occurred.": "Dữ liệu không hợp lệ.",
  };
  if (known[text]) return t(known[text]);
  const fields = {
    projectname: "Tên dự án",
    projectnamevi: "Tên dự án",
    projectnamezh: "Tên dự án",
    taskname: "Tên công việc",
    tasknamevi: "Tên công việc",
    tasknamezh: "Tên công việc",
    projectcode: "Mã dự án",
    manager: "Người phụ trách",
    managercodes: "Người phụ trách",
    requesterdepartmentid: "Phòng ban yêu cầu",
    requester: "Người yêu cầu",
    pic: "Người thực hiện",
    description: "Mô tả",
    status: "Trạng thái",
    progress: "Tiến độ",
    file: "Tệp Excel",
    actualstartdate: "Bắt đầu thực tế",
    actualenddate: "Kết thúc thực tế",
    startdate: "Ngày bắt đầu",
    startdatefrom: "Ngày bắt đầu",
    startdateto: "Ngày kết thúc",
    enddate: "Ngày kết thúc",
    enddatefrom: "Ngày bắt đầu",
    enddateto: "Ngày kết thúc",
    pagenumber: "Số trang",
    pagesize: "Số dòng mỗi trang",
    tasks: "Danh sách công việc",
    project: "Thông tin dự án",
  };
  const fieldName = (field) => t(fields[field.split(".").at(-1).toLowerCase()] ?? "Dữ liệu");
  let match = text.match(/^The (.+?) field is required\.$/);
  if (match) return t("Vui lòng nhập {field}.", { field: fieldName(match[1]) });
  match = text.match(/^The field (.+?) must be a string with a maximum length of '?([0-9]+)'?\.$/);
  if (match)
    return t("{field} tối đa {max} ký tự.", {
      field: fieldName(match[1]),
      max: match[2],
    });
  match = text.match(/^The field (.+?) must be between (.+?) and (.+?)\.$/);
  if (match)
    return t("{field} phải từ {min} đến {max}.", {
      field: fieldName(match[1]),
      min: match[2],
      max: match[3],
    });
  match = text.match(/^The field (.+?) is invalid\.$/);
  if (match) return t("{field} không hợp lệ.", { field: fieldName(match[1]) });
  match = text.match(/^The value .* is not valid for (.+?)\.$/);
  if (match) return t("{field} không hợp lệ.", { field: fieldName(match[1]) });
  if (text.startsWith("SortBy must be one of:")) return t("Cột sắp xếp không hợp lệ.");
  const fallback = {
    VALIDATION_ERROR: "Dữ liệu không hợp lệ.",
    BAD_REQUEST: "Dữ liệu không hợp lệ.",
    UNAUTHORIZED: "Vui lòng đăng nhập để tiếp tục.",
    FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
    NOT_FOUND: "Không tìm thấy dữ liệu.",
    METHOD_NOT_ALLOWED: "Thao tác này không được hỗ trợ.",
    DATA_CONFLICT: "Dữ liệu đã thay đổi. Vui lòng tải lại và thử lại.",
    DUPLICATE_DATA: "Dữ liệu đã tồn tại.",
    REFERENCE_CONFLICT: "Thao tác không phù hợp với dữ liệu liên quan.",
    DATABASE_UNAVAILABLE: "Không kết nối được cơ sở dữ liệu. Vui lòng thử lại sau.",
    DATABASE_NOT_CONFIGURED: "Không kết nối được cơ sở dữ liệu. Vui lòng thử lại sau.",
    REQUEST_TIMEOUT: "Hết thời gian chờ. Hãy tải lại dữ liệu để kiểm tra trước khi thử lại.",
    DATABASE_TIMEOUT: "Hết thời gian chờ. Hãy tải lại dữ liệu để kiểm tra trước khi thử lại.",
    REQUEST_CANCELLED: "Thao tác đã bị hủy.",
    CLIENT_CLOSED_REQUEST: "Thao tác đã bị hủy.",
    PAYLOAD_TOO_LARGE: "Dữ liệu gửi lên quá lớn.",
    UNSUPPORTED_MEDIA_TYPE: "Định dạng dữ liệu không được hỗ trợ.",
    TOO_MANY_REQUESTS: "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
    INTERNAL_ERROR: "Có lỗi hệ thống. Vui lòng liên hệ bộ phận hỗ trợ.",
  };
  return t(fallback[code] ?? "Không thể thực hiện thao tác. Vui lòng thử lại.");
}
