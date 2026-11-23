export const baseURL = import.meta.env.VITE_API_URL || `${import.meta.env.BASE_URL}api`;
export const setError = (error) =>
  JSON.stringify(error?.response?.data || error?.message) || "An error occurred";
