import { Button } from "antd";
import useLanguage from "../../hooks/useLanguage";
import { formatDate } from "../../utils/projectDetailUtils";

function Observation({ tone, mark, title, children }) {
  return (
    <div className="dashboard-observation">
      <span className={`dashboard-observation-mark dashboard-observation-${tone}`}>{mark}</span>
      <div className="min-w-0">
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

export default function DashboardInsights({ summary, today, year, onSelectView }) {
  const { t } = useLanguage();
  return (
    <section className="dashboard-panel">
      <div className="dashboard-panel-heading">
        <h2>{t("Nhận định tổng quan")}</h2>
      </div>
      <div className="dashboard-insight-heading">
        <span>{t("Tình hình hiện tại")}</span>
        <span>{formatDate(today)}</span>
      </div>
      <Observation
        tone={summary.overdue ? "danger" : "success"}
        mark={summary.overdue ? "!" : "✓"}
        title={
          summary.overdue
            ? t("{count} dự án đã quá hạn", { count: summary.overdue })
            : t("Không có dự án quá hạn")
        }
      >
        <p>
          {summary.overdue
            ? t("Dự án trễ lâu nhất đã quá hạn {days} ngày.", {
                days: summary.maxOverdueDays,
              })
            : t("Các dự án đang mở chưa có dự án vượt ngày kết thúc dự kiến.")}
        </p>
        {summary.overdue > 0 && (
          <Button
            type="link"
            size="small"
            className="dashboard-insight-link"
            onClick={() => onSelectView("late")}
          >
            {t("Xem các dự án quá hạn →")}
          </Button>
        )}
      </Observation>
      <Observation
        tone={summary.dueSoon ? "warning" : "neutral"}
        mark={summary.dueSoon ? "!" : "i"}
        title={t("{count} dự án đến hạn trong 7 ngày", {
          count: summary.dueSoon,
        })}
      >
        <p>
          {summary.dueSoon
            ? t("Theo dõi các công việc còn lại để hoàn thành theo kế hoạch.")
            : t("Không có dự án đang mở đến hạn trong 7 ngày tới.")}
        </p>
        {summary.dueSoon > 0 && (
          <Button
            type="link"
            size="small"
            className="dashboard-insight-link"
            onClick={() => onSelectView("soon")}
          >
            {t("Xem các dự án sắp đến hạn →")}
          </Button>
        )}
      </Observation>
      <div className="dashboard-insight-heading dashboard-insight-year">
        <span>{t("Kết quả trong năm")}</span>
        <span>{year}</span>
      </div>
      <Observation
        tone={!summary.measuredComplete ? "neutral" : summary.lateComplete ? "warning" : "success"}
        mark={!summary.measuredComplete ? "i" : summary.lateComplete ? "!" : "✓"}
        title={
          summary.onTimePercent === null
            ? t("Chưa đủ dữ liệu đánh giá đúng hạn")
            : t("{percent}% dự án hoàn thành đúng hạn", {
                percent: summary.onTimePercent,
              })
        }
      >
        <p>
          {summary.measuredComplete
            ? t(
                "{onTime} đúng hạn, {late} trễ hạn trong {total} dự án có đủ ngày dự kiến và thực tế.",
                {
                  onTime: summary.onTimeComplete,
                  late: summary.lateComplete,
                  total: summary.measuredComplete,
                },
              )
            : t("Chưa có dự án hoàn thành có đủ ngày dự kiến và thực tế trong năm đã chọn.")}
        </p>
      </Observation>
      <Observation
        tone="neutral"
        mark="i"
        title={t("{count} dự án chưa có ngày hoàn thành thực tế", {
          count: summary.missingActualEnd,
        })}
      >
        <p>{t("Dự án thiếu ngày thực tế chưa được tính vào tỷ lệ hoàn thành đúng hạn.")}</p>
      </Observation>
    </section>
  );
}
