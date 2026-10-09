import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'zhangsan' })
  @IsString()
  @IsNotEmpty({ message: '请输入登录账号' })
  @MaxLength(50)
  username!: string;

  @ApiProperty({ example: '张三' })
  @IsString()
  @IsNotEmpty({ message: '请输入姓名' })
  @MaxLength(50)
  displayName!: string;

  @ApiProperty({ enum: Role, default: Role.MEMBER })
  @IsEnum(Role, { message: '角色不合法' })
  role!: Role;

  @ApiProperty({ example: 'Init@123456' })
  @IsString()
  @MinLength(6, { message: '密码至少 6 位' })
  @MaxLength(100)
  password!: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: '张三' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  displayName?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role, { message: '角色不合法' })
  role?: Role;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'Init@123456' })
  @IsString()
  @MinLength(6, { message: '密码至少 6 位' })
  @MaxLength(100)
  newPassword!: string;
}
