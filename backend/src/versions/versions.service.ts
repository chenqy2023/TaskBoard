import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TaskStatus, VersionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVersionDto, QueryVersionDto, UpdateVersionDto } from './dto/version.dto';
import { summarizeFromAggregates, type VersionSummary } from './version-summary';
import { formatDateOnly, toDateOnly } from '../common/date.util';
import type { AuthUser } from '../common/decorators/current-user.decorator';

export interface VersionView {
  id: string;
  name: string;
  description: string | null;
  status: VersionStatus;
  testStartDate: string | null;
  plannedReleaseDate: string | null;
  createdBy: { id: string; displayName: string } | null;
  createdAt: string;
  updatedAt: string;
  summary: VersionSummary;
}

@Injectable()
export class VersionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryVersionDto): Promise<VersionView[]> {
    const where: Prisma.VersionWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.keyword?.trim()) where.name = { contains: query.keyword.trim(), mode: 'insensitive' };

    const versions = await this.prisma.version.findMany({
      where,
      include: { createdBy: { select: { id: true, displayName: true } } },
      orderBy: [{ createdAt: 'desc' }],
    });

    const summaries = await this.summariesFor(versions.map((v) => v.id));
    return versions.map((version) => this.toView(version, summaries.get(version.id)));
  }

  async findOne(id: string): Promise<VersionView> {
    const version = await this.prisma.version.findUnique({
      where: { id },
      include: { createdBy: { select: { id: true, displayName: true } } },
    });
    if (!version) throw new NotFoundException('版本不存在');

    const summaries = await this.summariesFor([id]);
    return this.toView(version, summaries.get(id));
  }

  /** 供任务服务复用：取某版本的汇总（含 404 校验） */
  async getSummary(id: string): Promise<VersionSummary> {
    await this.assertExists(id);
    const summaries = await this.summariesFor([id]);
    return summaries.get(id)!;
  }

  async create(dto: CreateVersionDto, actor: AuthUser): Promise<VersionView> {
    const name = dto.name.trim();
    const exists = await this.prisma.version.findUnique({ where: { name } });
    if (exists) throw new ConflictException(`版本号 ${name} 已存在`);

    const version = await this.prisma.version.create({
      data: {
        name,
        description: dto.description ?? null,
        status: dto.status ?? VersionStatus.TESTING,
        testStartDate: toDateOnly(dto.testStartDate),
        plannedReleaseDate: toDateOnly(dto.plannedReleaseDate),
        createdById: actor.id,
      },
      include: { createdBy: { select: { id: true, displayName: true } } },
    });
    return this.toView(version);
  }

  async update(id: string, dto: UpdateVersionDto): Promise<VersionView> {
    await this.assertExists(id);

    if (dto.name) {
      const name = dto.name.trim();
      const clash = await this.prisma.version.findFirst({ where: { name, id: { not: id } } });
      if (clash) throw new ConflictException(`版本号 ${name} 已存在`);
    }

    const version = await this.prisma.version.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description,
        status: dto.status,
        ...(dto.testStartDate !== undefined ? { testStartDate: toDateOnly(dto.testStartDate) } : {}),
        ...(dto.plannedReleaseDate !== undefined
          ? { plannedReleaseDate: toDateOnly(dto.plannedReleaseDate) }
          : {}),
      },
      include: { createdBy: { select: { id: true, displayName: true } } },
    });
    const summaries = await this.summariesFor([id]);
    return this.toView(version, summaries.get(id));
  }

  async remove(id: string, force = false) {
    await this.assertExists(id);
    const taskCount = await this.prisma.task.count({ where: { versionId: id, deletedAt: null } });
    // 版本下还有任务时先拦一道，避免手滑删掉整个迭代的测试记录
    if (taskCount > 0 && !force) {
      throw new ConflictException(
        `该版本下还有 ${taskCount} 个任务，删除版本会一并删除这些任务；确认请重复提交并带上 force=true`,
      );
    }
    await this.prisma.version.delete({ where: { id } });
    return { success: true, deletedTasks: taskCount };
  }

  private async assertExists(id: string) {
    const version = await this.prisma.version.findUnique({ where: { id }, select: { id: true } });
    if (!version) throw new NotFoundException('版本不存在');
  }

  /** 批量计算多个版本的汇总，2 条聚合查询搞定，不随版本数线性增长 */
  async summariesFor(versionIds: string[]): Promise<Map<string, VersionSummary>> {
    const result = new Map<string, VersionSummary>();
    if (versionIds.length === 0) return result;

    const baseWhere: Prisma.TaskWhereInput = {
      versionId: { in: versionIds },
      deletedAt: null,
    };

    const [totalGroups, statusGroups] = await Promise.all([
      this.prisma.task.groupBy({
        by: ['versionId'],
        where: baseWhere,
        _count: { _all: true },
        _sum: { progress: true },
      }),
      this.prisma.task.groupBy({
        by: ['versionId', 'status'],
        where: baseWhere,
        _count: { _all: true },
      }),
    ]);

    const statusByVersion = new Map<string, Partial<Record<TaskStatus, number>>>();
    for (const group of statusGroups) {
      const bucket = statusByVersion.get(group.versionId) ?? {};
      bucket[group.status] = group._count._all;
      statusByVersion.set(group.versionId, bucket);
    }

    const seen = new Set<string>();
    for (const group of totalGroups) {
      seen.add(group.versionId);
      result.set(
        group.versionId,
        summarizeFromAggregates({
          total: group._count._all,
          progressSum: group._sum.progress ?? 0,
          byStatus: statusByVersion.get(group.versionId) ?? {},
        }),
      );
    }

    // 没有任务的版本补空汇总
    for (const id of versionIds) {
      if (!seen.has(id)) result.set(id, summarizeFromAggregates({ total: 0, progressSum: 0, byStatus: {} }));
    }

    return result;
  }

  private toView(
    version: {
      id: string;
      name: string;
      description: string | null;
      status: VersionStatus;
      testStartDate: Date | null;
      plannedReleaseDate: Date | null;
      createdAt: Date;
      updatedAt: Date;
      createdBy?: { id: string; displayName: string } | null;
    },
    summary?: VersionSummary,
  ): VersionView {
    return {
      id: version.id,
      name: version.name,
      description: version.description,
      status: version.status,
      testStartDate: formatDateOnly(version.testStartDate),
      plannedReleaseDate: formatDateOnly(version.plannedReleaseDate),
      createdBy: version.createdBy ?? null,
      createdAt: version.createdAt.toISOString(),
      updatedAt: version.updatedAt.toISOString(),
      summary: summary ?? summarizeFromAggregates({ total: 0, progressSum: 0, byStatus: {} }),
    };
  }
}
