import { useEffect, useRef, useState } from "react";
import { Alert } from "antd";
import useLanguage from "../../hooks/useLanguage";

// Dùng chung vòng đời ApexCharts; hủy biểu đồ khi chuyển trang/ngôn ngữ.
export default function DashboardChart({ options, label }) {
  const host = useRef(null);
  const [error, setError] = useState(false);
  const { t } = useLanguage();
  useEffect(() => {
    let active = true;
    let chart;
    async function draw() {
      try {
        const { default: ApexCharts } = await import("apexcharts");
        if (!active) return;
        chart = new ApexCharts(host.current, options);
        await chart.render();
      } catch {
        if (active) setError(true);
      }
    }
    // oxlint-disable-next-line react/set-state-in-effect -- A changed dataset retries chart rendering.
    setError(false);
    void draw();
    return () => {
      active = false;
      chart?.destroy();
    };
  }, [options]);
  return (
    <>
      {error && (
        <Alert type="error" title={t("Không thể hiển thị biểu đồ. Vui lòng tải lại trang.")} />
      )}
      <div ref={host} role="img" aria-label={label} className="dashboard-apex-host" />
    </>
  );
}
