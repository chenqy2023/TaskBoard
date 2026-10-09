import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ActivitiesService } from './activities.service';

@ApiTags('评论与日志')
@ApiBearerAuth()
@Controller('tasks/:taskId/activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  @ApiOperation({ summary: '任务操作日志（时间线，倒序）' })
  list(@Param('taskId') taskId: string) {
    return this.activitiesService.listByTask(taskId);
  }
}
