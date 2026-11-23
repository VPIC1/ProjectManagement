import { Tag, Tooltip } from "antd";
import { FaUser } from "react-icons/fa6";
import useProjectUsers from "../hooks/useProjectUsers";
import { splitUserCodes } from "../utils/projectUserValues";

// Preserve employee codes (including leading zeros); resolve names only for the tooltip.
export default function ProjectUserTags({ value, grid = false, fallback = "—" }) {
  const { formatUser } = useProjectUsers();
  const codes = splitUserCodes(value);
  if (!codes.length) return <span className="text-gray-400">{fallback}</span>;
  return (
    <span
      className={
        grid
          ? "inline-grid w-fit max-w-full grid-cols-[repeat(4,max-content)] items-start justify-start gap-1 align-middle"
          : "inline-flex max-w-full flex-wrap items-center gap-1 align-middle"
      }
    >
      {codes.map((code) => (
        <Tooltip key={code} title={formatUser(code)} trigger={["hover", "focus"]}>
          <Tag
            color="blue"
            className="m-0! inline-flex! w-fit items-center gap-1 whitespace-nowrap"
            tabIndex={0}
          >
            <FaUser className="shrink-0 text-[10px]" aria-hidden="true" />
            {code}
          </Tag>
        </Tooltip>
      ))}
    </span>
  );
}
