// Chỉ chọn bản dịch để hiển thị, không sửa dữ liệu gốc hoặc tự tách nội dung ghép cũ.
export function localizedText(record, field, language = "vi") {
  const preferred = language === "zh" ? "Zh" : "Vi";
  const fallback = preferred === "Vi" ? "Zh" : "Vi";
  return (
    [record?.[field + preferred], record?.[field + fallback], record?.[field]].find(
      (value) => typeof value === "string" && value.trim(),
    ) ?? ""
  );
}

// Khi chưa có bản dịch, giữ nguyên nội dung cũ trong ô VI để người dùng chỉnh tách sau.
export function localizedFormValues(record, name) {
  const fields = {};
  for (const field of [name, "description"]) {
    const hasTranslation = !!(record[field + "Vi"]?.trim() || record[field + "Zh"]?.trim());
    fields[field + "Vi"] = record[field + "Vi"] ?? (hasTranslation ? "" : (record[field] ?? ""));
    fields[field + "Zh"] = record[field + "Zh"] ?? "";
  }
  return fields;
}

export function localizedPayload(values, name) {
  const clean = (value) => value?.trim() || null;
  const payload = {};
  for (const field of [name, "description"]) {
    if (!(field + "Vi" in values) && !(field + "Zh" in values)) continue;
    payload[field + "Vi"] = clean(values[field + "Vi"]);
    payload[field + "Zh"] = clean(values[field + "Zh"]);
    payload[field] = payload[field + "Vi"] ?? payload[field + "Zh"] ?? (field === name ? "" : null);
  }
  return payload;
}
