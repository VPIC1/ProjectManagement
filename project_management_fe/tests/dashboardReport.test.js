import test from "node:test";
import assert from "node:assert/strict";
import {
  dashboardReportHtml,
  loadDashboardReport,
  dashboardReportAttention,
  bilingualDashboardReportHtml,
} from "../src/utils/dashboardReport.js";

const report = () => ({
  year: 2026,
  today: "2026-11-16",
  dataUpdatedAt: "2026-11-16T01:00:00Z",
  overview: {
    total: 1,
    pendingNotOverdue: 1,
    complete: 0,
    holdNotOverdue: 0,
    cancel: 0,
    overdue: 0,
  },
  departments: [{ name: "IT", count: 1 }],
  months: Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    started: i === 9 ? 1 : 0,
    actualCompleted: i > 10 ? null : 0,
  })),
  dueMonths: [],
  projects: {
    totalCount: 1,
    items: [
      {
        id: 1,
        projectCode: "IT2611001",
        projectNameVi: '<script>alert("x")</script>',
        projectNameZh: "中文项目",
        plannedProgressPercent: null,
        progressPercent: 0,
        status: "PENDING",
      },
    ],
    hasNextPage: false,
  },
});

test("PDF report fetches every annual page, ignoring dashboard status tabs and loaded rows", async () => {
  const calls = [];
  const result = await loadDashboardReport(
    async (filters, config) => {
      calls.push(filters);
      assert.equal(config.timeout, 30000);
      const response = report();
      response.projects = {
        totalCount: 3,
        items: filters.projectPage === 1 ? [{ id: 1 }, { id: 2 }] : [{ id: 3 }],
        hasNextPage: filters.projectPage === 1,
      };
      return response;
    },
    2026,
    { timeout: 30000 },
  );
  assert.deepEqual(
    result.projects.items.map((p) => p.id),
    [1, 2, 3],
  );
  assert.deepEqual(
    calls.map((c) => c.projectPage),
    [1, 2],
  );
  assert.ok(calls.every((c) => c.year === 2026 && c.view === "all" && c.projectPageSize === 50));
});

test("PDF report rejects incomplete, duplicate or changing results instead of silently losing rows", async () => {
  for (const variant of ["incomplete", "duplicate", "changed"]) {
    await assert.rejects(
      loadDashboardReport(async (filters) => {
        const result = report();
        result.projects.totalCount = 2;
        result.projects.hasNextPage = true;
        result.projects.items =
          filters.projectPage === 1
            ? [{ id: 1 }]
            : variant === "incomplete"
              ? []
              : [{ id: variant === "duplicate" ? 1 : 2 }];
        if (variant === "changed" && filters.projectPage === 2)
          result.dataUpdatedAt = "2026-11-16T02:00:00Z";
        return result;
      }, 2026),
    );
  }
});

test("Empty annual PDF report finishes in one request and displays an empty state", async () => {
  let calls = 0;
  const data = await loadDashboardReport(async () => {
    calls++;
    const r = report();
    r.projects = { items: [], totalCount: 0, hasNextPage: false };
    return r;
  }, 2026);
  assert.equal(calls, 1);
  assert.match(dashboardReportHtml(data), /Không có dự án/);
});

test("PDF HTML escapes project content, uses selected language and preserves unknown planned progress", () => {
  const vi = dashboardReportHtml(report(), "vi");
  assert.ok(!vi.includes("<script>"));
  assert.match(vi, /&lt;script&gt;/);
  assert.match(vi, /A4 landscape/);
  assert.match(vi, /display:table-header-group/);
  assert.match(vi, /Kế hoạch<\/span>.*?<span>—<\/span>/);
  assert.match(vi, /UTC\+07:00/);
  const zh = dashboardReportHtml(report(), "zh");
  assert.match(zh, /中文项目/);
  assert.match(zh, /lang="zh-CN"/);
  assert.ok(!zh.includes("&lt;script&gt;"));
});

test("Report attention follows dashboard open statuses and inclusive seven-day calendar window", () => {
  const data = report();
  data.today = "2026-12-30";
  data.projects.items = [
    { id: 1, status: "PENDING", endDate: "2026-12-29" },
    { id: 2, status: "HOLD", endDate: "2026-12-28" },
    { id: 3, status: "COMPLETE", endDate: "2026-12-01" },
    { id: 4, status: "CANCEL", endDate: "2026-12-01" },
    { id: 5, status: "PENDING", endDate: "2026-12-30" },
    { id: 6, status: "HOLD", endDate: "2027-01-06" },
    { id: 7, status: "PENDING", endDate: "2027-01-07" },
    { id: 8, status: "PENDING", endDate: null },
  ];
  const attention = dashboardReportAttention(data);
  assert.deepEqual(
    attention.late.map((row) => [row.project.id, row.days]),
    [
      [2, -2],
      [1, -1],
    ],
  );
  assert.deepEqual(
    attention.soon.map((row) => [row.project.id, row.days]),
    [
      [5, 0],
      [6, 7],
    ],
  );
});

test("PDF includes full overdue and due-soon lists, even when they exceed dashboard page size", () => {
  const data = report();
  data.projects.items = Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    projectCode: `ATT${i}`,
    projectNameVi: `Việc ${i}`,
    projectNameZh: `项目${i}`,
    status: i === 7 ? "COMPLETE" : "HOLD",
    endDate: i < 6 ? "2026-11-15" : "2026-11-16",
    progressPercent: 10,
    plannedProgressPercent: 20,
  }));
  const html = dashboardReportHtml(data, "vi");
  const attention = html.slice(html.indexOf("data-report-attention"), html.indexOf("<footer>"));
  assert.match(attention, /Dự án cần chú ý/);
  assert.match(attention, /7 dự án/);
  for (let i = 0; i < 7; i++) assert.ok(attention.includes(`ATT${i}`));
  assert.ok(!attention.includes("ATT7"));
  assert.match(attention, /Đến hạn hôm nay/);
  assert.match(attention, /Quá hạn 1 ngày/);
});

test("Short stacked bars are rounded at their actual end, and bilingual PDF puts Chinese first", () => {
  const data = report();
  data.dueMonths = [
    { year: 2026, month: 10, complete: 2, overdue: 1, notOverdue: 0, total: 3 },
    { year: 2026, month: 11, complete: 0, overdue: 1, notOverdue: 3, total: 4 },
  ];
  const html = dashboardReportHtml(data);
  assert.match(html, /class="due-track" style="width:75%"/);
  assert.match(html, /\.due-track\{[^}]*border-radius:4px;overflow:hidden/);
  const bilingual = bilingualDashboardReportHtml(data);
  assert.ok(
    bilingual.indexOf('data-report-language="zh"') < bilingual.indexOf('data-report-language="vi"'),
  );
  assert.match(bilingual, /中文项目/);
  assert.match(bilingual, /项目总览报告/);
  assert.match(bilingual, /BÁO CÁO TỔNG QUAN DỰ ÁN/);
  assert.equal((bilingual.match(/data-report-attention/g) ?? []).length, 2);
});

test("Report due-month scale and percentage labels follow shared dashboard rules", () => {
  const data = report();
  data.dueMonths = [{ year: 2026, month: 10, complete: 10, overdue: 1, notOverdue: 2, total: 13 }];
  const html = dashboardReportHtml(data, "vi");
  // Dashboard scale: max 13, step 3, ceiling 15. Small slices keep their color but hide the label.
  assert.ok(html.includes('class="due-track" style="width:86.66666666666667%"'));
  assert.match(html, />76,9%<\/span>/);
  assert.match(html, />15,4%<\/span>/);
  assert.ok(!html.includes(">7,7%</span>"));
  assert.match(html, /class="due-axis"/);
});

test("Both PDF versions embed their own dashboard chart markup and shared chart styling", () => {
  const html = bilingualDashboardReportHtml(report(), {
    css: ".apexcharts-legend{display:flex}",
    fontUrl: "https://localhost/font.ttf",
    zh: {
      overview: '<svg data-test="zh-donut"></svg>',
      departments: '<svg data-test="zh-pie"></svg>',
      trend: '<div data-test="zh-trend">中文图例</div>',
    },
    vi: {
      overview: '<svg data-test="vi-donut"></svg>',
      departments: '<svg data-test="vi-pie"></svg>',
      trend: '<div data-test="vi-trend">Chú giải</div>',
    },
  });
  for (const key of ["zh-donut", "zh-pie", "zh-trend", "vi-donut", "vi-pie", "vi-trend"])
    assert.ok(html.includes(`data-test="${key}"`));
  assert.ok(html.indexOf("zh-donut") < html.indexOf("vi-donut"));
  assert.match(html, /\.apexcharts-legend\{display:flex\}/);
  assert.match(html, /font-face/);
});
