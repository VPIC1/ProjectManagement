import { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import { Alert, Button, Progress, Spin, Tag, Tooltip } from "antd";
import useLanguage from "../../hooks/useLanguage";
import useProjectStatusOptions from "../../hooks/useProjectStatusOptions";
import { formatDate, getRequestError } from "../../utils/projectDetailUtils";
import { daysUntil, isOpen, monthlyTimelineScale } from "../../utils/dashboardInsights";

// Timeline tải thêm theo trang, đồng bộ cuộn header/body và giữ vị trí khi phóng to/thu nhỏ.
export default function DashboardProjectList({
  data,
  summary,
  today,
  year,
  view,
  onViewChange,
  onOpenProject,
  loadingMore,
  moreError,
  hasMore,
  onLoadMore,
  loading,
  filterError,
  onRetry,
}) {
  const { t, content } = useLanguage();
  const statuses = useProjectStatusOptions();
  const scale = monthlyTimelineScale(data.items, today, year);
  const isCurrentYear = year === dayjs(today).year();
  const [monthWidth, setMonthWidth] = useState(120);
  const zoomAnchor = useRef(null);
  const scrollRef = useRef(null);
  const headerScrollRef = useRef(null);
  const sentinelRef = useRef(null);
  const [viewportWidth, setViewportWidth] = useState(1024);
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) =>
      setViewportWidth(entries[0].contentRect.width),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    function onWheel(event) {
      // Keep browser pinch zoom and native horizontal trackpad gestures intact.
      if (
        event.ctrlKey ||
        !(event.target instanceof Element) ||
        !event.target.closest("[data-timeline]")
      )
        return;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node.clientWidth : 1;
      const delta = event.deltaY * unit;
      const max = Math.max(0, node.scrollWidth - node.clientWidth);
      const next = Math.max(0, Math.min(max, node.scrollLeft + delta));
      // Keep vertical wheel input captured even at either horizontal edge.
      event.preventDefault();
      node.scrollLeft = next;
    }
    const header = headerScrollRef.current;
    function syncHeader() {
      if (header && header.scrollLeft !== node.scrollLeft) header.scrollLeft = node.scrollLeft;
    }
    function syncBody() {
      if (header && node.scrollLeft !== header.scrollLeft) node.scrollLeft = header.scrollLeft;
    }
    node.addEventListener("wheel", onWheel, { passive: false });
    header?.addEventListener("wheel", onWheel, { passive: false });
    node.addEventListener("scroll", syncHeader, { passive: true });
    header?.addEventListener("scroll", syncBody, { passive: true });
    return () => {
      node.removeEventListener("wheel", onWheel);
      header?.removeEventListener("wheel", onWheel);
      node.removeEventListener("scroll", syncHeader);
      header?.removeEventListener("scroll", syncBody);
    };
  }, []);
  const infoWidth = Math.max(510, viewportWidth / 2);
  const timelineWidth = Math.max(infoWidth, scale.months.length * monthWidth);
  const todayPosition = scale.position(today);
  const focusPosition = isCurrentYear ? todayPosition : 0;
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const visibleTimeline = Math.max(0, node.clientWidth - infoWidth);
    const position = zoomAnchor.current ?? focusPosition / 100;
    node.scrollLeft = Math.max(0, timelineWidth * position - visibleTimeline / 2);
    if (headerScrollRef.current) headerScrollRef.current.scrollLeft = node.scrollLeft;
    zoomAnchor.current = null;
  }, [timelineWidth, infoWidth, focusPosition, viewportWidth, view, year]);
  useEffect(() => {
    if (!hasMore || loadingMore || moreError || loading || filterError) return;
    const sentinel = sentinelRef.current;
    if (!sentinel || !scrollRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void onLoadMore();
      },
      { root: null, rootMargin: "0px 0px 240px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, moreError, onLoadMore, data.items.length, loading, filterError]);
  function zoom(next) {
    const node = scrollRef.current;
    if (node) {
      const visibleTimeline = Math.max(0, node.clientWidth - infoWidth);
      zoomAnchor.current = (node.scrollLeft + visibleTimeline / 2) / timelineWidth;
    }
    setMonthWidth(next);
  }
  const views = [
    ["active", t("Đang thực hiện ({count} dự án)", { count: summary.pending })],
    ["late", t("Quá hạn ({count} dự án)", { count: summary.overdue })],
    ["soon", t("Sắp đến hạn ({count} dự án)", { count: summary.dueSoon })],
  ];
  if (!["active", "late", "soon"].includes(view))
    views.push([
      view,
      t(
        view === "all"
          ? "Tất cả dự án"
          : view === "complete"
            ? "Đã hoàn thành"
            : view === "hold"
              ? "Đang chờ"
              : "Đã hủy",
      ),
    ]);
  function bar(from, to, actual, late) {
    if (!from && !to)
      return (
        <span className="pl-2 text-sm text-slate-400">
          {t(actual ? "Chưa có thời gian thực tế" : "Chưa có lịch dự kiến")}
        </span>
      );
    const left = scale.position(from ?? to);
    const right = scale.position(dayjs(to ?? from).add(1, "day"));
    if (right <= left) return null;
    return (
      <Tooltip
        title={`${t(actual ? "Thực tế" : "Kế hoạch")}: ${formatDate(from)} – ${formatDate(to)}`}
      >
        <span
          className={`absolute top-2 h-2 rounded-sm ${actual ? (late ? "bg-red-400" : "bg-blue-500") : "bg-slate-400"}`}
          style={{
            left: `${left}%`,
            width: `${Math.min(100 - left, Math.max(0.6, right - left))}%`,
          }}
        />
      </Tooltip>
    );
  }
  const columnWidths = (
    <colgroup>
      <col className="w-[calc(var(--info-width)*0.48)]" />
      <col className="w-[calc(var(--info-width)*0.34)]" />
      <col className="w-[calc(var(--info-width)*0.18)]" />
      <col className="w-[var(--timeline-width)]" />
    </colgroup>
  );
  const tableHeader = (
    <thead>
      <tr>
        <th>{t("Dự án / Tình trạng")}</th>
        <th className="left-[calc(var(--info-width)*0.48)] z-20!">{t("Kế hoạch / Thực tế")}</th>
        <th className="left-[calc(var(--info-width)*0.82)] z-20! text-center! border-r border-r-slate-200! after:pointer-events-none after:absolute after:inset-y-0 after:-right-1 after:w-1 after:bg-linear-to-r after:from-slate-900/10 after:to-transparent after:content-['']">
          {t("Chênh lệch")} (%)
        </th>
        <th data-timeline className="bg-slate-100! p-0!">
          <div className="flex">
            {scale.months.map((month) => (
              <div
                className={`w-[var(--month-width)] shrink-0 border-r border-slate-200 py-2 text-center font-medium ${month.isSame(dayjs(today), "month") ? "bg-blue-50 text-blue-700" : ""}`}
                key={month.format("YYYY-MM")}
              >
                {month.format("MM/YYYY")}
              </div>
            ))}
          </div>
        </th>
      </tr>
    </thead>
  );
  const tableClass =
    "w-[var(--table-width)] min-w-full table-fixed border-separate border-spacing-0 text-sm [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:border-b [&_th]:border-gray-200 [&_th]:bg-slate-50 [&_th]:p-2 [&_th]:text-left [&_th]:text-sm [&_th]:font-normal [&_th]:text-slate-500 [&_td]:border-b [&_td]:border-gray-100 [&_td]:px-2 [&_td]:py-2 [&_td]:align-middle [&_td:first-child]:sticky [&_td:first-child]:left-0 [&_td:first-child]:z-10 [&_td:first-child]:bg-white [&_th:first-child]:left-0 [&_th:first-child]:z-20";
  return (
    <section
      id="dashboard-project-list"
      className="min-w-0 rounded-lg border border-gray-300 bg-white p-3 dashboard-library-overrides"
      style={{
        "--viewport-width": `${viewportWidth}px`,
        "--info-width": `${infoWidth}px`,
        "--table-width": `${infoWidth + timelineWidth}px`,
        "--timeline-width": `${timelineWidth}px`,
        "--month-width": `${timelineWidth / scale.months.length}px`,
      }}
    >
      <div className="sticky top-0 z-30 bg-white py-1">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t("Tiến độ dự án")}</h2>
          <div className="flex items-center gap-1">
            <Button
              size="small"
              aria-label={t("Thu nhỏ timeline")}
              title={t("Thu nhỏ timeline")}
              disabled={monthWidth <= 60}
              onClick={() => zoom(monthWidth - 30)}
            >
              −
            </Button>
            <span className="min-w-12 text-center text-sm tabular-nums text-slate-500">
              {Math.round((monthWidth / 120) * 100)}%
            </span>
            <Button
              size="small"
              aria-label={t("Phóng to timeline")}
              title={t("Phóng to timeline")}
              disabled={monthWidth >= 300}
              onClick={() => zoom(monthWidth + 30)}
            >
              +
            </Button>
          </div>
        </div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {views.map(([key, label]) => (
              <Button
                size="small"
                key={key}
                type={view === key ? "primary" : "default"}
                aria-pressed={view === key}
                onClick={() => onViewChange(key)}
              >
                {label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500 [&_span]:inline-flex [&_span]:items-center [&_span]:gap-1.5 [&_i]:h-1.5 [&_i]:w-4 [&_i]:rounded-sm">
            <span>
              <i className="bg-slate-400" />
              {t("Kế hoạch")}
            </span>
            <span>
              <i className="bg-blue-500" />
              {t("Thực tế")}
            </span>
            {isCurrentYear && (
              <span className="text-red-500">
                ┊ {t("Hôm nay")} · {formatDate(today)}
              </span>
            )}
          </div>
        </div>
        {filterError && (
          <Alert
            className="mb-3"
            type="error"
            title={getRequestError(filterError)}
            action={
              <Button size="small" onClick={onRetry}>
                {t("Thử lại")}
              </Button>
            }
          />
        )}
        <div
          ref={headerScrollRef}
          className="w-[var(--viewport-width)] max-w-full overflow-x-hidden border-b border-gray-200 bg-slate-50"
          aria-hidden="true"
        >
          <table className={tableClass}>
            {columnWidths}
            {tableHeader}
          </table>
        </div>
      </div>
      <Spin spinning={loading}>
        <div ref={scrollRef} className="w-full overflow-x-auto">
          <table className={tableClass}>
            {columnWidths}
            <thead className="sr-only">{tableHeader.props.children}</thead>
            <tbody>
              {data.items.map((project) => {
                const days = daysUntil(project, today);
                const late = isOpen(project) && days !== null && days < 0;
                const planned = project.plannedProgressPercent,
                  actual = project.progressPercent;
                const delta =
                  typeof planned === "number" ? Math.round((actual - planned) * 10) / 10 : null;
                const status = statuses.find((s) => s.value === project.status);
                const actualEnd =
                  project.actualEndDate ??
                  (isOpen(project) && project.actualStartDate && project.actualStartDate <= today
                    ? today
                    : null);
                return (
                  <tr key={project.id}>
                    <td>
                      <div className="flex min-w-0 flex-col items-start gap-1">
                        <button
                          type="button"
                          className="inline-flex cursor-pointer items-center rounded px-1 -ml-1 text-left text-sm font-medium text-red-600 underline decoration-red-300 underline-offset-2 transition-colors hover:bg-red-50 hover:text-red-700 hover:decoration-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-default"
                          disabled={loading}
                          onClick={() => onOpenProject(project.id)}
                        >
                          {project.projectCode}
                        </button>
                        <Tooltip title={content(project, "projectName")}>
                          <span className="line-clamp-2 w-full min-w-0 break-words text-left text-sm font-normal text-gray-800">
                            {content(project, "projectName")}
                          </span>
                        </Tooltip>
                        <Tag
                          color={
                            late
                              ? "error"
                              : isOpen(project) && days !== null && days <= 7
                                ? "warning"
                                : status?.color
                          }
                        >
                          {late
                            ? t("Quá hạn {days} ngày", { days: -days })
                            : isOpen(project) && days === 0
                              ? t("Đến hạn hôm nay")
                              : isOpen(project) && days !== null && days <= 7
                                ? t("Còn {days} ngày", { days })
                                : status?.label}
                        </Tag>
                      </div>
                    </td>
                    <td className="sticky left-[calc(var(--info-width)*0.48)] z-10 bg-white">
                      <div className="grid grid-cols-[max-content_minmax(0,1fr)] items-center gap-x-2 gap-y-2">
                        <Tooltip
                          title={t(
                            "Kế hoạch là trung bình tiến độ dự kiến của toàn bộ công việc theo ngày bắt đầu và kết thúc của từng việc.",
                          )}
                        >
                          <span className="text-xs font-medium text-slate-500">
                            {t("Kế hoạch")}
                          </span>
                        </Tooltip>
                        {typeof planned === "number" ? (
                          <Progress
                            aria-label={t("Kế hoạch")}
                            percent={planned}
                            size={[-1, 7]}
                            strokeColor="#94a3b8"
                            status="normal"
                          />
                        ) : (
                          <Tooltip
                            title={t("Chưa đủ ngày dự kiến của công việc để tính kế hoạch.")}
                          >
                            <span>—</span>
                          </Tooltip>
                        )}
                        <span className="text-xs font-medium text-slate-700">{t("Thực tế")}</span>
                        <Progress
                          aria-label={t("Thực tế")}
                          percent={actual}
                          size={[-1, 7]}
                          strokeColor={late ? "#ff4d4f" : actual === 100 ? "#52c41a" : "#1677ff"}
                          status="normal"
                        />
                      </div>
                    </td>
                    <td className="sticky left-[calc(var(--info-width)*0.82)] z-10 bg-white text-center border-r border-r-slate-200! after:pointer-events-none after:absolute after:inset-y-0 after:-right-1 after:w-1 after:bg-linear-to-r after:from-slate-900/10 after:to-transparent after:content-['']">
                      <div
                        className={`mx-auto flex w-full flex-col items-center justify-center gap-1 py-1 ${delta === null ? "text-slate-400" : delta < 0 ? "text-red-600" : delta > 0 ? "text-green-700" : "text-blue-600"}`}
                      >
                        {delta === null ? (
                          <span className="text-xs leading-snug">{t("Chưa đủ dữ liệu")}</span>
                        ) : delta === 0 ? (
                          <span className="inline-flex items-center justify-center gap-1 text-sm font-medium">
                            <span aria-hidden="true">✓</span>
                            {t("Đúng tiến độ")}
                          </span>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-1 text-base font-semibold tabular-nums">
                              <span aria-hidden="true">{delta < 0 ? "↓" : "↑"}</span>
                              {Math.abs(delta)}%
                            </span>
                            <span className="text-xs leading-snug text-slate-500">
                              {t(delta < 0 ? "Chậm tiến độ" : "Vượt tiến độ")}
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                    <td
                      data-timeline
                      className="relative bg-slate-50/60 bg-[repeating-linear-gradient(to_right,transparent_0,transparent_calc(var(--month-width)_-_1px),#e2e8f0_calc(var(--month-width)_-_1px),#e2e8f0_var(--month-width))] px-0! [&>div]:relative [&>div]:h-6"
                    >
                      {isCurrentYear && (
                        <span
                          className="pointer-events-none absolute inset-y-0 z-1 border-l border-dashed border-red-500"
                          style={{ left: `${scale.position(today)}%` }}
                        />
                      )}
                      <div>{bar(project.startDate, project.endDate, false, late)}</div>
                      <div>{bar(project.actualStartDate, actualEnd, true, late)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!data.items.length && (
            <div className="p-6 text-center text-sm text-slate-500">{t("Không có dự án")}</div>
          )}
        </div>
      </Spin>
      <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />
      <div
        className="mt-2 flex shrink-0 flex-wrap items-center justify-between gap-2 text-sm text-slate-500"
        aria-live="polite"
      >
        <span>
          {t("Đã tải {loaded}/{total} dự án", {
            loaded: data.items.length,
            total: data.totalCount,
          })}
        </span>
        {loadingMore && (
          <span className="inline-flex items-center gap-2">
            <Spin size="small" />
            {t("Đang tải...")}
          </span>
        )}
        {moreError && (
          <div role="alert" className="flex flex-wrap items-center gap-2 text-red-600">
            <span>{getRequestError(moreError)}</span>
            <Button size="small" onClick={onLoadMore}>
              {t("Thử lại")}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
