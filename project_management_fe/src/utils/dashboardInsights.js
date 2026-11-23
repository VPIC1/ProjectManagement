import dayjs from "dayjs";

export const isOpen = (item) => item.status === "PENDING" || item.status === "HOLD";
export function daysUntil(item, today) {
  return item.endDate
    ? dayjs(item.endDate).startOf("day").diff(dayjs(today).startOf("day"), "day")
    : null;
}
export function projectIssues(project, tasks, today) {
  const remaining = tasks.filter(isOpen);
  const overdue = remaining.filter(
    (task) => daysUntil(task, today) !== null && daysUntil(task, today) < 0,
  );
  const unassigned = remaining.filter((task) => !task.pic?.trim());
  const soon = remaining.filter(
    (task) =>
      daysUntil(task, today) !== null && daysUntil(task, today) >= 0 && daysUntil(task, today) <= 7,
  );
  const prioritized = remaining
    .filter((task) => overdue.includes(task) || unassigned.includes(task) || soon.includes(task))
    .sort(
      (a, b) =>
        Number(overdue.includes(b)) - Number(overdue.includes(a)) ||
        Number(unassigned.includes(b)) - Number(unassigned.includes(a)) ||
        (a.endDate ?? "9999").localeCompare(b.endDate ?? "9999") ||
        a.id - b.id,
    );
  return {
    remaining,
    overdue,
    unassigned,
    soon,
    prioritized,
    completed: tasks.filter((task) => task.status === "COMPLETE").length,
    overdueDays: isOpen(project) && daysUntil(project, today) < 0 ? -daysUntil(project, today) : 0,
  };
}

export function timelineScale(projects, today) {
  const dates = [
    dayjs(today),
    ...projects
      .flatMap((p) => [p.startDate, p.endDate, p.actualStartDate, p.actualEndDate])
      .filter(Boolean)
      .map((d) => dayjs(d))
      .filter((d) => d.isValid()),
  ];
  const start = dates.reduce((a, b) => (b.isBefore(a) ? b : a)).subtract(3, "day");
  const end = dates.reduce((a, b) => (b.isAfter(a) ? b : a)).add(3, "day");
  const duration = Math.max(end.diff(start, "day"), 1);
  const position = (date) =>
    Math.max(0, Math.min(100, (dayjs(date).diff(start, "day") / duration) * 100));
  return {
    start,
    end,
    duration,
    position,
    ticks: Array.from({ length: 5 }, (_, i) => start.add(Math.round((duration * i) / 4), "day")),
  };
}

// Read all server pages for the selected portfolio; never depend on a fixed API page size.
export async function fetchCompleteDashboard(request, filters, config = {}) {
  const result = await request({ ...filters, projectPage: 1, projectPageSize: 50 }, config);
  const unique = new Map(result.projects.items.map((project) => [project.id, project]));
  const pages =
    result.projects.totalPages ?? Math.ceil(result.projects.totalCount / result.projects.pageSize);
  for (let page = 2; page <= pages; page += 1) {
    if (config.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const next = await request({ ...filters, projectPage: page, projectPageSize: 50 }, config);
    for (const project of next.projects.items) unique.set(project.id, project);
  }
  return { ...result, projects: { ...result.projects, items: [...unique.values()] } };
}

// Equal-width calendar months; interpolate days inside each individual month.
export function monthlyTimelineScale(projects, today, year) {
  const dates = [
    dayjs(today),
    ...projects
      .flatMap((p) => [p.startDate, p.endDate, p.actualStartDate, p.actualEndDate])
      .filter(Boolean)
      .map((d) => dayjs(d))
      .filter((d) => d.isValid()),
  ];
  const start = year
    ? dayjs(`${year}-01-01`)
    : dates.reduce((a, b) => (b.isBefore(a) ? b : a)).startOf("month");
  const last = year
    ? dayjs(`${year}-12-01`)
    : dates.reduce((a, b) => (b.isAfter(a) ? b : a)).startOf("month");
  const count = (last.year() - start.year()) * 12 + last.month() - start.month() + 1;
  const months = Array.from({ length: count }, (_, i) => start.add(i, "month"));
  const position = (value) => {
    const d = dayjs(value);
    const month = (d.year() - start.year()) * 12 + d.month() - start.month();
    return Math.max(0, Math.min(100, ((month + (d.date() - 1) / d.daysInMonth()) / count) * 100));
  };
  return { months, position };
}
