import assert from "node:assert/strict";
import test from "node:test";
import { departmentTreeData, normalizeDepartmentSearch } from "../src/utils/departmentTree.js";

test("Department tree preserves distinct IDs for duplicate names and their parent paths", () => {
  const nodes = departmentTreeData([
    { id: 1, name: "Công ty", groupType: "Department", sortOrder: 1 },
    { id: 2, name: "Phòng IT", parentId: 1, sortOrder: 2, path: "Công ty / Phòng IT" },
    { id: 3, name: "Công ty khác", sortOrder: 5 },
    { id: 4, name: "Phòng IT", parentId: 3, sortOrder: 6, path: "Công ty khác / Phòng IT" },
    { id: 5, name: "Ngừng", parentId: 1, sortOrder: 4, isActive: false },
  ]);
  assert.equal(nodes.length, 2);
  assert.equal(nodes[0].children.length, 1);
  assert.equal(nodes[0].children[0].value, 2);
  assert.equal(nodes[1].children[0].value, 4);
  assert.notEqual(nodes[0].children[0].path, nodes[1].children[0].path);
});
test("Group nodes remain visible but non-selectable; Vietnamese search ignores accents", () => {
  const [group] = departmentTreeData([
    { id: 7, name: "會員", groupType: "Group", selectable: false },
  ]);
  assert.equal(group.selectable, false);
  assert.equal(
    normalizeDepartmentSearch("Khối Hành Chính / Phòng IT"),
    "khoi hanh chinh / phong it",
  );
  assert.equal(normalizeDepartmentSearch("資訊部"), "資訊部");
});

test("Department tree switches both names and paths by language, with fallback", () => {
  const rows = [
    { id: 1, nameVi: "Công ty", nameZh: "公司", pathVi: "Công ty", pathZh: "公司" },
    {
      id: 2,
      parentId: 1,
      nameVi: "IT Ban IT",
      nameZh: "IT 資訊部",
      pathVi: "Công ty / IT Ban IT",
      pathZh: "公司 / IT 資訊部",
    },
    { id: 3, parentId: 1, nameVi: "Phòng phần mềm", nameZh: null },
  ];
  const vi = departmentTreeData(rows, "vi")[0];
  const zh = departmentTreeData(rows, "zh")[0];
  assert.equal(vi.children[0].title, "IT Ban IT");
  assert.equal(zh.children[0].title, "IT 資訊部");
  assert.equal(zh.children[0].path, "公司 / IT 資訊部");
  assert.equal(zh.children[1].title, "Phòng phần mềm");
  assert.match(zh.children[0].searchText, /IT Ban IT/);
});
