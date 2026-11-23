import { DatePicker, Form, Modal } from "antd";
import dayjs from "dayjs";
import useLanguage from "../../hooks/useLanguage";
import { joinUserCodes, splitUserCodes } from "../../utils/projectUserValues";
import { toTaskValues, validateEndDate } from "../../utils/projectDetailUtils";
import ProjectUserSelect from "./ProjectUserSelect";

// Confirm planned/actual dates and assignees together; callers retain other task fields.
export default function TaskCompletionModal({
  task,
  managers,
  saving = false,
  onCancel,
  onConfirm,
}) {
  const { t, content } = useLanguage();
  const [form] = Form.useForm();
  const initial = toTaskValues(task);
  return (
    <Modal
      open
      title={t("Xác nhận hoàn thành công việc")}
      width={560}
      mask={{ closable: false }}
      closable={!saving}
      keyboard={!saving}
      onCancel={onCancel}
      onOk={() => form.submit()}
      okText={t("Xác nhận hoàn thành")}
      cancelText={t("Hủy")}
      confirmLoading={saving}
      cancelButtonProps={{ disabled: saving }}
      destroyOnHidden
    >
      <p className="mb-4 line-clamp-2 break-words font-medium">{content(task, "taskName")}</p>
      <Form
        form={form}
        layout="vertical"
        disabled={saving}
        initialValues={{
          pic: initial.pic,
          dateRange: initial.dateRange,
          actualDateRange: [
            initial.actualDateRange?.[0] ?? null,
            initial.actualDateRange?.[1] ?? dayjs(),
          ],
        }}
        onFinish={(values) =>
          onConfirm({
            pic: joinUserCodes(values.pic),
            startDate: values.dateRange?.[0]?.format("YYYY-MM-DD") ?? null,
            endDate: values.dateRange?.[1]?.format("YYYY-MM-DD") ?? null,
            actualStartDate: values.actualDateRange[0].format("YYYY-MM-DD"),
            actualEndDate: values.actualDateRange[1].format("YYYY-MM-DD"),
          })
        }
      >
        <Form.Item
          name="dateRange"
          label={t("Thời gian dự kiến")}
          rules={[{ validator: (_, range) => validateEndDate(range?.[0], range?.[1]) }]}
        >
          <DatePicker.RangePicker
            className="w-full"
            format="DD/MM/YYYY"
            placeholder={[t("Bắt đầu dự kiến"), t("Kết thúc dự kiến")]}
            allowEmpty={[true, true]}
            allowClear
          />
        </Form.Item>
        <Form.Item
          name="actualDateRange"
          label={t("Thời gian thực tế")}
          rules={[
            {
              validator: (_, range) => {
                if (!range?.[0]?.isValid() || !range?.[1]?.isValid())
                  return Promise.reject(
                    new Error(t("Vui lòng nhập đủ ngày bắt đầu và kết thúc thực tế.")),
                  );
                return range[1].isBefore(range[0], "day")
                  ? Promise.reject(
                      new Error(t("Ngày kết thúc thực tế không được trước ngày bắt đầu thực tế.")),
                    )
                  : Promise.resolve();
              },
            },
          ]}
        >
          <DatePicker.RangePicker
            className="w-full"
            format="DD/MM/YYYY"
            placeholder={[t("Bắt đầu thực tế"), t("Kết thúc thực tế")]}
            allowEmpty={[true, true]}
            allowClear
          />
        </Form.Item>
        <Form.Item
          name="pic"
          label={t("Người phụ trách")}
          rules={[
            {
              required: true,
              type: "array",
              min: 1,
              message: t("Vui lòng chọn người phụ trách để xác nhận hoàn thành."),
            },
            {
              validator: (_, value) => {
                const codes = splitUserCodes(value);
                if (codes.some((code) => !splitUserCodes(managers).includes(code)))
                  return Promise.reject(
                    new Error(t("Người thực hiện phải thuộc danh sách người phụ trách của dự án.")),
                  );
                return (joinUserCodes(codes)?.length ?? 0) > 255
                  ? Promise.reject(new Error(t("Danh sách mã người thực hiện tối đa 255 ký tự.")))
                  : Promise.resolve();
              },
            },
          ]}
        >
          <ProjectUserSelect
            mode="multiple"
            allowedCodes={splitUserCodes(managers)}
            placeholder={t("Chọn người phụ trách")}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
