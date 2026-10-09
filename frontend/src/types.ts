export type Role = 'ADMIN' | 'MEMBER';
export type VersionStatus = 'TESTING' | 'RELEASED' | 'ARCHIVED';
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

export interface VersionSummary {
  total: number;
  done: number;
  avgProgress: number;
  completionRate: number;
  byStatus: Record<TaskStatus, number>;
}

export interface VersionView {
  id: string;
  name: string;
  description: string | null;
  status: VersionStatus;
  testStartDate: string | null;
  plannedReleaseDate: string | null;
  createdBy: { id: string; displayName: string } | null;
  createdAt: string;
  updatedAt: string;
  summary: VersionSummary;
}

export interface TaskView {
  id: string;
  versionId: string;
  title: string;
  description: string | null;
  module: string;
  assignee: { id: string; displayName: string } | null;
  priority: Priority;
  status: TaskStatus;
  progress: number;
  dueDate: string | null;
  overdue: boolean;
  sortIndex: number;
  completedAt: string | null;
  createdBy: { id: string; displayName: string } | null;
  createdAt: string;
  updatedAt: string;
  /** 仅「我的待办」接口返回 */
  version?: { id: string; name: string };
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

export interface VersionStats {
  summary: VersionSummary;
  byStatus: { status: TaskStatus; label: string; count: number }[];
  byPriority: { priority: Priority; label: string; count: number }[];
  byAssignee: BucketStats[];
  byModule: BucketStats[];
}

export interface TaskQuery {
  status?: TaskStatus;
  assigneeId?: string;
  priority?: Priority;
  module?: string;
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
  priority?: Priority;
  module?: string;
  status?: TaskStatus;
}

export interface Paginated<T> {
  total: number;
  page: number;
  pageSize: number;
  items: T[];
}

export interface RawImportRow {
  rowNo: number;
  title: string;
  module?: string;
  assignee?: string;
  priority?: string;
  status?: string;
  progress?: string;
  dueDate?: string;
  description?: string;
}

export interface ParsedImportRow {
  rowNo: number;
  title: string;
  module: string;
  assigneeName: string | null;
  assigneeId: string | null;
  priority: Priority;
  status: TaskStatus;
  progress: number;
  dueDate: string | null;
  description: string | null;
  errors: string[];
  warnings: string[];
}

export interface ImportPreview {
  total: number;
  validCount: number;
  errorCount: number;
  warningCount: number;
  rows: { raw: RawImportRow; parsed: ParsedImportRow }[];
}
