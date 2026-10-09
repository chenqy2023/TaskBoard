import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/** 把 Prisma 的约束错误翻译成可读的中文提示，避免前端收到 500 裸错误。 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '数据库操作失败';

    switch (exception.code) {
      case 'P2002': {
        status = HttpStatus.CONFLICT;
        const target = (exception.meta?.target as string[] | string | undefined) ?? '';
        const field = Array.isArray(target) ? target.join(', ') : String(target);
        message = field ? `${field} 已存在，请换一个` : '数据已存在，违反唯一约束';
        break;
      }
      case 'P2003':
        status = HttpStatus.BAD_REQUEST;
        message = '关联数据不存在或仍被引用';
        break;
      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        message = '目标记录不存在（可能已被他人删除）';
        break;
      default:
        this.logger.error(`未处理的 Prisma 错误 ${exception.code}: ${exception.message}`);
    }

    response.status(status).json({ statusCode: status, message, code: exception.code });
  }
}
