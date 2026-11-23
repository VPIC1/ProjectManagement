import { useEffect, useState } from "react";
import { Alert, Button, Spin } from "antd";
import useLanguage from "../../hooks/useLanguage";
import { getProjectDashboard } from "../../utils/endpoint";
import { getRequestError } from "../../utils/projectDetailUtils";
import DashboardAttention from "./DashboardAttention";

export default function DashboardNotificationPanel({ data, year, refresh, onOpenProject }) {
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (page === 1) return;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await getProjectDashboard(
          { year, attention: "late", attentionPage: page },
          { signal: controller.signal, timeout: 30000 },
        );
        if (!controller.signal.aborted) setResult(response.attention);
      } catch (e) {
        if (!controller.signal.aborted) setError(getRequestError(e));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    // oxlint-disable-next-line react/set-state-in-effect -- Independently page overdue notifications without resetting the project timeline.
    void load();
    return () => controller.abort();
  }, [page, year, refresh, retry]);
  return (
    <section className="flex h-full min-w-0 flex-col rounded-lg border border-gray-300 bg-white p-3">
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{t("Dự án cần chú ý")}</h2>
        <span className="text-sm text-slate-500">
          {t("{count} dự án", {
            count: data.attentionSummary.overdue + data.attentionSummary.dueSoon,
          })}
        </span>
      </div>
      <div className="relative min-h-72 flex-1">
        {error && (
          <Alert
            className="mb-2"
            type="error"
            title={error}
            action={
              <Button size="small" onClick={() => setRetry((n) => n + 1)}>
                {t("Thử lại")}
              </Button>
            }
          />
        )}
        <Spin
          spinning={page > 1 && loading}
          rootClassName="absolute inset-0 flex min-h-0 flex-col [&>.ant-spin-container]:flex [&>.ant-spin-container]:min-h-0 [&>.ant-spin-container]:flex-1 [&>.ant-spin-container]:flex-col"
        >
          <DashboardAttention
            columns
            data={page === 1 ? data.attention : (result ?? data.attention)}
            summary={data.attentionSummary}
            today={data.today}
            year={year}
            refresh={refresh}
            onPageChange={(value) => {
              setError(null);
              setPage(value);
            }}
            onOpenProject={onOpenProject}
          />
        </Spin>
      </div>
    </section>
  );
}
