import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityAction, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivitiesService } from '../activities/activities.service';
import { RealtimeService } from '../realtime/realtime.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activities: ActivitiesService,
    private readonly realtime: RealtimeService,
  ) {}

  async listByTask(taskId: string) {
    await this.assertTaskExists(taskId);
    const comments = await this.prisma.comment.findMany({
      where: { taskId },
      include: { author: { select: { id: true, displayName: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return comments.map(toCommentView);
  }

  async create(taskId: string, body: string, actor: AuthUser) {
    const task = await this.assertTaskExists(taskId);

    const comment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: { taskId, authorId: actor.id, body: body.trim() },
        include: { author: { select: { id: true, displayName: true } } },
      });
      await this.activities.record(
        {
          taskId,
          actorId: actor.id,
          action: ActivityAction.COMMENT_ADDED,
          field: 'body',
          toValue: created.body.slice(0, 200),
        },
        tx,
      );
      return created;
    });

    await this.realtime.emitToProject(task.projectId, 'comment.created', {
      projectId: task.projectId,
      taskId,
      comment: toCommentView(comment),
      by: actor.displayName,
    });
    return toCommentView(comment);
  }

  async remove(id: string, actor: AuthUser) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      include: { task: { select: { projectId: true } } },
    });
    if (!comment) throw new NotFoundException('评论不存在');
    // 只允许本人或管理员删除，避免互相改口供
    if (comment.authorId !== actor.id && actor.role !== Role.ADMIN) {
      throw new ForbiddenException('只能删除自己发表的评论');
    }

    await this.prisma.comment.delete({ where: { id } });
    await this.realtime.emitToProject(comment.task.projectId, 'comment.deleted', {
      projectId: comment.task.projectId,
      taskId: comment.taskId,
      commentId: id,
      by: actor.displayName,
    });
    return { success: true };
  }

  private async assertTaskExists(taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: { id: true, projectId: true },
    });
    if (!task) throw new NotFoundException('任务不存在');
    return task;
  }
}

function toCommentView(comment: {
  id: string;
  taskId: string;
  body: string;
  createdAt: Date;
  updatedAt: Date | null;
  author: { id: string; displayName: string };
}) {
  return {
    id: comment.id,
    taskId: comment.taskId,
    body: comment.body,
    author: comment.author,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt ? comment.updatedAt.toISOString() : null,
  };
}
