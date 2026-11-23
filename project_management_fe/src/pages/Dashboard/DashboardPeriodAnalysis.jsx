import { Select } from "antd";
import dayjs from "dayjs";
import useLanguage from "../../hooks/useLanguage";
import { formatDate } from "../../utils/projectDetailUtils";

export default function DashboardPeriodAnalysis({ months, year, today, month, onMonthChange }) {
  const { t } = useLanguage();
  const selected = months.find((item) => item.month === month);
  const currentMonth = dayjs(today).year() === year && dayjs(today).month() + 1 === month;
  return (
    <section className="dashboard-panel">
      <div className="dashboard-panel-heading">
        <h2>{t("Trong tháng")}</h2>
        <Select
          aria-label={t("Tháng phân tích")}
          value={month}
          onChange={onMonthChange}
          placeholder={t("Chọn tháng")}
          options={months.map((item) => ({
            value: item.month,
            label: t("Tháng {month}", { month: item.month }),
          }))}
        />
      </div>
      <div className="dashboard-period-numbers">
        <div>
          <span>{t("Dự kiến kết thúc")}</span>
          <strong>{selected.plannedEnd}</strong>
        </div>
        <div>
          <span>{t("Hoàn thành thực tế")}</span>
          <strong>{selected.actualCompleted ?? "—"}</strong>
        </div>
      </div>
      {selected.actualCompleted !== null && (
        <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-gray-100 pt-4 text-xs text-gray-500">
          <span>
            {t("Đúng hạn")}{" "}
            <strong className="ml-1 text-green-700">{selected.onTimeCompleted}</strong>
          </span>
          <span>
            {t("Trễ hạn")} <strong className="ml-1 text-red-600">{selected.lateCompleted}</strong>
          </span>
        </div>
      )}
      {(currentMonth || selected.actualCompleted === null) && (
        <p className="dashboard-unit mt-3">
          {currentMonth ? t("Tính đến {date}", { date: formatDate(today) }) : t("Chưa đến kỳ")}
        </p>
      )}
    </section>
  );
}
