import { useEffect, useState } from "react";
import { Alert, Button, Drawer, Empty, Grid, Progress, Spin, Tag } from "antd";
import useLanguage from "../../hooks/useLanguage";
import ProjectUserTags from "../../components/ProjectUserTags";
import { getProjectById, getTasks } from "../../utils/endpoint";
import { fetchAllProjectTasks } from "../../utils/projectTaskData";
import { daysUntil, projectIssues } from "../../utils/dashboardInsights";
import { formatDate, formatDateTime, getRequestError } from "../../utils/projectDetailUtils";

export default function DashboardProjectDrawer({ id, today, onClose, onOpenDetail }) {
  const { t, content } = useLanguage();
  const screens = Grid.useBreakpoint();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    async function load() {
      setLoading(true);
      setError(null);
      setResult(null);
      try {
        const project = await getProjectById(id, { timeout: 30000 });
        if (!current) return;
        const tasks = await fetchAllProjectTasks(getTasks, project.projectCode, () => current);
        if (current && tasks) setResult({ project, tasks });
      } catch (e) {
        if (current) setError(getRequestError(e));
      } finally {
        if (current) setLoading(false);
      }
    }
    // oxlint-disable-next-line react/set-state-in-effect -- Load current selected project's complete task list.
    void load();
    return () => {
      current = false;
    };
  }, [id, retry]);
  const issues = result ? projectIssues(result.project, result.tasks, today) : null;
  const project = result?.project;
  const delta =
    typeof project?.plannedProgressPercent === "number"
      ? Math.round((project.progressPercent - project.plannedProgressPercent) * 10) / 10
      : null;
  return (
    <Drawer
      open
      onClose={onClose}
      title={t("Tổng quan dự án")}
      size={screens.lg ? "33.333vw" : "100vw"}
      className="dashboard-project-drawer"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="primary" disabled={!project} onClick={() => onOpenDetail(id)}>
            {t("Mở chi tiết đầy đủ")}
          </Button>
        </div>
      }
    >
      <Spin spinning={loading}>
        {error && (
          <Alert
            type="error"
            title={error}
            action={<Button onClick={() => setRetry((n) => n + 1)}>{t("Thử lại")}</Button>}
          />
        )}
        {project && (
          <div className="flex flex-col gap-5 [&_h2]:mt-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold">
            <div>
              <span className="text-left text-sm text-red-600 underline underline-offset-2">
                {project.projectCode}
              </span>
              <h2>{content(project, "projectName")}</h2>
            </div>
            <section
              className={`rounded-md border-l-4 p-3 text-sm [&_p]:mt-1 ${issues.overdueDays || delta < 0 || issues.overdue.length ? "border-red-500 bg-red-50" : "border-blue-500 bg-blue-50"}`}
            >
              <h3>
                {t(
                  issues.overdueDays || issues.overdue.length
                    ? "Cần xử lý ngay"
                    : delta < 0
                      ? "Đang chậm hơn kế hoạch"
                      : "Tình hình hiện tại",
                )}
              </h3>
              {issues.overdueDays > 0 && (
                <p>{t("Quá hạn {days} ngày", { days: issues.overdueDays })}</p>
              )}
              {delta !== null && (
                <p>
                  {t("Chênh lệch")} {delta > 0 ? "+" : ""}
                  {delta}%
                </p>
              )}
              <p>{t("{count} công việc chưa hoàn thành", { count: issues.remaining.length })}</p>
              <p>
                {t("{count} công việc quá hạn", { count: issues.overdue.length })} ·{" "}
                {t("{count} công việc chưa có người phụ trách", {
                  count: issues.unassigned.length,
                })}
              </p>
            </section>
            <div className="grid grid-cols-3 gap-2 [&>div]:rounded-md [&>div]:bg-slate-50 [&>div]:p-3 [&_span]:block [&_span]:text-sm [&_span]:text-slate-500 [&_small]:block [&_small]:text-sm [&_small]:text-slate-500 [&_strong]:my-1 [&_strong]:block [&_strong]:text-2xl">
              <div>
                <span>{t("Thực tế")}</span>
                <strong>{project.progressPercent}%</strong>
                <small>
                  {t("Kế hoạch")}{" "}
                  {project.plannedProgressPercent == null
                    ? "—"
                    : `${project.plannedProgressPercent}%`}
                </small>
              </div>
              <div>
                <span>{t("Đã hoàn thành")}</span>
                <strong>
                  {issues.completed}/{result.tasks.length}
                </strong>
                <small>{t("công việc")}</small>
              </div>
              <div>
                <span>{t("Cần chú ý")}</span>
                <strong>{issues.prioritized.length}</strong>
                <small>{t("công việc")}</small>
              </div>
            </div>
            <section>
              <h3>{t("Việc cần xử lý trước")}</h3>
              {issues.prioritized.length ? (
                issues.prioritized.map((task) => (
                  <article
                    className="border-t border-gray-200 py-3 [&>div:first-child]:flex [&>div:first-child]:items-start [&>div:first-child]:justify-between [&>div:first-child]:gap-2 [&_strong]:text-sm [&_strong]:font-medium [&_p]:mt-1 [&_p]:text-sm [&_p]:text-slate-500"
                    key={task.id}
                  >
                    <div>
                      <strong>{content(task, "taskName")}</strong>
                      <Tag
                        className="dashboard-task-status-tag"
                        color={issues.overdue.includes(task) ? "error" : "warning"}
                      >
                        {issues.overdue.includes(task)
                          ? t("Quá hạn {days} ngày", { days: -daysUntil(task, today) })
                          : !task.pic?.trim()
                            ? t("Chưa có người phụ trách")
                            : daysUntil(task, today) === 0
                              ? t("Đến hạn hôm nay")
                              : t("Còn {days} ngày", { days: daysUntil(task, today) })}
                      </Tag>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                      <ProjectUserTags value={task.pic} fallback={t("Chưa có người phụ trách")} />
                      <span>
                        {t("Kết thúc dự kiến")}: {formatDate(task.endDate)}
                      </span>
                    </div>
                    <Progress percent={task.progress ?? 0} size="small" status="normal" />
                  </article>
                ))
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={t("Không có công việc cần chú ý")}
                />
              )}
            </section>
            <section>
              <h3>{t("Thông tin chính")}</h3>
              <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-2 text-sm [&_dt]:text-slate-500 [&_dd]:m-0 [&_dd]:wrap-anywhere">
                <dt>{t("Người phụ trách")}</dt>
                <dd>
                  <ProjectUserTags value={project.manager} />
                </dd>
                <dt>{t("Phòng ban yêu cầu")}</dt>
                <dd>{content(project, "requesterDepartmentName") ?? t("Chưa gán phòng ban")}</dd>
                <dt>{t("Ngày bắt đầu")}</dt>
                <dd>{formatDate(project.startDate)}</dd>
                <dt>{t("Kết thúc dự kiến")}</dt>
                <dd>{formatDate(project.endDate)}</dd>
                <dt>{t("Cập nhật gần nhất")}</dt>
                <dd>{formatDateTime(project.updatedDate ?? project.createdDate)}</dd>
              </dl>
            </section>
          </div>
        )}
        {!result && <div className="min-h-32" />}
      </Spin>
    </Drawer>
  );
}
