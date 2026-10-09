import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin' })
  @IsString()
  @IsNotEmpty({ message: '请输入账号' })
  @MaxLength(50)
  username!: string;

  @ApiProperty({ example: 'Admin@123456' })
  @IsString()
  @IsNotEmpty({ message: '请输入密码' })
  @MaxLength(100)
  password!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: '请输入原密码' })
  oldPassword!: string;

  @ApiProperty()
  @IsString()
  @MinLength(6, { message: '新密码至少 6 位' })
  @MaxLength(100)
  newPassword!: string;
}
