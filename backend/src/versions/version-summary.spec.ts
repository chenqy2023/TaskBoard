import { TaskStatus } from '@prisma/client';
import { summarizeFromAggregates, summarizeTasks } from './version-summary';

describe('版本进度汇总口径', () => {
  it('平均进度取算术平均并四舍五入为整数', () => {
    const summary = summarizeTasks([
      { status: TaskStatus.TODO, progress: 60 },
      { status: TaskStatus.IN_PROGRESS, progress: 30 },
      { status: TaskStatus.DONE, progress: 100 },
    ]);

    expect(summary.total).toBe(3);
    expect(summary.done).toBe(1);
    // (60 + 30 + 100) / 3 = 63.33... -> 63
    expect(summary.avgProgress).toBe(63);
    expect(summary.completionRate).toBe(33.3);
  });

  it('空版本不出现除零，返回全 0', () => {
    const summary = summarizeTasks([]);

    expect(summary).toEqual({
      total: 0,
      done: 0,
      avgProgress: 0,
      completionRate: 0,
      byStatus: { TODO: 0, IN_PROGRESS: 0, BLOCKED: 0, DONE: 0 },
    });
  });

  it('按状态分类计数', () => {
    const summary = summarizeTasks([
      { status: TaskStatus.TODO, progress: 0 },
      { status: TaskStatus.TODO, progress: 10 },
      { status: TaskStatus.BLOCKED, progress: 50 },
      { status: TaskStatus.DONE, progress: 100 },
    ]);

    expect(summary.byStatus).toEqual({ TODO: 2, IN_PROGRESS: 0, BLOCKED: 1, DONE: 1 });
    expect(summary.completionRate).toBe(25);
  });

  it('越界的进度值被夹到 0-100，不影响平均值', () => {
    const summary = summarizeTasks([
      { status: TaskStatus.TODO, progress: 150 },
      { status: TaskStatus.TODO, progress: -20 },
    ]);

    expect(summary.avgProgress).toBe(50);
  });

  it('聚合结果与逐条计算结果一致', () => {
    const tasks = [
      { status: TaskStatus.TODO, progress: 20 },
      { status: TaskStatus.IN_PROGRESS, progress: 45 },
      { status: TaskStatus.DONE, progress: 100 },
      { status: TaskStatus.BLOCKED, progress: 5 },
    ];

    const byTasks = summarizeTasks(tasks);
    const byAggregate = summarizeFromAggregates({
      total: tasks.length,
      progressSum: tasks.reduce((sum, task) => sum + task.progress, 0),
      byStatus: {
        TODO: 1,
        IN_PROGRESS: 1,
        DONE: 1,
        BLOCKED: 1,
      },
    });

    expect(byAggregate).toEqual(byTasks);
  });

  it('聚合结果缺少某个状态时补 0', () => {
    const summary = summarizeFromAggregates({ total: 1, progressSum: 40, byStatus: { TODO: 1 } });

    expect(summary.byStatus.IN_PROGRESS).toBe(0);
    expect(summary.byStatus.DONE).toBe(0);
  });
});
