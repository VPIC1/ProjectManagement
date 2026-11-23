import { trendChartOptions } from "../../utils/dashboardChartOptions";
import { useMemo } from "react";
import useLanguage from "../../hooks/useLanguage";
import DashboardChart from "./DashboardChart";

export default function DashboardTrendChart({ months, year, onSelect }) {
  const { t } = useLanguage();
  const options = useMemo(
    () => trendChartOptions(months, t, year, onSelect),
    [months, t, year, onSelect],
  );
  return (
    <section className="min-w-0 rounded-lg border border-gray-300 bg-white p-3 flex flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">
          {t("Số dự án bắt đầu và hoàn thành theo tháng")}
        </h2>
        <span className="text-sm text-slate-500">{year}</span>
      </div>
      <div className="[&_.apexcharts-svg]:!cursor-pointer [&_.apexcharts-svg_*]:!cursor-pointer relative min-h-72 min-w-0 flex-1 [&>.dashboard-apex-host]:absolute [&>.dashboard-apex-host]:inset-0">
        <DashboardChart options={options} label={t("Số dự án bắt đầu và hoàn thành theo tháng")} />
      </div>
    </section>
  );
}
