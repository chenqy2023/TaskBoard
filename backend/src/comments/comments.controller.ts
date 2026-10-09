import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/comment.dto';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';

@ApiTags('评论与日志')
@ApiBearerAuth()
@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get('tasks/:taskId/comments')
  @ApiOperation({ summary: '任务评论列表' })
  list(@Param('taskId') taskId: string) {
    return this.commentsService.listByTask(taskId);
  }

  @Post('tasks/:taskId/comments')
  @ApiOperation({ summary: '发表评论' })
  create(
    @Param('taskId') taskId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.commentsService.create(taskId, dto.body, actor);
  }

  @Delete('comments/:id')
  @ApiOperation({ summary: '删除评论（本人或管理员）' })
  remove(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.commentsService.remove(id, actor);
  }
}
