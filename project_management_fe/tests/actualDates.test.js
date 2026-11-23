import assert from "node:assert/strict";
import test from "node:test";
import {
  toProjectValues,
  projectPayload,
  toTaskValues,
  taskPayload,
} from "../src/utils/projectDetailUtils.js";
import { getImportProjectErrors, getImportTaskErrors } from "../src/utils/projectImportDraft.js";
import { setActiveLanguage, translateServerMessage } from "../src/locales/translate.js";

test("Project and task form roundtrips preserve planned and actual dates independently", () => {
  const dates = {
    startDate: "2026-01-01",
    endDate: "2026-01-10",
    actualStartDate: "2026-01-04",
    actualEndDate: "2026-01-12",
  };
  const project = projectPayload(toProjectValues({ projectName: "P", ...dates }));
  const task = taskPayload(toTaskValues({ taskName: "T", ...dates }), "IT2611001");
  for (const payload of [project, task])
    for (const [key, value] of Object.entries(dates)) assert.equal(payload[key], value);
  const cleared = toProjectValues({ projectName: "P", ...dates });
  cleared.actualDateRange = null;
  assert.equal(projectPayload(cleared).actualEndDate, null);
  assert.equal(projectPayload(cleared).endDate, "2026-01-10");
  assert.equal(taskPayload(toTaskValues({ taskName: "T" }), "IT2611001").actualStartDate, null);
});

test("Invalid actual dates are caught in import drafts and localized", () => {
  const invalid = { actualStartDate: "2026-01-12", actualEndDate: "2026-01-04" };
  setActiveLanguage("vi");
  assert.ok(
    getImportProjectErrors({ project: { projectName: "P", ...invalid }, errors: [] }).some((s) =>
      s.includes("thực tế"),
    ),
  );
  assert.ok(
    getImportTaskErrors({ taskName: "T", progress: 0, ...invalid }, "").some((s) =>
      s.includes("thực tế"),
    ),
  );
  setActiveLanguage("zh");
  assert.equal(
    translateServerMessage(
      "Ngày kết thúc thực tế không được trước ngày bắt đầu thực tế. / 实际结束日期不能早于实际开始日期。",
      "VALIDATION_ERROR",
    ),
    "实际结束日期不能早于实际开始日期。",
  );
});
