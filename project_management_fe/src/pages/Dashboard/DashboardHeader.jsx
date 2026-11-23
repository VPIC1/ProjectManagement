import { Button, DatePicker, Tooltip } from "antd";
import { FaFilePdf, FaDatabase } from "react-icons/fa6";
import dayjs from "dayjs";
import useLanguage from "../../hooks/useLanguage";

export default function DashboardHeader({
  year,
  onYearChange,
  dataUpdatedAt,
  onExportPdf,
  exportingPdf,
  exportDisabled,
}) {
  const { t } = useLanguage();
  const date = dataUpdatedAt ? new Date(dataUpdatedAt) : null;
  const valid = date && !Number.isNaN(date.getTime());
  const timestamp = valid
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Ho_Chi_Minh",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
        .format(date)
        .replace(",", "")
    : "—";

  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {t("Tổng quan dự án công nghệ thông tin")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {t("Theo dõi tiến độ · Phát hiện vấn đề · Ưu tiên xử lý")}
        </p>
      </div>
      <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border border-gray-300 bg-white p-3 sm:w-auto">
        <Tooltip title={t("Giờ Việt Nam (UTC+07:00)")}>
          <div className="min-w-0 flex-1 sm:flex-none">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <FaDatabase aria-hidden="true" className="size-3.5 shrink-0" />
              {t("Dữ liệu cập nhật đến")}
            </p>
            <time
              className="mt-1 block text-base font-semibold tabular-nums text-blue-800"
              dateTime={valid ? dataUpdatedAt : undefined}
            >
              {timestamp}
            </time>
          </div>
        </Tooltip>
        <div className="flex items-end gap-3 border-l border-gray-200 pl-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            {t("Năm báo cáo")}
            <DatePicker
              className="w-28"
              aria-label={t("Năm báo cáo")}
              picker="year"
              allowClear={false}
              disabled={exportingPdf}
              value={dayjs(`${year}-01-01`)}
              minDate={dayjs("1900-01-01")}
              maxDate={dayjs("9998-12-31")}
              onChange={(value) => onYearChange(value?.year() ?? dayjs().year())}
            />
          </label>
          <Button
            type="primary"
            danger
            icon={<FaFilePdf aria-hidden="true" />}
            onClick={onExportPdf}
            loading={exportingPdf}
            disabled={exportDisabled}
          >
            {t("Xuất PDF")}
          </Button>
        </div>
      </div>
    </header>
  );
}
