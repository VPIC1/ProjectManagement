export const splitUserCodes = (value) => [
  ...new Set(
    (Array.isArray(value) ? value : (value ?? "").split(","))
      .map((code) => code.trim())
      .filter(Boolean),
  ),
];

export const joinUserCodes = (value) => splitUserCodes(value).join(",") || null;
