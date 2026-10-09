import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import {
  BatchUpdateTaskDto,
  CreateTaskDto,
  MoveTaskDto,
  QueryTaskDto,
  UpdateTaskDto,
} from './dto/task.dto';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';

@ApiTags('任务')
@ApiBearerAuth()
@Controller()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get('versions/:versionId/tasks')
  @ApiOperation({ summary: '任务列表（分页 + 筛选 + 排序）' })
  findAll(@Param('versionId') versionId: string, @Query() query: QueryTaskDto) {
    return this.tasksService.findAll(versionId, query);
  }

  @Get('versions/:versionId/board')
  @ApiOperation({ summary: '看板数据：该版本全部任务（不分页）' })
  findBoard(@Param('versionId') versionId: string, @Query() query: QueryTaskDto) {
    return this.tasksService.findBoard(versionId, query);
  }

  @Get('versions/:versionId/modules')
  @ApiOperation({ summary: '该版本出现过的模块列表（筛选下拉用）' })
  listModules(@Param('versionId') versionId: string) {
    return this.tasksService.listModules(versionId);
  }

  @Get('tasks/my')
  @ApiOperation({ summary: '我的待办（未完成任务）' })
  myTasks(@CurrentUser() actor: AuthUser) {
    return this.tasksService.myTasks(actor);
  }

  @Post('tasks')
  @ApiOperation({ summary: '新建任务' })
  create(@Body() dto: CreateTaskDto, @CurrentUser() actor: AuthUser) {
    return this.tasksService.create(dto, actor);
  }

  @Post('tasks/batch')
  @ApiOperation({ summary: '批量修改负责人/优先级/状态/截止日期' })
  batchUpdate(@Body() dto: BatchUpdateTaskDto, @CurrentUser() actor: AuthUser) {
    return this.tasksService.batchUpdate(dto, actor);
  }

  @Get('tasks/:id')
  @ApiOperation({ summary: '任务详情' })
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  @Patch('tasks/:id')
  @ApiOperation({ summary: '编辑任务' })
  update(@Param('id') id: string, @Body() dto: UpdateTaskDto, @CurrentUser() actor: AuthUser) {
    return this.tasksService.update(id, dto, actor);
  }

  @Patch('tasks/:id/status')
  @ApiOperation({ summary: '看板拖拽：改状态并落到目标列指定位置' })
  move(@Param('id') id: string, @Body() dto: MoveTaskDto, @CurrentUser() actor: AuthUser) {
    return this.tasksService.move(id, dto, actor);
  }

  @Delete('tasks/:id')
  @ApiOperation({ summary: '删除任务（软删除，仅创建者或管理员）' })
  remove(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.tasksService.remove(id, actor);
  }
}
