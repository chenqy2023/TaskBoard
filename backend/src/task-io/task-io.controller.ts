import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { TaskIoService } from './task-io.service';
import { ImportConfirmDto } from './dto/task-io.dto';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

@ApiTags('导入导出')
@ApiBearerAuth()
@Controller('versions/:versionId')
export class TaskIoController {
  constructor(private readonly taskIoService: TaskIoService) {}

  @Get('export')
  @ApiOperation({ summary: '导出该版本任务为 xlsx' })
  async export(@Param('versionId') versionId: string, @Res() res: Response) {
    const { buffer, filename } = await this.taskIoService.buildExport(versionId);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    res.end(buffer);
  }

  @Post('import/preview')
  @ApiOperation({ summary: '上传 xlsx 并预览校验结果（不落库）' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  preview(@Param('versionId') versionId: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('请选择要上传的 .xlsx 文件');
    return this.taskIoService.previewImport(versionId, file.buffer);
  }

  @Post('import/confirm')
  @ApiOperation({ summary: '确认导入预览通过的行' })
  confirm(
    @Param('versionId') versionId: string,
    @Body() dto: ImportConfirmDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.taskIoService.confirmImport(versionId, dto.rows, actor);
  }
}
