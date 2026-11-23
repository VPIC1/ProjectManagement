import { localizedText } from "./localizedContent.js";
export const normalizeDepartmentSearch = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim();

// Keep numeric selection values so project payloads and existing links stay unchanged.
export function departmentTreeData(rows, language = "vi") {
  const nodes = new Map(
    rows
      .filter((row) => row.isActive !== false)
      .map((row) => [
        row.id,
        {
          key: row.id,
          value: row.id,
          title: localizedText(row, "name", language),
          label: localizedText(row, "name", language),
          path: localizedText(row, "path", language) || localizedText(row, "name", language),
          searchText: `${row.nameVi ?? ""} ${row.nameZh ?? ""} ${row.pathVi ?? ""} ${row.pathZh ?? ""}`,
          groupCode: row.groupCode,
          sortOrder: row.sortOrder ?? 0,
          groupType: row.groupType,
          selectable: row.selectable ?? row.groupType !== "Group",
          children: [],
        },
      ]),
  );
  const roots = [];
  for (const row of rows) {
    const node = nodes.get(row.id);
    if (!node) continue;
    const parent = nodes.get(row.parentId);
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
  }
  function sort(items) {
    items.sort(
      (a, b) =>
        Number(a.groupType === "Group") - Number(b.groupType === "Group") ||
        a.sortOrder - b.sortOrder ||
        a.value - b.value,
    );
    for (const node of items) {
      if (node.children.length) sort(node.children);
      else delete node.children;
    }
    return items;
  }
  return sort(roots);
}
