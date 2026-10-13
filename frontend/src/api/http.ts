import axios, { AxiosError } from 'axios';
import { message } from 'ant-design-vue';
import { tGlobal } from '@/i18n';

export const TOKEN_KEY = 'taskboard-token';

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
    const text = Array.isArray(raw) ? raw.join('; ') : raw;

    if (status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      if (!window.location.hash.includes('/login')) {
        message.error(text || tGlobal('http.sessionExpired'));
        window.location.hash = '#/login';
      }
    } else if (status === 403) {
      message.error(text || tGlobal('http.forbidden'));
    } else if (status && status >= 400) {
      message.error(text || tGlobal('http.requestFailed', { status }));
    } else if (error.code === 'ECONNABORTED') {
      message.error(tGlobal('http.timeout'));
    } else {
      message.error(tGlobal('http.offline'));
    }
    return Promise.reject(error);
  },
);

export function errorText(error: unknown, fallback?: string): string {
  const err = error as AxiosError<{ message?: string | string[] }>;
  const raw = err?.response?.data?.message;
  if (Array.isArray(raw)) return raw.join('; ');
  return raw || fallback || tGlobal('common.operationFailed');
}
