import { useContext } from "react";
import { LanguageContext } from "../contexts/LanguageContext";

export default function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("LanguageProvider is required.");
  return value;
}
