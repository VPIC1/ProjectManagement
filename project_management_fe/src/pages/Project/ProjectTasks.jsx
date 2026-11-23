import useProjectStatusOptions from "../../hooks/useProjectStatusOptions";
import useLanguage from "../../hooks/useLanguage";
import {
  Alert,
  Button,
  Empty,
  Popconfirm,
  Popover,
  Progress,
  Spin,
  Tag,
  Tooltip,
  message,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { FaCompress, FaExpand, FaRegTrashCan } from "react-icons/fa6";
import { deleteTask, getTaskById, getTasks, updateTask } from "../../utils/endpoint";
import { formatDate, getRequestError, REQUEST_CONFIG } from "../../utils/projectDetailUtils";
import TaskEditorModal from "./TaskEditorModal";
import TaskCompletionModal from "./TaskCompletionModal";
import TaskStatusControl from "./TaskStatusControl";
import { fetchAllProjectTasks, getTaskProgress } from "../../utils/projectTaskData";
import ProjectUserTags from "../../components/ProjectUserTags";

export default function ProjectTasks({
  projectCode,
  previewTasks,
  onDraftChange,
  managers,
  disabled = false,
  expanded = false,
  onToggleExpanded,
  onBusyChange,
  onChanged,
}) {
  const { t, content } = useLanguage();
  const PROJECT_STATUS_OPTIONS = useProjectStatusOptions();
  const [savedTasks, setTasks] = useState([]);
  const draftMode = previewTasks !== undefined;
  const readOnly = draftMode && !onDraftChange;
  const tasks = previewTasks ?? savedTasks;
  const changingStatusRef = useRef(null);
  const [changingStatus, setChangingStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [editor, setEditor] = useState(null);
  const [completionTask, setCompletionTask] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [editorSaving, setEditorSaving] = useState(false);
  const [notice, noticeHolder] = message.useMessage();
  const busy = disabled || deleting !== null || editorSaving || changingStatus !== null;
  const reload = () => setRefresh((value) => value + 1);

  useEffect(() => {
    if (draftMode) return;
    let current = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchAllProjectTasks(getTasks, projectCode, () => current);
        if (current && response) setTasks(response);
      } catch (requestError) {
        if (current) {
          setError(getRequestError(requestError));
          setTasks([]);
        }
      } finally {
        if (current) setLoading(false);
      }
    };
    // oxlint-disable-next-line react/set-state-in-effect -- Loads every task page for this project.
    void load();
    return () => {
      current = false;
    };
  }, [projectCode, refresh, draftMode]);

  const remove = async (taskId) => {
    if (draftMode) {
      onDraftChange(tasks.filter((task) => task.id !== taskId));
      notice.success(t("Đã xóa công việc."));
      return;
    }
    setDeleting(taskId);
    onBusyChange(true);
    try {
      await deleteTask(taskId, REQUEST_CONFIG);
      notice.success(t("Đã xóa công việc."));
      onChanged?.();
      reload();
    } catch (requestError) {
      notice.error(getRequestError(requestError));
    } finally {
      setDeleting(null);
      onBusyChange(false);
    }
  };

  const statusCounts = useMemo(
    () =>
      PROJECT_STATUS_OPTIONS.map((status) => ({
        ...status,
        count: tasks.filter((task) => task.status === status.value).length,
      })),
    [tasks, PROJECT_STATUS_OPTIONS],
  );
  const progress = useMemo(() => getTaskProgress(tasks), [tasks]);
  const changeStatus = async (task, status, completion = null) => {
    if (
      busy ||
      loading ||
      changingStatusRef.current !== null ||
      (status === task.status && !completion)
    )
      return false;
    if (draftMode && status === "COMPLETE" && !completion) {
      setCompletionTask(task);
      return false;
    }
    if (draftMode) {
      onDraftChange(
        tasks.map((item) =>
          item.id === task.id
            ? {
                ...item,
                status,
                ...completion,
                progress: status === "COMPLETE" ? 100 : item.progress,
              }
            : item,
        ),
      );
      return true;
    }
    changingStatusRef.current = task.id;
    setChangingStatus(task.id);
    onBusyChange(true);
    try {
      // PUT requires all editable fields. Read fresh details before changing only status.
      const latest = await getTaskById(task.id, REQUEST_CONFIG);
      if (latest.projectCode !== projectCode) {
        notice.warning(t("Công việc đã chuyển sang dự án khác. Danh sách sẽ được tải lại."));
        reload();
        return;
      }
      if (status === "COMPLETE" && !completion) {
        setCompletionTask(latest);
        return false;
      }
      const updated = await updateTask(
        task.id,
        { ...latest, ...completion, status, ...(status === "COMPLETE" ? { progress: 100 } : {}) },
        REQUEST_CONFIG,
      );
      setTasks((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
      notice.success(t("Đã cập nhật trạng thái công việc."));
      onChanged?.();
      return true;
    } catch (requestError) {
      notice.error(getRequestError(requestError));
    } finally {
      changingStatusRef.current = null;
      setChangingStatus(null);
      onBusyChange(false);
    }
  };

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white p-3">
      {noticeHolder}
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">
          {t("Danh sách công việc ({count})", { count: tasks.length })}
        </h2>
        <div className="flex items-center gap-2">
          {onToggleExpanded && (
            <Tooltip
              title={
                expanded
                  ? t("Khôi phục thông tin dự án")
                  : t("Thu gọn thông tin dự án để tập trung vào công việc")
              }
            >
              <Button
                size="small"
                icon={expanded ? <FaCompress /> : <FaExpand />}
                aria-pressed={expanded}
                disabled={disabled}
                onClick={onToggleExpanded}
              >
                {expanded ? t("Thu gọn") : t("Mở rộng")}
              </Button>
            </Tooltip>
          )}
          {!readOnly && (
            <>
              <Button size="small" onClick={reload} disabled={loading || busy} hidden={draftMode}>
                {t("Tải lại")}
              </Button>
              <Button
                type="primary"
                size="small"
                onClick={() => setEditor({ id: null })}
                disabled={busy}
              >
                {t("Thêm công việc")}
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div
          className="flex flex-wrap items-center gap-2"
          aria-label={t("Thống kê công việc theo trạng thái")}
        >
          {statusCounts.map((status) => (
            <Tag key={status.value} color={status.color} variant="solid" className="me-0!">
              {status.label} ({status.count})
            </Tag>
          ))}
        </div>
        <div className="flex w-80 max-w-full items-center gap-2" aria-label={t("Tiến độ dự án")}>
          <span className="shrink-0 text-xs text-gray-600">{t("Tiến độ")}</span>
          <div className="min-w-0 flex-1">
            <Progress percent={progress.percent} size="small" />
          </div>
        </div>
      </div>
      {error && (
        <Alert
          className="mb-2"
          type="error"
          showIcon
          title={t("Không tải được công việc")}
          description={t(error)}
          action={
            <Button size="small" onClick={reload}>
              {t("Thử lại")}
            </Button>
          }
        />
      )}
      <div
        role="region"
        aria-label={t("Danh sách toàn bộ công việc")}
        className="min-h-0 min-w-0 flex-1 overflow-auto pr-1"
      >
        <Spin spinning={loading}>
          {tasks.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={loading ? t("Đang tải công việc") : t("Chưa có công việc")}
            />
          ) : (
            <ul aria-label={t("Danh sách công việc")} className="flex flex-col gap-2">
              {tasks.map((task) => (
                <li
                  key={task.id}
                  className="rounded-md border border-gray-200 px-3 py-2 hover:border-gray-300"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                        {readOnly ? (
                          <span className="min-w-0 break-words font-medium text-gray-800">
                            {content(task, "taskName")}
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="min-w-0 break-words text-left font-medium text-blue-600 hover:underline disabled:opacity-50"
                            disabled={busy}
                            onClick={() => setEditor({ id: task.id })}
                          >
                            {content(task, "taskName")}
                          </button>
                        )}
                        <Tag
                          variant="solid"
                          color={
                            PROJECT_STATUS_OPTIONS.find((status) => status.value === task.status)
                              ?.color
                          }
                          className="me-0!"
                        >
                          {PROJECT_STATUS_OPTIONS.find((status) => status.value === task.status)
                            ?.label ?? task.status}
                        </Tag>
                      </div>
                      {task.validationErrors?.length > 0 && (
                        <ul
                          className="mt-1 list-inside list-disc text-xs text-red-600"
                          role="status"
                        >
                          {task.validationErrors.map((issue, index) => (
                            <li key={index}>{issue}</li>
                          ))}
                        </ul>
                      )}
                      {content(task, "description") && (
                        <Popover
                          title={t("Mô tả")}
                          content={
                            <div className="max-h-[min(280px,50dvh)] min-w-0 overflow-y-auto overscroll-contain whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">
                              {content(task, "description")}
                            </div>
                          }
                          classNames={{
                            root: "task-description-popover",
                          }}
                          styles={{
                            root: { width: 480, maxWidth: "calc(100vw - 32px)" },
                            container: { width: "100%", maxWidth: "100%" },
                          }}
                          placement="right"
                          autoAdjustOverflow={{
                            adjustX: true,
                            adjustY: true,
                            shiftX: true,
                            shiftY: true,
                          }}
                          arrow={false}
                          trigger={["hover", "click"]}
                        >
                          <p className="mt-1 line-clamp-2 w-fit max-w-[min(100%,640px)] cursor-pointer whitespace-pre-wrap break-words text-sm text-gray-500">
                            {content(task, "description")}
                          </p>
                        </Popover>
                      )}
                      <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
                        <span className="inline-flex flex-wrap items-center gap-1">
                          <span>{t("Người thực hiện")}:</span>
                          <ProjectUserTags value={task.pic} fallback={t("Chưa phân công")} />
                        </span>
                        <span>
                          {t("Thời gian dự kiến")}: {formatDate(task.startDate)} –{" "}
                          {formatDate(task.endDate)}
                        </span>
                        {(task.actualStartDate || task.actualEndDate) && (
                          <span>
                            {t("Thời gian thực tế")}: {formatDate(task.actualStartDate)} –{" "}
                            {formatDate(task.actualEndDate)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {!readOnly && (
                        <div className="flex items-center gap-2">
                          <TaskStatusControl
                            value={task.status}
                            taskName={content(task, "taskName")}
                            disabled={busy || loading}
                            saving={changingStatus === task.id}
                            onChange={(status) => changeStatus(task, status)}
                          />
                          <Popconfirm
                            title={t("Xóa công việc này?")}
                            description={t("Thao tác này không thể hoàn tác.")}
                            okText={t("Xóa")}
                            cancelText={t("Hủy")}
                            okButtonProps={{ danger: true }}
                            onConfirm={() => remove(task.id)}
                            disabled={busy}
                          >
                            <Tooltip title={t("Xóa công việc")}>
                              <Button
                                size="small"
                                danger
                                icon={<FaRegTrashCan />}
                                aria-label={t("Xóa công việc: {name}", {
                                  name: content(task, "taskName"),
                                })}
                                loading={deleting === task.id}
                                disabled={busy}
                              />
                            </Tooltip>
                          </Popconfirm>
                        </div>
                      )}
                      <div
                        className="flex w-64 max-w-full items-center gap-2"
                        aria-label={t("Tiến độ")}
                      >
                        <span className="shrink-0 text-xs text-gray-500">{t("Tiến độ")}</span>
                        <Progress
                          percent={task.progress ?? 0}
                          size={[-1, 8]}
                          className="mb-0! min-w-0 flex-1"
                        />
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Spin>
      </div>
      {completionTask && (
        <TaskCompletionModal
          task={completionTask}
          managers={managers}
          saving={changingStatus === completionTask.id}
          onCancel={() => {
            if (changingStatusRef.current === null) setCompletionTask(null);
          }}
          onConfirm={async (values) => {
            if (await changeStatus(completionTask, "COMPLETE", values)) setCompletionTask(null);
          }}
        />
      )}
      {!readOnly && editor && (
        <TaskEditorModal
          taskId={editor.id}
          draft={draftMode}
          initialTask={draftMode ? (tasks.find((task) => task.id === editor.id) ?? null) : null}
          projectCode={projectCode}
          managers={managers}
          onClose={() => setEditor(null)}
          onSaved={(response) => {
            notice.success(editor.id ? t("Đã cập nhật công việc.") : t("Đã thêm công việc."));
            if (draftMode) {
              onDraftChange(
                editor.id !== null
                  ? tasks.map((task) => (task.id === editor.id ? response : task))
                  : [...tasks, response],
              );
              setEditor(null);
              return;
            }
            setEditor(null);
            reload();
            onChanged?.();
          }}
          onBusyChange={(value) => {
            setEditorSaving(value);
            onBusyChange?.(value);
          }}
        />
      )}
    </section>
  );
}
