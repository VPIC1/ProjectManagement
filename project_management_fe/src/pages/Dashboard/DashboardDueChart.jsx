import { Empty, Tooltip } from "antd";
import useLanguage from "../../hooks/useLanguage";
import { dueChartModel, dueSegmentLabel } from "../../utils/dashboardChartOptions";

export default function DashboardDueChart({ months = [], year, today, onSelect }) {
  const { t, language } = useLanguage();
  const { rows, ceiling, ticks } = dueChartModel(months, year, today);
  const percent = new Intl.NumberFormat(language === "zh" ? "zh-CN" : "vi-VN", {
    style: "percent",
    maximumFractionDigits: 1,
  });
  const groups = [
    {
      key: "complete",
      field: "complete",
      label: t("Đã hoàn thành"),
      color: "bg-green-500",
      text: "text-white",
    },
    { key: "late", field: "overdue", label: t("Quá hạn"), color: "bg-red-500", text: "text-white" },
    {
      key: "open",
      field: "notOverdue",
      label: t("Chưa quá hạn"),
      color: "bg-blue-200",
      text: "text-blue-950",
    },
  ];
  return (
    <section className="flex min-w-0 flex-col rounded-lg border border-gray-300 bg-white p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{t("Tình hình xử lý theo tháng đến hạn")}</h2>
        <span className="text-sm text-slate-500">{year}</span>
      </div>
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-700">
        {groups.map((group) => (
          <span key={group.key} className="flex items-center gap-1.5">
            <i aria-hidden="true" className={`size-2.5 rounded-sm ${group.color}`} />
            {group.label}
          </span>
        ))}
      </div>
      {rows.length ? (
        <div className="flex min-h-56 flex-1 flex-col justify-center py-3">
          <div className="relative flex flex-col gap-6">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-6 left-18 top-0 border-l border-gray-200 sm:left-21"
            />
            {rows.map((month) => (
              <div
                key={`${month.year ?? year}-${month.month}`}
                className="grid grid-cols-[4rem_minmax(0,1fr)_4rem] items-center gap-2 sm:grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] sm:gap-3"
              >
                <span className="text-sm font-normal tabular-nums text-gray-700">
                  {String(month.month).padStart(2, "0")}/{month.year ?? year}
                </span>
                <div className="flex h-9 min-w-0">
                  <div
                    className="flex h-full min-w-0 overflow-hidden rounded-md"
                    style={{ width: `${(month.total / ceiling) * 100}%` }}
                  >
                    {groups.map((group) => {
                      const count = month[group.field];
                      if (!(count > 0)) return null;
                      const label = `${group.label}: ${t("{count} dự án", { count })} (${percent.format(count / month.total)})`;
                      return (
                        <Tooltip key={group.key} title={label}>
                          <button
                            type="button"
                            aria-label={`${String(month.month).padStart(2, "0")}/${month.year ?? year} · ${label}`}
                            className={`h-full min-w-0 cursor-pointer text-[14px] font-semibold tabular-nums transition-[filter] hover:brightness-110 focus-visible:z-1 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-700 ${group.color} ${group.text}`}
                            style={{ width: `${(count / month.total) * 100}%` }}
                            onClick={() =>
                              onSelect({
                                kind: "due",
                                year: month.year ?? year,
                                month: month.month,
                                group: group.key,
                                label: group.label,
                              })
                            }
                          >
                            {dueSegmentLabel(count, month.total, ceiling, percent)}
                          </button>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
                <span className="text-right text-sm tabular-nums">
                  <strong className="font-semibold text-slate-800">{month.total}</strong>{" "}
                  <span className="text-xs text-slate-500">{t("dự án")}</span>
                </span>
              </div>
            ))}
            <div
              aria-hidden="true"
              className="grid grid-cols-[4rem_minmax(0,1fr)_4rem] gap-2 text-xs text-slate-500 sm:grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] sm:gap-3"
            >
              <span />
              <div className="relative h-6 border-t border-gray-200">
                {ticks.map((tick) => (
                  <span
                    key={tick}
                    className="absolute top-1 -translate-x-1/2 tabular-nums"
                    style={{ left: `${(tick / ceiling) * 100}%` }}
                  >
                    {tick}
                  </span>
                ))}
              </div>
              <span className="text-right">{t("Dự án")}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-56 flex-1 items-center justify-center">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("Không có dự án")} />
        </div>
      )}
    </section>
  );
}
