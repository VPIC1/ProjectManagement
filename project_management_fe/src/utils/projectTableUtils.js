import { DEFAULT_PROJECT_QUERY } from "../constants/projectConstants.js";

export function getProjectTableQuery(current, pagination, sorter, action, filters = {}) {
  if (action === "filter") {
    return {
      ...current,
      pageNumber: 1,
      status: filters.status?.length ? filters.status : undefined,
      managerCodes: filters.manager?.length ? filters.manager : undefined,
    };
  }
  if (action === "sort") {
    const selected = Array.isArray(sorter) ? sorter.find((item) => item.order) : sorter;
    return {
      ...current,
      pageNumber: 1,
      sortBy: selected?.order ? selected.field : DEFAULT_PROJECT_QUERY.sortBy,
      sortDirection: selected?.order
        ? selected.order === "ascend"
          ? "asc"
          : "desc"
        : DEFAULT_PROJECT_QUERY.sortDirection,
    };
  }
  const pageSize = pagination.pageSize ?? current.pageSize;
  return {
    ...current,
    pageNumber: pageSize !== current.pageSize ? 1 : (pagination.current ?? 1),
    pageSize,
  };
}
