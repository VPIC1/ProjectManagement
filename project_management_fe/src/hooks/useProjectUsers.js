import { useContext } from "react";
import { ProjectUsersContext } from "../contexts/ProjectUsersContext";

export default function useProjectUsers() {
  const directory = useContext(ProjectUsersContext);
  if (!directory) throw new Error("ProjectUsersProvider is required.");
  return directory;
}
