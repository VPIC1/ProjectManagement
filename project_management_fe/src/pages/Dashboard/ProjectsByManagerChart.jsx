import useLanguage from "../../hooks/useLanguage";
import { Alert, Empty, Pagination } from "antd";
import { useEffect, useRef, useState } from "react";
import { UNASSIGNED_MANAGER } from "../../utils/dashboardData";

const PEOPLE_PER_PAGE = 10;

const SERIES = [
  { name: "Đang thực hiện", field: "pendingProjects", color: "#1677ff" },
  { name: "Đã hoàn thành", field: "completeProjects", color: "#52c41a" },
  { name: "Đang chờ", field: "holdProjects", color: "#faad14" },
  { name: "Đã hủy", field: "cancelProjects", color: "#ff4d4f" },
];

export default function ProjectsByManagerChart({ managers, page, onPageChange, onSelectManager }) {
  const { t } = useLanguage();
  const host = useRef(null);
  const [error, setError] = useState(null);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(managers.length / PEOPLE_PER_PAGE)));

  useEffect(() => {
    if (!managers.length) return;
    let current = true;
    let chart;
    const draw = async () => {
      try {
        const { default: ApexCharts } = await import("apexcharts");
        if (!current) return;
        const rows = managers.slice(
          (currentPage - 1) * PEOPLE_PER_PAGE,
          currentPage * PEOPLE_PER_PAGE,
        );
        chart = new ApexCharts(host.current, {
          chart: {
            type: "bar",
            stacked: true,
            height: 456,
            fontFamily: "Roboto, sans-serif",
            toolbar: { show: false },
            animations: { enabled: false },
            events: {
              dataPointSelection: (_event, _context, config) => {
                const row = rows[config.dataPointIndex];
                if (row) onSelectManager(row.userCode ?? UNASSIGNED_MANAGER);
              },
            },
          },
          series: SERIES.map(({ name, field }) => ({
            name: t(name),
            data: rows.map((row) => row[field]),
          })),
          colors: SERIES.map((series) => series.color),
          plotOptions: {
            bar: {
              horizontal: true,
              barHeight: "55%",
              borderRadius: 3,
              dataLabels: {
                total: {
                  enabled: true,
                  style: { fontSize: "12px", fontWeight: 500 },
                },
              },
            },
          },
          dataLabels: { enabled: false },
          xaxis: {
            categories: rows.map((row) =>
              row.userCode
                ? row.userName
                  ? `${row.userCode} - ${row.userName}`
                  : row.userCode
                : t("Chưa phân công"),
            ),
            min: 0,
            max: Math.max(1, ...managers.map((row) => row.totalProjects)) + 1,
            decimalsInFloat: 0,
            tickAmount: Math.min(5, Math.max(1, ...managers.map((row) => row.totalProjects)) + 1),
            labels: {
              formatter: (value) => (Number.isInteger(Number(value)) ? String(value) : ""),
            },
          },
          yaxis: { labels: { maxWidth: 215, style: { fontSize: "12px" } } },
          legend: { show: false },
          tooltip: {
            shared: true,
            intersect: false,
            y: { formatter: (value) => t("{count} dự án", { count: value }) },
          },
          grid: {
            borderColor: "#e5e7eb",
            padding: { left: 0, right: 20, top: -10, bottom: -10 },
          },
          states: { active: { allowMultipleDataPointsSelection: false } },
          noData: { text: t("Không có dự án trong khoảng ngày đã chọn") },
          responsive: [
            {
              breakpoint: 480,
              options: {
                yaxis: {
                  labels: { maxWidth: 135, style: { fontSize: "11px" } },
                },
              },
            },
          ],
        });
        await chart.render();
      } catch {
        if (current) setError(t("Không thể hiển thị biểu đồ. Vui lòng tải lại trang."));
      }
    };
    // oxlint-disable-next-line react/set-state-in-effect -- Resets chart errors for a changed page or dataset.
    setError(null);
    void draw();
    return () => {
      current = false;
      chart?.destroy();
    };
  }, [managers, currentPage, t, onSelectManager]);

  return (
    <>
      <div className="dashboard-legend">
        {SERIES.map((series) => (
          <span key={series.field}>
            <i style={{ backgroundColor: series.color }} />
            {t(series.name)}
          </span>
        ))}
      </div>
      {error ? (
        <Alert type="error" showIcon title={error} />
      ) : managers.length ? (
        <div
          ref={host}
          className="dashboard-chart"
          role="region"
          aria-label={t("Biểu đồ số dự án theo người phụ trách, sắp xếp giảm dần")}
        />
      ) : (
        <div className="dashboard-empty">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("Không tìm thấy nhân viên")} />
        </div>
      )}
      <div className="dashboard-chart-footer">
        <span>
          {t("{from}–{to} / {total} người", {
            from: managers.length ? (currentPage - 1) * PEOPLE_PER_PAGE + 1 : 0,
            to: Math.min(currentPage * PEOPLE_PER_PAGE, managers.length),
            total: managers.length,
          })}
        </span>
        <Pagination
          size="small"
          simple
          current={currentPage}
          pageSize={PEOPLE_PER_PAGE}
          total={managers.length}
          showSizeChanger={false}
          onChange={onPageChange}
        />
      </div>
      <p className="dashboard-footnote">
        {t("Một dự án có nhiều người phụ trách được tính cho từng người.")}
      </p>
    </>
  );
}
