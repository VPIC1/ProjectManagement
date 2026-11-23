import useLanguage from "../../hooks/useLanguage";
import { Select } from "antd";
import useProjectUsers from "../../hooks/useProjectUsers";

const normalizeSearch = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

export default function ProjectUserSelect({
  value,
  onChange,
  placeholder,
  mode,
  allowedCodes,
  ...props
}) {
  const { t } = useLanguage();
  const { options, loading, error } = useProjectUsers();
  const availableOptions =
    allowedCodes === undefined
      ? options
      : allowedCodes.map(
          (code) => options.find((option) => option.value === code) ?? { value: code, label: code },
        );
  const values = mode === "multiple" ? (value ?? []) : value ? [value] : [];
  const legacyOptions = values
    .filter((code) => !availableOptions.some((option) => option.value === code))
    .map((code) => ({
      value: code,
      label: options.find((option) => option.value === code)?.label ?? code,
      disabled: true,
    }));
  return (
    <Select
      {...props}
      mode={mode}
      value={mode === "multiple" ? values : value || undefined}
      onChange={onChange}
      allowClear
      placeholder={placeholder}
      loading={loading}
      disabled={loading || error ? true : undefined}
      showSearch={{
        filterOption: (input, option) =>
          normalizeSearch(option.label).includes(normalizeSearch(input)),
      }}
      options={[...legacyOptions, ...availableOptions]}
      notFoundContent={
        loading
          ? t("Đang tải nhân viên…")
          : error
            ? t("Không tải được danh sách nhân viên")
            : allowedCodes?.length === 0
              ? t("Hãy chọn người phụ trách dự án trước.")
              : t("Không tìm thấy nhân viên")
      }
    />
  );
}
