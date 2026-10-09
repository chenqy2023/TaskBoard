import { ActivityAction, Priority, TaskStatus, VersionStatus } from '@prisma/client';

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: '未开始',
  [TaskStatus.IN_PROGRESS]: '进行中',
  [TaskStatus.BLOCKED]: '阻塞',
  [TaskStatus.DONE]: '已完成',
};

/** 看板列的展示顺序 */
export const TASK_STATUS_ORDER: TaskStatus[] = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.BLOCKED,
  TaskStatus.DONE,
];

export const PRIORITY_LABELS: Record<Priority, string> = {
  [Priority.P0]: 'P0 紧急',
  [Priority.P1]: 'P1 高',
  [Priority.P2]: 'P2 中',
  [Priority.P3]: 'P3 低',
};

export const VERSION_STATUS_LABELS: Record<VersionStatus, string> = {
  [VersionStatus.TESTING]: '测试中',
  [VersionStatus.RELEASED]: '已发布',
  [VersionStatus.ARCHIVED]: '已归档',
};

export const ACTIVITY_ACTION_LABELS: Record<ActivityAction, string> = {
  [ActivityAction.TASK_CREATED]: '创建了任务',
  [ActivityAction.TASK_UPDATED]: '修改了任务',
  [ActivityAction.TASK_DELETED]: '删除了任务',
  [ActivityAction.STATUS_CHANGED]: '变更了状态',
  [ActivityAction.ASSIGNEE_CHANGED]: '变更了负责人',
  [ActivityAction.PARTICIPANTS_CHANGED]: '变更了参与人',
  [ActivityAction.PRIORITY_CHANGED]: '变更了优先级',
  [ActivityAction.DUE_DATE_CHANGED]: '变更了日期',
  [ActivityAction.PROGRESS_CHANGED]: '更新了进度',
  [ActivityAction.COMMENT_ADDED]: '发表了评论',
};

/** 四个计划/实际日期的字段名与中文名，日志与 Excel 都按这个顺序 */
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

/** 进度变动小于该阈值不记日志，避免拖动进度时刷屏 */
export const PROGRESS_LOG_THRESHOLD = 5;

/** Excel 导入导出的列名（顺序即列顺序） */
export const TASK_EXCEL_COLUMNS = [
  '标题',
  '负责人',
  '参与人',
  '优先级',
  '状态',
  '进度',
  '计划开始日期',
  '计划结束日期',
  '实际开始日期',
  '实际结束日期',
  '描述',
] as const;

export function buildLabelToEnum<T extends string>(labels: Record<T, string>): Record<string, T> {
  return Object.entries(labels).reduce<Record<string, T>>((acc, [value, label]) => {
    acc[label as string] = value as T;
    return acc;
  }, {});
}

export function parsePriority(input: unknown): Priority | null {
  const raw = String(input ?? '').trim().toUpperCase();
  if (!raw) return null;
  const direct = Priority[raw as keyof typeof Priority];
  if (direct) return direct;
  return buildLabelToEnum(PRIORITY_LABELS)[String(input).trim()] ?? null;
}

export function parseTaskStatus(input: unknown): TaskStatus | null {
  const raw = String(input ?? '').trim().toUpperCase();
  if (raw && TaskStatus[raw as keyof typeof TaskStatus]) {
    return TaskStatus[raw as keyof typeof TaskStatus];
  }
  return buildLabelToEnum(TASK_STATUS_LABELS)[String(input).trim()] ?? null;
}
