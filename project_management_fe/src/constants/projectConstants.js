export const DEFAULT_PROJECT_QUERY = Object.freeze({
  pageNumber: 1,
  pageSize: 15,
  sortBy: "createdDate",
  sortDirection: "desc",
});

export const PROJECT_STATUS_OPTIONS = [
  { value: "PENDING", label: "Đang thực hiện", color: "processing" },
  { value: "COMPLETE", label: "Đã hoàn thành", color: "success" },
  { value: "HOLD", label: "Đang chờ", color: "warning" },
  { value: "CANCEL", label: "Đã hủy", color: "error" },
];
