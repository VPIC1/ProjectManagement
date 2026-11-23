import { FaRegFolderOpen } from "react-icons/fa6";

const Card = ({ title, value }) => {
  return (
    <div className="flex-1 bg-white border border-gray-300 rounded-md p-4 border-l-3 border-l-red-500">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <div className="text-gray-700">{title}</div>
          <div className="text-red-500 text-2xl font-bold">{value}</div>
        </div>
        <FaRegFolderOpen size={32} className="text-gray-700" />
      </div>
    </div>
  );
};

export default Card;
