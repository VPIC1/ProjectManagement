import axios from "axios";
import { baseURL } from "./util";

// Axios dùng chung: trả trực tiếp response.data; GET trùng chuyển caller cũ sang kết quả mới nhất.

const api = axios.create({
  baseURL: baseURL,
  withCredentials: true,
});

if (baseURL.includes("localhost")) {
  // Thêm request interceptor để ghi lại thời gian bắt đầu
  api.interceptors.request.use(
    (config) => {
      config.metadata = { startTime: new Date() }; // Ghi lại thời gian bắt đầu
      return config;
    },
    (error) => {
      return Promise.reject(error);
    },
  );

  // Thêm response interceptor để ghi lại thời gian kết thúc và tính toán thời gian xử lý

  api.interceptors.response.use(
    (response) => {
      const endTime = new Date();
      const duration = endTime - response.config.metadata.startTime; // Tính thời gian xử lý
      console.log(`Request to ${response.config.url} took ${duration} ms`);
      return response;
    },
    (error) => {
      if (axios.isCancel(error)) return Promise.reject(error);
      const endTime = new Date();
      const duration = error.config?.metadata?.startTime
        ? endTime - error.config.metadata.startTime
        : null; // Tính thời gian xử lý nếu metadata có sẵn
      if (duration !== null) {
        console.error(`Request to ${error.config.url} failed, took ${duration} ms`);
      } else {
        console.error(`Request to ${error.config.url} failed, but start time wasn't recorded.`);
      }

      // Xử lý lỗi timeout và báo lỗi phù hợp
      if (error.code === "ECONNABORTED") {
        console.error(`Request to ${error.config.url} timed out`);
      } else if (error.response) {
        // Lỗi khi nhận được phản hồi từ server
        console.error(`Error fetching data from ${error.config.url}:`, error.response.data);
      } else {
        // Lỗi khác (kết nối mạng, không thể gửi yêu cầu)
        console.error("Error fetching data:", error.message);
      }
      return Promise.reject(error);
    },
  );
}
api.interceptors.request.use((config) => {
  const csrfToken = document.cookie
    .split("; ")
    .find((row) => row.startsWith("csrftoken="))
    ?.split("=")[1];

  if (csrfToken) {
    config.headers["X-CSRFToken"] = csrfToken;
  }

  return config;
});
// Tự hủy GET trùng đang chạy; các API khác vẫn độc lập.
const pendingGets = new Map();

const sendGet = async (url, config) => {
  try {
    const response = await api.get(url, config);
    return response.data;
  } catch (error) {
    if (!axios.isCancel(error)) console.error("Error fetching data", error);
    throw error;
  }
};

const get = (url, config = {}) => {
  // Caller đã quản lý cancellation thì giữ nguyên signal của caller.
  if (config.signal || config.cancelToken) return sendGet(url, config);

  const headers = axios.AxiosHeaders.from(config.headers).toJSON();
  const sortedHeaders = Object.entries(headers).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const key = JSON.stringify([
    api.getUri({ ...config, url, method: "get" }),
    sortedHeaders,
    config.auth ?? null,
    config.responseType ?? "json",
    config.withCredentials ?? api.defaults.withCredentials,
    config.timeout ?? api.defaults.timeout,
  ]);
  const controller = new AbortController();
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  const entry = { controller, promise, resolve, reject, superseded: false };
  const previous = pendingGets.get(key);
  pendingGets.set(key, entry);

  if (previous) {
    previous.superseded = true;
    // Caller cũ nhận kết quả của request mới nhất, không nhận undefined/CanceledError.
    // Vì vậy component vẫn có thể await API rồi setState như bình thường.
    previous.resolve(promise);
    previous.controller.abort();
  }

  void sendGet(url, { ...config, signal: controller.signal })
    .then(
      (data) => {
        if (!entry.superseded) entry.resolve(data);
      },
      (error) => {
        if (!entry.superseded) entry.reject(error);
      },
    )
    .finally(() => {
      if (pendingGets.get(key) === entry) pendingGets.delete(key);
    });

  return promise;
};

// Tham số cuối là Axios config (headers, timeout, signal...), không phải token riêng.
const post = async (url, data, headers) => {
  try {
    const response = await api.post(url, data, headers);
    return response.data;
  } catch (error) {
    console.error("Error posting data", error);
    throw error;
  }
};

// Mutation không tự hủy khi có request mới để tránh che mất kết quả ghi dữ liệu.
const patch = async (url, data, headers) => {
  try {
    const response = await api.patch(url, data, headers);
    return response.data;
  } catch (error) {
    console.error("Error patching data", error);
    throw error;
  }
};
const put = async (url, data, headers) => {
  try {
    const response = await api.put(url, data, headers);
    return response.data;
  } catch (error) {
    console.error("Error putting data", error);
    throw error;
  }
};
const deleteReq = async (url, data, headers) => {
  try {
    const response = await api.delete(url, data, headers);
    return response.data;
  } catch (error) {
    console.error("Error deleting data", error);
    throw error;
  }
};
export default {
  get,
  post,
  patch,
  put,
  delete: deleteReq,
  baseURL,
};
