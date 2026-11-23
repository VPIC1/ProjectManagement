import { overviewChartOptions, overviewChartRows } from "../../utils/dashboardChartOptions";
import { useMemo } from "react";
import { Tooltip } from "antd";
import useLanguage from "../../hooks/useLanguage";
import DashboardChart from "./DashboardChart";

export default function DashboardOverview({ summary, year, onSelect }) {
  const { t, language } = useLanguage();
  const percentage = new Intl.NumberFormat(language === "zh" ? "zh-CN" : "vi-VN", {
    style: "percent",
    maximumFractionDigits: 1,
  });
  const statuses = useMemo(() => overviewChartRows(summary, t), [summary, t]);
  const options = useMemo(
    () => overviewChartOptions(summary, statuses, t, year, onSelect),
    [statuses, summary, t, year, onSelect],
  );
  function legendRow(label, count, dot, view) {
    return (
      <button
        type="button"
        disabled={!(count > 0)}
        onClick={() => {
          if (count > 0) onSelect({ kind: "status", view, label, year });
        }}
        className="grid w-full grid-cols-[0.5rem_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-md px-2 py-1.5 text-left enabled:hover:bg-blue-50 disabled:cursor-default focus-visible:outline-2 focus-visible:outline-blue-500"
      >
        <i className={`size-2 rounded-full ${dot}`} aria-hidden="true" />
        <span className="text-sm text-slate-700">{label}</span>
        <strong className="min-w-5 text-right text-base font-semibold tabular-nums text-slate-800">
          {count}
        </strong>
        <span className="min-w-12 text-right text-xs tabular-nums text-slate-500">
          {percentage.format(summary.total ? count / summary.total : 0)}
        </span>
      </button>
    );
  }
  return (
    <section
      className="flex h-full min-w-0 flex-col rounded-lg border border-gray-300 bg-white p-3"
      aria-label={t("Trạng thái dự án")}
    >
      <h2 className="mb-3 shrink-0 text-base font-semibold">{t("Tổng quan dự án")}</h2>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-3">
        <div className="relative h-full min-h-72 min-w-0 xl:min-h-0 [&>.dashboard-apex-host]:absolute [&>.dashboard-apex-host]:inset-0 [&_.apexcharts-pie-area]:cursor-pointer">
          {summary.total > 0 ? (
            <DashboardChart options={options} label={t("Trạng thái dự án")} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="flex aspect-square w-full max-w-44 flex-col items-center justify-center rounded-full border-12 border-gray-100">
                <span className="text-xs text-slate-500">{t("Tổng dự án")}</span>
                <strong className="text-2xl font-semibold">0</strong>
              </div>
            </div>
          )}
          <button
            type="button"
            disabled={!(summary.total > 0)}
            aria-label={t("Tổng dự án")}
            onClick={() => {
              if (summary.total > 0)
                onSelect({ kind: "status", view: "all", label: t("Tổng dự án"), year });
            }}
            className="absolute left-1/2 top-1/2 z-1 aspect-square w-[min(56%,7rem)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-transparent disabled:cursor-default focus-visible:outline-2 focus-visible:outline-blue-500"
          />
        </div>
        <div className="max-h-full min-w-0 overflow-y-auto overscroll-contain pr-1">
          {statuses
            .filter((status) => status.view !== "late")
            .map((status) => (
              <div key={status.label}>
                {legendRow(status.label, status.count, status.dot, status.view)}
              </div>
            ))}
          <Tooltip
            title={t(
              "Dự án quá hạn được tách khỏi nhóm đang thực hiện và đang chờ để không đếm trùng.",
            )}
          >
            <div className="mt-1 border-t border-gray-200 pt-1">
              {legendRow(t("Quá hạn"), summary.overdue, "bg-red-500", "late")}
            </div>
          </Tooltip>
        </div>
      </div>
    </section>
  );
}
