import { Injectable } from '@nestjs/common';
import { Priority, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VersionsService } from '../versions/versions.service';
import {
  PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
} from '../common/constants';

const UNASSIGNED = '未分配';
const NO_MODULE = '未填模块';

interface Bucket {
  key: string;
  label: string;
  total: number;
  done: number;
  progressSum: number;
}

@Injectable()
export class StatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly versions: VersionsService,
  ) {}

  async byVersion(versionId: string) {
    const [summary, statusRows, priorityRows, assigneeRows, moduleRows] = await Promise.all([
      this.versions.getSummary(versionId),
      this.prisma.task.groupBy({
        by: ['status'],
        where: { versionId, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.task.groupBy({
        by: ['priority'],
        where: { versionId, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.task.groupBy({
        by: ['assigneeId', 'status'],
        where: { versionId, deletedAt: null },
        _count: { _all: true },
        _sum: { progress: true },
      }),
      this.prisma.task.groupBy({
        by: ['module', 'status'],
        where: { versionId, deletedAt: null },
        _count: { _all: true },
        _sum: { progress: true },
      }),
    ]);

    const users = await this.prisma.user.findMany({
      select: { id: true, displayName: true },
    });
    const userName = new Map(users.map((u) => [u.id, u.displayName]));

    const statusCount = new Map(statusRows.map((row) => [row.status, row._count._all]));
    const priorityCount = new Map(priorityRows.map((row) => [row.priority, row._count._all]));

    const assignees = foldBuckets(
      assigneeRows.map((row) => ({
        key: row.assigneeId ?? 'unassigned',
        label: row.assigneeId ? (userName.get(row.assigneeId) ?? '未知成员') : UNASSIGNED,
        status: row.status,
        count: row._count._all,
        progressSum: row._sum.progress ?? 0,
      })),
    );

    const modules = foldBuckets(
      moduleRows.map((row) => ({
        key: row.module || 'none',
        label: row.module || NO_MODULE,
        status: row.status,
        count: row._count._all,
        progressSum: row._sum.progress ?? 0,
      })),
    );

    return {
      summary,
      byStatus: TASK_STATUS_ORDER.map((status) => ({
        status,
        label: TASK_STATUS_LABELS[status],
        count: statusCount.get(status) ?? 0,
      })),
      byPriority: (Object.keys(PRIORITY_LABELS) as Priority[]).map((priority) => ({
        priority,
        label: PRIORITY_LABELS[priority],
        count: priorityCount.get(priority) ?? 0,
      })),
      byAssignee: assignees,
      byModule: modules,
    };
  }
}

function foldBuckets(
  rows: { key: string; label: string; status: TaskStatus; count: number; progressSum: number }[],
): { key: string; label: string; total: number; done: number; avgProgress: number; completionRate: number }[] {
  const map = new Map<string, Bucket>();
  for (const row of rows) {
    const bucket = map.get(row.key) ?? {
      key: row.key,
      label: row.label,
      total: 0,
      done: 0,
      progressSum: 0,
    };
    bucket.total += row.count;
    bucket.progressSum += row.progressSum;
    if (row.status === TaskStatus.DONE) bucket.done += row.count;
    map.set(row.key, bucket);
  }

  return [...map.values()]
    .map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      total: bucket.total,
      done: bucket.done,
      avgProgress: bucket.total === 0 ? 0 : Math.round(bucket.progressSum / bucket.total),
      completionRate:
        bucket.total === 0 ? 0 : Math.round((bucket.done / bucket.total) * 1000) / 10,
    }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'zh-Hans-CN'));
}
