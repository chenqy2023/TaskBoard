import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({ example: '接口已联调通过，明天开始回归' })
  @IsString()
  @IsNotEmpty({ message: '评论内容不能为空' })
  @MaxLength(2000)
  body!: string;
}
