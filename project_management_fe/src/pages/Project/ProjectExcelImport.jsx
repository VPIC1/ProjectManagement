import { useState } from "react";
import { Button, Empty, Form, Modal, Spin, Tag, Tooltip, Upload, message } from "antd";
import { FaDownload, FaFileExcel, FaUpload } from "react-icons/fa6";
import useLanguage from "../../hooks/useLanguage";
import ProjectModalLayout from "./ProjectModalLayout";
import ProjectSummary from "./ProjectSummary";
import ProjectTasks from "./ProjectTasks";
import ProjectWorkFields from "./ProjectWorkFields";
import {
  createDraftTaskId,
  getImportProjectErrors,
  getImportTaskErrors,
} from "../../utils/projectImportDraft";
import useProjectStatusOptions from "../../hooks/useProjectStatusOptions";
import {
  downloadProjectTemplate,
  previewProjectExcel,
  importProjectDraft,
} from "../../utils/endpoint";
import {
  fillForm,
  getRequestError,
  projectPayload,
  toProjectValues,
} from "../../utils/projectDetailUtils";

// Bản nháp nằm ở client cho đến khi xác nhận import. Sửa task ở đây chưa gọi API CRUD task.
export default function ProjectExcelImport({ onImported }) {
  const { t, content } = useLanguage();
  const statuses = useProjectStatusOptions();
  const [notice, holder] = message.useMessage();
  const [form] = Form.useForm();
  const [confirm, confirmHolder] = Modal.useModal();
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [taskBusy, setTaskBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [file, setFile] = useState(null);
  const [draft, setDraft] = useState(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const busy = reading || saving || taskBusy;
  const editFocus = editing && !collapsed;
  const projectStatus = statuses.find((item) => item.value === draft?.project.status);
  const template = async () => {
    setDownloading(true);
    try {
      const blob = await downloadProjectTemplate({ timeout: 60000 });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Mau-du-an.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) {
      if (requestError.response?.data instanceof Blob) {
        try {
          requestError.response.data = JSON.parse(await requestError.response.data.text());
        } catch {
          /* Dùng thông báo mặc định nếu không phải JSON. */
        }
      }
      notice.error(getRequestError(requestError, "Không thể tải mẫu dự án."));
    } finally {
      setDownloading(false);
    }
  };
  const chooseFile = async (nextFile) => {
    setCollapsed(false);
    setEditing(false);
    setDirty(false);
    setDraft(null);
    setFile(null);
    if (!/\.xlsx$/i.test(nextFile.name) || nextFile.size > 5 * 1024 * 1024) {
      notice.error(t("Chọn tệp .xlsx không quá 5 MB."));
      return false;
    }
    setFile(nextFile);
    setReading(true);
    try {
      const result = await previewProjectExcel(nextFile, { timeout: 60000 });
      const tasks = result.tasks.map((task, index) => ({
        ...task,
        id: createDraftTaskId(),
        importErrors: result.errors
          .filter((issue) => issue.row === (result.taskRows?.[index] ?? index + 10))
          .map((issue) => issue.message),
      }));
      setDraft({
        project: result.project,
        tasks,
        errors: result.errors.filter((issue) => issue.row < 10),
      });
      fillForm(form, toProjectValues(result.project));
      if (result.errors.length) notice.error(t("Hãy chỉnh sửa các trường lỗi trước khi nhập."));
    } catch (requestError) {
      notice.error(getRequestError(requestError));
    } finally {
      setReading(false);
    }
    return false;
  };
  const reset = () => {
    setOpen(false);
    setCollapsed(false);
    setEditing(false);
    setDirty(false);
    setFile(null);
    setDraft(null);
  };
  const close = () => {
    if (busy) return;
    if (dirty || (editing && form.isFieldsTouched())) {
      confirm.confirm({
        title: t("Bỏ thay đổi chưa lưu?"),
        content: t("Thông tin dự án đang sửa sẽ không được lưu."),
        okText: t("Bỏ thay đổi"),
        cancelText: t("Tiếp tục sửa"),
        onOk: reset,
      });
    } else reset();
  };
  const saveProject = (values) => {
    setDraft((previous) => ({
      ...previous,
      project: {
        ...projectPayload(values),
        requesterDepartmentName: values.requesterDepartment?.label,
      },
      errors: [],
    }));
    setEditing(false);
    setDirty(true);
  };
  const projectErrors = draft ? getImportProjectErrors(draft) : [];
  const hasTaskErrors = draft?.tasks.some(
    (task) => getImportTaskErrors(task, draft.project.manager).length > 0,
  );
  const save = async () => {
    if (busy || editing || !draft || projectErrors.length || hasTaskErrors) return;
    setSaving(true);
    try {
      const project = await importProjectDraft(draft, { timeout: 60000 });
      notice.success(
        t("Đã nhập dự án {code} và {count} công việc.", {
          code: project.projectCode,
          count: project.totalTasks,
        }),
      );
      reset();
      onImported?.(project);
    } catch (requestError) {
      notice.error(getRequestError(requestError));
    } finally {
      setSaving(false);
    }
  };
  const previewTasks = (draft?.tasks ?? [])
    .map((task, index) => ({
      ...task,
      order: index,
      validationErrors: getImportTaskErrors(task, draft.project.manager),
    }))
    .sort((left, right) => {
      if (!left.startDate && right.startDate) return 1;
      if (left.startDate && !right.startDate) return -1;
      return (
        (left.startDate ?? "").localeCompare(right.startDate ?? "") || left.order - right.order
      );
    });
  return (
    <>
      {holder}
      {confirmHolder}
      <Button icon={<FaDownload />} loading={downloading} onClick={template}>
        {t("Tải mẫu dự án")}
      </Button>
      <Button color="green" variant="solid" icon={<FaFileExcel />} onClick={() => setOpen(true)}>
        {t("Nhập Excel")}
      </Button>
      <ProjectModalLayout
        title={t("Nhập dự án từ Excel")}
        open={open}
        editFocus={editFocus}
        editing={editing}
        onCancel={close}
        closable={!busy}
        keyboard={!busy}
      >
        {editFocus && <div className="project-edit-focus__veil" aria-hidden="true" />}
        <div className="flex h-full min-h-0 min-w-0 flex-col gap-3">
          <section
            className={`project-edit-focus__panel ${editing ? "min-h-0 flex-1" : "max-h-[55dvh] shrink-0"} overflow-auto rounded-lg border border-gray-200 bg-white p-3 ${editFocus ? "project-edit-focus__panel--active" : ""}`}
          >
            <div
              className={`flex flex-wrap items-center justify-between gap-2 ${editing ? "project-edit-toolbar" : ""}`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Tooltip title={content(draft?.project, "projectName")}>
                  <h2 className="truncate font-semibold">
                    {content(draft?.project, "projectName") || t("Thông tin dự án")}
                  </h2>
                </Tooltip>
                {draft && (
                  <Tag variant="solid" color={projectStatus?.color}>
                    {projectStatus?.label ?? draft.project.status}
                  </Tag>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Upload
                  accept=".xlsx"
                  showUploadList={false}
                  beforeUpload={chooseFile}
                  disabled={busy || editing}
                >
                  <Button icon={<FaUpload />} disabled={busy || editing}>
                    {t("Chọn tệp Excel")}
                  </Button>
                </Upload>
                <Button onClick={close} disabled={busy}>
                  {t("Đóng")}
                </Button>
                {draft &&
                  !collapsed &&
                  (editing ? (
                    <>
                      <Button
                        disabled={busy}
                        onClick={() => {
                          fillForm(form, toProjectValues(draft.project));
                          setEditing(false);
                        }}
                      >
                        {t("Hủy sửa")}
                      </Button>
                      <Button type="primary" disabled={busy} onClick={() => form.submit()}>
                        {t("Lưu dự án")}
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="primary"
                      disabled={busy}
                      onClick={() => {
                        fillForm(form, toProjectValues(draft.project));
                        setEditing(true);
                      }}
                    >
                      {t("Chỉnh sửa")}
                    </Button>
                  ))}
                <Button
                  color="green"
                  variant="solid"
                  loading={saving}
                  disabled={busy || editing || !draft || projectErrors.length > 0 || hasTaskErrors}
                  onClick={save}
                >
                  {t("Xác nhận nhập")}
                </Button>
              </div>
            </div>
            <Tooltip title={file?.name}>
              <div className="mt-1 truncate text-xs text-gray-500">
                {file?.name ?? t("Chưa chọn tệp")}
              </div>
            </Tooltip>
            <div hidden={collapsed} className="mt-3">
              <div className="flex flex-col gap-3">
                {projectErrors.length > 0 && (
                  <ul className="list-inside list-disc text-sm text-red-600" role="status">
                    {projectErrors.map((issue, index) => (
                      <li key={index}>{issue}</li>
                    ))}
                  </ul>
                )}
                <Spin spinning={reading}>
                  {draft && !editing && <ProjectSummary project={draft.project} />}
                  <div hidden={!editing}>
                    <Form
                      form={form}
                      name="importProjectDetails"
                      className="project-details-form"
                      layout="vertical"
                      disabled={busy}
                      onFinish={saveProject}
                    >
                      <ProjectWorkFields compact />
                    </Form>
                  </div>
                </Spin>
              </div>
            </div>
          </section>
          <div className={editing ? "hidden" : "flex min-h-0 flex-1 flex-col"} inert={editing}>
            {draft ? (
              <ProjectTasks
                previewTasks={previewTasks}
                managers={draft.project.manager}
                expanded={collapsed}
                disabled={busy || editing}
                onDraftChange={(tasks) => {
                  setDraft((previous) => ({ ...previous, tasks }));
                  setDirty(true);
                }}
                onBusyChange={setTaskBusy}
                onToggleExpanded={() => setCollapsed((value) => !value)}
              />
            ) : (
              <section className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-gray-200 bg-white">
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={t(reading ? "Đang tải công việc" : "Chưa chọn tệp")}
                />
              </section>
            )}
          </div>
        </div>
      </ProjectModalLayout>
    </>
  );
}
