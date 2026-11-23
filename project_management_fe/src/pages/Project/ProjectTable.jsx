import useProjectStatusOptions from "../../hooks/useProjectStatusOptions";
import useLanguage from "../../hooks/useLanguage";
import { Button, Input, message, Progress, Table, Tag, Tooltip } from "antd";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import { useEffect, useMemo, useState } from "react";
import { FaMagnifyingGlass, FaPlus, FaRotateRight } from "react-icons/fa6";
import { getProjects } from "../../utils/endpoint";
import { DEFAULT_PROJECT_QUERY } from "../../constants/projectConstants";
import { getProjectTableQuery } from "../../utils/projectTableUtils";
import { getRequestError } from "../../utils/projectDetailUtils";
import ProjectDetailModal from "./ProjectDetailModal";
import ProjectExcelImport from "./ProjectExcelImport";
import useProjectUsers from "../../hooks/useProjectUsers";
import ProjectUserTags from "../../components/ProjectUserTags";

const displayDate = (value, withTime = false) =>
  value && dayjs(value).isValid()
    ? dayjs(value).format(withTime ? "DD/MM/YYYY HH:mm:ss" : "DD/MM/YYYY")
    : "—";

const ProjectTable = ({ onChanged }) => {
  const { t, content } = useLanguage();
  const PROJECT_STATUS_OPTIONS = useProjectStatusOptions();
  const [notice, noticeHolder] = message.useMessage();
  const { options: employeeOptions } = useProjectUsers();
  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState({ ...DEFAULT_PROJECT_QUERY });
  const [result, setResult] = useState({ items: [], totalCount: 0 });
  const [loading, setLoading] = useState(false);
  const [id, setId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let current = true;
    const loadProjects = async () => {
      setLoading(true);
      try {
        const response = await getProjects(query, { timeout: 15000 });
        if (!current) return;
        const lastPage = Math.max(1, response.totalPages);
        if (query.pageNumber > lastPage) {
          setQuery((previous) => ({ ...previous, pageNumber: lastPage }));
          return;
        }
        setResult(response);
      } catch (requestError) {
        if (!current) return;

        message.error(getRequestError(requestError));
      } finally {
        if (current) setLoading(false);
      }
    };
    // oxlint-disable-next-line react/set-state-in-effect -- Fetches the server page and tracks loading.
    void loadProjects();
    // Ignore obsolete results when filters change; cancellation stays in api.js.
    return () => {
      current = false;
    };
  }, [query, refreshKey]);

  const columns = useMemo(() => {
    const employeeFilters = employeeOptions.map(({ value, label }) => ({ value, text: label }));
    const sortable = (title, dataIndex, width, extra = {}) => ({
      title,
      dataIndex,
      key: dataIndex,
      width,
      sorter: true,
      sortOrder:
        query.sortBy === dataIndex ? (query.sortDirection === "asc" ? "ascend" : "descend") : null,
      render: (value) => value || "—",
      ...extra,
    });
    const dateComparison = (planned, actual) => (
      <div className="grid grid-cols-[max-content_max-content] items-center gap-x-2 gap-y-1 whitespace-nowrap text-sm tabular-nums">
        <span className="text-xs text-gray-500">{t("Kế hoạch")}</span>
        <span className="text-slate-600">{displayDate(planned)}</span>
        <span className="text-xs text-gray-500">{t("Thực tế")}</span>
        <span className={actual ? "font-medium text-blue-600" : "text-gray-400"}>
          {displayDate(actual)}
        </span>
      </div>
    );
    return [
      sortable(t("Mã dự án"), "projectCode", 100, {
        fixed: "left",
        render: (value, record) => {
          if (!value) return "—";
          return (
            <Button variant="link" color="red" size="small" onClick={() => setId(record.id)}>
              <span className="underline underline-offset-4">{value}</span>
            </Button>
          );
        },
      }),
      sortable(t("Tên dự án"), "projectName", 260, {
        fixed: "left",
        ellipsis: { showTitle: false },
        render: (_, record) => (
          <Tooltip title={content(record, "projectName")}>
            <span className="line-clamp-2 whitespace-normal break-words">
              {content(record, "projectName") || "—"}
            </span>
          </Tooltip>
        ),
      }),
      sortable(t("Trạng thái"), "status", 120, {
        filters: PROJECT_STATUS_OPTIONS.map(({ label, value }) => ({
          text: label,
          value,
        })),
        filteredValue: query.status ?? null,
        filterMultiple: true,
        render: (value) => {
          const status = PROJECT_STATUS_OPTIONS.find((item) => item.value === value);
          return (
            <Tag color={status?.color} variant="solid">
              {status?.label ?? value}
            </Tag>
          );
        },
      }),
      {
        title: t("Tiến độ"),
        key: "progress",
        width: 240,
        render: (_, record) => (
          <div className="grid grid-cols-[max-content_minmax(0,1fr)_3.5rem] items-center gap-x-2 gap-y-1">
            <span className="text-xs text-gray-500">{t("Kế hoạch")}</span>
            {typeof record.plannedProgressPercent === "number" ? (
              <>
                <Progress
                  aria-label={t("Kế hoạch")}
                  percent={record.plannedProgressPercent}
                  showInfo={false}
                  className="m-0! min-w-0 w-full!"
                  size={[-1, 10]}
                  strokeColor="#94a3b8"
                  status="normal"
                />
                <span className="text-right whitespace-nowrap tabular-nums">
                  {record.plannedProgressPercent}%
                </span>
              </>
            ) : (
              <Tooltip title={t(record.status === "CANCEL" ? "Đã hủy" : "Chưa đủ ngày dự kiến")}>
                <span className="col-span-2 text-xs text-gray-400">—</span>
              </Tooltip>
            )}
            <span className="text-xs text-gray-500">{t("Thực tế")}</span>
            {typeof record.progressPercent === "number" ? (
              <>
                <Progress
                  aria-label={t("Thực tế")}
                  percent={record.progressPercent}
                  showInfo={false}
                  className="m-0! min-w-0 w-full!"
                  size={[-1, 10]}
                  strokeColor={record.progressPercent === 100 ? "#52c41a" : "#1677ff"}
                  status="normal"
                />
                <span className="text-right whitespace-nowrap tabular-nums">
                  {record.progressPercent}%
                </span>
              </>
            ) : (
              <span className="col-span-2 text-xs text-gray-400">—</span>
            )}
          </div>
        ),
      },
      sortable(t("Người phụ trách"), "manager", 260, {
        filters: employeeFilters,
        filteredValue: query.managerCodes ?? null,
        filterMultiple: true,
        filterSearch: true,
        render: (value) => <ProjectUserTags value={value} grid />,
      }),
      sortable(t("Người yêu cầu"), "requester", 180, {
        ellipsis: { showTitle: false },
        render: (value) => (
          <Tooltip title={value}>
            <span className="block truncate">{value || "—"}</span>
          </Tooltip>
        ),
      }),
      sortable(t("Ngày bắt đầu"), "startDate", 190, {
        render: (value, record) => dateComparison(value, record.actualStartDate),
      }),
      sortable(t("Ngày kết thúc"), "endDate", 190, {
        render: (value, record) => dateComparison(value, record.actualEndDate),
      }),
    ];
  }, [
    t,
    PROJECT_STATUS_OPTIONS,
    query.sortBy,
    query.sortDirection,
    query.status,
    query.managerCodes,
    employeeOptions,
    content,
  ]);

  const applySearch = (value) => {
    const search = value.trim() || undefined;
    setQuery((previous) => ({ ...previous, pageNumber: 1, search }));
  };
  const resetFilters = () => {
    setSearchText("");
    setQuery((previous) => ({
      ...DEFAULT_PROJECT_QUERY,
      pageSize: previous.pageSize,
    }));
  };
  const refresh = () => setRefreshKey((value) => value + 1);

  return (
    <>
      {noticeHolder}
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xl font-semibold">
            {t("Danh sách dự án ({count} dự án)", { count: result.totalCount })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ProjectExcelImport
              onImported={(project) => {
                refresh();
                onChanged?.();
                setId(project.id);
              }}
            />
            <Button variant="solid" color="red" icon={<FaPlus />} onClick={() => setCreating(true)}>
              {t("Thêm dự án")}
            </Button>
          </div>
        </div>
        <div className="rounded-md border border-gray-300 bg-white p-3 flex flex-1 flex-col overflow-auto">
          <div className="mb-3 flex items-center gap-2">
            <Input.Search
              enterButton={<Button aria-label={t("Tìm kiếm")} icon={<FaMagnifyingGlass />} />}
              className="min-w-[240px] max-w-[480px] flex-1"
              aria-label={t("Tìm kiếm dự án")}
              allowClear
              maxLength={255}
              placeholder={t("Tìm mã, tên, mô tả hoặc người phụ trách")}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              onSearch={applySearch}
            />
            <Button className="shrink-0" onClick={resetFilters}>
              {t("Xóa bộ lọc")}
            </Button>
            <Button
              className="shrink-0"
              onClick={refresh}
              disabled={loading}
              icon={<FaRotateRight />}
            >
              {t("Tải lại")}
            </Button>
          </div>
          <div className="flex-1 overflow-auto">
            <Table
              sticky
              rowKey="id"
              columns={columns}
              dataSource={result.items}
              loading={loading}
              size="small"
              scroll={{ x: 1670 }}
              pagination={{
                current: query.pageNumber,
                pageSize: query.pageSize,
                total: result.totalCount,

                pageSizeOptions: [10, 20, 50, 100],
                showTotal: (total, range) =>
                  total === 0
                    ? t("{count} dự án", { count: 0 })
                    : t("{from}–{to} / {total} dự án", { from: range[0], to: range[1], total }),
              }}
              onChange={(pagination, filters, sorter, extra) =>
                setQuery((previous) =>
                  getProjectTableQuery(previous, pagination, sorter, extra.action, filters),
                )
              }
            />
          </div>
        </div>
      </div>
      {(id !== null || creating) && (
        <ProjectDetailModal
          key={id ?? "new"}
          id={id}
          onClose={() => {
            setId(null);
            setCreating(false);
          }}
          onDeleted={(project) =>
            notice.success(
              t("Đã xóa dự án {code} và toàn bộ công việc thuộc dự án.", {
                code: project.projectCode,
              }),
            )
          }
          onChanged={() => {
            refresh();
            onChanged?.();
          }}
        />
      )}
    </>
  );
};

export default ProjectTable;
