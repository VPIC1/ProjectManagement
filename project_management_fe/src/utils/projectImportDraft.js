let draftTaskSequence = 0;
// Không phụ thuộc crypto.randomUUID vì ứng dụng có thể chạy trên HTTP nội bộ.
export const createDraftTaskId = () => `import-task-${++draftTaskSequence}`;

import { localizedText } from "./localizedContent.js";
import { splitUserCodes } from "./projectUserValues.js";
import { translate as t, translateServerMessage } from "../locales/translate.js";

export function getImportTaskErrors(task, managers) {
  const errors = (task.importErrors ?? []).map((issue) =>
    translateServerMessage(issue, "VALIDATION_ERROR"),
  );
  if (!localizedText(task, "taskName")) errors.push(t("Vui lòng nhập tên."));
  if ([task.taskName, task.taskNameVi, task.taskNameZh].some((value) => (value?.length ?? 0) > 255))
    errors.push(t("Tên tối đa 255 ký tự."));
  if (task.startDate && task.endDate && task.endDate < task.startDate)
    errors.push(t("Ngày kết thúc không được trước ngày bắt đầu."));
  if (task.actualStartDate && task.actualEndDate && task.actualEndDate < task.actualStartDate)
    errors.push(t("Ngày kết thúc thực tế không được trước ngày bắt đầu thực tế."));
  if (!Number.isInteger(task.progress) || task.progress < 0 || task.progress > 100)
    errors.push(t("Tiến độ phải là số nguyên từ 0 đến 100."));
  const allowed = new Set(splitUserCodes(managers));
  if (splitUserCodes(task.pic).some((code) => !allowed.has(code)))
    errors.push(t("Người thực hiện phải thuộc danh sách người phụ trách của dự án."));
  if (splitUserCodes(task.pic).join(",").length > 255)
    errors.push(t("Danh sách mã người thực hiện tối đa 255 ký tự."));
  return [...new Set(errors)];
}

export function getImportProjectErrors(draft) {
  const project = draft.project;
  const errors = draft.errors.map(
    (issue) =>
      `${t("Dòng {row}", { row: issue.row })}: ${translateServerMessage(issue.message, "VALIDATION_ERROR")}`,
  );
  if (!localizedText(project, "projectName")) errors.push(t("Vui lòng nhập tên."));
  if (
    [project.projectName, project.projectNameVi, project.projectNameZh].some(
      (value) => (value?.length ?? 0) > 255,
    )
  )
    errors.push(t("Tên tối đa 255 ký tự."));
  if (project.startDate && project.endDate && project.endDate < project.startDate)
    errors.push(t("Ngày kết thúc không được trước ngày bắt đầu."));
  if (
    project.actualStartDate &&
    project.actualEndDate &&
    project.actualEndDate < project.actualStartDate
  )
    errors.push(t("Ngày kết thúc thực tế không được trước ngày bắt đầu thực tế."));
  if (splitUserCodes(project.manager).join(",").length > 255)
    errors.push(t("Danh sách mã người phụ trách tối đa 255 ký tự."));
  return [...new Set(errors)];
}
