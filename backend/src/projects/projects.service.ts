import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TaskStatus, ProjectStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, QueryProjectDto, UpdateProjectDto } from './dto/project.dto';
import { summarizeFromAggregates, type ProjectSummary } from './project-summary';
import { formatDateOnly, toDateOnly } from '../common/date.util';
import type { AuthUser } from '../common/decorators/current-user.decorator';

export interface ProjectView {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  createdBy: { id: string; displayName: string } | null;
  createdAt: string;
  updatedAt: string;
  summary: ProjectSummary;
}

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryProjectDto): Promise<ProjectView[]> {
    const where: Prisma.ProjectWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.keyword?.trim()) where.name = { contains: query.keyword.trim(), mode: 'insensitive' };

    const projects = await this.prisma.project.findMany({
      where,
      include: { createdBy: { select: { id: true, displayName: true } } },
      orderBy: [{ createdAt: 'desc' }],
    });

    const summaries = await this.summariesFor(projects.map((v) => v.id));
    return projects.map((project) => this.toView(project, summaries.get(project.id)));
  }

  async findOne(id: string): Promise<ProjectView> {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { createdBy: { select: { id: true, displayName: true } } },
    });
    if (!project) throw new NotFoundException('项目不存在');

    const summaries = await this.summariesFor([id]);
    return this.toView(project, summaries.get(id));
  }

  /** 供任务服务复用：取某项目的汇总（含 404 校验） */
  async getSummary(id: string): Promise<ProjectSummary> {
    await this.assertExists(id);
    const summaries = await this.summariesFor([id]);
    return summaries.get(id)!;
  }

  async create(dto: CreateProjectDto, actor: AuthUser): Promise<ProjectView> {
    const name = dto.name.trim();
    const exists = await this.prisma.project.findUnique({ where: { name } });
    if (exists) throw new ConflictException(`项目名称 ${name} 已存在`);

    const project = await this.prisma.project.create({
      data: {
        name,
        description: dto.description ?? null,
        status: dto.status ?? ProjectStatus.ACTIVE,
        startDate: toDateOnly(dto.startDate),
        endDate: toDateOnly(dto.endDate),
        createdById: actor.id,
      },
      include: { createdBy: { select: { id: true, displayName: true } } },
    });
    return this.toView(project);
  }

  async update(id: string, dto: UpdateProjectDto): Promise<ProjectView> {
    await this.assertExists(id);

    if (dto.name) {
      const name = dto.name.trim();
      const clash = await this.prisma.project.findFirst({ where: { name, id: { not: id } } });
      if (clash) throw new ConflictException(`项目名称 ${name} 已存在`);
    }

    const project = await this.prisma.project.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description,
        status: dto.status,
        ...(dto.startDate !== undefined ? { startDate: toDateOnly(dto.startDate) } : {}),
        ...(dto.endDate !== undefined
          ? { endDate: toDateOnly(dto.endDate) }
          : {}),
      },
      include: { createdBy: { select: { id: true, displayName: true } } },
    });
    const summaries = await this.summariesFor([id]);
    return this.toView(project, summaries.get(id));
  }

  async remove(id: string, force = false) {
    await this.assertExists(id);
    const taskCount = await this.prisma.task.count({ where: { projectId: id, deletedAt: null } });
    // 项目下还有任务时先拦一道，避免手滑删掉整个迭代的记录
    if (taskCount > 0 && !force) {
      throw new ConflictException(
        `该项目下还有 ${taskCount} 个任务，删除项目会一并删除这些任务；确认请重复提交并带上 force=true`,
      );
    }
    await this.prisma.project.delete({ where: { id } });
    return { success: true, deletedTasks: taskCount };
  }

  private async assertExists(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id }, select: { id: true } });
    if (!project) throw new NotFoundException('项目不存在');
  }

  /** 批量计算多个项目的汇总，2 条聚合查询搞定，不随项目数线性增长 */
  async summariesFor(projectIds: string[]): Promise<Map<string, ProjectSummary>> {
    const result = new Map<string, ProjectSummary>();
    if (projectIds.length === 0) return result;

    const baseWhere: Prisma.TaskWhereInput = {
      projectId: { in: projectIds },
      deletedAt: null,
    };

    const [totalGroups, statusGroups] = await Promise.all([
      this.prisma.task.groupBy({
        by: ['projectId'],
        where: baseWhere,
        _count: { _all: true },
        _sum: { progress: true },
      }),
      this.prisma.task.groupBy({
        by: ['projectId', 'status'],
        where: baseWhere,
        _count: { _all: true },
      }),
    ]);

    const statusByProject = new Map<string, Partial<Record<TaskStatus, number>>>();
    for (const group of statusGroups) {
      const bucket = statusByProject.get(group.projectId) ?? {};
      bucket[group.status] = group._count._all;
      statusByProject.set(group.projectId, bucket);
    }

    const seen = new Set<string>();
    for (const group of totalGroups) {
      seen.add(group.projectId);
      result.set(
        group.projectId,
        summarizeFromAggregates({
          total: group._count._all,
          progressSum: group._sum.progress ?? 0,
          byStatus: statusByProject.get(group.projectId) ?? {},
        }),
      );
    }

    // 没有任务的项目补空汇总
    for (const id of projectIds) {
      if (!seen.has(id)) result.set(id, summarizeFromAggregates({ total: 0, progressSum: 0, byStatus: {} }));
    }

    return result;
  }

  private toView(
    project: {
      id: string;
      name: string;
      description: string | null;
      status: ProjectStatus;
      startDate: Date | null;
      endDate: Date | null;
      createdAt: Date;
      updatedAt: Date;
      createdBy?: { id: string; displayName: string } | null;
    },
    summary?: ProjectSummary,
  ): ProjectView {
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      startDate: formatDateOnly(project.startDate),
      endDate: formatDateOnly(project.endDate),
      createdBy: project.createdBy ?? null,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      summary: summary ?? summarizeFromAggregates({ total: 0, progressSum: 0, byStatus: {} }),
    };
  }
}
