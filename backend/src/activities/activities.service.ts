import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ActivityInput {
  taskId: string;
  actorId: string;
  action: ActivityAction;
  field?: string | null;
  fromValue?: string | null;
  toValue?: string | null;
}

export type PrismaLike = PrismaService | Prisma.TransactionClient;

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  /** 记一条操作日志。传入事务客户端即可与业务写入保持原子。 */
  async record(input: ActivityInput, client: PrismaLike = this.prisma) {
    return client.activityLog.create({
      data: {
        taskId: input.taskId,
        actorId: input.actorId,
        action: input.action,
        field: input.field ?? null,
        fromValue: input.fromValue ?? null,
        toValue: input.toValue ?? null,
      },
    });
  }

  async recordMany(inputs: ActivityInput[], client: PrismaLike = this.prisma) {
    if (inputs.length === 0) return;
    await client.activityLog.createMany({
      data: inputs.map((input) => ({
        taskId: input.taskId,
        actorId: input.actorId,
        action: input.action,
        field: input.field ?? null,
        fromValue: input.fromValue ?? null,
        toValue: input.toValue ?? null,
      })),
    });
  }

  async listByTask(taskId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId }, select: { id: true } });
    if (!task) throw new NotFoundException('任务不存在');

    const logs = await this.prisma.activityLog.findMany({
      where: { taskId },
      include: { actor: { select: { id: true, displayName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      field: log.field,
      fromValue: log.fromValue,
      toValue: log.toValue,
      actor: log.actor,
      createdAt: log.createdAt.toISOString(),
    }));
  }
}
