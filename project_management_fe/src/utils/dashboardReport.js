import { localizedText } from "./localizedContent.js";
import {
  departmentChartRows,
  dueChartModel,
  dueSegmentLabel,
  overviewChartRows,
} from "./dashboardChartOptions.js";
import { translate } from "../locales/translate.js";
import { daysUntil, isOpen } from "./dashboardInsights.js";

// Fetch every page independently of the dashboard's loaded rows and status tab.
export async function loadDashboardReport(request, year, config = {}) {
  let report;
  const projects = new Map();
  for (let page = 1; ; page++) {
    const result = await request(
      { year, view: "all", projectPage: page, projectPageSize: 50 },
      config,
    );
    const batch = result.projects;
    if (
      !batch ||
      !Array.isArray(batch.items) ||
      !Number.isInteger(batch.totalCount) ||
      batch.totalCount < 0
    )
      throw new Error("Invalid report response");
    if (!report) report = result;
    if (
      result.year !== year ||
      batch.totalCount !== report.projects.totalCount ||
      result.dataUpdatedAt !== report.dataUpdatedAt
    )
      throw new Error("Report data changed; retry");
    for (const project of batch.items) {
      if (projects.has(project.id)) throw new Error("Duplicate report row; retry");
      projects.set(project.id, project);
    }
    if (projects.size === batch.totalCount)
      return { ...report, projects: { ...report.projects, items: [...projects.values()] } };
    if (!batch.items.length || projects.size > batch.totalCount || !batch.hasNextPage)
      throw new Error("Incomplete report; retry");
  }
}

// Same open statuses, inclusive seven-day window and ordering as the dashboard.
// All project pages have already been loaded, so neither attention column is truncated.
export function dashboardReportAttention(data) {
  const rows = data.projects.items
    .filter((project) => isOpen(project) && project.endDate)
    .map((project) => ({ project, days: daysUntil(project, data.today) }))
    .filter((row) => Number.isFinite(row.days))
    .sort(
      (a, b) => a.project.endDate.localeCompare(b.project.endDate) || a.project.id - b.project.id,
    );
  return {
    late: rows.filter((row) => row.days < 0),
    soon: rows.filter((row) => row.days >= 0 && row.days <= 7),
  };
}

export function escapeReportText(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
  );
}

const copies = {
  vi: {
    title: "BÁO CÁO TỔNG QUAN DỰ ÁN",
    year: "Năm báo cáo",
    updated: "Dữ liệu cập nhật đến",
    today: "Ngày báo cáo",
    total: "Tổng dự án",
    active: "Đang thực hiện (chưa quá hạn)",
    complete: "Đã hoàn thành",
    hold: "Đang chờ (chưa quá hạn)",
    cancel: "Đã hủy",
    late: "Quá hạn",
    status: "Trạng thái dự án",
    departments: "Dự án theo phòng ban đề xuất",
    unassigned: "Chưa gán phòng ban",
    trend: "Xu hướng dự án theo tháng",
    started: "Dự án bắt đầu",
    actualCompleted: "Hoàn thành thực tế",
    due: "Tình hình xử lý theo tháng đến hạn",
    open: "Chưa quá hạn",
    attention: "Dự án cần chú ý",
    overdueProjects: "Dự án quá hạn",
    soonProjects: "Dự án sắp đến hạn",
    projects: "dự án",
    noAttention: "Không có dự án cần chú ý",
    lateDays: (days) => `Quá hạn ${days} ngày`,
    remainingDays: (days) => `Còn ${days} ngày`,
    dueToday: "Đến hạn hôm nay",
    list: "Danh sách dự án",
    code: "Mã dự án",
    name: "Tên dự án",
    progress: "Tiến độ",
    planned: "Kế hoạch",
    actual: "Thực tế",
    plannedDates: "Ngày dự kiến",
    actualDates: "Ngày thực tế",
    empty: "Không có dự án",
    print: "Lưu PDF / In báo cáo",
    close: "Đóng",
    instruction: "Chọn “Lưu dưới dạng PDF” trong hộp thoại in.",
    pendingStatus: "Đang thực hiện",
    holdStatus: "Đang chờ",
    footer: "Phòng Công nghệ thông tin · VPIC1",
    note: "Báo cáo gồm toàn bộ dự án thuộc năm đã chọn, không phụ thuộc tab trạng thái hoặc số dòng đã tải trên dashboard.",
  },
  zh: {
    title: "项目总览报告",
    year: "报告年度",
    updated: "数据更新至",
    today: "报告日期",
    total: "项目总数",
    active: "进行中（未逾期）",
    complete: "已完成",
    hold: "等待中（未逾期）",
    cancel: "已取消",
    late: "逾期",
    status: "项目状态",
    departments: "按申请部门统计项目",
    unassigned: "未分配部门",
    trend: "项目月度趋势",
    started: "开始项目",
    actualCompleted: "实际完成",
    due: "按到期月份统计处理情况",
    open: "未逾期",
    attention: "需关注的项目",
    overdueProjects: "逾期项目",
    soonProjects: "即将到期的项目",
    projects: "个项目",
    noAttention: "没有需要关注的项目",
    lateDays: (days) => `逾期 ${days} 天`,
    remainingDays: (days) => `剩余 ${days} 天`,
    dueToday: "今天到期",
    list: "项目列表",
    code: "项目编号",
    name: "项目名称",
    progress: "进度",
    planned: "计划",
    actual: "实际",
    plannedDates: "计划日期",
    actualDates: "实际日期",
    empty: "没有项目",
    print: "保存 PDF / 打印报告",
    close: "关闭",
    instruction: "请在打印对话框中选择“另存为 PDF”。",
    pendingStatus: "进行中",
    holdStatus: "等待中",
    footer: "信息技术部 · VPIC1",
    note: "报告包含所选年度的全部项目，不受仪表板状态标签或已加载行数影响。",
  },
};

export function dashboardReportHtml(data, language = "vi", charts = {}) {
  const t = (key, values) => translate(key, values, language);
  const l = copies[language] ?? copies.vi;
  const e = escapeReportText;
  const number = new Intl.NumberFormat(language === "zh" ? "zh-CN" : "vi-VN", {
    maximumFractionDigits: 1,
  });
  const pct = (value) => (value == null ? "—" : `${number.format(value)}%`);
  const date = (value) =>
    /^\d{4}-\d{2}-\d{2}/.test(value ?? "")
      ? value.slice(0, 10).split("-").reverse().join("/")
      : "—";
  const period = (start, end) => `${date(start)} – ${date(end)}`;
  const updatedDate = data.dataUpdatedAt ? new Date(data.dataUpdatedAt) : null;
  const updated =
    updatedDate && !Number.isNaN(updatedDate.getTime())
      ? new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Ho_Chi_Minh",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(updatedDate)
      : "—";
  const total = data.overview.total;
  const statuses = overviewChartRows(data.overview, t).map((row) => [
    row.label,
    row.count,
    row.color,
  ]);
  let offset = 0;
  const arcs = statuses
    .map(([, count, color]) => {
      const size = total ? (count / total) * 100 : 0;
      const arc = `<circle cx="70" cy="70" r="52" fill="none" stroke="${color}" stroke-width="23" pathLength="100" stroke-dasharray="${size} ${100 - size}" stroke-dashoffset="${-offset}" transform="rotate(-90 70 70)"/>`;
      offset += size;
      return arc;
    })
    .join("");
  const donut =
    charts.overview ??
    `<svg viewBox="0 0 140 140" class="donut" role="img" aria-label="${e(l.status)}"><circle cx="70" cy="70" r="52" fill="none" stroke="#e5e7eb" stroke-width="23"/>${arcs}<text x="70" y="72" text-anchor="middle" font-size="28" font-weight="bold" fill="#0f172a">${total}</text><text x="70" y="91" text-anchor="middle" font-size="10" fill="#64748b">${e(l.total)}</text></svg>`;
  const statusLegend = statuses
    .map(
      ([label, count, color]) =>
        `<div class="legend-row"><span><i style="background:${color}"></i>${e(label)}</span><strong>${count}</strong><span class="muted">${pct(total ? (count / total) * 100 : 0)}</span></div>`,
    )
    .join("");
  const departments = departmentChartRows(data.departments, language);
  const departmentTotal = departments.reduce((sum, row) => sum + row.count, 0);
  const departmentRows = departments
    .map(
      (row) =>
        `<div class="department-legend"><i style="background:${row.color}"></i><span>${e(row.name ?? t("Chưa gán phòng ban"))}</span><strong>${row.count}</strong><span class="muted">${pct(departmentTotal ? (row.count / departmentTotal) * 100 : 0)}</span></div>`,
    )
    .join("");
  let pieOffset = 0;
  const pieStops = departments
    .map((row) => {
      const start = pieOffset;
      pieOffset += departmentTotal ? (row.count / departmentTotal) * 100 : 0;
      return `${row.color} ${start}% ${pieOffset}%`;
    })
    .join(",");
  const departmentPie =
    charts.departments ??
    `<div class="fallback-pie" style="background:conic-gradient(${pieStops || "#e5e7eb 0% 100%"})"></div>`;
  const legend = (groups) =>
    `<div class="chart-legend">${groups.map(([label, color]) => `<span><i style="background:${color}"></i>${e(label)}</span>`).join("")}</div>`;
  const maxTrend = Math.max(
    1,
    ...data.months.flatMap((row) => [row.started ?? 0, row.actualCompleted ?? 0]),
  );
  const ceiling = Math.max(1, Math.ceil(maxTrend / 4)) * 4;
  const grid = Array.from({ length: 5 }, (_, i) => {
    const y = 155 - i * 32;
    return `<line x1="26" x2="492" y1="${y}" y2="${y}" stroke="#e2e8f0"/><text x="20" y="${y + 3}" text-anchor="end" font-size="9" fill="#64748b">${(ceiling * i) / 4}</text>`;
  }).join("");
  const bars = data.months
    .map((row, index) => {
      const x = 32 + index * 38;
      return (
        [
          [row.started, "#1677ff", 0],
          [row.actualCompleted, "#22a84a", 13],
        ]
          .map(([value, color, dx]) =>
            value == null
              ? ""
              : `<rect x="${x + dx}" y="${155 - (value / ceiling) * 128}" width="11" height="${(value / ceiling) * 128}" rx="2" fill="${color}"/>${value > 0 ? `<text x="${x + dx + 5.5}" y="${150 - (value / ceiling) * 128}" text-anchor="middle" font-size="9">${value}</text>` : ""}`,
          )
          .join("") +
        `<text x="${x + 11}" y="174" text-anchor="middle" font-size="10" fill="#475569">${row.month}</text>`
      );
    })
    .join("");
  const trend =
    charts.trend ??
    `<svg class="trend" viewBox="0 0 505 185" role="img" aria-label="${e(l.trend)}">${grid}${bars}</svg>`;
  const {
    rows: dueRows,
    ceiling: dueCeiling,
    ticks: dueTicks,
  } = dueChartModel(data.dueMonths, data.year, data.today);
  const percentage = new Intl.NumberFormat(language === "zh" ? "zh-CN" : "vi-VN", {
    style: "percent",
    maximumFractionDigits: 1,
  });
  const due = dueRows
    .map(
      (row) =>
        `<div class="due-row"><span>${String(row.month).padStart(2, "0")}/${row.year ?? data.year}</span><div class="due-area"><div class="due-track" style="width:${(row.total / dueCeiling) * 100}%">${[
          [row.complete, "oklch(72.3% 0.219 149.579)", "white"],
          [row.overdue, "oklch(63.7% 0.237 25.331)", "white"],
          [row.notOverdue, "oklch(88.2% 0.059 254.128)", "#162456"],
        ]
          .map(([value, color, textColor]) =>
            value > 0
              ? `<span style="background:${color};color:${textColor};width:${(value / row.total) * 100}%">${dueSegmentLabel(value, row.total, dueCeiling, percentage)}</span>`
              : "",
          )
          .join(
            "",
          )}</div></div><span class="due-total"><strong>${row.total}</strong> <small>${e(l.projects)}</small></span></div>`,
    )
    .join("");
  const dueAxis = `<div class="due-axis"><span></span><div>${dueTicks.map((tick) => `<span style="left:${(tick / dueCeiling) * 100}%">${tick}</span>`).join("")}</div><span>${e(t("Dự án"))}</span></div>`;
  const attention = dashboardReportAttention(data);
  const attentionGroup = (mode, title, rows) =>
    `<section class="attention-group ${mode}"><h3><span>${e(title)}</span><span>${rows.length} ${e(l.projects)}</span></h3>${rows.length ? rows.map(({ project, days }) => `<article class="attention-item"><div><strong>${e(project.projectCode)}</strong><span>${e(mode === "attention-late" ? l.lateDays(-days) : days === 0 ? l.dueToday : l.remainingDays(days))}</span></div><p>${e(localizedText(project, "projectName", language))}</p></article>`).join("") : `<p class="muted attention-empty">${e(l.noAttention)}</p>`}</section>`;
  const attentionHtml = `<section class="panel attention-panel" data-report-attention><h2>${e(l.attention)} <span class="muted">· ${attention.late.length + attention.soon.length} ${e(l.projects)}</span></h2><div class="attention-columns">${attentionGroup("attention-late", l.overdueProjects, attention.late)}${attentionGroup("attention-soon", l.soonProjects, attention.soon)}</div></section>`;
  const statusNames = {
    PENDING: l.pendingStatus,
    COMPLETE: l.complete,
    HOLD: l.holdStatus,
    CANCEL: l.cancel,
  };
  const projects = data.projects.items
    .map((project) => {
      const late =
        ["PENDING", "HOLD"].includes(project.status) &&
        project.endDate &&
        project.endDate < data.today;
      const name = localizedText(project, "projectName", language);
      const progress = (label, value, color) =>
        `<div class="progress-row"><span>${e(label)}</span><div class="track"><b style="background:${color};width:${Math.max(0, Math.min(100, value ?? 0))}%"></b></div><span>${pct(value)}</span></div>`;
      return `<tr><td class="code">${e(project.projectCode)}</td><td>${e(name)}</td><td><span class="status ${late ? "late" : ""}">${e(statusNames[project.status] ?? project.status)}</span>${late ? `<div class="late">${e(l.late)}</div>` : ""}</td><td>${progress(l.planned, project.plannedProgressPercent, "#94a3b8")}${progress(l.actual, project.progressPercent, project.status === "COMPLETE" ? "#22a84a" : "#1677ff")}</td><td>${e(period(project.startDate, project.endDate))}</td><td>${e(period(project.actualStartDate, project.actualEndDate))}</td></tr>`;
    })
    .join("");
  return `<!doctype html><html lang="${language === "zh" ? "zh-CN" : "vi"}"><head><meta charset="utf-8"><title>VPIC1 - ${e(l.title)} - ${data.year}</title><style>
  @page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font-family:Roboto,Arial,"Microsoft YaHei","Microsoft JhengHei",sans-serif;margin:0;color:#0f172a;font-size:11px;line-height:1.45;background:#e2e8f0}main{max-width:1120px;margin:20px auto;padding:28px;background:white}h1{font-size:23px;margin:3px 0 8px}h2{font-size:14px;margin:0 0 14px}p{margin:4px 0}.muted{color:#64748b}.brand{font-weight:bold;letter-spacing:2px;color:#dc2626}header{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #334155;padding-bottom:14px;margin-bottom:18px}.meta{text-align:right;font-size:10px;white-space:nowrap}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.panel{border:1px solid #cbd5e1;border-radius:8px;padding:16px;break-inside:avoid;margin-bottom:16px}.status-content{display:grid;grid-template-columns:185px minmax(0,1fr);gap:12px;align-items:center}.donut{width:185px;height:190px}.report-chart>svg{display:block;max-width:100%}.report-chart.pie-chart{display:flex;align-items:center;justify-content:center;min-height:190px}.fallback-pie{width:165px;height:165px;border:2px solid white;border-radius:50%}.department-legend{display:grid;grid-template-columns:8px minmax(0,1fr) 22px 43px;gap:7px;align-items:center;margin:10px 0}.department-legend strong,.department-legend>.muted{text-align:right}.report-panel-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:14px}.report-panel-head h2{margin:0}.report-panel-head>span{color:#64748b;font-size:10px;white-space:nowrap}.report-trend{min-height:200px}.legend-row{display:grid;grid-template-columns:1fr 30px 48px;gap:8px;margin:10px 0}.legend-row>span:first-child{display:flex;align-items:center;gap:7px}i{display:inline-block;width:8px;height:8px;border-radius:2px;flex-shrink:0}.dept{display:grid;grid-template-columns:minmax(0,1fr) 100px 24px 46px;align-items:center;gap:9px;margin:10px 0;break-inside:avoid}.dept>strong,.dept>.muted{text-align:right}.track{height:7px;border-radius:9px;background:#eef2f6;overflow:hidden}.track b{display:block;height:100%;border-radius:9px;background:#1677ff}.chart-legend{display:flex;flex-wrap:wrap;gap:14px;color:#475569;font-size:10px;margin-bottom:10px}.chart-legend span{display:flex;gap:5px;align-items:center}.trend{display:block;width:100%;height:auto}.due-plot{min-height:190px;display:flex;flex-direction:column;justify-content:center;position:relative}.due-rows{position:relative}.due-rows:before{content:"";position:absolute;left:72px;top:0;bottom:0;border-left:1px solid #e2e8f0}.due-row{position:relative;display:grid;grid-template-columns:62px 1fr 48px;gap:10px;align-items:center;margin:18px 0}.due-total{text-align:right;white-space:nowrap}.due-total small{font-size:9px;color:#64748b}.due-axis{display:grid;grid-template-columns:62px 1fr 48px;gap:10px;color:#64748b;font-size:9px}.due-axis>div{position:relative;height:22px;border-top:1px solid #cbd5e1}.due-axis>div>span{position:absolute;top:4px;transform:translateX(-50%)}.due-axis>span:last-child{text-align:right}.due-track{display:flex;height:28px;border-radius:4px;overflow:hidden}.due-track span{flex-shrink:0;text-align:center;line-height:28px;font-weight:bold;color:#0f172a}.attention-panel{margin-top:18px}.attention-columns{display:grid;grid-template-columns:1fr 1fr;gap:16px}.attention-group+section{border-left:1px solid #e2e8f0;padding-left:16px}.attention-group h3{display:flex;justify-content:space-between;gap:12px;margin:0 0 5px;padding:9px 10px;border-radius:5px;font-size:11px;break-after:avoid}.attention-late h3{background:#fff1f2;color:#dc2626}.attention-soon h3{background:#fffbeb;color:#d97706}.attention-item{padding:10px;border-bottom:1px solid #eef2f6;break-inside:avoid}.attention-item:last-child{border-bottom:0}.attention-item>div{display:flex;justify-content:space-between;gap:12px;margin-bottom:5px}.attention-item strong{color:#dc2626;text-decoration:underline}.attention-late .attention-item>div>span{color:#dc2626}.attention-soon .attention-item>div>span{color:#d97706}.attention-item p{overflow-wrap:anywhere}.attention-empty{padding:10px}.project-section{break-before:page}.project-section h2{margin-bottom:5px}table{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:14px;font-size:10px}thead{display:table-header-group}th{background:#f1f5f9;text-align:left;border-bottom:1px solid #94a3b8;padding:9px 7px}td{padding:10px 7px;border-bottom:1px solid #e2e8f0;vertical-align:top;overflow-wrap:anywhere}tr{break-inside:avoid}th:nth-child(1){width:10%}th:nth-child(2){width:29%}th:nth-child(3){width:12%}th:nth-child(4){width:23%}th:nth-child(5),th:nth-child(6){width:13%}.code{font-weight:bold;color:#1d4ed8}.progress-row{display:grid;grid-template-columns:50px 1fr 42px;align-items:center;gap:6px;margin:0 0 4px}.progress-row>span:first-child{white-space:nowrap}.progress-row>span:last-child{text-align:right;white-space:nowrap}.status{font-weight:bold}.late{color:#dc2626}footer{margin-top:18px;border-top:1px solid #cbd5e1;padding-top:8px;text-align:center;color:#64748b;font-size:10px}.toolbar{position:sticky;top:0;padding:12px 20px;background:#0f172a;color:white;display:flex;gap:12px;align-items:center;z-index:1}.toolbar button{padding:8px 14px;border:1px solid #cbd5e1;border-radius:5px;background:white;cursor:pointer}.toolbar span{margin-left:auto}@media print{body{background:white}main{max-width:none;padding:0;margin:0}.toolbar{display:none}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}.panel{box-shadow:none}.project-section{margin-top:0}}
  </style></head><body><div class="toolbar"><button data-print>${e(l.print)}</button><button data-close>${e(l.close)}</button><span>${e(l.instruction)}</span></div><main>
  <header><div><div class="brand">VPIC1 · IT PROJECT</div><h1>${e(l.title)}</h1><p>${e(l.year)}: <strong>${data.year}</strong></p></div><div class="meta"><p>${e(l.today)}: ${e(date(data.today))}</p><p>${e(l.updated)}: ${e(updated)} (UTC+07:00)</p></div></header>
  <div class="grid"><section class="panel"><h2>${e(t("Tổng quan dự án"))}</h2><div class="status-content"><div class="report-chart pie-chart">${donut}</div><div>${statusLegend}</div></div></section><section class="panel"><div class="report-panel-head"><h2>${e(t("Dự án theo phòng ban đề xuất"))}</h2><span>${departmentTotal} ${e(l.projects)}</span></div>${departmentTotal ? `<div class="status-content"><div class="report-chart pie-chart">${departmentPie}</div><div>${departmentRows}</div></div>` : `<p class="muted">${e(l.empty)}</p>`}</section></div>
  <div class="grid"><section class="panel"><div class="report-panel-head"><h2>${e(t("Số dự án bắt đầu và hoàn thành theo tháng"))}</h2><span>${data.year}</span></div><div class="report-chart report-trend">${
    charts.trend
      ? trend
      : legend([
          [t("Số dự án bắt đầu"), "#1677ff"],
          [t("Số dự án hoàn thành"), "#52c41a"],
        ]) + trend
  }</div></section><section class="panel"><div class="report-panel-head"><h2>${e(l.due)}</h2><span>${data.year}</span></div>${legend(
    [
      [l.complete, "oklch(72.3% 0.219 149.579)"],
      [l.late, "oklch(63.7% 0.237 25.331)"],
      [l.open, "oklch(88.2% 0.059 254.128)"],
    ],
  )}<div class="due-plot">${dueRows.length ? `<div class="due-rows">${due}</div>${dueAxis}` : `<p class="muted">${e(l.empty)}</p>`}</div></section></div>
  <section class="project-section"><h2>${e(l.list)} · ${data.projects.items.length}</h2><p class="muted">${e(l.note)}</p><table><thead><tr>${[l.code, l.name, l.status, l.progress, l.plannedDates, l.actualDates].map((label) => `<th>${e(label)}</th>`).join("")}</tr></thead><tbody>${projects || `<tr><td colspan="6">${e(l.empty)}</td></tr>`}</tbody></table></section>
  ${attentionHtml}
  <footer>${e(l.footer)} · ${data.year}</footer></main></body></html>`;
}

// One printable file: Chinese first, Vietnamese second. Both sections use the
// very same loaded data and the same layout, including all attention projects.
export function bilingualDashboardReportHtml(data, charts = {}) {
  const zh = dashboardReportHtml(data, "zh", charts.zh);
  const vi = dashboardReportHtml(data, "vi", charts.vi);
  const main = (html) => html.match(/<main>([\s\S]*?)<\/main>/)[1];
  const style =
    (charts.css ?? "") +
    zh.match(/<style>([\s\S]*?)<\/style>/)[1] +
    (charts.fontUrl
      ? `@font-face{font-family:Roboto;src:url("${charts.fontUrl}") format("truetype");font-weight:100 900;font-display:block}`
      : "");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>VPIC1 - 项目总览报告 / Báo cáo tổng quan dự án - ${data.year}</title><style>${style}main+main{break-before:page}</style></head><body><div class="toolbar"><button data-print>保存 PDF / Lưu PDF</button><button data-close>关闭 / Đóng</button><span>另存为 PDF / Chọn “Lưu dưới dạng PDF”</span></div><main lang="zh-CN" data-report-language="zh">${main(zh)}</main><main lang="vi" data-report-language="vi">${main(vi)}</main></body></html>`;
}

// Keep the preview available after canceling print, allowing the user to retry or close it.
export async function showDashboardReport(reportWindow, data) {
  if (reportWindow.closed) return;
  const { renderDashboardReportCharts } = await import("./dashboardReportCharts.js");
  const charts = await renderDashboardReportCharts(data);
  if (reportWindow.closed) return;
  reportWindow.document.open();
  reportWindow.document.write(bilingualDashboardReportHtml(data, charts));
  reportWindow.document.close();
  const print = () => {
    if (!reportWindow.closed) {
      reportWindow.focus();
      reportWindow.print();
    }
  };
  reportWindow.document.querySelector("[data-print]").addEventListener("click", print);
  reportWindow.document
    .querySelector("[data-close]")
    .addEventListener("click", () => reportWindow.close());
  await reportWindow.document.fonts.ready;
  if (reportWindow.closed) return;
  await new Promise((resolve) =>
    reportWindow.requestAnimationFrame(() => reportWindow.requestAnimationFrame(resolve)),
  );
  print();
}
