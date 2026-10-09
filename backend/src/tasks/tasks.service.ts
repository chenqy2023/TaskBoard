import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityAction, Prisma, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivitiesService } from '../activities/activities.service';
import { RealtimeService } from '../realtime/realtime.service';
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
  normalizeProgress,
  reindexColumn,
  type TaskSnapshot,
} from './task.rules';

const TASK_INCLUDE = {
  assignee: { select: { id: true, displayName: true } },
  participants: { select: { id: true, displayName: true } },
  createdBy: { select: { id: true, displayName: true } },
} satisfies Prisma.TaskInclude;

type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof TASK_INCLUDE }>;

export interface TaskView {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  assignee: { id: string; displayName: string } | null;
  participants: { id: string; displayName: string }[];
  priority: string;
  status: TaskStatus;
  progress: number;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
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

  async findAll(projectId: string, query: QueryTaskDto) {
    await this.assertProjectExists(projectId);
    const where = this.buildWhere(projectId, query);
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

  /** 看板用：一次取回该项目全部任务，前端自己按列分组 */
  async findBoard(projectId: string, query: QueryTaskDto) {
    await this.assertProjectExists(projectId);
    const tasks = await this.prisma.task.findMany({
      where: this.buildWhere(projectId, query),
      include: TASK_INCLUDE,
      orderBy: [{ sortIndex: 'asc' }, { createdAt: 'asc' }],
    });
    return tasks.map(toTaskView);
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
    await this.assertProjectExists(dto.projectId);
    if (dto.assigneeId) await this.assertUserExists(dto.assigneeId);
    const participantIds = await this.resolveParticipantIds(dto.participantIds);

    const status = dto.status ?? TaskStatus.TODO;
    const aggregate = await this.prisma.task.aggregate({
      where: { projectId: dto.projectId, status, deletedAt: null },
      _max: { sortIndex: true },
    });

    // 创建时若直接标为已完成，进度强制 100%，与状态联动规则保持一致
    const progress = status === TaskStatus.DONE ? 100 : normalizeProgress(dto.progress ?? 0);

    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          projectId: dto.projectId,
          title: dto.title.trim(),
          description: dto.description ?? null,
          assigneeId: dto.assigneeId ?? null,
          participants: { connect: participantIds.map((id) => ({ id })) },
          priority: dto.priority,
          status,
          progress,
          plannedStartDate: toDateOnly(dto.plannedStartDate),
          plannedEndDate: toDateOnly(dto.plannedEndDate),
          actualStartDate: toDateOnly(dto.actualStartDate),
          actualEndDate: toDateOnly(dto.actualEndDate),
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
      if (created.assignee) {
        await this.activities.record(
          {
            taskId: created.id,
            actorId: actor.id,
            action: ActivityAction.ASSIGNEE_CHANGED,
            field: 'assigneeId',
            toValue: created.assignee.displayName,
          },
          tx,
        );
      }
      if (created.participants.length > 0) {
        await this.activities.record(
          {
            taskId: created.id,
            actorId: actor.id,
            action: ActivityAction.PARTICIPANTS_CHANGED,
            field: 'participants',
            toValue: created.participants.map((item) => item.displayName).join('、'),
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
    const participantIds =
      dto.participantIds !== undefined ? await this.resolveParticipantIds(dto.participantIds) : undefined;

    const before = snapshot(current);
    const nextStatus = dto.status ?? current.status;
    const transition = applyStatusTransition(
      { status: current.status, progress: current.progress, completedAt: current.completedAt },
      nextStatus,
    );

    const progress = dto.progress !== undefined ? normalizeProgress(dto.progress) : transition.progress;

    const after: TaskSnapshot = {
      ...before,
      status: nextStatus,
      progress,
      assigneeId: dto.assigneeId !== undefined ? dto.assigneeId : current.assigneeId,
      priority: dto.priority ?? current.priority,
      plannedStartDate:
        dto.plannedStartDate !== undefined ? toDateOnly(dto.plannedStartDate) : current.plannedStartDate,
      plannedEndDate:
        dto.plannedEndDate !== undefined ? toDateOnly(dto.plannedEndDate) : current.plannedEndDate,
      actualStartDate:
        dto.actualStartDate !== undefined ? toDateOnly(dto.actualStartDate) : current.actualStartDate,
      actualEndDate:
        dto.actualEndDate !== undefined ? toDateOnly(dto.actualEndDate) : current.actualEndDate,
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.task.update({
        where: { id },
        data: {
          title: dto.title?.trim(),
          description: dto.description,
          assigneeId: dto.assigneeId,
          ...(participantIds !== undefined
            ? { participants: { set: participantIds.map((pid) => ({ id: pid })) } }
            : {}),
          priority: dto.priority,
          status: nextStatus,
          progress,
          plannedStartDate: after.plannedStartDate,
          plannedEndDate: after.plannedEndDate,
          actualStartDate: after.actualStartDate,
          actualEndDate: after.actualEndDate,
          completedAt: transition.completedAt,
        },
        include: TASK_INCLUDE,
      });

      // 参与人姓名要用更新后的结果回填，否则新加的人日志里只有 id
      const finalAfter: TaskSnapshot = { ...after, participants: snapshot(saved).participants };
      const logs = diffToActivities(before, finalAfter, actor.id).map((log) => ({ ...log, taskId: id }));

      const textChanged =
        (dto.title !== undefined && dto.title.trim() !== current.title) ||
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
      where: { projectId: current.projectId, status: dto.status, deletedAt: null },
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
        ...before,
        status: nextStatus,
        progress: transition.progress,
        assigneeId: dto.assigneeId !== undefined ? dto.assigneeId : task.assigneeId,
        priority: dto.priority ?? task.priority,
      };

      await this.prisma.$transaction(async (tx) => {
        const saved = await tx.task.update({
          where: { id: task.id },
          data: {
            assigneeId: after.assigneeId,
            priority: after.priority,
            status: nextStatus,
            progress: after.progress,
            completedAt: transition.completedAt,
          },
          include: TASK_INCLUDE,
        });
        const finalAfter: TaskSnapshot = { ...after, participants: snapshot(saved).participants };
        await this.activities.recordMany(
          diffToActivities(before, finalAfter, actor.id).map((log) => ({ ...log, taskId: task.id })),
          tx,
        );
      });
      updatedCount += 1;
    }

    await this.realtime.emitToProject(tasks[0].projectId, 'task.batch-updated', {
      projectId: tasks[0].projectId,
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

    await this.realtime.emitToProject(task.projectId, 'task.deleted', {
      projectId: task.projectId,
      taskId: id,
      by: actor.displayName,
    });
    return { success: true };
  }

  /** 我的待办：我负责的 + 我参与的，都还没完成 */
  async myTasks(actor: AuthUser, limit = 50) {
    const tasks = await this.prisma.task.findMany({
      where: {
        deletedAt: null,
        status: { not: TaskStatus.DONE },
        OR: [{ assigneeId: actor.id }, { participants: { some: { id: actor.id } } }],
      },
      include: { ...TASK_INCLUDE, project: { select: { id: true, name: true } } },
      orderBy: [{ plannedEndDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: limit,
    });
    return tasks.map((task) => ({
      ...toTaskView(task),
      project: { id: task.project.id, name: task.project.name },
      isAssignee: task.assigneeId === actor.id,
    }));
  }

  private buildWhere(projectId: string, query: QueryTaskDto): Prisma.TaskWhereInput {
    const where: Prisma.TaskWhereInput = { projectId, deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.participantId) where.participants = { some: { id: query.participantId } };

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
      case 'plannedEndDate':
        // 未设计划结束日期的排在最后，避免空值挤在最前
        return [{ plannedEndDate: { sort: order, nulls: 'last' } }];
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

  private async assertProjectExists(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('项目不存在');
  }

  private async assertUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new BadRequestException('指定的负责人不存在');
  }

  /** 参与人去重并校验存在性，避免把脏 id 写进关联表 */
  private async resolveParticipantIds(ids: string[] | undefined): Promise<string[]> {
    if (!ids || ids.length === 0) return [];
    const unique = [...new Set(ids.filter(Boolean))];
    const found = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true },
    });
    if (found.length !== unique.length) {
      throw new BadRequestException('参与人中有不存在的成员，请刷新页面后重试');
    }
    return unique;
  }

  private async getOrThrow(id: string): Promise<TaskWithRelations> {
    const task = await this.prisma.task.findFirst({
      where: { id, deletedAt: null },
      include: TASK_INCLUDE,
    });
    if (!task) throw new NotFoundException('任务不存在或已被删除');
    return task;
  }

  private assertCanModify(task: TaskWithRelations, actor: AuthUser) {
    if (!canModifyTask(toOwnership(task), actor)) {
      throw new ForbiddenException('只能修改自己创建、自己负责或自己参与的任务');
    }
  }

  private assertCanDelete(task: TaskWithRelations, actor: AuthUser) {
    if (!canDeleteTask(toOwnership(task), actor)) {
      throw new ForbiddenException('只有任务创建者或管理员可以删除任务');
    }
  }

  private emit(actor: AuthUser, event: string, task: TaskWithRelations) {
    return this.realtime.emitToProject(task.projectId, event, {
      projectId: task.projectId,
      task: toTaskView(task),
      by: actor.displayName,
    });
  }
}

function toOwnership(task: TaskWithRelations) {
  return {
    createdById: task.createdById,
    assigneeId: task.assigneeId,
    participantIds: task.participants.map((item) => item.id),
  };
}

export function snapshot(task: {
  status: TaskStatus;
  progress: number;
  assigneeId: string | null;
  participants: { id: string; displayName: string }[];
  priority: TaskSnapshot['priority'];
  plannedStartDate: Date | null;
  plannedEndDate: Date | null;
  actualStartDate: Date | null;
  actualEndDate: Date | null;
}): TaskSnapshot {
  return {
    status: task.status,
    progress: task.progress,
    assigneeId: task.assigneeId,
    participants: task.participants.map((item) => ({ id: item.id, displayName: item.displayName })),
    priority: task.priority,
    plannedStartDate: task.plannedStartDate,
    plannedEndDate: task.plannedEndDate,
    actualStartDate: task.actualStartDate,
    actualEndDate: task.actualEndDate,
  };
}

/** 逾期判断：有计划结束日期、已过期、且未完成 */
export function isOverdue(
  plannedEndDate: Date | null,
  status: TaskStatus,
  today = new Date(),
): boolean {
  if (!plannedEndDate || status === TaskStatus.DONE) return false;
  const planned = formatDateOnly(plannedEndDate);
  const now = formatDateOnly(today);
  return !!planned && !!now && planned < now;
}

export function toTaskView(task: TaskWithRelations): TaskView {
  return {
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    description: task.description,
    assignee: task.assignee ? { id: task.assignee.id, displayName: task.assignee.displayName } : null,
    participants: task.participants.map((item) => ({ id: item.id, displayName: item.displayName })),
    priority: task.priority,
    status: task.status,
    progress: task.progress,
    plannedStartDate: formatDateOnly(task.plannedStartDate),
    plannedEndDate: formatDateOnly(task.plannedEndDate),
    actualStartDate: formatDateOnly(task.actualStartDate),
    actualEndDate: formatDateOnly(task.actualEndDate),
    overdue: isOverdue(task.plannedEndDate, task.status),
    sortIndex: task.sortIndex,
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    createdBy: task.createdBy
      ? { id: task.createdBy.id, displayName: task.createdBy.displayName }
      : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}
