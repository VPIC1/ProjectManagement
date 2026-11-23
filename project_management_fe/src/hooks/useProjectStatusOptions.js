import { useMemo } from "react";
import { PROJECT_STATUS_OPTIONS } from "../constants/projectConstants";
import useLanguage from "./useLanguage";

export default function useProjectStatusOptions() {
  const { t } = useLanguage();
  return useMemo(
    () =>
      PROJECT_STATUS_OPTIONS.map((option) => ({
        ...option,
        label: t(option.label),
      })),
    [t],
  );
}
