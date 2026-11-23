// One request at a time; a disposed query can never append into a newer portfolio.
// Phân trang nối tiếp, khử trùng theo id. Hủy phiên lọc cũ để kết quả không trộn giữa các năm/trạng thái.
export function createDashboardPager(request, filters, onChange) {
  const controller = new AbortController();
  let disposed = false,
    busy = false,
    page = 0;
  let state = {
    data: null,
    loading: true,
    loadingMore: false,
    error: null,
    moreError: null,
    hasMore: true,
  };
  function emit(patch) {
    state = { ...state, ...patch };
    if (!disposed) onChange(state);
  }
  async function loadMore() {
    if (disposed || busy || !state.hasMore) return;
    busy = true;
    const nextPage = page + 1;
    emit({ loading: nextPage === 1, loadingMore: nextPage > 1, error: null, moreError: null });
    try {
      const response = await request(
        { ...filters, projectPage: nextPage, projectPageSize: 20 },
        { signal: controller.signal, timeout: 30000 },
      );
      if (disposed) return;
      const projects = response.projects;
      const unique = new Map((state.data?.projects.items ?? []).map((item) => [item.id, item]));
      for (const item of projects.items) unique.set(item.id, item);
      page = projects.pageNumber ?? nextPage;
      const totalPages = projects.totalPages ?? Math.ceil(projects.totalCount / projects.pageSize);
      emit({
        data: { ...response, projects: { ...projects, items: [...unique.values()] } },
        hasMore: page >= nextPage && page < totalPages && unique.size < projects.totalCount,
      });
    } catch (error) {
      if (!disposed) emit(nextPage === 1 ? { error } : { moreError: error });
    } finally {
      busy = false;
      if (!disposed) emit({ loading: false, loadingMore: false });
    }
  }
  return {
    loadMore,
    dispose() {
      disposed = true;
      controller.abort();
    },
  };
}
