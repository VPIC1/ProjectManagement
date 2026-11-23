import { Form, Input } from "antd";
import useLanguage from "../../hooks/useLanguage";

// Một nội dung có hai bản ngôn ngữ nằm sát nhau, dùng chung nhãn và quy tắc kiểm tra.
export default function BilingualContentField({
  name,
  label,
  placeholder,
  multiline = false,
  requiredName = false,
}) {
  const { t } = useLanguage();
  const form = Form.useFormInstance();
  return (
    <fieldset className="bilingual-content-field col-span-full mb-3 min-w-0 rounded-lg border border-gray-300 bg-slate-50 px-3 pb-3">
      <legend className="px-1 text-sm font-medium text-gray-800">
        {requiredName && (
          <span className="mr-1 text-red-500" aria-hidden="true">
            *
          </span>
        )}
        {label}
      </legend>
      <div className="flex flex-col gap-3 pt-1">
        {[
          { suffix: "Vi", language: "VI · Tiếng Việt" },
          { suffix: "Zh", language: "ZH · 中文" },
        ].map(({ suffix, language }) => {
          const field = name + suffix;
          const other = name + (suffix === "Vi" ? "Zh" : "Vi");
          return (
            <Form.Item
              key={field}
              name={field}
              label={language}
              layout="horizontal"
              labelAlign="left"
              colon={false}
              labelCol={{ flex: "115px" }}
              wrapperCol={{ flex: "auto" }}
              className="mb-0! min-w-0 [&_.ant-form-item-label]:self-start"
              dependencies={requiredName ? [other] : undefined}
              rules={
                requiredName
                  ? [
                      {
                        validator: (_, value) =>
                          value?.trim() || form.getFieldValue(other)?.trim()
                            ? Promise.resolve()
                            : Promise.reject(new Error(t("Nhập tên ở ít nhất một ngôn ngữ."))),
                      },
                      { max: 255, message: t("Tên tối đa 255 ký tự.") },
                    ]
                  : undefined
              }
            >
              {/* Mô tả giãn theo nội dung; chỉ khung chứa form cuộn. */}
              {multiline ? (
                <Input.TextArea
                  placeholder={`${placeholder} (${language})`}
                  autoSize={{ minRows: 4 }}
                />
              ) : (
                <Input maxLength={255} allowClear placeholder={`${placeholder} (${language})`} />
              )}
            </Form.Item>
          );
        })}
      </div>
    </fieldset>
  );
}
