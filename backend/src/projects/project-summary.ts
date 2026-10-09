import { TaskStatus } from '@prisma/client';
import { TASK_STATUS_ORDER } from '../common/constants';

export interface ProjectSummary {
  /** 未删除任务总数 */
  total: number;
  /** 已完成任务数 */
  done: number;
  /** 平均进度，0-100 的整数 */
  avgProgress: number;
  /** 任务完成率（百分比），保留 1 位小数 */
  completionRate: number;
  byStatus: Record<TaskStatus, number>;
}

export interface TaskLike {
  status: TaskStatus;
  progress: number;
}

export function emptyStatusCount(): Record<TaskStatus, number> {
  return TASK_STATUS_ORDER.reduce(
    (acc, status) => {
      acc[status] = 0;
      return acc;
    },
    {} as Record<TaskStatus, number>,
  );
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * 项目进度口径（已与需求方确认）：
 *   - 平均进度 = 所有未删除任务 progress 的算术平均，四舍五入为整数
 *   - 完成率   = 已完成任务数 / 总任务数，保留 1 位小数
 */
export function summarizeTasks(tasks: TaskLike[]): ProjectSummary {
  const byStatus = emptyStatusCount();
  let progressSum = 0;

  for (const task of tasks) {
    byStatus[task.status] = (byStatus[task.status] ?? 0) + 1;
    progressSum += clampProgress(task.progress);
  }

  const total = tasks.length;
  const done = byStatus[TaskStatus.DONE] ?? 0;

  return {
    total,
    done,
    avgProgress: total === 0 ? 0 : Math.round(progressSum / total),
    completionRate: total === 0 ? 0 : round1((done / total) * 100),
    byStatus,
  };
}

/** 列表页用聚合结果构造，避免把每个项目的任务全查出来 */
export function summarizeFromAggregates(input: {
  total: number;
  progressSum: number;
  byStatus: Partial<Record<TaskStatus, number>>;
}): ProjectSummary {
  const byStatus = emptyStatusCount();
  for (const status of TASK_STATUS_ORDER) {
    byStatus[status] = input.byStatus[status] ?? 0;
  }
  const done = byStatus[TaskStatus.DONE] ?? 0;
  const total = input.total;

  return {
    total,
    done,
    avgProgress: total === 0 ? 0 : Math.round(input.progressSum / total),
    completionRate: total === 0 ? 0 : round1((done / total) * 100),
    byStatus,
  };
}

export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}
