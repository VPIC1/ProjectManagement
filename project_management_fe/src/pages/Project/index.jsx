import ProjectTable from "./ProjectTable";
import ProjectUsersProvider from "../../contexts/ProjectUsersProvider";

const Project = () => {
  return (
    <div className="container mx-auto px-4 space-y-3 flex flex-1 overflow-auto flex-col">
      <ProjectUsersProvider>
        <ProjectTable />
      </ProjectUsersProvider>
    </div>
  );
};

export default Project;
