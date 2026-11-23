import dayjs from "dayjs";
import { localizedFormValues, localizedPayload } from "./localizedContent.js";
import { joinUserCodes, splitUserCodes } from "./projectUserValues.js";
import { translate as t, translateServerMessage } from "../locales/translate.js";

const asDate = (value) => (value && dayjs(value).isValid() ? dayjs(value) : null);
const textOrNull = (value) => value?.trim() || null;
export const REQUEST_CONFIG = Object.freeze({ timeout: 15000 });
export const formatDateTime = (value) => asDate(value)?.format("DD/MM/YYYY HH:mm:ss") || "—";
export const formatDate = (value) => asDate(value)?.format("DD/MM/YYYY") || "—";

export function getRequestError(
  error,
  fallback = "Không thể thực hiện thao tác. Vui lòng thử lại.",
) {
  if (error.code === "ECONNABORTED")
    return t("Hết thời gian chờ. Hãy tải lại dữ liệu để kiểm tra trước khi thử lại.");
  const problem = error.response?.data;
  if (problem?.errors)
    return [
      ...new Set(
        Object.values(problem.errors)
          .flat()
          .map((message) => translateServerMessage(message, problem.code ?? "VALIDATION_ERROR")),
      ),
    ].join(" ");
  return problem?.detail || problem?.title
    ? translateServerMessage(problem.detail || problem.title, problem.code)
    : t(fallback);
}

export function toProjectValues(project = {}) {
  return {
    ...localizedFormValues(project, "projectName"),
    projectName: project.projectName ?? "",
    description: project.description ?? "",
    manager: splitUserCodes(project.manager),
    requester: project.requester ?? "",
    requesterDepartment:
      project.requesterDepartmentId == null
        ? undefined
        : {
            value: project.requesterDepartmentId,
            label: project.requesterDepartmentName,
          },
    status: project.status ?? "PENDING",
    dateRange:
      project.startDate || project.endDate
        ? [asDate(project.startDate), asDate(project.endDate)]
        : null,
    actualDateRange:
      project.actualStartDate || project.actualEndDate
        ? [asDate(project.actualStartDate), asDate(project.actualEndDate)]
        : null,
  };
}
export function toTaskValues(task = {}) {
  return {
    ...localizedFormValues(task, "taskName"),
    taskName: task.taskName ?? "",
    progress: task.progress ?? 0,
    description: task.description ?? "",
    pic: splitUserCodes(task.pic),
    status: task.status ?? "PENDING",
    dateRange:
      task.startDate || task.endDate ? [asDate(task.startDate), asDate(task.endDate)] : null,
    actualDateRange:
      task.actualStartDate || task.actualEndDate
        ? [asDate(task.actualStartDate), asDate(task.actualEndDate)]
        : null,
  };
}
// Gửi null tường minh để xóa ngày trong DB. Không đổi ngày nghiệp vụ thành UTC bằng toISOString().
const workPayload = (values) => ({
  description: textOrNull(values.description),
  status: values.status,
  startDate: values.startDate?.format("YYYY-MM-DD") ?? null,
  endDate: values.endDate?.format("YYYY-MM-DD") ?? null,
  actualStartDate: values.actualDateRange?.[0]?.format("YYYY-MM-DD") ?? null,
  actualEndDate: values.actualDateRange?.[1]?.format("YYYY-MM-DD") ?? null,
});
export const projectPayload = (values) => ({
  ...workPayload({ ...values, startDate: values.dateRange?.[0], endDate: values.dateRange?.[1] }),
  projectName: values.projectName?.trim() ?? "",
  ...localizedPayload(values, "projectName"),
  manager: joinUserCodes(values.manager),
  requester: textOrNull(values.requester),
  requesterDepartmentId: values.requesterDepartment?.value ?? null,
});
export const taskPayload = (values, projectCode) => ({
  ...workPayload({ ...values, startDate: values.dateRange?.[0], endDate: values.dateRange?.[1] }),
  projectCode,
  taskName: values.taskName?.trim() ?? "",
  ...localizedPayload(values, "taskName"),
  progress: values.progress,
  pic: joinUserCodes(values.pic),
});
export function fillForm(form, values) {
  form.setFields(
    Object.entries(values).map(([name, value]) => ({
      name,
      value,
      touched: false,
      errors: [],
      warnings: [],
    })),
  );
}
export function validateEndDate(start, end) {
  return start && end && end.isBefore(start, "day")
    ? Promise.reject(new Error(t("Ngày kết thúc không được trước ngày bắt đầu.")))
    : Promise.resolve();
}
