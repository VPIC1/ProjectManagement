import { translate } from "../locales/translate.js";
import {
  overviewChartOptions,
  overviewChartRows,
  departmentChartRows,
  departmentChartOptions,
  trendChartOptions,
} from "./dashboardChartOptions.js";

// Render the same ApexCharts options used by the dashboard into static SVGs.
// Temporary hosts stay outside the visible layout and are always destroyed.
export async function renderDashboardReportCharts(data) {
  const { default: ApexCharts } = await import("apexcharts");
  await document.fonts.ready;
  const result = {
    fontUrl: new URL("../assets/fonts/Roboto-VariableFont_wdth,wght.ttf", import.meta.url).href,
  };
  async function draw(options, width, height) {
    if (["pie", "donut"].includes(options.chart.type)) {
      // Print pies are narrower than screen charts. Fit the percentages to the
      // ring thickness; only solid pies can move inward without entering a hole.
      options = {
        ...options,
        dataLabels: {
          ...options.dataLabels,
          style: { ...options.dataLabels.style, fontSize: "11px" },
        },
        plotOptions: {
          ...options.plotOptions,
          pie: {
            ...options.plotOptions.pie,
            dataLabels: {
              ...options.plotOptions.pie.dataLabels,
              offset: options.chart.type === "pie" ? -8 : 0,
            },
          },
        },
      };
    }
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    Object.assign(host.style, {
      position: "fixed",
      left: "-10000px",
      top: "0",
      width: `${width}px`,
      height: `${height}px`,
      opacity: "0",
      pointerEvents: "none",
    });
    document.body.appendChild(host);
    let chart;
    try {
      chart = new ApexCharts(host, {
        ...options,
        chart: {
          ...options.chart,
          width,
          height,
          parentHeightOffset: 0,
          redrawOnWindowResize: false,
          redrawOnParentResize: false,
          animations: { enabled: false },
          events: {},
        },
      });
      await chart.render();
      const svg = host.querySelector("svg.apexcharts-svg");
      if (!svg) throw new Error("Report chart failed to render");
      // ApexCharts keeps the legend beside the SVG inside its canvas wrapper.
      // Preserve both so the printed chart includes the same series legend.
      const canvas = host.querySelector(".apexcharts-canvas").cloneNode(true);
      canvas
        .querySelectorAll(
          ".apexcharts-tooltip,.apexcharts-xaxistooltip,.apexcharts-yaxistooltip,.apexcharts-toolbar",
        )
        .forEach((node) => node.remove());
      return canvas.outerHTML;
    } finally {
      chart?.destroy();
      host.remove();
    }
  }
  for (const language of ["zh", "vi"]) {
    const t = (key, values) => translate(key, values, language);
    const departments = departmentChartRows(data.departments, language);
    result[language] = {
      overview:
        data.overview.total > 0
          ? await draw(
              overviewChartOptions(
                data.overview,
                overviewChartRows(data.overview, t),
                t,
                data.year,
              ),
              185,
              190,
            )
          : null,
      departments: departments.some((row) => row.count > 0)
        ? await draw(departmentChartOptions(departments, t, data.year), 185, 190)
        : null,
      trend: await draw(trendChartOptions(data.months, t, data.year), 470, 200),
    };
  }
  result.css = document.querySelector("#apexcharts-css")?.textContent ?? "";
  return result;
}
