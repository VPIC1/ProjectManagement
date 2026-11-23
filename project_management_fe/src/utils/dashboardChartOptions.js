import { localizedText } from "./localizedContent.js";
// Pure presentation options shared by the live dashboard and PDF charts.
import { dueMonthRows } from "./dashboardDueMonths.js";

export function overviewChartOptions(summary, statuses, t, year, onSelect = () => {}) {
  return {
    chart: {
      type: "donut",
      height: "100%",
      fontFamily: "Roboto, sans-serif",
      toolbar: { show: false },
      animations: { enabled: false },
      events: {
        dataPointSelection: (_, __, point) => {
          const status = statuses[point.dataPointIndex];
          if (status?.count > 0)
            onSelect({ kind: "status", view: status.view, label: status.label, year });
        },
      },
    },
    series: statuses.map((status) => status.count),
    labels: statuses.map((status) => status.label),
    colors: statuses.map((status) => status.color),
    legend: { show: false },
    dataLabels: {
      enabled: true,
      formatter: (percent) => (percent > 8 ? `${Math.round(percent * 10) / 10}%` : ""),
      style: { fontSize: "14px", fontWeight: 600, colors: ["#fff"] },
      background: { enabled: false },
      dropShadow: { enabled: false },
    },
    stroke: { width: 2, colors: ["#fff"] },
    plotOptions: {
      pie: {
        expandOnClick: false,
        donut: {
          size: "56%",
          labels: {
            show: true,
            name: { show: true, fontSize: "13px" },
            value: { show: true, fontSize: "26px" },
            total: {
              show: true,
              showAlways: true,
              label: t("Tổng dự án"),
              fontSize: "13px",
              formatter: () => String(summary.total),
            },
          },
        },
      },
    },
    tooltip: { y: { formatter: (value) => t("{count} dự án", { count: value }) } },
  };
}

export function overviewChartRows(summary, t) {
  return [
    {
      view: "active-not-late",
      label: t("Đang thực hiện (chưa quá hạn)"),
      count: summary.pendingNotOverdue,
      color: "#3b82f6",
      dot: "bg-blue-500",
    },
    {
      view: "complete",
      label: t("Đã hoàn thành"),
      count: summary.complete,
      color: "#22c55e",
      dot: "bg-green-500",
    },
    {
      view: "hold-not-late",
      label: t("Đang chờ (chưa quá hạn)"),
      count: summary.holdNotOverdue,
      color: "#f59e0b",
      dot: "bg-amber-500",
    },
    {
      view: "cancel",
      label: t("Đã hủy"),
      count: summary.cancel,
      color: "#f87171",
      dot: "bg-red-400",
    },
    {
      view: "late",
      label: t("Quá hạn"),
      count: summary.overdue,
      color: "#ff4d4f",
      dot: "bg-red-500",
    },
  ];
}

export function departmentChartOptions(rows, t, year, onSelect = () => {}) {
  return {
    chart: {
      type: "pie",
      height: "100%",
      fontFamily: "Roboto, sans-serif",
      toolbar: { show: false },
      animations: { enabled: false },
      events: {
        dataPointSelection: (_, __, point) => {
          const row = rows[point.dataPointIndex];
          if (row?.count > 0)
            onSelect({
              kind: "department",
              id: row.id,
              label: row.name ?? t("Chưa gán phòng ban"),
              year,
            });
        },
      },
    },
    series: rows.map((row) => row.count),
    labels: rows.map((row) => row.name ?? t("Chưa gán phòng ban")),
    colors: rows.map((row) => row.color),
    legend: { show: false },
    dataLabels: {
      enabled: true,
      formatter: (percent) => (percent > 8 ? `${Math.round(percent * 10) / 10}%` : ""),
      style: { fontSize: "14px", fontWeight: 600, colors: ["#fff"] },
      background: { enabled: false },
      dropShadow: { enabled: false },
    },
    stroke: { width: 2, colors: ["#fff"] },
    plotOptions: { pie: { expandOnClick: false } },
    tooltip: { y: { formatter: (value) => t("{count} dự án", { count: value }) } },
  };
}

export function departmentChartRows(departments, language) {
  return [...departments]
    .sort(
      (a, b) =>
        b.count - a.count ||
        localizedText(a, "name", language).localeCompare(
          localizedText(b, "name", language),
          language === "zh" ? "zh-CN" : "vi-VN",
        ) ||
        (a.id ?? 0) - (b.id ?? 0),
    )
    .map((row, index, all) => ({
      ...row,
      name: localizedText(row, "name", language) || row.name,
      color: `hsl(217, 78%, ${Math.round(36 + (index / Math.max(1, all.length - 1)) * 42)}%)`,
    }));
}

export function trendChartOptions(months, t, year, onSelect = () => {}) {
  return {
    chart: {
      type: "bar",
      events: {
        click: (event, chart) => {
          const plot = chart.el.querySelector(".apexcharts-grid");
          if (!plot) return;
          const rect = plot.getBoundingClientRect();
          if (
            !rect.width ||
            event.clientX < rect.left ||
            event.clientX >= rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            return;
          const index = Math.floor(((event.clientX - rect.left) / rect.width) * months.length);
          const month = months[index];
          if (month && ((month.started ?? 0) > 0 || (month.actualCompleted ?? 0) > 0))
            onSelect({ kind: "month", year, month: month.month, series: "both" });
        },
        xAxisLabelClick: (_, __, point) => {
          const month = months[point.labelIndex];
          if (month && ((month.started ?? 0) > 0 || (month.actualCompleted ?? 0) > 0))
            onSelect({ kind: "month", year, month: month.month, series: "both" });
        },
      },
      height: "100%",
      parentHeightOffset: 0,
      redrawOnParentResize: true,
      fontFamily: "Roboto, sans-serif",
      toolbar: { show: false },
      animations: { enabled: false },
    },
    series: [
      { name: t("Số dự án bắt đầu"), data: months.map((item) => item.started) },
      {
        name: t("Số dự án hoàn thành"),
        data: months.map((item) => item.actualCompleted),
      },
    ],
    colors: ["#1677ff", "#52c41a"],
    plotOptions: { bar: { columnWidth: "60%", borderRadius: 2, dataLabels: { position: "top" } } },
    dataLabels: {
      enabled: true,
      formatter: (value) => (value > 0 ? String(value) : ""),
      offsetY: -22,
      style: { fontSize: "14px", colors: ["#475569"] },
      background: { enabled: false },
    },
    xaxis: {
      axisBorder: { show: true, color: "#cbd5e1" },
      axisTicks: { show: true, color: "#cbd5e1" },
      categories: months.map((item) => t("Tháng {month}", { month: item.month })),
      labels: {
        rotate: -45,
        rotateAlways: true,
        hideOverlappingLabels: false,
        style: { fontSize: "12px" },
      },
    },
    yaxis: {
      axisBorder: { show: true, color: "#cbd5e1" },
      axisTicks: { show: true, color: "#cbd5e1" },
      min: 0,
      max:
        Math.max(1, ...months.flatMap((item) => [item.started ?? 0, item.actualCompleted ?? 0])) +
        1,
      forceNiceScale: true,
      decimalsInFloat: 0,
      labels: {
        formatter: (value) => (Number.isInteger(value) ? String(value) : ""),
      },
    },
    grid: { show: false, padding: { top: 12 } },
    legend: { position: "top", horizontalAlign: "left", fontSize: "15px" },
    tooltip: {
      shared: true,
      intersect: false,
      y: {
        formatter: (value) =>
          value === null ? t("Chưa có thực tế") : t("{count} dự án", { count: value }),
      },
    },
  };
}

export function dueChartModel(months, year, today) {
  const rows = dueMonthRows(months, year, today);
  const max = Math.max(1, ...rows.map((month) => month.total));
  const step = Math.max(1, Math.ceil(max / 6));
  const ceiling = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step);
  return { rows, ceiling, ticks };
}
export function dueSegmentLabel(count, total, ceiling, percent) {
  return count / total > 0.08 && count / ceiling >= 0.08 ? percent.format(count / total) : "";
}
