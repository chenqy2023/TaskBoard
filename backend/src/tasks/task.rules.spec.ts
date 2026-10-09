import { ActivityAction, Priority, TaskStatus } from '@prisma/client';
import {
  applyStatusTransition,
  canDeleteTask,
  canModifyTask,
  diffToActivities,
  nextSortIndex,
  normalizeProgress,
  reindexColumn,
  type TaskSnapshot,
} from './task.rules';

const baseSnapshot: TaskSnapshot = {
  status: TaskStatus.IN_PROGRESS,
  progress: 40,
  assigneeId: 'user-a',
  participants: [{ id: 'user-p', displayName: '参与人甲' }],
  priority: Priority.P2,
  plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
  plannedEndDate: new Date('2026-10-20T00:00:00.000Z'),
  actualStartDate: null,
  actualEndDate: null,
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
});

describe('进度只接受 0-100 整数', () => {
  it('小数四舍五入为整数', () => {
    expect(normalizeProgress(66.4)).toBe(66);
    expect(normalizeProgress(66.5)).toBe(67);
    expect(normalizeProgress('80.6')).toBe(81);
  });

  it('越界夹到 0-100', () => {
    expect(normalizeProgress(180)).toBe(100);
    expect(normalizeProgress(-30)).toBe(0);
  });

  it('非数字按 0 处理', () => {
    expect(normalizeProgress('一半')).toBe(0);
    expect(normalizeProgress('')).toBe(0);
    expect(normalizeProgress(null)).toBe(0);
    expect(normalizeProgress(undefined)).toBe(0);
  });

  it('正常整数原样返回', () => {
    expect(normalizeProgress(0)).toBe(0);
    expect(normalizeProgress(100)).toBe(100);
    expect(normalizeProgress('75')).toBe(75);
  });
});

describe('任务编辑与删除权限', () => {
  const task = { createdById: 'owner', assigneeId: 'assignee', participantIds: ['helper'] };

  it('管理员可以改任意任务', () => {
    expect(canModifyTask(task, { id: 'someone', role: 'ADMIN' })).toBe(true);
  });

  it('创建者、负责人、参与人都可以改', () => {
    expect(canModifyTask(task, { id: 'owner', role: 'MEMBER' })).toBe(true);
    expect(canModifyTask(task, { id: 'assignee', role: 'MEMBER' })).toBe(true);
    expect(canModifyTask(task, { id: 'helper', role: 'MEMBER' })).toBe(true);
  });

  it('与任务无关的成员不能改', () => {
    expect(canModifyTask(task, { id: 'stranger', role: 'MEMBER' })).toBe(false);
  });

  it('参与人也不能删除任务', () => {
    expect(canDeleteTask(task, { id: 'helper', role: 'MEMBER' })).toBe(false);
    expect(canDeleteTask(task, { id: 'assignee', role: 'MEMBER' })).toBe(false);
  });

  it('创建者可以删除自己的任务', () => {
    expect(canDeleteTask(task, { id: 'owner', role: 'MEMBER' })).toBe(true);
  });

  it('没有参与人时只有创建者和负责人可改', () => {
    const bare = { createdById: 'owner', assigneeId: null };
    expect(canModifyTask(bare, { id: 'stranger', role: 'MEMBER' })).toBe(false);
    expect(canModifyTask(bare, { id: 'owner', role: 'MEMBER' })).toBe(true);
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

  it('负责人与优先级变化各自成一条', () => {
    const logs = diffToActivities(
      baseSnapshot,
      { ...baseSnapshot, assigneeId: 'user-b', priority: Priority.P0 },
      'actor',
    );

    expect(logs.map((log) => log.action).sort()).toEqual(
      [ActivityAction.ASSIGNEE_CHANGED, ActivityAction.PRIORITY_CHANGED].sort(),
    );
  });

  it('参与人变化用姓名记录，便于直接阅读', () => {
    const logs = diffToActivities(
      baseSnapshot,
      {
        ...baseSnapshot,
        participants: [
          { id: 'user-p', displayName: '参与人甲' },
          { id: 'user-q', displayName: '参与人乙' },
        ],
      },
      'actor',
    );

    const log = logs.find((item) => item.action === ActivityAction.PARTICIPANTS_CHANGED);
    expect(log?.fromValue).toBe('参与人甲');
    expect(log?.toValue).toBe('参与人甲、参与人乙');
  });

  it('参与人增删顺序不同但集合相同，不重复记日志', () => {
    const logs = diffToActivities(
      { ...baseSnapshot, participants: [{ id: 'p1', displayName: '甲' }, { id: 'p2', displayName: '乙' }] },
      { ...baseSnapshot, participants: [{ id: 'p2', displayName: '乙' }, { id: 'p1', displayName: '甲' }] },
      'actor',
    );

    expect(logs).toEqual([]);
  });

  it('清空参与人会记一条日志', () => {
    const logs = diffToActivities(baseSnapshot, { ...baseSnapshot, participants: [] }, 'actor');

    const log = logs.find((item) => item.action === ActivityAction.PARTICIPANTS_CHANGED);
    expect(log?.fromValue).toBe('参与人甲');
    expect(log?.toValue).toBeNull();
  });

  it.each([
    ['plannedStartDate', new Date('2026-10-02T00:00:00.000Z'), '计划开始日期'],
    ['plannedEndDate', new Date('2026-10-25T00:00:00.000Z'), '计划结束日期'],
    ['actualStartDate', new Date('2026-10-03T00:00:00.000Z'), '实际开始日期'],
    ['actualEndDate', new Date('2026-10-26T00:00:00.000Z'), '实际结束日期'],
  ])('%s 变更会各记一条日期日志', (field, value) => {
    const logs = diffToActivities(baseSnapshot, { ...baseSnapshot, [field]: value }, 'actor');

    const dateLogs = logs.filter((item) => item.action === ActivityAction.DUE_DATE_CHANGED);
    expect(dateLogs).toHaveLength(1);
    expect(dateLogs[0].field).toBe(field);
  });

  it('只有时间部分的差异不算日期变更', () => {
    const sameDay = new Date('2026-10-20T15:00:00.000Z');
    const logs = diffToActivities(baseSnapshot, { ...baseSnapshot, plannedEndDate: sameDay }, 'actor');

    expect(logs).toEqual([]);
  });

  it('没有任何变化时不产生日志', () => {
    expect(diffToActivities(baseSnapshot, { ...baseSnapshot }, 'actor')).toEqual([]);
  });
});

describe('看板列内排序', () => {
  it('新任务排在列末尾', () => {
    expect(nextSortIndex(null)).toBe(0);
    expect(nextSortIndex(4)).toBe(5);
  });

  it('拖到指定位置后其余任务依次顺延', () => {
    expect(reindexColumn(['a', 'b', 'c'], 'c', 0)).toEqual([
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
