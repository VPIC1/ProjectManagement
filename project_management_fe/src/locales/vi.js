import zh from "./zh.js";

// Tiếng Việt là ngôn ngữ gốc của các khóa bản dịch.
export default Object.fromEntries(Object.keys(zh).map((key) => [key, key]));
