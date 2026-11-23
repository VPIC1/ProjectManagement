import { useEffect, useState } from "react";
import { Alert, Badge, Button, Popover, Spin } from "antd";
import { FaBell } from "react-icons/fa6";
import useLanguage from "../hooks/useLanguage";
import { getProjectDashboard } from "../utils/endpoint";
import { getRequestError } from "../utils/projectDetailUtils";
import DashboardAttention from "../pages/Dashboard/DashboardAttention";
import DashboardProjectDrawer from "../pages/Dashboard/DashboardProjectDrawer";
import ProjectDetailModal from "../pages/Project/ProjectDetailModal";
import ProjectUsersProvider from "../contexts/ProjectUsersProvider";

function NotificationProject({ id, today, onClose, onRefresh }) {
  const [detail, setDetail] = useState(false);
  return (
    <ProjectUsersProvider>
      {detail ? (
        <ProjectDetailModal
          id={id}
          onClose={onClose}
          onChanged={onRefresh}
          onDeleted={() => {
            onRefresh();
            onClose();
          }}
        />
      ) : (
        <DashboardProjectDrawer
          id={id}
          today={today}
          onClose={onClose}
          onOpenDetail={() => setDetail(true)}
        />
      )}
    </ProjectUsersProvider>
  );
}

export default function ProjectNotificationBell() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [projectId, setProjectId] = useState(null);
  const [year, setYear] = useState(() =>
    Number(
      new Intl.DateTimeFormat("en-GB", { year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(
        new Date(),
      ),
    ),
  );
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await getProjectDashboard(
          { year, attention: "late", attentionPage: page },
          { signal: controller.signal, timeout: 30000 },
        );
        if (!controller.signal.aborted) setData(result);
      } catch (e) {
        if (!controller.signal.aborted) setError(getRequestError(e));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    // oxlint-disable-next-line react/set-state-in-effect -- Load the current portfolio's overdue and due-soon notification counts.
    void load();
    return () => controller.abort();
  }, [year, page, retry]);
  useEffect(() => {
    const refresh = () => {
      setYear(
        Number(
          new Intl.DateTimeFormat("en-GB", {
            year: "numeric",
            timeZone: "Asia/Ho_Chi_Minh",
          }).format(new Date()),
        ),
      );
      setRetry((n) => n + 1);
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  const count = data ? data.attentionSummary.overdue + data.attentionSummary.dueSoon : undefined;
  return (
    <>
      <Popover
        placement="bottomRight"
        trigger="click"
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (value) {
            setPage(1);
            setRetry((n) => n + 1);
          }
        }}
        title={t("Thông báo dự án")}
        content={
          <div className="max-h-[min(70dvh,640px)] w-[min(90vw,480px)] overflow-y-auto">
            {error && (
              <Alert
                type="error"
                title={error}
                action={
                  <Button size="small" onClick={() => setRetry((n) => n + 1)}>
                    {t("Thử lại")}
                  </Button>
                }
              />
            )}
            <Spin spinning={loading}>
              {data ? (
                <DashboardAttention
                  data={data.attention}
                  summary={data.attentionSummary}
                  today={data.today}
                  year={year}
                  refresh={retry}
                  onPageChange={setPage}
                  onOpenProject={(id) => {
                    setOpen(false);
                    setProjectId(id);
                  }}
                />
              ) : (
                <div className="min-h-24" />
              )}
            </Spin>
          </div>
        }
      >
        <Badge count={count} showZero={!!data} overflowCount={99} size="small" offset={[-6, 6]}>
          <Button
            type="text"
            shape="circle"
            aria-label={t("Thông báo dự án ({count})", { count: count ?? 0 })}
            aria-expanded={open}
            icon={<FaBell className="text-xl" />}
          />
        </Badge>
      </Popover>
      {projectId !== null && (
        <NotificationProject
          key={projectId}
          id={projectId}
          today={data.today}
          onClose={() => setProjectId(null)}
          onRefresh={() => setRetry((n) => n + 1)}
        />
      )}
    </>
  );
}
