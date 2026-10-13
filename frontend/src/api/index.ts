import { http } from './http';
import type {
  ActivityView,
  CommentView,
  Paginated,
  TaskQuery,
  TaskStatus,
  TaskView,
  User,
  ProjectStats,
  ProjectStatus,
  ProjectSummary,
  ProjectView,
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
  list: () => http.get<User[]>('/users').then((r) => r.data),
  create: (payload: { username: string; displayName: string; role: string; password: string }) =>
    http.post<User>('/users', payload).then((r) => r.data),
  update: (id: string, payload: { displayName?: string; role?: string }) =>
    http.patch<User>(`/users/${id}`, payload).then((r) => r.data),
  resetPassword: (id: string, newPassword: string) =>
    http.post(`/users/${id}/reset-password`, { newPassword }).then((r) => r.data),
  remove: (id: string) => http.delete(`/users/${id}`).then((r) => r.data),
};

// ---------- 项目 ----------
export const projectsApi = {
  list: (params?: { status?: ProjectStatus; keyword?: string }) =>
    http.get<ProjectView[]>('/projects', { params }).then((r) => r.data),
  get: (id: string) => http.get<ProjectView>(`/projects/${id}`).then((r) => r.data),
  summary: (id: string) => http.get<ProjectSummary>(`/projects/${id}/summary`).then((r) => r.data),
  create: (payload: Record<string, unknown>) =>
    http.post<ProjectView>('/projects', payload).then((r) => r.data),
  update: (id: string, payload: Record<string, unknown>) =>
    http.patch<ProjectView>(`/projects/${id}`, payload).then((r) => r.data),
  remove: (id: string, force = false) =>
    http.delete(`/projects/${id}`, { params: { force } }).then((r) => r.data),
};

// ---------- 任务 ----------
export const tasksApi = {
  list: (projectId: string, params: TaskQuery) =>
    http
      .get<Paginated<TaskView>>(`/projects/${projectId}/tasks`, { params })
      .then((r) => r.data),
  board: (projectId: string, params?: TaskQuery) =>
    http.get<TaskView[]>(`/projects/${projectId}/board`, { params }).then((r) => r.data),
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
  byProject: (projectId: string) =>
    http.get<ProjectStats>(`/stats/projects/${projectId}`).then((r) => r.data),
};
