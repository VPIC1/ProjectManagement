import useProjectStatusOptions from "../../hooks/useProjectStatusOptions";
import useLanguage from "../../hooks/useLanguage";
import { Alert, Button, Empty, Form, Modal, Popconfirm, Spin, Tag, Tooltip, message } from "antd";
import { useEffect, useState } from "react";
import { FaFileExcel } from "react-icons/fa6";
import {
  createProject,
  deleteProject,
  exportProjectExcel,
  getProjectById,
  updateProject,
} from "../../utils/endpoint";
import ProjectWorkFields from "./ProjectWorkFields";
import ProjectTasks from "./ProjectTasks";
import ProjectModalLayout from "./ProjectModalLayout";
import ProjectSummary from "./ProjectSummary";
import {
  fillForm,
  formatDateTime,
  getRequestError,
  projectPayload,
  REQUEST_CONFIG,
  toProjectValues,
} from "../../utils/projectDetailUtils";

// Modal dùng chung từ danh sách và dashboard. Chỉ bật nền mờ khi sửa dự án đã tồn tại.
export default function ProjectDetailModal({ id = null, onClose, onChanged, onDeleted }) {
  const { t, language, content } = useLanguage();
  const PROJECT_STATUS_OPTIONS = useProjectStatusOptions();
  const [form] = Form.useForm();
  const [notice, noticeHolder] = message.useMessage();
  const [confirm, confirmHolder] = Modal.useModal();
  const [projectId, setProjectId] = useState(id);
  const [editing, setEditing] = useState(!id);
  const [collapsed, setCollapsed] = useState(false);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [taskBusy, setTaskBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);
  const busy = saving || deleting || taskBusy || exporting;
  const editFocus = Boolean(projectId) && editing && !collapsed;

  useEffect(() => {
    if (!projectId) return;
    let current = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getProjectById(projectId, REQUEST_CONFIG);
        if (!current) return;
        setProject(response);
        fillForm(form, toProjectValues(response));
      } catch (requestError) {
        if (current) setError(getRequestError(requestError));
      } finally {
        if (current) setLoading(false);
      }
    };
    // oxlint-disable-next-line react/set-state-in-effect -- Loads the selected project's editable details.
    void load();
    return () => {
      current = false;
    };
  }, [projectId, form, retry]);

  const close = () => {
    if (busy) return;
    if (form.isFieldsTouched()) {
      confirm.confirm({
        title: t("Bỏ thay đổi chưa lưu?"),
        content: t("Thông tin dự án đang sửa sẽ không được lưu."),
        okText: t("Bỏ thay đổi"),
        cancelText: t("Tiếp tục sửa"),
        onOk: onClose,
      });
    } else onClose();
  };
  const save = async (values) => {
    setSaving(true);
    try {
      const payload = projectPayload(values);
      const response = projectId
        ? await updateProject(projectId, payload, REQUEST_CONFIG)
        : await createProject(payload, REQUEST_CONFIG);
      setProject(response);
      setProjectId(response.id);
      fillForm(form, toProjectValues(response));
      setEditing(false);
      notice.success(
        projectId
          ? t("Đã cập nhật dự án.")
          : t("Đã tạo dự án. Bạn có thể thêm công việc bên dưới."),
      );
      onChanged?.();
    } catch (requestError) {
      notice.error(getRequestError(requestError));
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    setDeleting(true);
    try {
      await deleteProject(projectId, REQUEST_CONFIG);
      onDeleted?.(project);
      onChanged?.();
      onClose();
    } catch (requestError) {
      notice.error(getRequestError(requestError));
    } finally {
      setDeleting(false);
    }
  };

  const downloadExcel = async () => {
    if (!projectId || busy) return;
    setExporting(true);
    try {
      const blob = await exportProjectExcel(projectId, language, {
        timeout: 60000,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        `${project.projectCode} - ${content(project, "projectName")}`
          .split("")
          .map((char) => (char.charCodeAt(0) < 32 ? "_" : char))
          .join("")
          .replace(/[<>:"/\\|?*]/g, "_")
          .slice(0, 180)
          .replace(/[ .]+$/, "") + ".xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) {
      if (requestError.response?.data instanceof Blob) {
        try {
          requestError.response.data = JSON.parse(await requestError.response.data.text());
        } catch {
          /* Non-JSON errors use the default message. */
        }
      }
      notice.error(getRequestError(requestError, "Không thể xuất Excel. Vui lòng thử lại."));
    } finally {
      setExporting(false);
    }
  };

  return (
    <ProjectModalLayout
      editFocus={editFocus}
      editing={editing}
      title={
        <div className="flex items-center gap-2 pr-8">
          <span>{projectId ? t("Chi tiết dự án") : t("Thêm dự án")}</span>
          {project && (
            <Tag variant="solid" color="red">
              {project.projectCode}
            </Tag>
          )}
        </div>
      }
      keyboard={!busy}
      closable={!busy}
      onCancel={close}
      destroyOnHidden
    >
      {noticeHolder}
      {confirmHolder}
      {editFocus && <div className="project-edit-focus__veil" aria-hidden="true" />}
      <div className="flex h-full min-w-0 min-h-0 flex-col gap-3">
        <section
          className={`project-edit-focus__panel ${editing ? "min-h-0 flex-1" : "max-h-[55dvh] shrink-0"} overflow-auto rounded-lg border border-gray-200 bg-white p-3 ${editFocus ? "project-edit-focus__panel--active" : ""}`}
        >
          <div
            className={`flex shrink-0 items-center justify-between gap-2 ${editing ? "project-edit-toolbar" : ""} ${collapsed ? "" : "mb-2 flex-wrap"}`}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Tooltip title={content(project, "projectName")}>
                <h2 className="truncate font-semibold">
                  {content(project, "projectName") || t("Thông tin dự án")}
                </h2>
              </Tooltip>
              {project && (
                <Tag
                  variant="solid"
                  color={
                    PROJECT_STATUS_OPTIONS.find((item) => item.value === project.status)?.color
                  }
                >
                  {PROJECT_STATUS_OPTIONS.find((item) => item.value === project.status)?.label ??
                    project.status}
                </Tag>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {projectId && !editing && (
                <Button
                  color="green"
                  variant="solid"
                  icon={<FaFileExcel />}
                  onClick={downloadExcel}
                  loading={exporting}
                  disabled={busy || loading || Boolean(error)}
                >
                  {t("Xuất Excel")}
                </Button>
              )}
              {!collapsed && (
                <>
                  {projectId && (
                    <Popconfirm
                      title={t("Xóa dự án {code}?", {
                        code: project?.projectCode || t("Dự án này"),
                      })}
                      description={
                        <div className="max-w-80">
                          {t(
                            "Dự án và toàn bộ công việc thuộc dự án sẽ bị xóa vĩnh viễn. Thao tác này không thể hoàn tác.",
                          )}
                        </div>
                      }
                      okText={t("Xóa dự án")}
                      cancelText={t("Hủy")}
                      okButtonProps={{ danger: true }}
                      onConfirm={remove}
                      disabled={busy || loading || Boolean(error)}
                    >
                      <Button
                        danger
                        loading={deleting}
                        disabled={busy || loading || Boolean(error)}
                      >
                        {t("Xóa dự án")}
                      </Button>
                    </Popconfirm>
                  )}
                  {editing ? (
                    <>
                      {project && (
                        <Button
                          disabled={busy}
                          onClick={() => {
                            fillForm(form, toProjectValues(project));
                            setEditing(false);
                          }}
                        >
                          {t("Hủy sửa")}
                        </Button>
                      )}
                      <Button
                        type="primary"
                        loading={saving}
                        disabled={busy || loading || Boolean(error)}
                        onClick={() => form.submit()}
                      >
                        {projectId ? t("Lưu dự án") : t("Tạo dự án")}
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="primary"
                      disabled={busy || loading || Boolean(error)}
                      onClick={() => setEditing(true)}
                    >
                      {t("Chỉnh sửa")}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
          <div id="project-details-content" hidden={collapsed}>
            <div className="min-w-0 pr-1">
              {error && (
                <Alert
                  className="mb-3"
                  type="error"
                  showIcon
                  title={t("Không tải được dự án")}
                  description={t(error)}
                  action={
                    <Button onClick={() => setRetry((value) => value + 1)}>{t("Thử lại")}</Button>
                  }
                />
              )}
              <Spin spinning={loading}>
                {project && !editing && <ProjectSummary project={project} />}
                <div hidden={!editing}>
                  <Form
                    className="project-details-form"
                    name="projectDetails"
                    form={form}
                    layout="vertical"
                    size="middle"
                    initialValues={toProjectValues()}
                    disabled={loading || busy || Boolean(error)}
                    onFinish={save}
                  >
                    <ProjectWorkFields projectCode={project?.projectCode} compact />
                  </Form>
                </div>
              </Spin>
            </div>
            {project && (
              <div className="mt-2 flex justify-end shrink-0 text-xs text-gray-500">
                {t("Tạo")}: {formatDateTime(project.createdDate)} · {t("Cập nhật")}:{" "}
                {formatDateTime(project.updatedDate)}
              </div>
            )}
          </div>
        </section>
        <div className={editing ? "hidden" : "flex min-h-0 flex-1 flex-col"} inert={editing}>
          {project ? (
            <ProjectTasks
              key={project.projectCode}
              projectCode={project.projectCode}
              managers={project.manager}
              disabled={editFocus || saving || deleting || loading}
              expanded={collapsed}
              onToggleExpanded={() => setCollapsed((value) => !value)}
              onBusyChange={setTaskBusy}
              onChanged={onChanged}
            />
          ) : (
            <section className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-gray-200 bg-white">
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  projectId
                    ? t("Đang chờ thông tin dự án")
                    : t("Lưu dự án trước khi thêm công việc")
                }
              />
            </section>
          )}
        </div>
      </div>
    </ProjectModalLayout>
  );
}
