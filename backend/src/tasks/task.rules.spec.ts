import { ActivityAction, Priority, TaskStatus } from '@prisma/client';
import {
  applyStatusTransition,
  canDeleteTask,
  canModifyTask,
  diffToActivities,
  nextSortIndex,
  reindexColumn,
  type TaskSnapshot,
} from './task.rules';

const baseSnapshot: TaskSnapshot = {
  status: TaskStatus.IN_PROGRESS,
  progress: 40,
  assigneeId: 'user-a',
  priority: Priority.P2,
  dueDate: new Date('2026-10-20T00:00:00.000Z'),
};

describe('状态与进度联动', () => {
  it('拖到已完成时进度自动置 100 并记录完成时间', () => {
    const now = new Date('2026-10-09T10:00:00.000Z');
    const result = applyStatusTransition(
      { status: TaskStatus.IN_PROGRESS, progress: 40, completedAt: null },
      TaskStatus.DONE,
      now,
    );

    expect(result.progress).toBe(100);
    expect(result.completedAt).toEqual(now);
  });

  it('拖出已完成时保留原进度、清空完成时间', () => {
    const result = applyStatusTransition(
      { status: TaskStatus.DONE, progress: 100, completedAt: new Date('2026-10-01T00:00:00.000Z') },
      TaskStatus.IN_PROGRESS,
    );

    expect(result.progress).toBe(100);
    expect(result.completedAt).toBeNull();
  });

  it('状态没变时进度与完成时间原样保留', () => {
    const completedAt = new Date('2026-10-01T00:00:00.000Z');
    const result = applyStatusTransition(
      { status: TaskStatus.BLOCKED, progress: 55, completedAt },
      TaskStatus.BLOCKED,
    );

    expect(result).toEqual({ progress: 55, completedAt });
  });

  it('已完成任务再次拖到已完成时保留原完成时间', () => {
    const completedAt = new Date('2026-10-01T00:00:00.000Z');
    const result = applyStatusTransition(
      { status: TaskStatus.DONE, progress: 100, completedAt },
      TaskStatus.DONE,
    );

    expect(result.completedAt).toEqual(completedAt);
  });
});

describe('任务编辑与删除权限', () => {
  const task = { createdById: 'owner', assigneeId: 'assignee' };

  it('管理员可以改任意任务', () => {
    expect(canModifyTask(task, { id: 'someone', role: 'ADMIN' })).toBe(true);
  });

  it('创建者和负责人都可以改', () => {
    expect(canModifyTask(task, { id: 'owner', role: 'MEMBER' })).toBe(true);
    expect(canModifyTask(task, { id: 'assignee', role: 'MEMBER' })).toBe(true);
  });

  it('其他成员不能改', () => {
    expect(canModifyTask(task, { id: 'stranger', role: 'MEMBER' })).toBe(false);
  });

  it('负责人也不能删除他人创建的任务', () => {
    expect(canDeleteTask(task, { id: 'assignee', role: 'MEMBER' })).toBe(false);
  });

  it('创建者可以删除自己的任务', () => {
    expect(canDeleteTask(task, { id: 'owner', role: 'MEMBER' })).toBe(true);
  });

  it('未分配任务时只有创建者可改', () => {
    const unassigned = { createdById: 'owner', assigneeId: null };
    expect(canModifyTask(unassigned, { id: 'stranger', role: 'MEMBER' })).toBe(false);
    expect(canModifyTask(unassigned, { id: 'owner', role: 'MEMBER' })).toBe(true);
  });
});

describe('变更日志生成', () => {
  it('状态变化写入日志', () => {
    const logs = diffToActivities(baseSnapshot, { ...baseSnapshot, status: TaskStatus.DONE }, 'actor');

    const statusLog = logs.find((log) => log.action === ActivityAction.STATUS_CHANGED);
    expect(statusLog?.fromValue).toBe(TaskStatus.IN_PROGRESS);
    expect(statusLog?.toValue).toBe(TaskStatus.DONE);
  });

  it('进度变动小于阈值不记日志，避免刷屏', () => {
    const logs = diffToActivities(baseSnapshot, { ...baseSnapshot, progress: 43 }, 'actor');

    expect(logs.find((log) => log.action === ActivityAction.PROGRESS_CHANGED)).toBeUndefined();
  });

  it('进度变动达到阈值时记日志', () => {
    const logs = diffToActivities(baseSnapshot, { ...baseSnapshot, progress: 45 }, 'actor');

    const progressLog = logs.find((log) => log.action === ActivityAction.PROGRESS_CHANGED);
    expect(progressLog?.fromValue).toBe('40');
    expect(progressLog?.toValue).toBe('45');
  });

  it('负责人、优先级、截止日期变化各自成一条', () => {
    const logs = diffToActivities(
      baseSnapshot,
      {
        ...baseSnapshot,
        assigneeId: 'user-b',
        priority: Priority.P0,
        dueDate: new Date('2026-10-25T00:00:00.000Z'),
      },
      'actor',
    );

    expect(logs.map((log) => log.action).sort()).toEqual(
      [
        ActivityAction.ASSIGNEE_CHANGED,
        ActivityAction.PRIORITY_CHANGED,
        ActivityAction.DUE_DATE_CHANGED,
      ].sort(),
    );
  });

  it('没有任何变化时不产生日志', () => {
    expect(diffToActivities(baseSnapshot, { ...baseSnapshot }, 'actor')).toEqual([]);
  });

  it('只有时间部分的差异不算截止日期变更', () => {
    const sameDay = new Date('2026-10-20T15:00:00.000Z');
    const logs = diffToActivities(baseSnapshot, { ...baseSnapshot, dueDate: sameDay }, 'actor');

    expect(logs).toEqual([]);
  });
});

describe('看板列内排序', () => {
  it('新任务排在列末尾', () => {
    expect(nextSortIndex(null)).toBe(0);
    expect(nextSortIndex(4)).toBe(5);
  });

  it('拖到指定位置后其余任务依次顺延', () => {
    const result = reindexColumn(['a', 'b', 'c'], 'c', 0);

    expect(result).toEqual([
      { id: 'c', sortIndex: 0 },
      { id: 'a', sortIndex: 1 },
      { id: 'b', sortIndex: 2 },
    ]);
  });

  it('目标下标越界时夹到区间内', () => {
    expect(reindexColumn(['a', 'b'], 'a', 99)).toEqual([
      { id: 'b', sortIndex: 0 },
      { id: 'a', sortIndex: 1 },
    ]);
    expect(reindexColumn(['a', 'b'], 'b', -5)).toEqual([
      { id: 'b', sortIndex: 0 },
      { id: 'a', sortIndex: 1 },
    ]);
  });
});
