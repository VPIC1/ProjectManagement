import api from "./api";

export const WORK_STATUSES = Object.freeze(["PENDING", "COMPLETE", "HOLD", "CANCEL"]);

const COMMON_SORT_FIELDS = [
  "id",
  "projectCode",
  "status",
  "startDate",
  "endDate",
  "actualStartDate",
  "actualEndDate",
  "createdDate",
  "updatedDate",
];
export const PROJECT_SORT_FIELDS = Object.freeze([
  ...COMMON_SORT_FIELDS,
  "projectName",
  "manager",
  "requester",
]);
export const TASK_SORT_FIELDS = Object.freeze([...COMMON_SORT_FIELDS, "taskName", "pic"]);

/**
 * Các hàm trả về response.data từ api.js (không cần đọc .data lần nữa).
 * config là Axios request config tùy chọn: { signal, headers, timeout, ... }.
 * Ngày: "yyyy-MM-dd". Thời gian tạo/cập nhật: ISO 8601 theo giờ database.
 * Các khoảng ngày/thời gian bao gồm cả hai đầu mút.
 * ProjectPayload và TaskPayload có actualStartDate, actualEndDate: yyyy-MM-dd hoặc null, độc lập với ngày dự kiến.
 *
 * @typedef {"PENDING"|"COMPLETE"|"HOLD"|"CANCEL"} WorkStatus
 *
 * @typedef {Object} ListFilters
 * @property {number} [pageNumber=1] Trang, bắt đầu từ 1.
 * @property {number} [pageSize=20] Số bản ghi/trang, từ 1 đến 100.
 * @property {string} [sortBy="createdDate"] Xem PROJECT_SORT_FIELDS/TASK_SORT_FIELDS.
 * @property {"asc"|"desc"} [sortDirection="desc"] Chiều sắp xếp.
 * @property {number} [id] Lọc chính xác ID.
 * @property {string} [projectCode] Lọc chính xác mã project, ví dụ IT2611001.
 * @property {string} [search] Tìm chứa chuỗi trong mã, tên, mô tả và người phụ trách.
 * @property {string} [description] Mô tả chứa chuỗi.
 * @property {WorkStatus|WorkStatus[]} [status] Một hoặc nhiều trạng thái.
 * @property {string} [startDateFrom] Ngày bắt đầu từ yyyy-MM-dd.
 * @property {string} [startDateTo] Ngày bắt đầu đến yyyy-MM-dd.
 * @property {string} [endDateFrom] Ngày kết thúc từ yyyy-MM-dd.
 * @property {string} [endDateTo] Ngày kết thúc đến yyyy-MM-dd.
 * @property {string} [actualStartDateFrom] Ngày bắt đầu thực tế từ yyyy-MM-dd.
 * @property {string} [actualStartDateTo] Ngày bắt đầu thực tế đến yyyy-MM-dd.
 * @property {string} [actualEndDateFrom] Ngày kết thúc thực tế từ yyyy-MM-dd.
 * @property {string} [actualEndDateTo] Ngày kết thúc thực tế đến yyyy-MM-dd.
 * @property {string} [createdDateFrom] Thời gian tạo từ, ví dụ 2026-11-01T00:00:00.
 * @property {string} [createdDateTo] Thời gian tạo đến, ví dụ 2026-11-30T23:59:59.
 * @property {string} [updatedDateFrom] Thời gian cập nhật từ (ISO 8601).
 * @property {string} [updatedDateTo] Thời gian cập nhật đến (ISO 8601).
 *
 * @typedef {ListFilters & {
 *   projectName?: string, manager?: string, requester?: string,
 *   managerCodes?: string[]
 * }} ProjectFilters managerCodes lọc mã chính xác, chọn nhiều mã theo OR trong mỗi nhóm; các nhóm kết hợp AND.
 *
 * @typedef {ListFilters & { taskName?: string, pic?: string }} TaskFilters
 * taskName và pic tìm chứa chuỗi.
 *
 * @typedef {Object} ProjectPayload
 * @property {string} [projectName] Tên tương thích, hoặc nhập ít nhất một bản dịch.
 * @property {string|null} [projectNameVi] Tên Việt, tối đa 255 ký tự.
 * @property {string|null} [projectNameZh] Tên Trung, tối đa 255 ký tự.
 * @property {string|null} [descriptionVi] Mô tả tiếng Việt.
 * @property {string|null} [descriptionZh] Mô tả tiếng Trung.
 * @property {string|null} [description=null]
 * @property {string|null} [manager=null] Nhiều mã nhân viên từ GET /api/project-users, cách nhau bằng dấu phẩy, không gửi nhãn code - name.
 * @property {string|null} [requester=null] Tối đa 255 ký tự.
 * @property {WorkStatus} [status="PENDING"]
 * @property {string|null} [startDate=null] yyyy-MM-dd.
 * @property {string|null} [endDate=null] yyyy-MM-dd, không trước startDate.
 *
 * @typedef {Object} TaskPayload
 * @property {string} projectCode Mã project đang tồn tại, tối đa 50 ký tự.
 * @property {string} [taskName] Tên tương thích, hoặc nhập ít nhất một bản dịch.
 * @property {string|null} [taskNameVi] Tên Việt, tối đa 255 ký tự.
 * @property {string|null} [taskNameZh] Tên Trung, tối đa 255 ký tự.
 * @property {string|null} [descriptionVi] Mô tả tiếng Việt.
 * @property {string|null} [descriptionZh] Mô tả tiếng Trung.
 * @property {string|null} [description=null]
 * @property {string|null} [pic=null] Nhiều mã người thực hiện từ GET /api/project-users, cách nhau bằng dấu phẩy.
 * @property {number} [progress=0] Tiến độ công việc (%), số nguyên từ 0 đến 100.
 * @property {WorkStatus} [status="PENDING"]
 * @property {string|null} [startDate=null] yyyy-MM-dd.
 * @property {string|null} [endDate=null] yyyy-MM-dd, không trước startDate.
 *
 * @typedef {Object} PagedResult
 * @property {Object[]} items
 * @property {number} pageNumber
 * @property {number} pageSize
 * @property {number} totalCount Tổng số bản ghi sau lọc.
 * @property {number} totalPages
 * @property {boolean} hasPreviousPage
 * @property {boolean} hasNextPage
 */

const COMMON_FILTER_FIELDS = [
  "id",
  "projectCode",
  "status",
  "search",
  "description",
  "pageNumber",
  "pageSize",
  "sortBy",
  "sortDirection",
  "startDateFrom",
  "startDateTo",
  "endDateFrom",
  "endDateTo",
  "actualStartDateFrom",
  "actualStartDateTo",
  "actualEndDateFrom",
  "actualEndDateTo",
  "createdDateFrom",
  "createdDateTo",
  "updatedDateFrom",
  "updatedDateTo",
];

const listConfig = (filters, extraFields, config) => {
  const values = {
    pageNumber: 1,
    pageSize: 20,
    sortBy: "createdDate",
    sortDirection: "desc",
    ...filters,
  };
  const params = {};
  for (const field of [...COMMON_FILTER_FIELDS, ...extraFields]) {
    const value = values[field];
    if (value === undefined || value === null || value === "") continue;
    if (field === "status") {
      const statuses = Array.isArray(value) ? value : [value];
      params.status = statuses.filter(
        (status) => status !== undefined && status !== null && status !== "",
      );
    } else {
      params[field] = value;
    }
  }
  return {
    ...config,
    params,
    // ASP.NET Core nhận status=PENDING&status=HOLD, không dùng status[]=...
    paramsSerializer: { indexes: null },
  };
};

// Chỉ gửi các trường được backend cho phép, loại id/projectCode/timestamps của project.
const projectBody = ({
  projectName,
  projectNameVi,
  projectNameZh,
  descriptionVi,
  descriptionZh,
  description = null,
  manager = null,
  requester = null,
  requesterDepartmentId,
  status = "PENDING",
  startDate = null,
  endDate = null,
  actualStartDate = null,
  actualEndDate = null,
}) => ({
  projectName,
  projectNameVi,
  projectNameZh,
  descriptionVi,
  descriptionZh,
  description,
  manager,
  requester,
  requesterDepartmentId,
  status,
  startDate,
  endDate,
  actualStartDate,
  actualEndDate,
});

const taskBody = ({
  projectCode,
  taskName,
  taskNameVi,
  taskNameZh,
  descriptionVi,
  descriptionZh,
  description = null,
  pic = null,
  progress = 0,
  status = "PENDING",
  startDate = null,
  endDate = null,
  actualStartDate = null,
  actualEndDate = null,
}) => ({
  projectCode,
  taskName,
  taskNameVi,
  taskNameZh,
  descriptionVi,
  descriptionZh,
  description,
  pic,
  progress: status === "COMPLETE" ? 100 : progress,
  status,
  startDate,
  endDate,
  actualStartDate,
  actualEndDate,
});

/**
 * GET /api/projects
 * @param {ProjectFilters} [filters={}]
 * @param {Object} [config={}]
 * @returns {Promise<PagedResult>}
 * @example
 * getProjects({ search: "ERP", manager: "An", status: ["PENDING", "HOLD"],
 *   pageNumber: 1, pageSize: 10, sortBy: "startDate", sortDirection: "asc" });
 */
export const getProjects = (filters = {}, config = {}) =>
  api.get(
    "/projects",
    listConfig(
      filters,
      ["projectName", "manager", "requester", "managerCodes", "activityYear", "activityMonth"],
      config,
    ),
  );

/** GET /api/projects/{id}. id là số nguyên dương. */
export const getProjectById = (id, config = {}) =>
  api.get(`/projects/${encodeURIComponent(id)}`, config);

/**
 * POST /api/projects. Backend tự tạo projectCode dạng ITyyMM001.
 * @param {ProjectPayload} data Không cần truyền projectCode/id/timestamps.
 * @param {Object} [config={}]
 * @returns {Promise<Object>} Project vừa tạo, gồm id và projectCode.
 */
export const createProject = (data, config = {}) =>
  api.post("/projects", projectBody(data), config);

/**
 * PUT /api/projects/{id}. Thay thế toàn bộ trường nghiệp vụ, giữ nguyên mã project.
 * @param {number} id
 * @param {ProjectPayload} data Trường nullable không truyền trở thành null.
 * @param {Object} [config={}]
 * @returns {Promise<Object>} Project sau cập nhật.
 */
export const updateProject = (id, data, config = {}) =>
  api.put(`/projects/${encodeURIComponent(id)}`, projectBody(data), config);

/** DELETE /api/projects/{id}. Xóa dự án và toàn bộ task của dự án; trả 204 khi thành công. */
export const deleteProject = (id, config = {}) =>
  api.delete(`/projects/${encodeURIComponent(id)}`, config);

/**
 * GET /api/tasks
 * @param {TaskFilters} [filters={}]
 * @param {Object} [config={}]
 * @returns {Promise<PagedResult>}
 * @example
 * getTasks({ projectCode: "IT2611001", pic: "An", status: ["PENDING", "HOLD"],
 *   startDateFrom: "2026-11-01", endDateTo: "2026-12-31",
 *   pageNumber: 1, pageSize: 10, sortBy: "endDate", sortDirection: "asc" });
 */
export const getTasks = (filters = {}, config = {}) =>
  api.get("/tasks", listConfig(filters, ["taskName", "pic"], config));

/** GET /api/tasks/{id}. id là số nguyên dương. */
export const getTaskById = (id, config = {}) => api.get(`/tasks/${encodeURIComponent(id)}`, config);

/**
 * POST /api/tasks
 * @param {TaskPayload} data projectCode phải thuộc project đang tồn tại.
 * @param {Object} [config={}]
 * @returns {Promise<Object>} Task vừa tạo.
 */
export const createTask = (data, config = {}) => api.post("/tasks", taskBody(data), config);

/**
 * PUT /api/tasks/{id}. Thay thế toàn bộ trường nghiệp vụ; có thể đổi projectCode.
 * @param {number} id
 * @param {TaskPayload} data Trường nullable không truyền trở thành null.
 * @param {Object} [config={}]
 * @returns {Promise<Object>} Task sau cập nhật.
 */
export const updateTask = (id, data, config = {}) =>
  api.put(`/tasks/${encodeURIComponent(id)}`, taskBody(data), config);

/** DELETE /api/tasks/{id}. Trả 204 khi thành công. */
export const deleteTask = (id, config = {}) =>
  api.delete(`/tasks/${encodeURIComponent(id)}`, config);

// Hai endpoint hệ thống nằm ngoài /api. Giữ đúng thư mục gốc nếu host có subpath.
const systemConfig = (config) => ({
  ...config,
  baseURL: api.baseURL.replace(/\/api\/?$/i, "").replace(/\/$/, ""),
});

/** GET /health/db. Trả chuỗi Healthy; lỗi 503 được api.js chuyển thành rejected Promise. */
export const getDatabaseHealth = (config = {}) => api.get("/health/db", systemConfig(config));

/** GET /openapi/v1.json. Chỉ có trong môi trường backend Development. */
export const getOpenApiDocument = (config = {}) =>
  api.get("/openapi/v1.json", systemConfig(config));

/**
 * GET /api/projects/statistics. Card và biểu đồ dùng chung khoảng ngày bắt đầu, không phân trang.
 * @param {{ startDateFrom?: string, startDateTo?: string }} [filters={}] yyyy-MM-dd, bao gồm hai đầu mút.
 * @param {Object} [config={}] Axios config: signal, headers, timeout, ...
 * @returns {Promise<{
 *   totalProjects: number, pendingProjects: number, completeProjects: number,
 *   holdProjects: number, cancelProjects: number,
 *   projectsByManager: Array<{userCode: string|null, userName: string, totalProjects: number,
 *     pendingProjects: number, completeProjects: number, holdProjects: number, cancelProjects: number}>
 * }>}
 * Card: tổng = totalProjects; đang thực hiện (PENDING) = pendingProjects;
 * hoàn thành = completeProjects; hủy = cancelProjects; đang chờ (HOLD) = holdProjects.
 */
export const getProjectStatistics = (filters = {}, config = {}) =>
  api.get("/projects/statistics", {
    ...config,
    params: {
      startDateFrom: filters.startDateFrom || undefined,
      startDateTo: filters.startDateTo || undefined,
    },
  });

/** GET /api/project-users. Trả [{ id, code, name }]; mã giữ dạng chuỗi để giữ số 0 đầu. */
export const getProjectUsers = (config = {}) => api.get("/project-users", config);

/** GET /api/departments. Trả [{ id, name }]. */
export const getDepartments = (config = {}) => api.get("/departments", config);

/** GET /api/projects/{id}/export. Returns an XLSX Blob; language: vi or zh. */
export const exportProjectExcel = (id, language = "vi", config = {}) =>
  api.get(`/projects/${encodeURIComponent(id)}/export`, {
    ...config,
    params: { language },
    responseType: "blob",
  });

/** Mẫu Excel cùng bố cục với file xuất dự án. */
export const downloadProjectTemplate = (config = {}) =>
  api.get("/projects/template", { ...config, responseType: "blob" });
const excelFileBody = (file) => {
  const body = new FormData();
  body.append("file", file);
  return body;
};
/** Phân tích file và trả bản xem trước; không ghi DB. */
export const previewProjectExcel = (file, config = {}) =>
  api.post("/projects/import/preview", excelFileBody(file), config);
/** Import một dự án mới và toàn bộ task trong một lần lưu. */
export const importProjectExcel = (file, config = {}) =>
  api.post("/projects/import", excelFileBody(file), config);

/** Lưu dữ liệu dự án/task đã sửa trên bản xem trước, không đọc lại file gốc. */
export const importProjectDraft = (draft, config = {}) =>
  api.post(
    "/projects/import/draft",
    {
      project: projectBody(draft.project),
      tasks: draft.tasks.map((task) => taskBody({ ...task, projectCode: "AUTO" })),
    },
    config,
  );

/** GET /api/projects/dashboard: tổng hợp theo end_date, dự án đang mở và phân trang tại server.
 * filters: { year, departmentId, view: "active"|"all"|"complete"|"hold"|"cancel"|"late"|"soon", projectPage, comparisonPage, attention: "late"|"soon", attentionPage }. departmentId=0 lọc dự án chưa gán phòng ban.
 * Trả { year, today, summary, overview, months, projects: PagedResult, comparison: PagedResult, attention: PagedResult, attentionSummary, departments }. departmentId chỉ lọc projects và summary. Overview, comparison, attention và months tổng hợp toàn bộ phòng ban.
 * projects.items có startDate, endDate, actualStartDate, actualEndDate, plannedProgressPercent và progressPercent.
 * months.started đếm ngày bắt đầu dự kiến, actualCompleted đếm ngày kết thúc thực tế của dự án COMPLETE.
 */
export const getProjectDashboard = (filters = {}, config = {}) =>
  api.get("/projects/dashboard", {
    ...config,
    params: { ...config.params, ...filters },
  });
