import test from "node:test";
import assert from "node:assert/strict";
import { localizedText, localizedFormValues } from "../src/utils/localizedContent.js";
import {
  projectPayload,
  toProjectValues,
  taskPayload,
  toTaskValues,
} from "../src/utils/projectDetailUtils.js";

test("display picks selected language, other translation, then legacy without changing source", () => {
  const project = { projectName: "old", projectNameVi: "Dự án", projectNameZh: "项目" };
  assert.equal(localizedText(project, "projectName", "vi"), "Dự án");
  assert.equal(localizedText(project, "projectName", "zh"), "项目");
  assert.equal(localizedText({ ...project, projectNameZh: null }, "projectName", "zh"), "Dự án");
  assert.equal(
    localizedText({ projectName: "Nội dung cũ / 旧内容" }, "projectName", "zh"),
    "Nội dung cũ / 旧内容",
  );
  assert.equal(project.projectName, "old");
});
test("forms preserve both translations, allow Chinese-only names, and explicitly clear descriptions", () => {
  const values = toProjectValues({
    projectNameVi: null,
    projectNameZh: "项目",
    projectName: "项目",
    descriptionZh: "说明",
  });
  assert.equal(values.projectNameVi, "");
  const payload = projectPayload(values);
  assert.equal(payload.projectNameZh, "项目");
  assert.equal(payload.projectName, "项目");
  assert.equal(payload.descriptionZh, "说明");
  values.descriptionZh = "";
  assert.equal(projectPayload(values).descriptionZh, null);
  const task = taskPayload(
    toTaskValues({
      taskNameVi: "Công việc",
      taskNameZh: "任务",
      descriptionVi: "Ghi chú",
      descriptionZh: "备注",
    }),
    "IT2611001",
  );
  assert.equal(task.taskNameVi, "Công việc");
  assert.equal(task.taskNameZh, "任务");
  assert.equal(task.descriptionZh, "备注");
  assert.equal(
    localizedFormValues({ projectName: "Giữ nguyên / 保留" }, "projectName").projectNameVi,
    "Giữ nguyên / 保留",
  );
});
