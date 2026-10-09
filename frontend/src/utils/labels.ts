import type { Priority, TaskStatus, VersionStatus } from '@/types';

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: '未开始',
  IN_PROGRESS: '进行中',
  BLOCKED: '阻塞',
  DONE: '已完成',
};

/** 看板列顺序，与后端 TASK_STATUS_ORDER 保持一致 */
export const TASK_STATUS_ORDER: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'];

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  TODO: 'default',
  IN_PROGRESS: 'processing',
  BLOCKED: 'error',
  DONE: 'success',
};

/** 看板列头左侧的强调色 */
export const TASK_STATUS_BAR_COLORS: Record<TaskStatus, string> = {
  TODO: '#8c8c8c',
  IN_PROGRESS: '#1677ff',
  BLOCKED: '#ff4d4f',
  DONE: '#52c41a',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  P0: 'P0 紧急',
  P1: 'P1 高',
  P2: 'P2 中',
  P3: 'P3 低',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  P0: '#cf1322',
  P1: '#fa8c16',
  P2: '#1677ff',
  P3: '#8c8c8c',
};

export const PRIORITY_ORDER: Priority[] = ['P0', 'P1', 'P2', 'P3'];

export const VERSION_STATUS_LABELS: Record<VersionStatus, string> = {
  TESTING: '测试中',
  RELEASED: '已发布',
  ARCHIVED: '已归档',
};

export const VERSION_STATUS_COLORS: Record<VersionStatus, string> = {
  TESTING: 'processing',
  RELEASED: 'success',
  ARCHIVED: 'default',
};

export const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  TASK_CREATED: '创建了任务',
  TASK_UPDATED: '修改了任务内容',
  TASK_DELETED: '删除了任务',
  STATUS_CHANGED: '变更了状态',
  ASSIGNEE_CHANGED: '变更了负责人',
  PRIORITY_CHANGED: '变更了优先级',
  DUE_DATE_CHANGED: '变更了截止日期',
  PROGRESS_CHANGED: '更新了进度',
  COMMENT_ADDED: '发表了评论',
};

/** 把日志里的字段原始值翻译成人看得懂的文案 */
export function describeActivityValue(field: string | null, value: string | null): string {
  if (value === null || value === '') return '（空）';
  if (field === 'status') return TASK_STATUS_LABELS[value as TaskStatus] ?? value;
  if (field === 'priority') return PRIORITY_LABELS[value as Priority] ?? value;
  if (field === 'progress') return `${value}%`;
  return value;
}

export function priorityColor(priority: Priority): string {
  return PRIORITY_COLORS[priority] ?? '#8c8c8c';
}

/** 进度条颜色：完成绿、阻塞红、其余蓝 */
export function progressColor(status: TaskStatus, progress: number): string {
  if (status === 'BLOCKED') return '#ff4d4f';
  if (progress >= 100) return '#52c41a';
  if (progress >= 60) return '#1677ff';
  return '#faad14';
}
