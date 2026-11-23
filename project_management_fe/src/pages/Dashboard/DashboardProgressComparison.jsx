import { Empty, Pagination, Progress, Tooltip } from "antd";
import useLanguage from "../../hooks/useLanguage";
import { formatDate } from "../../utils/projectDetailUtils";

export default function DashboardProgressComparison({ data, today, onOpenProject, onPageChange }) {
  const { t, content } = useLanguage();
  return (
    <section className="dashboard-panel">
      <div className="dashboard-panel-heading">
        <h2>{t("Tiến độ kế hoạch và thực tế")}</h2>
        <span className="dashboard-unit">{formatDate(today)}</span>
      </div>
      <div className="dashboard-timeline-legend">
        <Tooltip
          title={t(
            "Kế hoạch là trung bình tiến độ dự kiến của toàn bộ công việc theo ngày bắt đầu và kết thúc của từng việc.",
          )}
        >
          <span className="flex items-center gap-1.5">
            <i className="h-2 w-4 rounded-sm bg-slate-300" />
            {t("Kế hoạch")}
          </span>
        </Tooltip>
        <Tooltip title={t("Thực tế là trung bình tiến độ các công việc.")}>
          <span className="flex items-center gap-1.5">
            <i className="h-2 w-4 rounded-sm bg-blue-500" />
            {t("Thực tế")}
          </span>
        </Tooltip>
      </div>
      {data.items.length ? (
        data.items.map((project) => {
          const planned = project.plannedProgressPercent;
          const actual = project.progressPercent;
          const delta = planned == null ? null : Math.round((actual - planned) * 10) / 10;
          return (
            <div
              key={project.id}
              className="grid grid-cols-1 items-center gap-3 border-b border-gray-100 py-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_3.5rem]"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <button
                  type="button"
                  className="dashboard-project-code cursor-pointer"
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
              <div className="min-w-0">
                {planned == null ? (
                  <span className="block py-1 text-[11px] text-gray-400">
                    {t(project.status === "CANCEL" ? "Đã hủy" : "Chưa đủ ngày dự kiến")}
                  </span>
                ) : (
                  <Progress
                    aria-label={t("Kế hoạch")}
                    percent={planned}
                    size={[-1, 8]}
                    strokeColor="#94a3b8"
                    status="normal"
                  />
                )}
                <Progress
                  aria-label={t("Thực tế")}
                  percent={actual}
                  size={[-1, 8]}
                  strokeColor="#1677ff"
                  status="normal"
                />
              </div>
              <Tooltip
                title={
                  delta == null
                    ? t("Chênh lệch")
                    : t("Chênh lệch {value} điểm phần trăm", { value: delta })
                }
              >
                <span
                  className={`text-right text-xs font-medium tabular-nums ${delta < 0 ? "text-red-500" : delta > 0 ? "text-green-600" : "text-gray-500"}`}
                >
                  {delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta}%`}
                </span>
              </Tooltip>
            </div>
          );
        })
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("Không có dự án")} />
      )}
      {data.totalCount > 0 && (
        <div className="dashboard-pagination">
          <Pagination
            align="end"
            size="small"
            current={data.pageNumber}
            pageSize={data.pageSize}
            total={data.totalCount}
            showSizeChanger={false}
            onChange={onPageChange}
            showTotal={(total, range) =>
              t("{from}–{to} / {total} dự án", {
                from: range[0],
                to: range[1],
                total,
              })
            }
          />
        </div>
      )}
    </section>
  );
}
