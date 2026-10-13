export type Role = 'ADMIN' | 'MEMBER';
export type ProjectStatus = 'ACTIVE' | 'DONE' | 'ARCHIVED';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE';
export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectSummary {
  total: number;
  done: number;
  avgProgress: number;
  completionRate: number;
  byStatus: Record<TaskStatus, number>;
}

export interface ProjectView {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  createdBy: { id: string; displayName: string } | null;
  createdAt: string;
  updatedAt: string;
  summary: ProjectSummary;
}

export interface TaskView {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  assignee: { id: string; displayName: string } | null;
  participants: { id: string; displayName: string }[];
  priority: Priority;
  status: TaskStatus;
  progress: number;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  overdue: boolean;
  sortIndex: number;
  completedAt: string | null;
  createdBy: { id: string; displayName: string } | null;
  createdAt: string;
  updatedAt: string;
  /** 仅「我的待办」接口返回 */
  project?: { id: string; name: string };
  /** 仅「我的待办」接口返回：true 表示我是负责人，否则我是参与人 */
  isAssignee?: boolean;
}

export interface CommentView {
  id: string;
  taskId: string;
  body: string;
  author: { id: string; displayName: string };
  createdAt: string;
  updatedAt: string | null;
}

export interface ActivityView {
  id: string;
  action: string;
  field: string | null;
  fromValue: string | null;
  toValue: string | null;
  actor: { id: string; displayName: string };
  createdAt: string;
}

export interface BucketStats {
  key: string;
  label: string;
  total: number;
  done: number;
  avgProgress: number;
  completionRate: number;
}

export interface ProjectStats {
  summary: ProjectSummary;
  byStatus: { status: TaskStatus; label: string; count: number }[];
  byPriority: { priority: Priority; label: string; count: number }[];
  byAssignee: BucketStats[];
}

export interface TaskQuery {
  status?: TaskStatus;
  assigneeId?: string;
  participantId?: string;
  priority?: Priority;
  keyword?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

/** 看板与列表共用的筛选条件 */
export interface TaskFilters {
  keyword: string;
  assigneeId?: string;
  participantId?: string;
  priority?: Priority;
  status?: TaskStatus;
}

export interface Paginated<T> {
  total: number;
  page: number;
  pageSize: number;
  items: T[];
}

