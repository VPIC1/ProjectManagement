import { Button, Empty, Pagination, Tooltip } from "antd";
import { useEffect, useState } from "react";
import useLanguage from "../../hooks/useLanguage";
import { getProjectDashboard } from "../../utils/endpoint";
import { getRequestError } from "../../utils/projectDetailUtils";
import { daysUntil } from "../../utils/dashboardInsights";

export default function DashboardAttention({
  data,
  summary,
  today,
  onPageChange,
  onOpenProject,
  year,
  refresh,
  columns = false,
}) {
  const { t, content } = useLanguage();
  const [soon, setSoon] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await getProjectDashboard(
          { year, attention: "soon", attentionPage: page },
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) setSoon(result.attention);
      } catch (e) {
        if (!controller.signal.aborted) setError(getRequestError(e));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    // oxlint-disable-next-line react/set-state-in-effect -- Independently paginate due-soon alerts, retaining overdue alerts.
    void load();
    return () => controller.abort();
  }, [year, page, refresh, retry]);
  return (
    <div
      className={
        columns
          ? "grid h-full min-h-0 min-w-0 grid-cols-1 gap-3 p-0.5 sm:grid-cols-2"
          : "flex min-w-0 flex-col gap-3 p-0.5"
      }
    >
      {[
        ["late", data, summary.overdue],
        ["soon", soon, summary.dueSoon],
      ].map(([mode, group, count]) => (
        <section
          key={mode}
          className={
            columns
              ? "flex min-h-0 min-w-0 flex-col sm:[&+section]:border-l sm:[&+section]:border-gray-200 sm:[&+section]:pl-3"
              : "min-w-0 [&+section]:border-t [&+section]:border-gray-200 [&+section]:pt-3"
          }
        >
          <div
            className={`flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2 ${mode === "late" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"}`}
          >
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <i
                className={`size-2 rounded-full ${mode === "late" ? "bg-red-500" : "bg-amber-500"}`}
                aria-hidden="true"
              />
              {t(mode === "late" ? "Dự án quá hạn" : "Dự án sắp đến hạn")}
            </h2>
            <span className="text-sm font-semibold tabular-nums">
              {t("{count} dự án", { count })}
            </span>
          </div>
          <div className={columns ? "min-h-0 flex-1 overflow-y-auto overscroll-contain" : ""}>
            {mode === "soon" && loading ? (
              <p className="text-sm text-slate-500">{t("Đang tải...")}</p>
            ) : mode === "soon" && error ? (
              <div role="alert">
                {error}
                <Button size="small" onClick={() => setRetry((n) => n + 1)}>
                  {t("Thử lại")}
                </Button>
              </div>
            ) : group?.items.length ? (
              group.items.map((project) => (
                <div
                  className="border-b border-gray-100 px-3 py-3 last:border-b-0 [&>div]:mb-1 [&>div]:flex [&>div]:justify-between [&>div]:gap-2 [&>div]:text-sm"
                  key={project.id}
                >
                  <div>
                    <button
                      type="button"
                      className="inline-flex cursor-pointer items-center rounded px-1 -ml-1 text-left text-sm font-medium text-red-600 underline decoration-red-300 underline-offset-2 transition-colors hover:bg-red-50 hover:text-red-700 hover:decoration-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-default"
                      onClick={() => onOpenProject(project.id)}
                    >
                      {project.projectCode}
                    </button>
                    <span className={mode === "late" ? "text-red-500" : "text-amber-600"}>
                      {mode === "late"
                        ? t("Quá hạn {days} ngày", { days: -daysUntil(project, today) })
                        : daysUntil(project, today) === 0
                          ? t("Đến hạn hôm nay")
                          : t("Còn {days} ngày", { days: daysUntil(project, today) })}
                    </span>
                  </div>
                  <Tooltip title={content(project, "projectName")}>
                    <span className="line-clamp-2 w-full min-w-0 break-words text-left text-sm font-normal text-gray-800">
                      {content(project, "projectName")}
                    </span>
                  </Tooltip>
                </div>
              ))
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={t("Không có dự án cần chú ý")}
              />
            )}
          </div>
          {group && group.totalCount > group.pageSize && (
            <Pagination
              className="px-3 py-2"
              size="small"
              current={group.pageNumber}
              total={group.totalCount}
              pageSize={group.pageSize}
              showSizeChanger={false}
              onChange={mode === "late" ? onPageChange : setPage}
            />
          )}
        </section>
      ))}
    </div>
  );
}
