import { ActivityAction, Priority, TaskStatus, ProjectStatus } from '@prisma/client';

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

/** 优先级对外只用这四个描述，不再带 P0~P3 编号（枚举值内部仍是 P0~P3） */
export const PRIORITY_LABELS: Record<Priority, string> = {
  [Priority.P0]: '紧急',
  [Priority.P1]: '高',
  [Priority.P2]: '中',
  [Priority.P3]: '低',
};

export const VERSION_STATUS_LABELS: Record<ProjectStatus, string> = {
  [ProjectStatus.ACTIVE]: '进行中',
  [ProjectStatus.DONE]: '已完成',
  [ProjectStatus.ARCHIVED]: '已归档',
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

/** 四个计划/实际日期的字段名与中文名（日志顺序） */
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
