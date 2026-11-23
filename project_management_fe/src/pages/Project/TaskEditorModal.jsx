import useLanguage from "../../hooks/useLanguage";
import { Alert, Button, Form, Modal, Spin, message } from "antd";
import { useEffect, useState } from "react";
import { createTask, getTaskById, updateTask } from "../../utils/endpoint";
import { createDraftTaskId } from "../../utils/projectImportDraft";
import ProjectWorkFields from "./ProjectWorkFields";
import {
  fillForm,
  formatDateTime,
  getRequestError,
  REQUEST_CONFIG,
  taskPayload,
  toTaskValues,
} from "../../utils/projectDetailUtils";

export default function TaskEditorModal({
  taskId,
  projectCode,
  managers,
  onClose,
  onSaved,
  onBusyChange,
  draft = false,
  initialTask = null,
}) {
  const { t } = useLanguage();
  const [form] = Form.useForm();
  const [notice, noticeHolder] = message.useMessage();
  const [task, setTask] = useState(initialTask);
  const [loading, setLoading] = useState(Boolean(taskId) && !draft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);
  const [confirm, confirmHolder] = Modal.useModal();

  useEffect(() => {
    if (draft || !taskId) return;
    let current = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getTaskById(taskId, REQUEST_CONFIG);
        if (!current) return;
        if (response.projectCode !== projectCode) {
          setError("Công việc đã được chuyển sang dự án khác. Vui lòng tải lại danh sách.");
          return;
        }
        setTask(response);
        fillForm(form, toTaskValues(response));
      } catch (requestError) {
        if (current) setError(getRequestError(requestError));
      } finally {
        if (current) setLoading(false);
      }
    };
    // oxlint-disable-next-line react/set-state-in-effect -- Loads the selected task from the API.
    void load();
    return () => {
      current = false;
    };
  }, [taskId, projectCode, form, retry, draft]);

  const close = () => {
    if (saving) return;
    if (form.isFieldsTouched()) {
      confirm.confirm({
        title: t("Bỏ thay đổi chưa lưu?"),
        content: t("Các thay đổi của công việc sẽ không được lưu."),
        okText: t("Bỏ thay đổi"),
        cancelText: t("Tiếp tục sửa"),
        onOk: onClose,
      });
    } else onClose();
  };
  const save = async (values) => {
    setSaving(true);
    onBusyChange?.(true);
    try {
      const payload = taskPayload(values, projectCode);
      const response = draft
        ? {
            ...initialTask,
            ...payload,
            id: initialTask?.id ?? createDraftTaskId(),
            importErrors: [],
          }
        : taskId
          ? await updateTask(taskId, payload, REQUEST_CONFIG)
          : await createTask(payload, REQUEST_CONFIG);
      onSaved(response);
    } catch (requestError) {
      notice.error(getRequestError(requestError));
    } finally {
      setSaving(false);
      onBusyChange?.(false);
    }
  };
  return (
    <Modal
      open
      title={taskId ? t("Chi tiết công việc") : t("Thêm công việc")}
      width={900}
      mask={{ closable: false }}
      keyboard={!saving}
      closable={!saving}
      onCancel={close}
      destroyOnHidden
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          {task && !draft && (
            <div className="text-left text-xs text-gray-500">
              {t("Tạo")}: {formatDateTime(task.createdDate)} · {t("Cập nhật")}:{" "}
              {formatDateTime(task.updatedDate)}
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button onClick={close} disabled={saving}>
              {t("Đóng")}
            </Button>
            <Button
              type="primary"
              loading={saving}
              disabled={loading || Boolean(error)}
              onClick={() => form.submit()}
            >
              {taskId ? t("Lưu công việc") : t("Thêm công việc")}
            </Button>
          </div>
        </div>
      }
      classNames={{ body: "task-editor-modal__body" }}
    >
      {noticeHolder}
      {confirmHolder}
      <div className="mb-3 text-gray-500">
        {t("Dự án")}: <strong>{projectCode || t("Mã dự án tự tạo sau khi lưu")}</strong>
      </div>
      {error && (
        <Alert
          type="error"
          showIcon
          title={t("Không tải được công việc")}
          description={t(error)}
          action={<Button onClick={() => setRetry((value) => value + 1)}>{t("Thử lại")}</Button>}
        />
      )}
      <Spin spinning={loading}>
        <Form
          name="taskDetails"
          form={form}
          layout="vertical"
          initialValues={toTaskValues(initialTask ?? {})}
          onFinish={save}
          onValuesChange={(changed) => {
            if (changed.status === "COMPLETE") form.setFieldValue("progress", 100);
          }}
          disabled={loading || saving || Boolean(error)}
        >
          <ProjectWorkFields task managers={managers} />
        </Form>
      </Spin>
    </Modal>
  );
}
