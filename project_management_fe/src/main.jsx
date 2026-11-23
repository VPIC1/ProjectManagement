import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import LanguageProvider from "./contexts/LanguageProvider";
import { BrowserRouter as Router } from "react-router-dom";
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LanguageProvider>
      <Router basename={import.meta.env.BASE_URL.replace(/\/+$/, "") || "/"}>
        <App />
      </Router>
    </LanguageProvider>
  </StrictMode>,
);
