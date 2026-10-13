import type { Priority, TaskStatus, ProjectStatus } from '@/types';
import { tGlobal } from '@/i18n';
import { localizeDemoText } from '@/utils/demo-content';

/** 看板列顺序，与后端 TASK_STATUS_ORDER 保持一致 */
export const TASK_STATUS_ORDER: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'];

function i18nMap<K extends string>(prefix: string, keys: readonly K[]): Record<K, string> {
  const target = {} as Record<K, string>;
  for (const key of keys) {
    Object.defineProperty(target, key, {
      enumerable: true,
      configurable: true,
      get() {
        return tGlobal(`${prefix}.${key}`);
      },
    });
  }
  return target;
}

export const TASK_STATUS_LABELS = i18nMap('labels.taskStatus', TASK_STATUS_ORDER);

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  TODO: 'default',
  IN_PROGRESS: 'processing',
  BLOCKED: 'error',
  DONE: 'success',
};

/**
 * 项目卡片封面的渐变。按项目名称散列稳定取一个，
 * 同一个项目每次打开都是同一张封面，不会闪来闪去。
 */
const COVER_GRADIENTS = [
  'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
  'linear-gradient(135deg, #134e4a 0%, #14b8a6 100%)',
  'linear-gradient(135deg, #4c1d95 0%, #a855f7 100%)',
  'linear-gradient(135deg, #7c2d12 0%, #f97316 100%)',
  'linear-gradient(135deg, #14532d 0%, #22c55e 100%)',
  'linear-gradient(135deg, #831843 0%, #ec4899 100%)',
  'linear-gradient(135deg, #1e293b 0%, #64748b 100%)',
  'linear-gradient(135deg, #312e81 0%, #6366f1 100%)',
];

export function coverGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 33 + seed.charCodeAt(i)) % 9973;
  }
  return COVER_GRADIENTS[hash % COVER_GRADIENTS.length];
}

/**
 * 头像底色的可选色板。用一个稳定的散列从姓名取色，
 * 保证同一个人在所有页面、所有时间都是同一个颜色。
 */
const AVATAR_COLORS = [
  '#1677ff',
  '#13c2c2',
  '#52c41a',
  '#fa8c16',
  '#eb2f96',
  '#722ed1',
  '#fa541c',
  '#2f54eb',
] as const;

export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 9973;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** 头像里的字：中文取姓氏首字，西文取首字母 */
export function avatarInitial(name: string): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '?';
  return /[一-龥]/.test(trimmed) ? trimmed[0] : trimmed[0].toUpperCase();
}

/**
 * JS 侧需要取语义色时统一从这里拿（图表、分组标记等）。
 * CSS 侧的同一组值在 main.css 的 --tk-* 变量里，两处含义一致。
 */
export const SEMANTIC = {
  brand: '#1677ff',
  danger: '#ff4d4f',
  warn: '#fa8c16',
  success: '#52c41a',
} as const;

/** 看板列头的淡底色，比列面板稍深一点，让列头可辨识 */
export const TASK_STATUS_TINTS: Record<TaskStatus, string> = {
  TODO: '#e3e7ec',
  IN_PROGRESS: '#dcebfd',
  BLOCKED: '#fbe1e1',
  DONE: '#dcf0dc',
};

/** 看板列头左侧的强调色 */
export const TASK_STATUS_BAR_COLORS: Record<TaskStatus, string> = {
  TODO: '#8c8c8c',
  IN_PROGRESS: '#1677ff',
  BLOCKED: '#ff4d4f',
  DONE: '#52c41a',
};

/** 优先级对外只用这四个描述，不再带 P0~P3 编号（枚举值内部仍是 P0~P3） */
export const PRIORITY_ORDER: Priority[] = ['P0', 'P1', 'P2', 'P3'];

export const PRIORITY_LABELS = i18nMap('labels.priority', PRIORITY_ORDER);

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

export const PROJECT_STATUS_ORDER: ProjectStatus[] = ['ACTIVE', 'DONE', 'ARCHIVED'];

export const VERSION_STATUS_LABELS = i18nMap('labels.projectStatus', PROJECT_STATUS_ORDER);

export const VERSION_STATUS_COLORS: Record<ProjectStatus, string> = {
  ACTIVE: 'processing',
  DONE: 'success',
  ARCHIVED: 'default',
};

const ACTIVITY_ACTIONS = [
  'TASK_CREATED',
  'TASK_UPDATED',
  'TASK_DELETED',
  'STATUS_CHANGED',
  'ASSIGNEE_CHANGED',
  'PARTICIPANTS_CHANGED',
  'PRIORITY_CHANGED',
  'DUE_DATE_CHANGED',
  'PROGRESS_CHANGED',
  'COMMENT_ADDED',
] as const;

export const ACTIVITY_ACTION_LABELS = i18nMap('labels.activity', ACTIVITY_ACTIONS);

/** 四个计划/实际日期的字段名与中文名 */
export const DATE_FIELDS = [
  'plannedStartDate',
  'plannedEndDate',
  'actualStartDate',
  'actualEndDate',
] as const;

export type DateField = (typeof DATE_FIELDS)[number];

export const DATE_FIELD_LABELS = i18nMap('labels.dateField', DATE_FIELDS);

/** 日期型字段的日志标题更具体一些，比统一的「变更了日期」好读 */
export function activityTitle(action: string, field: string | null): string {
  if (action === 'DUE_DATE_CHANGED' && field && (DATE_FIELDS as readonly string[]).includes(field)) {
    return tGlobal('labels.activity.dueDateField', {
      field: DATE_FIELD_LABELS[field as DateField],
    });
  }
  return (ACTIVITY_ACTION_LABELS as Record<string, string>)[action] ?? action;
}

/** 把日志里的字段原始值翻译成人看得懂的文案 */
export function describeActivityValue(field: string | null, value: string | null): string {
  if (value === null || value === '') return tGlobal('labels.activity.empty');
  if (field === 'status') return TASK_STATUS_LABELS[value as TaskStatus] ?? value;
  if (field === 'priority') return PRIORITY_LABELS[value as Priority] ?? value;
  if (field === 'progress') return `${value}%`;
  if (field === 'assigneeId') return value;
  return localizeDemoText(value);
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
