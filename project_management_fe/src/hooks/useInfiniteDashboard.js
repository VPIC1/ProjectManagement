import { useCallback, useEffect, useRef, useState } from "react";
import { getProjectDashboard } from "../utils/endpoint";
import { createDashboardPager } from "../utils/dashboardPaging";

// Giữ số liệu tổng theo năm khi đổi tab danh sách. retry buộc tải lại sau khi sửa hoặc xóa dữ liệu.
export default function useInfiniteDashboard(year, view, attentionPage, retry) {
  const pager = useRef(null);
  const cached = useRef(null);
  const [state, setState] = useState({
    data: null,
    loading: true,
    loadingMore: false,
    error: null,
    moreError: null,
    hasMore: false,
  });
  useEffect(() => {
    const session = createDashboardPager(
      getProjectDashboard,
      { year, view, attention: "late", attentionPage },
      (next) => {
        const previous = cached.current;
        let data = next.data;
        if (data && previous?.year === year && previous.retry === retry) {
          data = {
            ...data,
            overview: previous.data.overview,
            months: previous.data.months,
            dueMonths: previous.data.dueMonths,
            generatedAt: previous.data.generatedAt,
            dataUpdatedAt: previous.data.dataUpdatedAt,
            departments: previous.data.departments,
            attentionSummary: previous.data.attentionSummary,
            ...(previous.attentionPage === attentionPage
              ? { attention: previous.data.attention }
              : {}),
          };
        }
        if (data) cached.current = { data, year, retry, attentionPage };
        setState({ ...next, data: data ?? (previous?.year === year ? previous.data : null) });
      },
    );
    pager.current = session;
    // oxlint-disable-next-line react/set-state-in-effect -- Start a new paged request session for the selected portfolio.
    void session.loadMore();
    return () => session.dispose();
  }, [year, view, attentionPage, retry]);
  const loadMore = useCallback(() => pager.current?.loadMore(), []);
  return { ...state, loadMore };
}
