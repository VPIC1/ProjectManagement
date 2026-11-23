import { useMemo } from "react";
import { AutoComplete, Input } from "antd";
import useProjectUsers from "../../hooks/useProjectUsers";

const normalize = (text) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

// Gợi ý theo mã/tên nhân viên; giá trị vẫn là tên hoặc nội dung tự nhập.
export default function ProjectRequesterInput({ placeholder, ...props }) {
  const { users } = useProjectUsers();
  const options = useMemo(
    () =>
      (users ?? []).map((user) => ({
        key: user.code,
        value: user.name,
        label: `${user.code} - ${user.name}`,
      })),
    [users],
  );
  return (
    <AutoComplete
      {...props}
      className="w-full"
      options={options}
      allowClear
      showSearch={{
        filterOption: (input, option) => normalize(option?.label ?? "").includes(normalize(input)),
      }}
    >
      <Input maxLength={255} placeholder={placeholder} />
    </AutoComplete>
  );
}
