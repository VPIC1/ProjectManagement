import { departmentChartOptions, departmentChartRows } from "../../utils/dashboardChartOptions";
import { useMemo } from "react";
import { Empty, Tooltip } from "antd";
import useLanguage from "../../hooks/useLanguage";
import DashboardChart from "./DashboardChart";

export default function DashboardDepartments({ departments, year, onSelect }) {
  const { t, language } = useLanguage();
  const rows = useMemo(() => departmentChartRows(departments, language), [departments, language]);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const percentage = new Intl.NumberFormat(language === "zh" ? "zh-CN" : "vi-VN", {
    style: "percent",
    maximumFractionDigits: 1,
  });
  const options = useMemo(
    () => departmentChartOptions(rows, t, year, onSelect),
    [rows, t, year, onSelect],
  );
  return (
    <section className="flex min-w-0 flex-col rounded-lg border border-gray-300 bg-white p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{t("Dự án theo phòng ban đề xuất")}</h2>
        <span className="text-sm text-slate-500">{t("{count} dự án", { count: total })}</span>
      </div>
      {rows.length && total > 0 ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 items-center gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="relative min-h-72 min-w-0 xl:h-full xl:min-h-0 [&>.dashboard-apex-host]:absolute [&>.dashboard-apex-host]:inset-0 [&_.apexcharts-pie-area]:cursor-pointer">
            <DashboardChart options={options} label={t("Dự án theo phòng ban đề xuất")} />
          </div>
          <ul className="m-0 flex max-h-72 min-w-0 list-none xl:max-h-full flex-col gap-0 overflow-y-auto overscroll-contain p-0 pr-1">
            {rows.map((row) => {
              const label = row.name ?? t("Chưa gán phòng ban");
              return (
                <li className="shrink-0" key={row.id ?? "unassigned"}>
                  <button
                    type="button"
                    disabled={!(row.count > 0)}
                    onClick={() => {
                      if (row.count > 0) onSelect({ kind: "department", id: row.id, label, year });
                    }}
                    className="grid w-full grid-cols-[0.625rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors enabled:hover:bg-blue-50 disabled:cursor-default focus-visible:outline-2 focus-visible:outline-blue-500"
                  >
                    <i
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: row.color }}
                      aria-hidden="true"
                    />
                    <Tooltip title={label} placement="topLeft">
                      <span className="line-clamp-2 min-w-0 break-words text-sm text-gray-700">
                        {label}
                      </span>
                    </Tooltip>
                    <span className="flex items-baseline gap-2 tabular-nums">
                      <strong className="min-w-4 text-right text-sm font-semibold text-slate-800">
                        {row.count}
                      </strong>
                      <span className="min-w-12 text-right text-xs text-slate-500">
                        {percentage.format(row.count / total)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("Không có dự án")} />
      )}
    </section>
  );
}
