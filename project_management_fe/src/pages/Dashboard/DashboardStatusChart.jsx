import { useMemo } from "react";
import { Empty } from "antd";
import useLanguage from "../../hooks/useLanguage";
import useProjectStatusOptions from "../../hooks/useProjectStatusOptions";
import DashboardChart from "./DashboardChart";

const COLORS = ["#1677ff", "#52c41a", "#faad14", "#ff4d4f"];
export default function DashboardStatusChart({ summary }) {
  const { t } = useLanguage();
  const statuses = useProjectStatusOptions();
  const values = useMemo(
    () => [summary.pending, summary.complete, summary.hold, summary.cancel],
    [summary],
  );
  const options = useMemo(
    () => ({
      chart: {
        type: "donut",
        height: 250,
        fontFamily: "Roboto, sans-serif",
        animations: { enabled: false },
        toolbar: { show: false },
      },
      series: values,
      labels: statuses.map((s) => s.label),
      colors: COLORS,
      stroke: { width: 3, colors: ["#fff"] },
      dataLabels: { enabled: false },
      legend: { show: false },
      plotOptions: {
        pie: {
          donut: {
            size: "73%",
            labels: {
              show: true,
              name: { show: true },
              value: { fontSize: "28px", fontWeight: 600 },
              total: {
                show: true,
                showAlways: true,
                label: t("Tổng dự án"),
                formatter: () => String(summary.total),
              },
            },
          },
        },
      },
      tooltip: {
        y: { formatter: (value) => t("{count} dự án", { count: value }) },
      },
    }),
    [statuses, values, summary.total, t],
  );
  return (
    <section className="dashboard-panel">
      <div className="dashboard-panel-heading">
        <h2>{t("Trạng thái dự án")}</h2>
      </div>
      {summary.total ? (
        <DashboardChart options={options} label={t("Trạng thái dự án")} />
      ) : (
        <div className="dashboard-chart-empty">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("Không có dự án")} />
        </div>
      )}
      <div className="dashboard-status-legend">
        {statuses.map((status, index) => (
          <div key={status.value}>
            <span>
              <i className="dashboard-dot" style={{ backgroundColor: COLORS[index] }} />
              {status.label}
            </span>
            <strong>{values[index]}</strong>
          </div>
        ))}
      </div>
      <p className="dashboard-footnote">
        {t("Dự án đang mở và dự án kết thúc trong năm đã chọn.")}
      </p>
    </section>
  );
}
