import { ActivityAction, Priority, TaskStatus } from '@prisma/client';
import { PROGRESS_LOG_THRESHOLD } from '../common/constants';
import { formatDateOnly } from '../common/date.util';
import { clampProgress } from '../versions/version-summary';
import type { ActivityInput } from '../activities/activities.service';

export interface TaskSnapshot {
  status: TaskStatus;
  progress: number;
  assigneeId: string | null;
  priority: Priority;
  dueDate: Date | null;
}

export interface ActorLike {
  id: string;
  role: 'ADMIN' | 'MEMBER';
}

export interface TaskOwnership {
  createdById: string;
  assigneeId: string | null;
}

/**
 * 状态与进度的联动（已与需求方确认）：
 *   - 拖到「已完成」：进度自动置 100%，并记录完成时间
 *   - 拖出「已完成」：保留原进度（不清零），清空完成时间
 *   - 手工把进度改成 100 不会自动移动列，避免误操作
 */
export function applyStatusTransition(
  current: { status: TaskStatus; progress: number; completedAt: Date | null },
  nextStatus: TaskStatus,
  now: Date = new Date(),
): { progress: number; completedAt: Date | null } {
  if (nextStatus === current.status) {
    return { progress: current.progress, completedAt: current.completedAt };
  }
  if (nextStatus === TaskStatus.DONE) {
    return { progress: 100, completedAt: current.completedAt ?? now };
  }
  return { progress: current.progress, completedAt: null };
}

/**
 * 编辑权限：管理员可改任意任务；成员只能改自己创建或自己负责的任务。
 * 只读校验（能否查看）不在此处，看板对全员开放。
 */
export function canModifyTask(task: TaskOwnership, actor: ActorLike): boolean {
  if (actor.role === 'ADMIN') return true;
  if (task.createdById === actor.id) return true;
  return task.assigneeId === actor.id;
}

/** 只有管理员或任务创建者可以删除任务 */
export function canDeleteTask(task: TaskOwnership, actor: ActorLike): boolean {
  if (actor.role === 'ADMIN') return true;
  return task.createdById === actor.id;
}

/**
 * 比对修改前后的任务，产出需要落库的操作日志。
 * 进度变动小于阈值不记，避免拖进度条时刷满时间线。
 */
export function diffToActivities(
  before: TaskSnapshot,
  after: TaskSnapshot,
  actorId: string,
): ActivityInput[] {
  const logs: ActivityInput[] = [];
  const push = (
    action: ActivityAction,
    field: string,
    fromValue: string | null,
    toValue: string | null,
  ) => logs.push({ taskId: '', actorId, action, field, fromValue, toValue });

  if (before.status !== after.status) {
    push(ActivityAction.STATUS_CHANGED, 'status', before.status, after.status);
  }
  if (before.assigneeId !== after.assigneeId) {
    push(ActivityAction.ASSIGNEE_CHANGED, 'assigneeId', before.assigneeId, after.assigneeId);
  }
  if (before.priority !== after.priority) {
    push(ActivityAction.PRIORITY_CHANGED, 'priority', before.priority, after.priority);
  }

  const beforeDue = formatDateOnly(before.dueDate);
  const afterDue = formatDateOnly(after.dueDate);
  if (beforeDue !== afterDue) {
    push(ActivityAction.DUE_DATE_CHANGED, 'dueDate', beforeDue, afterDue);
  }

  const progressDelta = Math.abs(after.progress - before.progress);
  if (progressDelta >= PROGRESS_LOG_THRESHOLD) {
    push(
      ActivityAction.PROGRESS_CHANGED,
      'progress',
      String(before.progress),
      String(after.progress),
    );
  }

  return logs;
}

/** 新任务落到目标列末尾时用的排序值 */
export function nextSortIndex(maxSortIndex: number | null | undefined): number {
  return (maxSortIndex ?? -1) + 1;
}

/**
 * 拖拽后重排：把任务放进目标列的第 targetIndex 个位置，
 * 返回该列所有任务的新 sortIndex（按传入顺序从 0 递增）。
 */
export function reindexColumn(
  orderedTaskIds: string[],
  movingTaskId: string,
  targetIndex: number,
): { id: string; sortIndex: number }[] {
  const others = orderedTaskIds.filter((id) => id !== movingTaskId);
  const index = Math.min(Math.max(targetIndex, 0), others.length);
  const next = [...others.slice(0, index), movingTaskId, ...others.slice(index)];
  return next.map((id, i) => ({ id, sortIndex: i }));
}

export { clampProgress };
