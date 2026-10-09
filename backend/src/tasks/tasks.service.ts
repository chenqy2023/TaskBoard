import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityAction, Prisma, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivitiesService } from '../activities/activities.service';
import { RealtimeService } from '../realtime/realtime.service';
import { clampProgress } from '../versions/version-summary';
import { formatDateOnly, toDateOnly } from '../common/date.util';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  BatchUpdateTaskDto,
  CreateTaskDto,
  MoveTaskDto,
  QueryTaskDto,
  UpdateTaskDto,
} from './dto/task.dto';
import {
  applyStatusTransition,
  canDeleteTask,
  canModifyTask,
  diffToActivities,
  nextSortIndex,
  reindexColumn,
  type TaskSnapshot,
} from './task.rules';

const TASK_INCLUDE = {
  assignee: { select: { id: true, displayName: true } },
  createdBy: { select: { id: true, displayName: true } },
} satisfies Prisma.TaskInclude;

type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof TASK_INCLUDE }>;

export interface TaskView {
  id: string;
  versionId: string;
  title: string;
  description: string | null;
  module: string;
  assignee: { id: string; displayName: string } | null;
  priority: string;
  status: TaskStatus;
  progress: number;
  dueDate: string | null;
  overdue: boolean;
  sortIndex: number;
  completedAt: string | null;
  createdBy: { id: string; displayName: string } | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activities: ActivitiesService,
    private readonly realtime: RealtimeService,
  ) {}

  async findAll(versionId: string, query: QueryTaskDto) {
    await this.assertVersionExists(versionId);
    const where = this.buildWhere(versionId, query);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [total, tasks] = await Promise.all([
      this.prisma.task.count({ where }),
      this.prisma.task.findMany({
        where,
        include: TASK_INCLUDE,
        orderBy: this.buildOrderBy(query),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      items: tasks.map(toTaskView),
    };
  }

  /** 看板用：一次取回该版本全部任务，前端自己按列分组 */
  async findBoard(versionId: string, query: QueryTaskDto) {
    await this.assertVersionExists(versionId);
    const tasks = await this.prisma.task.findMany({
      where: this.buildWhere(versionId, query),
      include: TASK_INCLUDE,
      orderBy: [{ sortIndex: 'asc' }, { createdAt: 'asc' }],
    });
    return tasks.map(toTaskView);
  }

  /** 供筛选下拉使用：版本下出现过的模块 */
  async listModules(versionId: string) {
    await this.assertVersionExists(versionId);
    const rows = await this.prisma.task.findMany({
      where: { versionId, deletedAt: null, module: { not: '' } },
      select: { module: true },
      distinct: ['module'],
      orderBy: { module: 'asc' },
    });
    return rows.map((row) => row.module);
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, deletedAt: null },
      include: TASK_INCLUDE,
    });
    if (!task) throw new NotFoundException('任务不存在');
    return toTaskView(task);
  }

  async create(dto: CreateTaskDto, actor: AuthUser) {
    await this.assertVersionExists(dto.versionId);
    if (dto.assigneeId) await this.assertUserExists(dto.assigneeId);

    const status = dto.status ?? TaskStatus.TODO;
    const aggregate = await this.prisma.task.aggregate({
      where: { versionId: dto.versionId, status, deletedAt: null },
      _max: { sortIndex: true },
    });

    // 创建时若直接标为已完成，进度强制 100%，与状态联动规则保持一致
    const progress =
      status === TaskStatus.DONE ? 100 : clampProgress(dto.progress ?? 0);

    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          versionId: dto.versionId,
          title: dto.title.trim(),
          description: dto.description ?? null,
          module: dto.module?.trim() ?? '',
          assigneeId: dto.assigneeId ?? null,
          priority: dto.priority,
          status,
          progress,
          dueDate: toDateOnly(dto.dueDate),
          completedAt: status === TaskStatus.DONE ? new Date() : null,
          sortIndex: nextSortIndex(aggregate._max.sortIndex),
          createdById: actor.id,
        },
        include: TASK_INCLUDE,
      });

      await this.activities.record(
        {
          taskId: created.id,
          actorId: actor.id,
          action: ActivityAction.TASK_CREATED,
          field: 'title',
          toValue: created.title,
        },
        tx,
      );
      if (created.assigneeId) {
        await this.activities.record(
          {
            taskId: created.id,
            actorId: actor.id,
            action: ActivityAction.ASSIGNEE_CHANGED,
            field: 'assigneeId',
            toValue: created.assigneeId,
          },
          tx,
        );
      }

      return created;
    });

    await this.emit(actor, 'task.created', task);
    return toTaskView(task);
  }

  async update(id: string, dto: UpdateTaskDto, actor: AuthUser) {
    const current = await this.getOrThrow(id);
    this.assertCanModify(current, actor);

    if (dto.assigneeId) await this.assertUserExists(dto.assigneeId);

    const before: TaskSnapshot = snapshot(current);
    const nextStatus = dto.status ?? current.status;
    const transition = applyStatusTransition(
      { status: current.status, progress: current.progress, completedAt: current.completedAt },
      nextStatus,
    );

    const progress =
      dto.progress !== undefined ? clampProgress(dto.progress) : transition.progress;

    const after: TaskSnapshot = {
      status: nextStatus,
      progress,
      assigneeId: dto.assigneeId !== undefined ? dto.assigneeId : current.assigneeId,
      priority: dto.priority ?? current.priority,
      dueDate: dto.dueDate !== undefined ? toDateOnly(dto.dueDate) : current.dueDate,
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.task.update({
        where: { id },
        data: {
          title: dto.title?.trim(),
          description: dto.description,
          module: dto.module?.trim(),
          assigneeId: dto.assigneeId,
          priority: dto.priority,
          status: nextStatus,
          progress,
          dueDate: after.dueDate,
          completedAt: transition.completedAt,
        },
        include: TASK_INCLUDE,
      });

      const logs = diffToActivities(before, after, actor.id).map((log) => ({ ...log, taskId: id }));
      const textChanged =
        (dto.title !== undefined && dto.title.trim() !== current.title) ||
        (dto.module !== undefined && dto.module.trim() !== current.module) ||
        (dto.description !== undefined && (dto.description ?? null) !== current.description);

      if (textChanged) {
        logs.push({
          taskId: id,
          actorId: actor.id,
          action: ActivityAction.TASK_UPDATED,
          field: 'content',
          fromValue: null,
          toValue: null,
        });
      }
      await this.activities.recordMany(logs, tx);
      return saved;
    });

    await this.emit(actor, 'task.updated', updated);
    return toTaskView(updated);
  }

  /** 看板拖拽：改状态 + 落在目标列指定位置 */
  async move(id: string, dto: MoveTaskDto, actor: AuthUser) {
    const current = await this.getOrThrow(id);
    this.assertCanModify(current, actor);

    const transition = applyStatusTransition(
      { status: current.status, progress: current.progress, completedAt: current.completedAt },
      dto.status,
    );

    const columnTasks = await this.prisma.task.findMany({
      where: { versionId: current.versionId, status: dto.status, deletedAt: null },
      select: { id: true },
      orderBy: [{ sortIndex: 'asc' }, { createdAt: 'asc' }],
    });

    const orderedIds = columnTasks.map((t) => t.id);
    if (!orderedIds.includes(id)) orderedIds.push(id);
    const targetIndex = dto.targetIndex ?? orderedIds.length - 1;
    const reindexed = reindexColumn(orderedIds, id, targetIndex);

    const updated = await this.prisma.$transaction(async (tx) => {
      for (const item of reindexed) {
        await tx.task.update({ where: { id: item.id }, data: { sortIndex: item.sortIndex } });
      }

      const saved = await tx.task.update({
        where: { id },
        data: {
          status: dto.status,
          progress: transition.progress,
          completedAt: transition.completedAt,
        },
        include: TASK_INCLUDE,
      });

      const logs = diffToActivities(snapshot(current), snapshot(saved), actor.id).map((log) => ({
        ...log,
        taskId: id,
      }));
      await this.activities.recordMany(logs, tx);
      return saved;
    });

    await this.emit(actor, 'task.moved', updated);
    return toTaskView(updated);
  }

  async batchUpdate(dto: BatchUpdateTaskDto, actor: AuthUser) {
    const tasks = await this.prisma.task.findMany({
      where: { id: { in: dto.ids }, deletedAt: null },
      include: TASK_INCLUDE,
    });
    if (tasks.length === 0) throw new NotFoundException('未找到可操作的任务');
    if (dto.assigneeId) await this.assertUserExists(dto.assigneeId);

    // 只要有一个任务无权修改就整体拒绝，避免"部分成功"造成的困惑
    for (const task of tasks) this.assertCanModify(task, actor);

    let updatedCount = 0;
    for (const task of tasks) {
      const before = snapshot(task);
      const nextStatus = dto.status ?? task.status;
      const transition = applyStatusTransition(
        { status: task.status, progress: task.progress, completedAt: task.completedAt },
        nextStatus,
      );
      const after: TaskSnapshot = {
        status: nextStatus,
        progress: transition.progress,
        assigneeId: dto.assigneeId !== undefined ? dto.assigneeId : task.assigneeId,
        priority: dto.priority ?? task.priority,
        dueDate: dto.dueDate !== undefined ? toDateOnly(dto.dueDate) : task.dueDate,
      };

      await this.prisma.$transaction(async (tx) => {
        await tx.task.update({
          where: { id: task.id },
          data: {
            assigneeId: after.assigneeId,
            priority: after.priority,
            status: nextStatus,
            progress: after.progress,
            dueDate: after.dueDate,
            completedAt: transition.completedAt,
          },
        });
        await this.activities.recordMany(
          diffToActivities(before, after, actor.id).map((log) => ({ ...log, taskId: task.id })),
          tx,
        );
      });
      updatedCount += 1;
    }

    await this.realtime.emitToVersion(tasks[0].versionId, 'task.batch-updated', {
      versionId: tasks[0].versionId,
      ids: tasks.map((t) => t.id),
      by: actor.displayName,
    });

    return { success: true, updatedCount };
  }

  async remove(id: string, actor: AuthUser) {
    const task = await this.getOrThrow(id);
    this.assertCanDelete(task, actor);

    await this.prisma.$transaction(async (tx) => {
      await tx.task.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.activities.record(
        {
          taskId: id,
          actorId: actor.id,
          action: ActivityAction.TASK_DELETED,
          field: 'title',
          fromValue: task.title,
        },
        tx,
      );
    });

    await this.realtime.emitToVersion(task.versionId, 'task.deleted', {
      versionId: task.versionId,
      taskId: id,
      by: actor.displayName,
    });
    return { success: true };
  }

  async myTasks(actor: AuthUser, limit = 50) {
    const tasks = await this.prisma.task.findMany({
      where: { assigneeId: actor.id, deletedAt: null, status: { not: TaskStatus.DONE } },
      include: { ...TASK_INCLUDE, version: { select: { id: true, name: true } } },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      take: limit,
    });
    return tasks.map((task) => ({
      ...toTaskView(task),
      version: { id: task.version.id, name: task.version.name },
    }));
  }

  private buildWhere(versionId: string, query: QueryTaskDto): Prisma.TaskWhereInput {
    const where: Prisma.TaskWhereInput = { versionId, deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.module) where.module = query.module;

    if (query.assigneeId === 'unassigned') {
      where.assigneeId = null;
    } else if (query.assigneeId) {
      where.assigneeId = query.assigneeId;
    }

    if (query.keyword?.trim()) {
      const keyword = query.keyword.trim();
      where.OR = [
        { title: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  private buildOrderBy(query: QueryTaskDto): Prisma.TaskOrderByWithRelationInput[] {
    const order = query.order === 'desc' ? 'desc' : 'asc';
    switch (query.sortBy) {
      case 'createdAt':
        return [{ createdAt: order }];
      case 'dueDate':
        // 未设截止日期的排在最后，避免空值挤在最前
        return [{ dueDate: { sort: order, nulls: 'last' } }];
      case 'priority':
        return [{ priority: order }, { sortIndex: 'asc' }];
      case 'progress':
        return [{ progress: order }];
      case 'title':
        return [{ title: order }];
      default:
        return [{ status: 'asc' }, { sortIndex: 'asc' }];
    }
  }

  private async assertVersionExists(versionId: string) {
    const version = await this.prisma.version.findUnique({
      where: { id: versionId },
      select: { id: true },
    });
    if (!version) throw new NotFoundException('版本不存在');
  }

  private async assertUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new BadRequestException('指定的负责人不存在');
  }

  private async getOrThrow(id: string): Promise<TaskWithRelations> {
    const task = await this.prisma.task.findFirst({
      where: { id, deletedAt: null },
      include: TASK_INCLUDE,
    });
    if (!task) throw new NotFoundException('任务不存在或已被删除');
    return task;
  }

  private assertCanModify(task: { createdById: string; assigneeId: string | null }, actor: AuthUser) {
    if (!canModifyTask(task, actor)) {
      throw new ForbiddenException('只能修改自己创建或自己负责的任务');
    }
  }

  private assertCanDelete(task: { createdById: string; assigneeId: string | null }, actor: AuthUser) {
    if (!canDeleteTask(task, actor)) {
      throw new ForbiddenException('只有任务创建者或管理员可以删除任务');
    }
  }

  private emit(
    actor: AuthUser,
    event: string,
    task: TaskWithRelations,
  ) {
    return this.realtime.emitToVersion(task.versionId, event, {
      versionId: task.versionId,
      task: toTaskView(task),
      by: actor.displayName,
    });
  }
}

export function snapshot(task: {
  status: TaskStatus;
  progress: number;
  assigneeId: string | null;
  priority: TaskSnapshot['priority'];
  dueDate: Date | null;
}): TaskSnapshot {
  return {
    status: task.status,
    progress: task.progress,
    assigneeId: task.assigneeId,
    priority: task.priority,
    dueDate: task.dueDate,
  };
}

/** 逾期判断：有截止日期、已过期、且未完成 */
export function isOverdue(dueDate: Date | null, status: TaskStatus, today = new Date()): boolean {
  if (!dueDate || status === TaskStatus.DONE) return false;
  const due = formatDateOnly(dueDate);
  const now = formatDateOnly(today);
  return !!due && !!now && due < now;
}

export function toTaskView(task: TaskWithRelations): TaskView {
  return {
    id: task.id,
    versionId: task.versionId,
    title: task.title,
    description: task.description,
    module: task.module,
    assignee: task.assignee ? { id: task.assignee.id, displayName: task.assignee.displayName } : null,
    priority: task.priority,
    status: task.status,
    progress: task.progress,
    dueDate: formatDateOnly(task.dueDate),
    overdue: isOverdue(task.dueDate, task.status),
    sortIndex: task.sortIndex,
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    createdBy: task.createdBy
      ? { id: task.createdBy.id, displayName: task.createdBy.displayName }
      : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}
