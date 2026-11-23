import { useEffect, useMemo, useState } from "react";
import { Tooltip, TreeSelect } from "antd";
import useLanguage from "../../hooks/useLanguage";
import { getDepartments } from "../../utils/endpoint";
import { departmentTreeData, normalizeDepartmentSearch } from "../../utils/departmentTree";

export default function ProjectDepartmentSelect({ prefixOptions = [], placeholder, ...props }) {
  const { t, language } = useLanguage();
  const [departments, setDepartments] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    getDepartments({ signal: controller.signal })
      .then((departments) => {
        if (!controller.signal.aborted) setDepartments(departments);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, []);
  const nodes = useMemo(
    () => departments && departmentTreeData(departments, language),
    [departments, language],
  );
  return (
    <TreeSelect
      {...props}
      labelInValue
      allowClear
      className="w-full"
      treeLine
      treeNodeLabelProp="label"
      showSearch={{
        filterTreeNode: (input, node) =>
          normalizeDepartmentSearch(
            `${node.title} ${node.searchText ?? ""} ${node.groupCode ?? ""} ${node.path ?? ""}`,
          ).includes(normalizeDepartmentSearch(input)),
      }}
      loading={nodes === null && !failed}
      treeData={[
        ...prefixOptions.map((option) => ({ ...option, title: option.label })),
        ...(nodes ?? []),
      ]}
      treeTitleRender={(node) => (
        <Tooltip title={node.path}>
          <span>{node.title}</span>
        </Tooltip>
      )}
      placeholder={placeholder ?? t("Nhập để tìm phòng ban")}
      notFoundContent={failed ? t("Không tải được danh sách phòng ban") : undefined}
    />
  );
}
