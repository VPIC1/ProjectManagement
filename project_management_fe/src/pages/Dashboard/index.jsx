import { getProjectDashboard } from "../../utils/endpoint";
import { loadDashboardReport, showDashboardReport } from "../../utils/dashboardReport";
import DashboardNotificationPanel from "./DashboardNotificationPanel";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Spin, message } from "antd";
import dayjs from "dayjs";
import useLanguage from "../../hooks/useLanguage";
import ProjectUsersProvider from "../../contexts/ProjectUsersProvider";
import ProjectDetailModal from "../Project/ProjectDetailModal";
import useInfiniteDashboard from "../../hooks/useInfiniteDashboard";
import { getRequestError } from "../../utils/projectDetailUtils";
import DashboardChartProjects from "./DashboardChartProjects";
import DashboardOverview from "./DashboardOverview";
import DashboardHeader from "./DashboardHeader";
import DashboardProjectDrawer from "./DashboardProjectDrawer";
import DashboardProjectList from "./DashboardProjectList";
import DashboardTrendChart from "./DashboardTrendChart";
import DashboardDepartments from "./DashboardDepartments";
import DashboardDueChart from "./DashboardDueChart";

// Trang điều phối dữ liệu và modal. Nghiệp vụ truy vấn nằm trong hook/utils, biểu đồ ở component riêng.
function DashboardContent() {
  const { t } = useLanguage();
  const [notice, holder] = message.useMessage();
  const [year, setYear] = useState(() => dayjs().year());
  const [view, setView] = useState("active");
  const [retry, setRetry] = useState(0);
  const [projectId, setProjectId] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [chartSelection, setChartSelection] = useState(null);

  const { data, loading, error, loadingMore, moreError, hasMore, loadMore } = useInfiniteDashboard(
    year,
    view,
    1,
    retry,
  );

  const [exportingPdf, setExportingPdf] = useState(false);
  const reportController = useRef(null);
  useEffect(() => () => reportController.current?.abort(), []);

  async function exportPdf() {
    if (reportController.current) return;
    // Open synchronously from the click so browser popup protection does not block the report.
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) {
      notice.error(t("Cho phép cửa sổ bật lên để xuất báo cáo PDF."));
      return;
    }
    reportWindow.opener = null;
    reportWindow.document.title = t("Đang chuẩn bị báo cáo PDF…");
    reportWindow.document.body.textContent = t("Đang chuẩn bị báo cáo PDF…");
    const controller = new AbortController();
    reportController.current = controller;
    setExportingPdf(true);
    try {
      const report = await loadDashboardReport(getProjectDashboard, year, {
        signal: controller.signal,
        timeout: 30000,
      });
      if (!controller.signal.aborted) await showDashboardReport(reportWindow, report);
    } catch {
      if (!reportWindow.closed) reportWindow.close();
      if (!controller.signal.aborted)
        notice.error(t("Không thể xuất báo cáo PDF. Vui lòng thử lại."));
    } finally {
      if (reportController.current === controller) reportController.current = null;
      if (!controller.signal.aborted) setExportingPdf(false);
    }
  }

  function changeView(value) {
    setView(value);
  }

  return (
    <>
      {holder}
      <div className="min-h-0 min-w-0 w-full flex-1 overflow-y-auto">
        <div className="container mx-auto flex flex-col gap-3 px-4 pb-1 text-sm">
          <DashboardHeader
            onExportPdf={exportPdf}
            exportingPdf={exportingPdf}
            exportDisabled={!data || loading || Boolean(error)}
            year={year}
            dataUpdatedAt={data?.dataUpdatedAt}
            onYearChange={(value) => {
              setYear(value);
            }}
          />
          {error && !data ? (
            <Alert
              type="error"
              showIcon
              title={t("Không tải được số liệu dự án")}
              description={getRequestError(error)}
              action={<Button onClick={() => setRetry((n) => n + 1)}>{t("Thử lại")}</Button>}
            />
          ) : (
            <Spin spinning={loading && !data}>
              {data && (
                <div className="flex flex-col gap-3">
                  <div className="grid min-w-0 grid-cols-1 items-stretch gap-3 xl:grid-cols-22 [&>section]:h-full xl:[&>section:nth-child(-n+2)]:h-75 xl:[&>section]:col-span-11 xl:[&>section:nth-child(3)]:col-span-10 xl:[&>section:nth-child(4)]:col-span-12">
                    <DashboardOverview
                      summary={data.overview}
                      year={data.year}
                      onSelect={setChartSelection}
                    />
                    <DashboardDepartments
                      key={data.year}
                      departments={data.departments}
                      year={data.year}
                      onSelect={setChartSelection}
                    />
                    <DashboardTrendChart
                      months={data.months}
                      year={data.year}
                      onSelect={setChartSelection}
                    />
                    <DashboardDueChart
                      months={data.dueMonths}
                      year={data.year}
                      today={data.today}
                      onSelect={setChartSelection}
                    />
                  </div>
                  <DashboardProjectList
                    key={data.year}
                    data={data.projects}
                    loading={loading}
                    filterError={error}
                    onRetry={() => setRetry((n) => n + 1)}
                    loadingMore={loadingMore}
                    moreError={moreError}
                    hasMore={hasMore}
                    onLoadMore={loadMore}
                    year={data.year}
                    summary={data.summary}
                    today={data.today}
                    view={view}
                    onViewChange={changeView}

                    onOpenProject={setProjectId}
                  />
                  <DashboardNotificationPanel
                    key={`attention-${data.year}`}
                    data={data}
                    year={data.year}
                    refresh={retry}
                    onOpenProject={setProjectId}
                  />
                </div>
              )}
              {!data && <div className="min-h-40" />}
            </Spin>
          )}
        </div>
      </div>
      {chartSelection && (
        <DashboardChartProjects
          key={JSON.stringify(chartSelection)}
          selection={chartSelection}
          today={data?.today ?? dayjs().format("YYYY-MM-DD")}
          onClose={() => setChartSelection(null)}
          onOpenProject={setProjectId}
        />
      )}
      {projectId !== null && (
        <DashboardProjectDrawer
          key={projectId}
          id={projectId}
          today={data?.today ?? dayjs().format("YYYY-MM-DD")}

          onOpenDetail={(id) => {
            setProjectId(null);
            setDetailId(id);
          }}
          onClose={() => setProjectId(null)}
        />
      )}
      {detailId !== null && (
        <ProjectDetailModal
          key={detailId}
          id={detailId}
          onClose={() => setDetailId(null)}
          onChanged={() => setRetry((n) => n + 1)}
          onDeleted={(project) =>
            notice.success(
              t("Đã xóa dự án {code} và toàn bộ công việc thuộc dự án.", {
                code: project.projectCode,
              }),
            )
          }
        />
      )}
    </>
  );
}

export default function Dashboard() {
  return (
    <ProjectUsersProvider>
      <DashboardContent />
    </ProjectUsersProvider>
  );
}
