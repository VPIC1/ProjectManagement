import { useEffect, useState } from "react";
import { Alert, Button, Drawer, Progress, Table, Tag } from "antd";
import useLanguage from "../../hooks/useLanguage";
import useProjectStatusOptions from "../../hooks/useProjectStatusOptions";
import { getProjectDashboard, getProjects } from "../../utils/endpoint";
import { daysUntil, isOpen } from "../../utils/dashboardInsights";
import { chartProjectQuery } from "../../utils/dashboardChartQuery";
import { formatDate, getRequestError } from "../../utils/projectDetailUtils";

function DatePair({ planned, actual, emptyText, overdue = false }) {
  return (
    <div className="grid grid-rows-2 gap-1 text-sm leading-6 tabular-nums">
      <span
        className={`whitespace-nowrap ${overdue ? "font-medium text-red-600" : "text-slate-500"}`}
      >
        {formatDate(planned)}
      </span>
      <span
        className={
          actual
            ? `whitespace-nowrap font-medium ${planned && actual !== planned ? "text-blue-700" : "text-slate-900"}`
            : "whitespace-nowrap text-xs text-slate-500"
        }
      >
        {actual ? formatDate(actual) : emptyText}
      </span>
    </div>
  );
}

export default function DashboardChartProjects({ selection, today, onClose, onOpenProject }) {
  const { t, content } = useLanguage();
  const statuses = useProjectStatusOptions();

  function overdueDays(project) {
    const days = daysUntil(project, today);
    return isOpen(project) && days !== null && days < 0 ? -days : 0;
  }
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { endpoint, params } = chartProjectQuery(selection, page, today);
        const config = { signal: controller.signal, timeout: 30000 };
        const response =
          endpoint === "dashboard"
            ? (await getProjectDashboard(params, config)).projects
            : await getProjects(params, config);
        if (!controller.signal.aborted) setData(response);
      } catch (e) {
        if (!controller.signal.aborted) setError(getRequestError(e));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    // oxlint-disable-next-line react/set-state-in-effect -- Load only projects belonging to the selected chart mark.
    void load();
    return () => controller.abort();
  }, [selection, page, today, retry]);
  const title =
    selection.kind === "due"
      ? `${t("Dự án đến hạn")} · ${String(selection.month).padStart(2, "0")}/${selection.year} · ${selection.label}`
      : selection.kind === "status"
        ? `${t("Danh sách dự án")}: ${selection.label} · ${selection.year}`
        : selection.kind === "department"
          ? `${t("Phòng ban yêu cầu")}: ${selection.label} · ${selection.year}`
          : `${t(selection.series === "both" ? "Danh sách dự án" : selection.series === "started" ? "Số dự án bắt đầu" : "Số dự án hoàn thành")} · ${String(selection.month).padStart(2, "0")}/${selection.year}`;
  return (
    <Drawer
      open
      onClose={onClose}
      title={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>{title}</span>
          {data && (
            <span className="shrink-0 text-sm font-normal tabular-nums text-slate-500">
              {t("{count} dự án", { count: data.totalCount })}
            </span>
          )}
        </div>
      }
      size={1200}
      styles={{ body: { overflow: "hidden" } }}
    >
      <div className="min-w-0">
        {error && (
          <Alert
            className="mb-3"
            type="error"
            title={getRequestError(error)}
            action={<Button onClick={() => setRetry((n) => n + 1)}>{t("Thử lại")}</Button>}
          />
        )}
        <Table
          size="small"
          rowKey="id"
          loading={loading}
          dataSource={data?.items ?? []}
          scroll={{ x: 960, y: "calc(100dvh - 180px)" }}

          columns={[
            {
              title: t("Dự án"),
              key: "project",
              width: 340,
              render: (_, project) => (
                <div className="flex flex-col items-start gap-1">
                  <button
                    type="button"
                    className="inline-flex cursor-pointer items-center rounded px-1 -ml-1 text-left text-sm font-medium text-red-600 underline decoration-red-300 underline-offset-2 transition-colors hover:bg-red-50 hover:text-red-700 hover:decoration-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-default"
                    onClick={() => onOpenProject(project.id)}
                  >
                    {project.projectCode}
                  </button>
                  <span className="text-sm">{content(project, "projectName")}</span>
                </div>
              ),
            },
            {
              title: t("Trạng thái"),
              dataIndex: "status",
              width: 150,
              render: (status, project) => {
                const option = statuses.find((s) => s.value === status);
                const lateDays = overdueDays(project);
                return (
                  <div className="flex flex-col items-start gap-1.5">
                    <Tag color={option?.color}>{option?.label ?? status}</Tag>
                    {lateDays > 0 && (
                      <Tag color="error">{t("Quá hạn {days} ngày", { days: lateDays })}</Tag>
                    )}
                  </div>
                );
              },
            },
            {
              title: t("Thực tế"),
              dataIndex: "progressPercent",
              width: 130,
              render: (value, project) => (
                <Progress
                  percent={value ?? 0}
                  size="small"
                  strokeColor={overdueDays(project) ? "#ff4d4f" : undefined}
                  status={overdueDays(project) ? "normal" : undefined}
                />
              ),
            },
            {
              title: t("Lịch"),
              key: "schedule",
              width: 90,
              render: () => (
                <div className="grid grid-rows-2 gap-1 border-l border-gray-200 pl-3 text-sm leading-6">
                  <span className="text-slate-500">{t("Dự kiến")}</span>
                  <span className="font-medium text-slate-900">{t("Thực tế")}</span>
                </div>
              ),
            },
            {
              title: t("Bắt đầu"),
              key: "startDates",
              width: 140,
              render: (_, project) => (
                <DatePair
                  planned={project.startDate}
                  actual={project.actualStartDate}
                  emptyText={t("Chưa cập nhật")}
                />
              ),
            },
            {
              title: t("Kết thúc"),
              key: "endDates",
              width: 140,
              render: (_, project) => (
                <DatePair
                  planned={project.endDate}
                  actual={project.actualEndDate}
                  overdue={overdueDays(project) > 0}
                  emptyText={t(
                    project.status === "PENDING" || project.status === "HOLD"
                      ? "Chưa kết thúc"
                      : "Chưa cập nhật",
                  )}
                />
              ),
            },
          ]}
          pagination={{
            current: data?.pageNumber ?? page,
            pageSize: data?.pageSize ?? 20,
            total: data?.totalCount ?? 0,
            showSizeChanger: false,
            onChange: setPage,
            showTotal: (total) => t("{count} dự án", { count: total }),
          }}
        />
      </div>
    </Drawer>
  );
}
