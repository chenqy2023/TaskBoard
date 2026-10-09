import axios, { AxiosError } from 'axios';
import { message } from 'ant-design-vue';

export const TOKEN_KEY = 'task-kanban-token';

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  timeout: 20000,
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** 401 时清掉本地态并回登录页；其余错误统一弹提示，避免每个页面各写一遍 */
http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string | string[] }>) => {
    const status = error.response?.status;
    const raw = error.response?.data?.message;
    const text = Array.isArray(raw) ? raw.join('；') : raw;

    if (status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      if (!window.location.hash.includes('/login')) {
        message.error(text || '登录状态已失效，请重新登录');
        window.location.hash = '#/login';
      }
    } else if (status === 403) {
      message.error(text || '当前账号无权执行该操作');
    } else if (status && status >= 400) {
      message.error(text || `请求失败（${status}）`);
    } else if (error.code === 'ECONNABORTED') {
      message.error('请求超时，请检查网络或后端服务');
    } else {
      message.error('无法连接后端服务，请确认后端已启动');
    }
    return Promise.reject(error);
  },
);

export function errorText(error: unknown, fallback = '操作失败'): string {
  const err = error as AxiosError<{ message?: string | string[] }>;
  const raw = err?.response?.data?.message;
  if (Array.isArray(raw)) return raw.join('；');
  return raw || fallback;
}
