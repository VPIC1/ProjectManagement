import useProjectStatusOptions from "../../hooks/useProjectStatusOptions";
import useLanguage from "../../hooks/useLanguage";
import { Select } from "antd";

// The select only changes status. The colored status tag is displayed next to the task name.
export default function TaskStatusControl({
  value,
  taskName,
  disabled = false,
  saving = false,
  onChange,
}) {
  const { t } = useLanguage();
  const PROJECT_STATUS_OPTIONS = useProjectStatusOptions();
  return (
    <Select
      size="small"
      className="w-[175px]"
      value={value}
      placeholder={t("Chọn trạng thái")}
      disabled={disabled || saving}
      loading={saving}
      aria-label={t("Đổi trạng thái: {name}", { name: taskName })}
      options={PROJECT_STATUS_OPTIONS.map(({ label, value: status }) => ({ label, value: status }))}
      onChange={(status) => {
        if (status !== value) onChange(status);
      }}
    />
  );
}
