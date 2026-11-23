import dayjs from "dayjs";

export function chartProjectQuery(selection, page, today) {
  if (selection.kind === "due")
    return {
      endpoint: "dashboard",
      params: {
        year: selection.year,
        dueMonth: selection.month,
        dueStatus: selection.group,
        projectPage: page,
        projectPageSize: 20,
      },
    };
  if (selection.kind === "status")
    return {
      endpoint: "dashboard",
      params: {
        year: selection.year,
        view: selection.view,
        projectPage: page,
        projectPageSize: 20,
      },
    };
  if (selection.kind === "department")
    return {
      endpoint: "dashboard",
      params: {
        year: selection.year,
        view: "all",
        departmentId: selection.id ?? 0,
        projectPage: page,
        projectPageSize: 20,
      },
    };
  if (selection.series === "both")
    return {
      endpoint: "projects",
      params: {
        activityYear: selection.year,
        activityMonth: selection.month,
        pageNumber: page,
        pageSize: 20,
        sortBy: "startDate",
        sortDirection: "asc",
      },
    };
  const start = dayjs(`${selection.year}-${String(selection.month).padStart(2, "0")}-01`);
  const end = start.endOf("month").format("YYYY-MM-DD");
  return {
    endpoint: "projects",
    params: {
      pageNumber: page,
      pageSize: 20,
      sortBy: selection.series === "started" ? "startDate" : "actualEndDate",
      sortDirection: "asc",
      ...(selection.series === "started"
        ? { startDateFrom: start.format("YYYY-MM-DD"), startDateTo: end }
        : {
            status: ["COMPLETE"],
            actualEndDateFrom: start.format("YYYY-MM-DD"),
            actualEndDateTo: end < today ? end : today,
          }),
    },
  };
}
