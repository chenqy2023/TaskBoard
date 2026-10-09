import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectStatus } from '@prisma/client';

export class CreateProjectDto {
  @ApiProperty({ example: 'R25C14', description: '项目名称，唯一' })
  @IsString()
  @IsNotEmpty({ message: '请输入项目名称' })
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: ProjectStatus, default: ProjectStatus.ACTIVE })
  @IsOptional()
  @IsEnum(ProjectStatus, { message: '项目状态不合法' })
  status?: ProjectStatus;

  @ApiPropertyOptional({ example: '2026-10-01', description: '提测开始日期' })
  @IsOptional()
  @IsDateString({}, { message: '开始日期格式应为 YYYY-MM-DD' })
  startDate?: string | null;

  @ApiPropertyOptional({ example: '2026-10-30', description: '结束日期' })
  @IsOptional()
  @IsDateString({}, { message: '结束日期格式应为 YYYY-MM-DD' })
  endDate?: string | null;
}

export class UpdateProjectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ enum: ProjectStatus })
  @IsOptional()
  @IsEnum(ProjectStatus, { message: '项目状态不合法' })
  status?: ProjectStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: '开始日期格式应为 YYYY-MM-DD' })
  startDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: '结束日期格式应为 YYYY-MM-DD' })
  endDate?: string | null;
}

export class QueryProjectDto {
  @ApiPropertyOptional({ enum: ProjectStatus })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional({ description: '项目名称关键字' })
  @IsOptional()
  @IsString()
  keyword?: string;
}
