import zh from "./zh.js";
import vi from "./vi.js";
import { localizeServerMessage } from "./serverMessageTranslation.js";

export const LANGUAGE_STORAGE_KEY = "it-projects-language";
export function readLanguage() {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY) === "zh" ? "zh" : "vi";
  } catch {
    return "vi";
  }
}
let activeLanguage = readLanguage();
const originalText = new Map(Object.entries(zh).map(([key, value]) => [value, key]));

export function setActiveLanguage(language) {
  activeLanguage = language === "zh" ? "zh" : "vi";
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, activeLanguage);
  } catch {
    /* Private browsing may block storage. */
  }
}

export function translate(key, values = {}, language = activeLanguage) {
  const source = originalText.get(key) ?? key;
  const text = (language === "zh" ? zh : vi)[source] ?? source;
  return String(text ?? "").replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);
}

// Giữ mã và dữ liệu nhập nguyên bản; chỉ dịch thông báo lỗi chuẩn từ backend.
export function translateServerMessage(message, code) {
  if (zh[message] || originalText.has(message)) return translate(message);
  return localizeServerMessage(message, code, translate, activeLanguage);
}
