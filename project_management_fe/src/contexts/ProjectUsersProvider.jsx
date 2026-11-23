import useLanguage from "../hooks/useLanguage";
import { Alert, Button } from "antd";
import { useEffect, useMemo, useState } from "react";
import { getProjectUsers } from "../utils/endpoint";
import { ProjectUsersContext } from "./ProjectUsersContext";
import { getRequestError, REQUEST_CONFIG } from "../utils/projectDetailUtils";
import { splitUserCodes } from "../utils/projectUserValues";

export default function ProjectUsersProvider({ children }) {
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let current = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getProjectUsers(REQUEST_CONFIG);
        if (current) setUsers(response);
      } catch (requestError) {
        if (current) setError(getRequestError(requestError));
      } finally {
        if (current) setLoading(false);
      }
    };
    // oxlint-disable-next-line react/set-state-in-effect -- Loads the shared employee directory once per project page.
    void load();
    return () => {
      current = false;
    };
  }, [retry]);

  const directory = useMemo(() => {
    const labels = new Map(users.map((user) => [user.code, `${user.code} - ${user.name}`]));
    return {
      users,
      options: users.map((user) => ({
        value: user.code,
        label: labels.get(user.code),
      })),
      formatUser: (code, fallback = "—") => (code ? (labels.get(code) ?? code) : fallback),
      formatUsers: (value, fallback = "—") =>
        splitUserCodes(value)
          .map((code) => labels.get(code) ?? code)
          .join(", ") || fallback,
      loading,
      error,
    };
  }, [users, loading, error]);

  return (
    <ProjectUsersContext.Provider value={directory}>
      {error && (
        <Alert
          type="error"
          showIcon
          title={t("Không tải được danh sách nhân viên")}
          description={t(error)}
          action={
            <Button size="small" onClick={() => setRetry((value) => value + 1)}>
              {t("Thử lại")}
            </Button>
          }
        />
      )}
      {children}
    </ProjectUsersContext.Provider>
  );
}
