import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Priority, TaskStatus } from '@prisma/client';

export class CreateTaskDto {
  @ApiProperty({ description: '所属版本 id' })
  @IsString()
  @IsNotEmpty({ message: '缺少所属版本' })
  versionId!: string;

  @ApiProperty({ example: '登录模块功能测试' })
  @IsString()
  @IsNotEmpty({ message: '请输入任务标题' })
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional({ description: '负责人 id，留空表示未分配' })
  @IsOptional()
  @IsString()
  assigneeId?: string | null;

  @ApiPropertyOptional({ type: [String], description: '参与人 id 列表，可多选' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  participantIds?: string[];

  @ApiPropertyOptional({ enum: Priority, default: Priority.P2 })
  @IsOptional()
  @IsEnum(Priority, { message: '优先级不合法' })
  priority?: Priority;

  @ApiPropertyOptional({ enum: TaskStatus, default: TaskStatus.TODO })
  @IsOptional()
  @IsEnum(TaskStatus, { message: '状态不合法' })
  status?: TaskStatus;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, default: 0, description: '0-100 的整数' })
  @IsOptional()
  @IsInt({ message: '进度必须是整数' })
  @Min(0, { message: '进度不能小于 0' })
  @Max(100, { message: '进度不能大于 100' })
  progress?: number;

  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @IsDateString({}, { message: '计划开始日期格式应为 YYYY-MM-DD' })
  plannedStartDate?: string | null;

  @ApiPropertyOptional({ example: '2026-10-20' })
  @IsOptional()
  @IsDateString({}, { message: '计划结束日期格式应为 YYYY-MM-DD' })
  plannedEndDate?: string | null;

  @ApiPropertyOptional({ example: '2026-10-02' })
  @IsOptional()
  @IsDateString({}, { message: '实际开始日期格式应为 YYYY-MM-DD' })
  actualStartDate?: string | null;

  @ApiPropertyOptional({ example: '2026-10-21' })
  @IsOptional()
  @IsDateString({}, { message: '实际结束日期格式应为 YYYY-MM-DD' })
  actualEndDate?: string | null;
}

export class UpdateTaskDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigneeId?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  participantIds?: string[];

  @ApiPropertyOptional({ enum: Priority })
  @IsOptional()
  @IsEnum(Priority, { message: '优先级不合法' })
  priority?: Priority;

  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus, { message: '状态不合法' })
  status?: TaskStatus;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt({ message: '进度必须是整数' })
  @Min(0, { message: '进度不能小于 0' })
  @Max(100, { message: '进度不能大于 100' })
  progress?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: '计划开始日期格式应为 YYYY-MM-DD' })
  plannedStartDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: '计划结束日期格式应为 YYYY-MM-DD' })
  plannedEndDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: '实际开始日期格式应为 YYYY-MM-DD' })
  actualStartDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: '实际结束日期格式应为 YYYY-MM-DD' })
  actualEndDate?: string | null;
}

export class MoveTaskDto {
  @ApiProperty({ enum: TaskStatus })
  @IsEnum(TaskStatus, { message: '状态不合法' })
  status!: TaskStatus;

  @ApiPropertyOptional({ description: '在目标列中的落点下标，不传则放到末尾' })
  @IsOptional()
  @IsInt()
  @Min(0)
  targetIndex?: number;
}

export class QueryTaskDto {
  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ description: '负责人 id；传 unassigned 表示只看未分配' })
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional({ description: '参与人 id' })
  @IsOptional()
  @IsString()
  participantId?: string;

  @ApiPropertyOptional({ enum: Priority })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional({ description: '标题/描述关键字' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;

  @ApiPropertyOptional({
    enum: ['sortIndex', 'createdAt', 'plannedEndDate', 'priority', 'progress', 'title'],
    default: 'sortIndex',
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsString()
  order?: 'asc' | 'desc';
}

export class BatchUpdateTaskDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty({ message: '请选择要操作的任务' })
  @IsString({ each: true })
  ids!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigneeId?: string | null;

  @ApiPropertyOptional({ enum: Priority })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;
}
