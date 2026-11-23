import { REQUEST_CONFIG } from "./projectDetailUtils.js";

// The backend limits pageSize to 100; collect every page without exposing pagination in the UI.
export async function fetchAllProjectTasks(request, projectCode, isCurrent = () => true) {
  const tasks = new Map();
  let totalPages = 1;
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    if (!isCurrent()) return null;
    const page = await request(
      {
        projectCode,
        pageNumber,
        pageSize: 100,
        sortBy: "startDate",
        sortDirection: "asc",
      },
      REQUEST_CONFIG,
    );
    if (!isCurrent()) return null;
    if (pageNumber === 1)
      totalPages = Math.max(1, page.totalPages ?? Math.ceil(page.totalCount / 100));
    for (const task of page.items) tasks.set(task.id, task);
  }
  // Keep undated tasks last after collecting every page; Id breaks equal-date ties.
  return [...tasks.values()].sort((left, right) => {
    if (!left.startDate && right.startDate) return 1;
    if (left.startDate && !right.startDate) return -1;
    return (left.startDate ?? "").localeCompare(right.startDate ?? "") || left.id - right.id;
  });
}

// Cùng quy tắc với ProjectProgress.ActualPercent ở backend: tất cả task đều có trọng số bằng nhau.
export function getTaskProgress(tasks) {
  const completed = tasks.filter((task) => task.status === "COMPLETE").length;
  const total = tasks.length;
  const progressTotal = tasks.reduce((sum, task) => sum + (task.progress ?? 0), 0);
  return {
    completed,
    total,
    percent: total ? Math.round((progressTotal / total) * 10) / 10 : 0,
  };
}
