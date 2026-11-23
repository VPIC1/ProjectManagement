import { Descriptions, Grid, Tag } from "antd";
import useLanguage from "../../hooks/useLanguage";
import ProjectUserTags from "../../components/ProjectUserTags";
import useProjectStatusOptions from "../../hooks/useProjectStatusOptions";
import { formatDate } from "../../utils/projectDetailUtils";

// Thông tin dự án dùng chung; bản import chưa có mã cho đến khi lưu thành công.
export default function ProjectSummary({ project }) {
  const { t, content } = useLanguage();
  const statuses = useProjectStatusOptions();
  const screens = Grid.useBreakpoint();
  const columns = screens.lg ? 4 : screens.sm ? 2 : 1;
  const status = statuses.find((item) => item.value === project.status);
  return (
    <Descriptions
      className="project-summary"
      bordered
      size="small"
      column={columns}
      items={[
        {
          key: "name",
          label: t("Tên dự án"),
          span: columns === 4 ? 1 : columns,
          children: content(project, "projectName") || "—",
        },
        { key: "requester", label: t("Người yêu cầu"), children: project.requester || "—" },
        {
          key: "department",
          label: t("Phòng ban yêu cầu"),
          children: content(project, "requesterDepartmentName") || "—",
        },
        {
          key: "status",
          label: t("Trạng thái"),
          children: (
            <Tag variant="solid" color={status?.color}>
              {status?.label ?? project.status}
            </Tag>
          ),
        },
        {
          key: "manager",
          label: t("Người phụ trách"),
          span: Math.min(2, columns),
          children: <ProjectUserTags value={project.manager} />,
        },
        {
          key: "dates",
          label: t("Thời gian dự kiến"),
          children: `${formatDate(project.startDate)} – ${formatDate(project.endDate)}`,
        },
        {
          key: "actualDates",
          label: t("Thời gian thực tế"),
          children: `${formatDate(project.actualStartDate)} – ${formatDate(project.actualEndDate)}`,
        },
        {
          key: "description",
          label: t("Mô tả"),
          span: columns,
          children: (
            <span className="whitespace-pre-wrap break-words">
              {content(project, "description") || "—"}
            </span>
          ),
        },
      ]}
    />
  );
}
