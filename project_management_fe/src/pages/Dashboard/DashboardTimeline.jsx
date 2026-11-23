import { Empty, Tooltip } from "antd";
import dayjs from "dayjs";
import useLanguage from "../../hooks/useLanguage";
import { formatDate } from "../../utils/projectDetailUtils";

export default function DashboardTimeline({ projects, today, onOpenProject }) {
  const { t, content } = useLanguage();
  if (!projects.length)
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("Không có dự án")} />;

  const dates = [
    dayjs(today),
    ...projects.flatMap((project) =>
      [project.startDate, project.endDate, project.actualStartDate, project.actualEndDate]
        .filter(Boolean)
        .map((value) => dayjs(value)),
    ),
  ];
  const start = dates
    .reduce((earliest, date) => (date.isBefore(earliest) ? date : earliest))
    .subtract(7, "day");
  const end = dates.reduce((latest, date) => (date.isAfter(latest) ? date : latest)).add(7, "day");
  const days = end.diff(start, "day");
  const position = (date) => (dayjs(date).diff(start, "day") / days) * 100;
  const ticks = Array.from({ length: 7 }, (_, index) => ({
    date: start.add(Math.round((days * index) / 6), "day"),
    position: (index / 6) * 100,
  }));
  const todayPosition = position(today);
  const grid = (
    <>
      {ticks.map((tick, index) => (
        <span
          key={index}
          className="dashboard-timeline-gridline"
          style={{ left: `${tick.position}%` }}
        />
      ))}
      <span className="dashboard-timeline-today" style={{ left: `${todayPosition}%` }} />
    </>
  );

  function bar(from, until, color, label) {
    if (!from && !until) return <span className="text-[11px] text-gray-400">{label}</span>;
    const first = from ?? until;
    const last = until ?? from;
    const width = Math.max(((dayjs(last).diff(dayjs(first), "day") + 1) / days) * 100, 0.6);
    return (
      <Tooltip title={label}>
        <span
          className={`dashboard-timeline-bar ${color}`}
          style={{
            left: `${position(first)}%`,
            width: `${Math.min(width, 100 - position(first))}%`,
          }}
        />
      </Tooltip>
    );
  }

  return (
    <>
      <div className="dashboard-timeline-legend">
        <span className="flex items-center gap-1.5">
          <i className="h-2 w-4 rounded-sm bg-slate-300" />
          {t("Kế hoạch")}
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-2 w-4 rounded-sm bg-blue-500" />
          {t("Thực tế")}
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-3 border-l-2 border-dashed border-red-400" />
          {t("Hôm nay")}
        </span>
      </div>
      <div className="dashboard-timeline-scroll">
        <div className="dashboard-timeline" role="table" aria-label={t("Lịch dự án")}>
          <div className="dashboard-timeline-heading" role="row">
            <span role="columnheader">{t("Dự án")}</span>
            <div className="dashboard-timeline-axis" role="columnheader">
              {ticks.map((tick, index) => (
                <span
                  key={index}
                  className="absolute top-0 whitespace-nowrap text-[10px]"
                  style={{
                    left: `${tick.position}%`,
                    transform:
                      index === 6 ? "translateX(-100%)" : index ? "translateX(-50%)" : undefined,
                  }}
                >
                  {tick.date.format(days > 180 ? "MM/YYYY" : "DD/MM")}
                </span>
              ))}
              <span
                className="absolute bottom-1 rounded bg-red-50 px-1 text-[10px] text-red-600"
                style={{
                  left: `${todayPosition}%`,
                  transform: todayPosition > 80 ? "translateX(-100%)" : undefined,
                }}
              >
                {t("Hôm nay")} {formatDate(today)}
              </span>
            </div>
          </div>
          {projects.map((project) => {
            const running = project.status === "PENDING" || project.status === "HOLD";
            const actualEnd =
              project.actualEndDate ??
              (running && project.actualStartDate && !dayjs(project.actualStartDate).isAfter(today)
                ? today
                : null);
            const late = running && project.endDate && dayjs(project.endDate).isBefore(today);
            const plannedLabel = `${t("Kế hoạch")}: ${formatDate(project.startDate)} – ${formatDate(project.endDate)}`;
            const actualLabel = `${t("Thực tế")}: ${formatDate(project.actualStartDate)} – ${project.actualEndDate ? formatDate(project.actualEndDate) : running && actualEnd ? t("Hôm nay") : "—"}`;
            return (
              <div key={project.id} className="dashboard-timeline-row" role="row">
                <div className="dashboard-timeline-name" role="cell">
                  <button
                    className="dashboard-project-code cursor-pointer"
                    type="button"
                    onClick={() => onOpenProject(project.id)}
                  >
                    {project.projectCode}
                  </button>
                  <Tooltip title={content(project, "projectName")}>
                    <span className="line-clamp-2 text-xs text-gray-700">
                      {content(project, "projectName")}
                    </span>
                  </Tooltip>
                </div>
                <div className="dashboard-timeline-lanes" role="cell">
                  {grid}
                  <div className="relative h-6" aria-label={plannedLabel}>
                    {bar(
                      project.startDate,
                      project.endDate,
                      "bg-slate-300",
                      project.startDate || project.endDate
                        ? plannedLabel
                        : t("Chưa có lịch dự kiến"),
                    )}
                  </div>
                  <div className="relative h-6" aria-label={actualLabel}>
                    {bar(
                      project.actualStartDate,
                      actualEnd,
                      late ? "bg-red-400" : "bg-blue-500",
                      project.actualStartDate || project.actualEndDate
                        ? actualLabel
                        : t("Chưa có thời gian thực tế"),
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
