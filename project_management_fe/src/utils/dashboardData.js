import { splitUserCodes } from "./projectUserValues.js";

export const UNASSIGNED_MANAGER = "__unassigned__";
export const DASHBOARD_STATUSES = ["PENDING", "COMPLETE", "HOLD", "CANCEL"];

// Đọc đủ các trang API để thống kê và các panel cùng dùng một tập dự án.
export async function fetchDashboardProjects(request, filters, isCurrent = () => true) {
  const projects = new Map();
  let pages = 1;
  for (let pageNumber = 1; pageNumber <= pages; pageNumber++) {
    if (!isCurrent()) return null;
    const response = await request(
      { ...filters, pageNumber, pageSize: 100, sortBy: "id", sortDirection: "asc" },
      { timeout: 15000 },
    );
    if (!isCurrent()) return null;
    pages = Math.max(1, response.totalPages ?? Math.ceil(response.totalCount / 100));
    for (const project of response.items) projects.set(project.id, project);
  }
  return [...projects.values()];
}

export function getDashboardCounts(projects) {
  return Object.fromEntries([
    ["total", projects.length],
    ...DASHBOARD_STATUSES.map((status) => [
      status,
      projects.filter((project) => project.status === status).length,
    ]),
  ]);
}

export function getDashboardManagers(projects, users) {
  const directory = new Map(users.map((user) => [user.code, user.name]));
  const rows = new Map(
    users.map((user) => [
      user.code,
      {
        userCode: user.code,
        userName: user.name,
        totalProjects: 0,
        pendingProjects: 0,
        completeProjects: 0,
        holdProjects: 0,
        cancelProjects: 0,
      },
    ]),
  );
  const fields = {
    PENDING: "pendingProjects",
    COMPLETE: "completeProjects",
    HOLD: "holdProjects",
    CANCEL: "cancelProjects",
  };
  for (const project of projects) {
    const codes = splitUserCodes(project.manager);
    for (const code of codes.length ? codes : [UNASSIGNED_MANAGER]) {
      if (!rows.has(code))
        rows.set(code, {
          userCode: code === UNASSIGNED_MANAGER ? null : code,
          userName: directory.get(code) ?? "",
          totalProjects: 0,
          pendingProjects: 0,
          completeProjects: 0,
          holdProjects: 0,
          cancelProjects: 0,
        });
      const row = rows.get(code);
      row.totalProjects++;
      if (fields[project.status]) row[fields[project.status]]++;
    }
  }
  return [...rows.values()].sort(
    (a, b) =>
      b.totalProjects - a.totalProjects || (a.userCode ?? "").localeCompare(b.userCode ?? ""),
  );
}

export function matchesDashboardManager(project, code) {
  const codes = splitUserCodes(project.manager);
  return code === null || (code === UNASSIGNED_MANAGER ? codes.length === 0 : codes.includes(code));
}
