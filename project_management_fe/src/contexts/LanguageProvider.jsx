import { ConfigProvider } from "antd";
import viVN from "antd/locale/vi_VN";
import zhCN from "antd/locale/zh_CN";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import "dayjs/locale/zh-cn";
import { useCallback, useEffect, useMemo, useState } from "react";
import { localizedText } from "../utils/localizedContent";
import { LanguageContext } from "./LanguageContext";
import { readLanguage, setActiveLanguage, translate } from "../locales/translate";

export default function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(readLanguage);
  const setLanguage = useCallback((value) => {
    const next = value === "zh" ? "zh" : "vi";
    setActiveLanguage(next);
    setLanguageState(next);
  }, []);
  const t = useCallback((key, values) => translate(key, values, language), [language]);
  const componentLocale = useMemo(() => {
    const base = language === "zh" ? zhCN : viVN;
    return {
      ...base,
      global: { ...base.global, clear: t("Xóa nội dung") },
      Modal: { ...base.Modal, justOkText: t("Đồng ý") },
      Table: { ...base.Table, selectionMenu: t("Trình đơn lựa chọn") },
    };
  }, [language, t]);
  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      content: (record, field) => localizedText(record, field, language),
    }),
    [language, setLanguage, t],
  );

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "vi";
    document.title = t("IT Project");
    dayjs.locale(language === "zh" ? "zh-cn" : "vi");
  }, [language, t]);

  return (
    <LanguageContext.Provider value={value}>
      <ConfigProvider locale={componentLocale} theme={{ token: { fontSize: 15 } }}>
        {children}
      </ConfigProvider>
    </LanguageContext.Provider>
  );
}
