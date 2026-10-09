import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { VersionsService } from './versions.service';
import { CreateVersionDto, QueryVersionDto, UpdateVersionDto } from './dto/version.dto';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('版本管理')
@ApiBearerAuth()
@Controller('versions')
export class VersionsController {
  constructor(private readonly versionsService: VersionsService) {}

  @Get()
  @ApiOperation({ summary: '版本列表（含进度汇总）' })
  findAll(@Query() query: QueryVersionDto) {
    return this.versionsService.findAll(query);
  }

  @Post()
  @ApiOperation({ summary: '新建版本' })
  create(@Body() dto: CreateVersionDto, @CurrentUser() actor: AuthUser) {
    return this.versionsService.create(dto, actor);
  }

  @Get(':id')
  @ApiOperation({ summary: '版本详情（含进度汇总）' })
  findOne(@Param('id') id: string) {
    return this.versionsService.findOne(id);
  }

  @Get(':id/summary')
  @ApiOperation({ summary: '版本进度汇总（平均进度 + 完成率 + 各状态计数）' })
  getSummary(@Param('id') id: string) {
    return this.versionsService.getSummary(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '编辑版本' })
  update(@Param('id') id: string, @Body() dto: UpdateVersionDto) {
    return this.versionsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '删除版本（仅管理员；有任务时需 force=true）' })
  @ApiQuery({ name: 'force', required: false, type: Boolean })
  remove(@Param('id') id: string, @Query('force') force?: boolean) {
    return this.versionsService.remove(id, force === true);
  }
}
