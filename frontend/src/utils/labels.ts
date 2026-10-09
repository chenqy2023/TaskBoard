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

/** 优先级徽章底色，与 PRIORITY_COLORS 同色系但极浅，保证徽章上的深色文字可读 */
export const PRIORITY_TINTS: Record<Priority, string> = {
  P0: '#fff1f0',
  P1: '#fff7e6',
  P2: '#e6f4ff',
  P3: '#fafafa',
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
  PARTICIPANTS_CHANGED: '变更了参与人',
  PRIORITY_CHANGED: '变更了优先级',
  DUE_DATE_CHANGED: '变更了日期',
  PROGRESS_CHANGED: '更新了进度',
  COMMENT_ADDED: '发表了评论',
};

/** 四个计划/实际日期的字段名与中文名 */
export const DATE_FIELDS = [
  'plannedStartDate',
  'plannedEndDate',
  'actualStartDate',
  'actualEndDate',
] as const;

export type DateField = (typeof DATE_FIELDS)[number];

export const DATE_FIELD_LABELS: Record<DateField, string> = {
  plannedStartDate: '计划开始日期',
  plannedEndDate: '计划结束日期',
  actualStartDate: '实际开始日期',
  actualEndDate: '实际结束日期',
};

/** 日期型字段的日志标题更具体一些，比统一的「变更了日期」好读 */
export function activityTitle(action: string, field: string | null): string {
  if (action === 'DUE_DATE_CHANGED' && field && field in DATE_FIELD_LABELS) {
    return `变更了${DATE_FIELD_LABELS[field as DateField]}`;
  }
  return ACTIVITY_ACTION_LABELS[action] ?? action;
}

/** 把日志里的字段原始值翻译成人看得懂的文案 */
export function describeActivityValue(field: string | null, value: string | null): string {
  if (value === null || value === '') return '（空）';
  if (field === 'status') return TASK_STATUS_LABELS[value as TaskStatus] ?? value;
  if (field === 'priority') return PRIORITY_LABELS[value as Priority] ?? value;
  if (field === 'progress') return `${value}%`;
  if (field === 'assigneeId') return value;
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
