import { Navigate, Route, Routes } from "react-router-dom";
import Main from "./layouts/Main";
import Project from "./pages/Project/index";
import Dashboard from "./pages/Dashboard";

function App() {
  return (
    <Routes>
      <Route path="" element={<Main />}>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="project" element={<Project />} />
        <Route path="" element={<Navigate to="/dashboard" />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

export default App;
