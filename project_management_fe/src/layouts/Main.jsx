import { version as appVersion } from "../../package.json";
import { FaGlobe } from "react-icons/fa6";
import useLanguage from "../hooks/useLanguage";
import { NavLink, Outlet } from "react-router-dom";
import logo from "../assets/logo.gif";
import { Button } from "antd";
const Main = () => {
  const { t, language, setLanguage } = useLanguage();
  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <div className="bg-white py-2 shadow ">
        <div className="container flex flex-wrap justify-between items-center gap-3 mx-auto px-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center">
              <img
                src={logo}
                alt={t("Biểu trưng")}
                className="block w-30 border-r border-gray-300 pr-3 mr-3"
              />
              <span className="font-bold text-lg text-gray-700">{t("IT Project")}</span>
            </div>
            <nav aria-label={t("Điều hướng chính")} className="flex items-center gap-1">
              {[
                { to: "/dashboard", label: t("Tổng quan") },
                { to: "/project", label: t("Dự án") },
              ].map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-2 text-sm font-medium ${isActive ? "bg-red-50 text-red-600" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"}`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Button
              icon={<FaGlobe className="text-lg" />}
              aria-label={t("Đổi ngôn ngữ")}
              onClick={() => setLanguage(language === "vi" ? "zh" : "vi")}
            >
              {language === "vi" ? "中文" : "Tiếng Việt"}
            </Button>
          </div>
        </div>
      </div>
      <div className="flex flex-1 mt-4 overflow-auto">
        <Outlet />
      </div>
      <footer className="flex shrink-0 flex-wrap items-center justify-center gap-2 px-4 py-2 text-center text-xs text-slate-500">
        <span>{t("Phát triển bởi Phòng Công nghệ thông tin · VPIC1")}</span>
        <span aria-hidden="true">·</span>
        <span>
          {t("Phiên bản")} {appVersion}
        </span>
      </footer>
    </div>
  );
};

export default Main;
