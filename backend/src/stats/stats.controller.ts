import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StatsService } from './stats.service';

@ApiTags('统计')
@ApiBearerAuth()
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('projects/:projectId')
  @ApiOperation({ summary: '项目统计：按状态/优先级/负责人/模块聚合' })
  byProject(@Param('projectId') projectId: string) {
    return this.statsService.byProject(projectId);
  }
}
