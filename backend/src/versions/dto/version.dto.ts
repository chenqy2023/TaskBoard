import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VersionStatus } from '@prisma/client';

export class CreateVersionDto {
  @ApiProperty({ example: 'R25C14', description: '版本号，唯一' })
  @IsString()
  @IsNotEmpty({ message: '请输入版本号' })
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: VersionStatus, default: VersionStatus.TESTING })
  @IsOptional()
  @IsEnum(VersionStatus, { message: '版本状态不合法' })
  status?: VersionStatus;

  @ApiPropertyOptional({ example: '2026-10-01', description: '提测开始日期' })
  @IsOptional()
  @IsDateString({}, { message: '提测日期格式应为 YYYY-MM-DD' })
  testStartDate?: string | null;

  @ApiPropertyOptional({ example: '2026-10-30', description: '计划发布日期' })
  @IsOptional()
  @IsDateString({}, { message: '计划发布日期格式应为 YYYY-MM-DD' })
  plannedReleaseDate?: string | null;
}

export class UpdateVersionDto {
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

  @ApiPropertyOptional({ enum: VersionStatus })
  @IsOptional()
  @IsEnum(VersionStatus, { message: '版本状态不合法' })
  status?: VersionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: '提测日期格式应为 YYYY-MM-DD' })
  testStartDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: '计划发布日期格式应为 YYYY-MM-DD' })
  plannedReleaseDate?: string | null;
}

export class QueryVersionDto {
  @ApiPropertyOptional({ enum: VersionStatus })
  @IsOptional()
  @IsEnum(VersionStatus)
  status?: VersionStatus;

  @ApiPropertyOptional({ description: '版本号关键字' })
  @IsOptional()
  @IsString()
  keyword?: string;
}
