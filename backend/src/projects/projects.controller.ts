import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, QueryProjectDto, UpdateProjectDto } from './dto/project.dto';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('项目管理')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: '项目列表（含进度汇总）' })
  findAll(@Query() query: QueryProjectDto) {
    return this.projectsService.findAll(query);
  }

  @Post()
  @ApiOperation({ summary: '新建项目' })
  create(@Body() dto: CreateProjectDto, @CurrentUser() actor: AuthUser) {
    return this.projectsService.create(dto, actor);
  }

  @Get(':id')
  @ApiOperation({ summary: '项目详情（含进度汇总）' })
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Get(':id/summary')
  @ApiOperation({ summary: '项目进度汇总（平均进度 + 完成率 + 各状态计数）' })
  getSummary(@Param('id') id: string) {
    return this.projectsService.getSummary(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '编辑项目' })
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '删除项目（仅管理员；有任务时需 force=true）' })
  @ApiQuery({ name: 'force', required: false, type: Boolean })
  remove(@Param('id') id: string, @Query('force') force?: boolean) {
    return this.projectsService.remove(id, force === true);
  }
}
