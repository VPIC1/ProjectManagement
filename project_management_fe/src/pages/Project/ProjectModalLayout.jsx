import { Modal } from "antd";

// Khung toàn màn hình dùng chung cho chi tiết dự án và xem trước import.
export default function ProjectModalLayout({
  editFocus = false,
  editing = false,
  children,
  ...props
}) {
  return (
    <Modal
      open
      width="100vw"
      footer={null}
      mask={{ closable: false }}
      destroyOnHidden
      className="project-detail-modal"
      classNames={{
        container: "project-detail-modal__container",
        header: `project-detail-modal__header ${editFocus ? "project-edit-focus__header" : ""}`,
        body: `project-detail-modal__body ${editing ? "project-detail-modal__body--editing" : ""}`,
      }}
      {...props}
    >
      {children}
    </Modal>
  );
}
