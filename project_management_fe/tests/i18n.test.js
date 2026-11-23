import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import dayjs from "dayjs";
import { getImportProjectErrors, getImportTaskErrors } from "../src/utils/projectImportDraft.js";
import vi from "../src/locales/vi.js";
import zh from "../src/locales/zh.js";
import {
  LANGUAGE_STORAGE_KEY,
  readLanguage,
  setActiveLanguage,
  translate,
  translateServerMessage,
} from "../src/locales/translate.js";
import {
  getRequestError,
  projectPayload,
  toProjectValues,
  validateEndDate,
} from "../src/utils/projectDetailUtils.js";

afterEach(() => {
  setActiveLanguage("vi");
  delete globalThis.localStorage;
});

test("Both languages cover the same keys and preserve interpolation placeholders", () => {
  assert.deepEqual(Object.keys(vi), Object.keys(zh));
  const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  for (const key of Object.keys(vi)) {
    assert.ok(zh[key].trim(), key);
    assert.deepEqual(placeholders(vi[key]), placeholders(zh[key]), key);
  }
  assert.equal(
    translate("Danh sách dự án ({count} dự án)", { count: 19 }, "zh"),
    "项目列表（19 个项目）",
  );
});

test("Language preference is remembered; unsupported choices fall back to Vietnamese", () => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  };
  setActiveLanguage("zh");
  assert.equal(values.get(LANGUAGE_STORAGE_KEY), "zh");
  assert.equal(readLanguage(), "zh");
  assert.equal(translate("Trạng thái"), "状态");
  setActiveLanguage("unsupported");
  assert.equal(readLanguage(), "vi");
  assert.equal(translate("Trạng thái"), "Trạng thái");
});

test("Blocked browser storage does not prevent changing language", () => {
  globalThis.localStorage = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
  assert.equal(readLanguage(), "vi");
  assert.doesNotThrow(() => setActiveLanguage("zh"));
  assert.equal(translate("Ngày bắt đầu"), "开始日期");
});

test("Switching language preserves user-entered data and API codes/dates", () => {
  const source = {
    projectName: "Dự án thử nghiệm 项目",
    description: "Nội dung do người dùng nhập",
    manager: "01959,28405",
    startDate: "2026-11-01",
    endDate: "2026-11-09",
    status: "PENDING",
  };
  const values = toProjectValues(source);
  const before = projectPayload(values);
  setActiveLanguage("zh");
  assert.deepEqual(projectPayload(values), before);
  assert.deepEqual(values.manager, ["01959", "28405"]);
  assert.equal(before.manager, "01959,28405");
  assert.equal(before.projectName, source.projectName);
  assert.equal(translate("01959 - Đàm Đức Hải"), "01959 - Đàm Đức Hải");
});

test("Date validation and server validation messages use the chosen language", async () => {
  setActiveLanguage("zh");
  await assert.rejects(validateEndDate(dayjs("2026-11-09"), dayjs("2026-11-01")), {
    message: "结束日期不能早于开始日期。",
  });
  assert.equal(
    getRequestError({ code: "ECONNABORTED" }),
    zh["Hết thời gian chờ. Hãy tải lại dữ liệu để kiểm tra trước khi thử lại."],
  );
  const detail =
    "Vui lòng chọn người phụ trách từ danh sách nhân viên; gửi các mã cách nhau bằng dấu phẩy.";
  assert.equal(
    getRequestError({
      response: { data: { code: "VALIDATION_ERROR", errors: { Manager: [detail] } } },
    }),
    zh[detail],
  );
});

test("Product name stays IT Project and navigation/import actions use Vietnamese or Chinese", () => {
  for (const language of ["vi", "zh"])
    assert.equal(translate("IT Project", {}, language), "IT Project");
  assert.equal(translate("Tổng quan", {}, "vi"), "Tổng quan");
  assert.equal(translate("Nhập Excel", {}, "vi"), "Nhập Excel");
  assert.equal(translate("Xác nhận nhập", {}, "zh"), "确认导入");
  assert.equal(translate("Nhập dự án từ Excel", {}, "zh"), "从 Excel 导入项目");
});

test("Standard English server errors and validation field names are localized in both languages", () => {
  setActiveLanguage("vi");
  assert.equal(
    translateServerMessage("The ProjectName field is required.", "VALIDATION_ERROR"),
    "Vui lòng nhập Tên dự án.",
  );
  assert.equal(
    translateServerMessage(
      "The field Requester must be a string with a maximum length of '255'.",
      "VALIDATION_ERROR",
    ),
    "Người yêu cầu tối đa 255 ký tự.",
  );
  assert.equal(
    translateServerMessage("The field Progress must be between 0 and 100.", "VALIDATION_ERROR"),
    "Tiến độ phải từ 0 đến 100.",
  );
  assert.equal(
    translateServerMessage("A record with the same unique value already exists.", "DUPLICATE_DATA"),
    "Dữ liệu đã tồn tại.",
  );
  assert.equal(
    translateServerMessage("An unknown low-level SQL error", "INTERNAL_ERROR"),
    "Có lỗi hệ thống. Vui lòng liên hệ bộ phận hỗ trợ.",
  );
  setActiveLanguage("zh");
  assert.equal(
    translateServerMessage("The TaskName field is required.", "VALIDATION_ERROR"),
    "请输入任务名称。",
  );
  assert.equal(
    translateServerMessage(
      "The value 'invalid' is not valid for StartDateFrom.",
      "VALIDATION_ERROR",
    ),
    "开始日期无效。",
  );
  assert.equal(
    translateServerMessage("An unknown English validation error", "VALIDATION_ERROR"),
    zh["Dữ liệu không hợp lệ."],
  );
});

test("Bilingual Excel errors follow the selected language, including after switching on an open draft", () => {
  const issue = "Mã nhân viên không hợp lệ. / 员工工号无效。";
  setActiveLanguage("vi");
  assert.equal(translateServerMessage(issue, "VALIDATION_ERROR"), "Mã nhân viên không hợp lệ.");
  setActiveLanguage("zh");
  assert.equal(translateServerMessage(issue, "VALIDATION_ERROR"), "员工工号无效。");
  const task = {
    taskName: "Example",
    pic: null,
    progress: 0,
    importErrors: ["The TaskName field is required."],
  };
  assert.ok(getImportTaskErrors(task, null).includes("请输入任务名称。"));
  const draft = { project: { projectName: "Example" }, errors: [{ row: 3, message: issue }] };
  assert.deepEqual(getImportProjectErrors(draft), ["第 3 行: 员工工号无效。"]);
  setActiveLanguage("vi");
  assert.deepEqual(getImportProjectErrors(draft), ["Dòng 3: Mã nhân viên không hợp lệ."]);
});

test("Every literal translation key used by the UI has both language entries", () => {
  const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url));
  function inspect(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "locales") inspect(file);
        continue;
      }
      if (!/\.(jsx|js)$/.test(file)) continue;
      for (const match of readFileSync(file, "utf8").matchAll(/\bt\(\s*("(?:[^"\\]|\\.)*")/g)) {
        const key = JSON.parse(match[1]);
        assert.ok(Object.hasOwn(vi, key) && Object.hasOwn(zh, key), `${file}: ${key}`);
      }
    }
  }
  inspect(sourceRoot);
});
