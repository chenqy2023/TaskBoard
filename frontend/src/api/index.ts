import { http } from './http';
import type {
  ActivityView,
  CommentView,
  ImportPreview,
  Paginated,
  ParsedImportRow,
  RawImportRow,
  TaskQuery,
  TaskStatus,
  TaskView,
  User,
  VersionStats,
  VersionStatus,
  VersionSummary,
  VersionView,
} from '@/types';

// ---------- 认证 ----------
export const authApi = {
  login: (username: string, password: string) =>
    http.post<{ accessToken: string; user: User }>('/auth/login', { username, password }).then((r) => r.data),
  me: () => http.get<User>('/auth/me').then((r) => r.data),
  changePassword: (oldPassword: string, newPassword: string) =>
    http.post('/auth/password', { oldPassword, newPassword }).then((r) => r.data),
};

// ---------- 成员 ----------
export const usersApi = {
  list: (includeInactive = false) =>
    http
      .get<User[]>('/users', { params: { includeInactive } })
      .then((r) => r.data),
  create: (payload: { username: string; displayName: string; role: string; password: string }) =>
    http.post<User>('/users', payload).then((r) => r.data),
  update: (id: string, payload: { displayName?: string; role?: string; active?: boolean }) =>
    http.patch<User>(`/users/${id}`, payload).then((r) => r.data),
  resetPassword: (id: string, newPassword: string) =>
    http.post(`/users/${id}/reset-password`, { newPassword }).then((r) => r.data),
  remove: (id: string) => http.delete(`/users/${id}`).then((r) => r.data),
};

// ---------- 版本 ----------
export const versionsApi = {
  list: (params?: { status?: VersionStatus; keyword?: string }) =>
    http.get<VersionView[]>('/versions', { params }).then((r) => r.data),
  get: (id: string) => http.get<VersionView>(`/versions/${id}`).then((r) => r.data),
  summary: (id: string) => http.get<VersionSummary>(`/versions/${id}/summary`).then((r) => r.data),
  create: (payload: Record<string, unknown>) =>
    http.post<VersionView>('/versions', payload).then((r) => r.data),
  update: (id: string, payload: Record<string, unknown>) =>
    http.patch<VersionView>(`/versions/${id}`, payload).then((r) => r.data),
  remove: (id: string, force = false) =>
    http.delete(`/versions/${id}`, { params: { force } }).then((r) => r.data),
};

// ---------- 任务 ----------
export const tasksApi = {
  list: (versionId: string, params: TaskQuery) =>
    http
      .get<Paginated<TaskView>>(`/versions/${versionId}/tasks`, { params })
      .then((r) => r.data),
  board: (versionId: string, params?: TaskQuery) =>
    http.get<TaskView[]>(`/versions/${versionId}/board`, { params }).then((r) => r.data),
  modules: (versionId: string) =>
    http.get<string[]>(`/versions/${versionId}/modules`).then((r) => r.data),
  my: () => http.get<TaskView[]>('/tasks/my').then((r) => r.data),
  get: (id: string) => http.get<TaskView>(`/tasks/${id}`).then((r) => r.data),
  create: (payload: Record<string, unknown>) => http.post<TaskView>('/tasks', payload).then((r) => r.data),
  update: (id: string, payload: Record<string, unknown>) =>
    http.patch<TaskView>(`/tasks/${id}`, payload).then((r) => r.data),
  move: (id: string, status: TaskStatus, targetIndex?: number) =>
    http.patch<TaskView>(`/tasks/${id}/status`, { status, targetIndex }).then((r) => r.data),
  batch: (payload: Record<string, unknown>) => http.post('/tasks/batch', payload).then((r) => r.data),
  remove: (id: string) => http.delete(`/tasks/${id}`).then((r) => r.data),
};

// ---------- 评论与日志 ----------
export const commentsApi = {
  list: (taskId: string) => http.get<CommentView[]>(`/tasks/${taskId}/comments`).then((r) => r.data),
  create: (taskId: string, body: string) =>
    http.post<CommentView>(`/tasks/${taskId}/comments`, { body }).then((r) => r.data),
  remove: (id: string) => http.delete(`/comments/${id}`).then((r) => r.data),
  activities: (taskId: string) =>
    http.get<ActivityView[]>(`/tasks/${taskId}/activities`).then((r) => r.data),
};

// ---------- 统计 ----------
export const statsApi = {
  byVersion: (versionId: string) =>
    http.get<VersionStats>(`/stats/versions/${versionId}`).then((r) => r.data),
};

// ---------- 导入导出 ----------
export const taskIoApi = {
  exportUrl: (versionId: string) => `${import.meta.env.VITE_API_BASE || '/api'}/versions/${versionId}/export`,
  async download(versionId: string, filename: string) {
    const response = await http.get(`/versions/${versionId}/export`, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data as Blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
  preview: (versionId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http
      .post<ImportPreview>(`/versions/${versionId}/import/preview`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      })
      .then((r) => r.data);
  },
  confirm: (versionId: string, rows: RawImportRow[] | ParsedImportRow[]) =>
    http
      .post<{ createdCount: number }>(`/versions/${versionId}/import/confirm`, { rows })
      .then((r) => r.data),
};
