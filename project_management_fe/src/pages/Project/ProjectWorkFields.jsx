import useProjectStatusOptions from "../../hooks/useProjectStatusOptions";
import useLanguage from "../../hooks/useLanguage";
import { DatePicker, Form, Input, InputNumber, Select } from "antd";
import { validateEndDate } from "../../utils/projectDetailUtils";
import ProjectUserSelect from "./ProjectUserSelect";
import BilingualContentField from "./BilingualContentField";
import ProjectRequesterInput from "./ProjectRequesterInput";
import ProjectDepartmentSelect from "./ProjectDepartmentSelect";
import { joinUserCodes, splitUserCodes } from "../../utils/projectUserValues";

// Dùng chung trường form cho tạo/sửa/import. Người thực hiện task chỉ lấy từ manager dự án.
export default function ProjectWorkFields({
  task = false,
  projectCode,
  compact = false,
  managers,
}) {
  const { t } = useLanguage();
  const name = task ? "taskName" : "projectName";
  const PROJECT_STATUS_OPTIONS = useProjectStatusOptions();
  const selectedStatus = Form.useWatch("status");
  const form = Form.useFormInstance();

  function clearEmptyActualDate(event, { range } = {}) {
    if (event.target.value !== "" || !range) return;
    const current = form.getFieldValue("actualDateRange");
    const index = range === "start" ? 0 : 1;
    if (!current?.[index]) return;

    // RangePicker giữ ngày cũ khi người dùng xóa hết chữ trong một ô.
    const next = [...current];
    next[index] = null;
    form.setFields([
      {
        name: "actualDateRange",
        value: next.some(Boolean) ? next : null,
        touched: true,
        errors: [],
      },
    ]);
  }

  const statusField = (
    <Form.Item
      name="status"
      label={t("Trạng thái")}
      className={task ? "sm:col-span-3" : "md:col-span-2"}
      rules={[{ required: true, message: t("Vui lòng chọn trạng thái.") }]}
    >
      <Select options={PROJECT_STATUS_OPTIONS} placeholder={t("Chọn trạng thái")} />
    </Form.Item>
  );
  return (
    <div
      className={
        task
          ? "grid grid-cols-1 gap-x-3 sm:grid-cols-12"
          : "grid grid-cols-1 gap-x-3 md:grid-cols-12"
      }
    >
      {!task && !compact && (
        <Form.Item label={t("Mã dự án")} className="col-span-full">
          <Input
            disabled
            value={projectCode || ""}
            placeholder={t("Mã dự án tự tạo sau khi lưu")}
          />
        </Form.Item>
      )}
      <BilingualContentField
        name={name}
        label={task ? t("Tên công việc") : t("Tên dự án")}
        placeholder={task ? t("Nhập tên công việc") : t("Nhập tên dự án")}
        requiredName
      />
      {(task
        ? [{ name: "pic", label: t("Người thực hiện") }]
        : [
            { name: "manager", label: t("Người phụ trách") },
            { name: "requester", label: t("Người yêu cầu") },
          ]
      ).map(({ name, label }) => (
        <Form.Item
          key={name}
          name={name}
          label={label}
          className={task ? "sm:col-span-6" : "md:col-span-4"}
          rules={
            name !== "requester"
              ? [
                  {
                    validator: (_, value) =>
                      !task ||
                      splitUserCodes(value).every((code) => splitUserCodes(managers).includes(code))
                        ? Promise.resolve()
                        : Promise.reject(
                            new Error(
                              t("Người thực hiện phải thuộc danh sách người phụ trách của dự án."),
                            ),
                          ),
                  },
                  {
                    validator: (_, value) =>
                      (joinUserCodes(value)?.length ?? 0) <= 255
                        ? Promise.resolve()
                        : Promise.reject(
                            new Error(
                              t(
                                name === "pic"
                                  ? "Danh sách mã người thực hiện tối đa 255 ký tự."
                                  : "Danh sách mã người phụ trách tối đa 255 ký tự.",
                              ),
                            ),
                          ),
                  },
                ]
              : [{ max: 255, message: t("Tối đa 255 ký tự.") }]
          }
        >
          {name === "requester" ? (
            <ProjectRequesterInput placeholder={t("Nhập người yêu cầu")} />
          ) : (
            <ProjectUserSelect
              mode="multiple"
              allowedCodes={task ? splitUserCodes(managers) : undefined}
              placeholder={t(task ? "Chọn người thực hiện" : "Chọn người phụ trách")}
            />
          )}
        </Form.Item>
      ))}
      {task && statusField}
      {!task && (
        <Form.Item
          name="requesterDepartment"
          label={t("Phòng ban yêu cầu")}
          className="md:col-span-4"
        >
          <ProjectDepartmentSelect />
        </Form.Item>
      )}
      {task ? (
        <>
          <Form.Item
            name="progress"
            label={t("Tiến độ (%)")}
            className="sm:col-span-3"
            rules={[
              { required: true, message: t("Vui lòng nhập tiến độ từ 0 đến 100.") },
              {
                type: "integer",
                min: 0,
                max: 100,
                message: t("Tiến độ phải là số nguyên từ 0 đến 100."),
              },
            ]}
          >
            <InputNumber
              min={0}
              max={100}
              precision={0}
              suffix="%"
              disabled={selectedStatus === "COMPLETE" ? true : undefined}
              className="w-full!"
              placeholder={t("Nhập tiến độ từ 0 đến 100")}
            />
          </Form.Item>
          <Form.Item
            name="dateRange"
            label={t("Thời gian dự kiến")}
            className="sm:col-span-6"
            rules={[{ validator: (_, value) => validateEndDate(value?.[0], value?.[1]) }]}
          >
            <DatePicker.RangePicker
              format="DD/MM/YYYY"
              placeholder={[t("Bắt đầu dự kiến"), t("Kết thúc dự kiến")]}
              allowEmpty={[true, true]}
              className="w-full"
            />
          </Form.Item>
        </>
      ) : (
        <>
          <Form.Item
            name="dateRange"
            label={t("Thời gian dự kiến")}
            className="md:col-span-5"
            rules={[{ validator: (_, value) => validateEndDate(value?.[0], value?.[1]) }]}
          >
            <DatePicker.RangePicker
              format="DD/MM/YYYY"
              placeholder={[t("Bắt đầu dự kiến"), t("Kết thúc dự kiến")]}
              allowEmpty={[true, true]}
              className="w-full"
            />
          </Form.Item>
        </>
      )}
      <Form.Item
        name="actualDateRange"
        label={t("Thời gian thực tế")}
        className={task ? "sm:col-span-6" : "md:col-span-5"}
        rules={[
          {
            validator: (_, value) =>
              value?.[0] && value?.[1] && value[1].isBefore(value[0], "day")
                ? Promise.reject(
                    new Error(t("Ngày kết thúc thực tế không được trước ngày bắt đầu thực tế.")),
                  )
                : Promise.resolve(),
          },
        ]}
      >
        <DatePicker.RangePicker
          format="DD/MM/YYYY"
          placeholder={[t("Bắt đầu thực tế"), t("Kết thúc thực tế")]}
          allowClear
          allowEmpty={[true, true]}
          onBlur={clearEmptyActualDate}
          className="w-full"
        />
      </Form.Item>
      {!task && statusField}
      <BilingualContentField
        name="description"
        label={t("Mô tả")}
        multiline
        placeholder={
          task
            ? t("Nhập mô tả, yêu cầu hoặc nội dung cần thực hiện")
            : t("Nhập mô tả, mục tiêu hoặc phạm vi dự án")
        }
      />
    </div>
  );
}
