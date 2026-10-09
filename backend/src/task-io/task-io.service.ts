import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityAction, TaskStatus } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { ActivitiesService } from '../activities/activities.service';
import { RealtimeService } from '../realtime/realtime.service';
import {
  PRIORITY_LABELS,
  TASK_EXCEL_COLUMNS,
  TASK_STATUS_LABELS,
} from '../common/constants';
import { formatDateOnly, toDateOnly } from '../common/date.util';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  excelSerialToDate,
  parseImportRow,
  type ImportContext,
  type ParsedImportRow,
  type RawImportRow,
} from './import.rules';
import type { ImportRowDto } from './dto/task-io.dto';

/** 表头别名，容忍同事自己写模板时的叫法差异 */
const HEADER_ALIASES: Record<string, keyof RawImportRow> = {
  标题: 'title',
  任务标题: 'title',
  任务: 'title',
  名称: 'title',
  模块: 'module',
  所属模块: 'module',
  负责人: 'assignee',
  指派给: 'assignee',
  执行人: 'assignee',
  优先级: 'priority',
  状态: 'status',
  任务状态: 'status',
  进度: 'progress',
  完成度: 'progress',
  截止日期: 'dueDate',
  计划完成日期: 'dueDate',
  描述: 'description',
  备注: 'description',
  说明: 'description',
};

@Injectable()
export class TaskIoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activities: ActivitiesService,
    private readonly realtime: RealtimeService,
  ) {}

  async buildExport(versionId: string) {
    const version = await this.prisma.version.findUnique({
      where: { id: versionId },
      select: { id: true, name: true },
    });
    if (!version) throw new NotFoundException('版本不存在');

    const tasks = await this.prisma.task.findMany({
      where: { versionId, deletedAt: null },
      include: { assignee: { select: { displayName: true } } },
      orderBy: [{ status: 'asc' }, { sortIndex: 'asc' }],
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = '测试任务看板';
    const sheet = workbook.addWorksheet('任务清单');

    sheet.columns = [
      { header: TASK_EXCEL_COLUMNS[0], key: 'title', width: 42 },
      { header: TASK_EXCEL_COLUMNS[1], key: 'module', width: 16 },
      { header: TASK_EXCEL_COLUMNS[2], key: 'assignee', width: 12 },
      { header: TASK_EXCEL_COLUMNS[3], key: 'priority', width: 12 },
      { header: TASK_EXCEL_COLUMNS[4], key: 'status', width: 12 },
      { header: TASK_EXCEL_COLUMNS[5], key: 'progress', width: 10 },
      { header: TASK_EXCEL_COLUMNS[6], key: 'dueDate', width: 14 },
      { header: TASK_EXCEL_COLUMNS[7], key: 'description', width: 50 },
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F4FF' },
    };

    for (const task of tasks) {
      sheet.addRow({
        title: task.title,
        module: task.module,
        assignee: task.assignee?.displayName ?? '',
        priority: PRIORITY_LABELS[task.priority],
        status: TASK_STATUS_LABELS[task.status],
        progress: task.progress,
        dueDate: formatDateOnly(task.dueDate) ?? '',
        description: task.description ?? '',
      });
    }

    const guide = workbook.addWorksheet('填写说明');
    guide.columns = [
      { header: '字段', key: 'field', width: 14 },
      { header: '是否必填', key: 'required', width: 10 },
      { header: '可填值 / 说明', key: 'note', width: 70 },
    ];
    guide.getRow(1).font = { bold: true };
    [
      ['标题', '是', '任务名称，最长 200 字'],
      ['模块', '否', '自由文本，例如「登录鉴权」；同名会自动归到一组'],
      ['负责人', '否', `填登录账号或姓名，如 admin / 张三；不存在时该行会提示警告并留空`],
      ['优先级', '否', `${Object.values(PRIORITY_LABELS).join(' / ')}，也可只写 P0~P3；默认 P2 中`],
      ['状态', '否', `${Object.values(TASK_STATUS_LABELS).join(' / ')}，也可只写 TODO/IN_PROGRESS/BLOCKED/DONE；默认未开始`],
      ['进度', '否', '0-100 的数字；状态为已完成时会强制为 100'],
      ['截止日期', '否', 'YYYY-MM-DD，也支持 2026/10/20、2026年10月20日'],
      ['描述', '否', '补充说明'],
    ].forEach((row) => guide.addRow({ field: row[0], required: row[1], note: row[2] }));

    const buffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(buffer),
      filename: `${version.name}-任务清单.xlsx`,
    };
  }

  /** 解析上传的 xlsx 并逐行校验，不落库 */
  async previewImport(versionId: string, fileBuffer: Buffer) {
    await this.assertVersionExists(versionId);

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(fileBuffer as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException('无法解析该文件，请上传 .xlsx 格式（不支持老版 .xls）');
    }

    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('Excel 中没有任何工作表');

    const headerMap = this.readHeader(sheet.getRow(1));
    if (!headerMap.has('title')) {
      throw new BadRequestException('未找到「标题」列，请使用导出的模板或保证首行含「标题」表头');
    }

    const rawRows = this.readRows(sheet, headerMap);
    if (rawRows.length === 0) throw new BadRequestException('Excel 中没有可导入的数据行');
    if (rawRows.length > 2000) throw new BadRequestException('单次最多导入 2000 行，请分批处理');

    const ctx = await this.buildContext();
    const parsed = rawRows.map((raw) => ({ raw, parsed: parseImportRow(raw, ctx) }));

    return {
      total: parsed.length,
      validCount: parsed.filter((item) => item.parsed.errors.length === 0).length,
      errorCount: parsed.filter((item) => item.parsed.errors.length > 0).length,
      warningCount: parsed.filter((item) => item.parsed.warnings.length > 0).length,
      rows: parsed,
    };
  }

  /** 确认导入：服务端重新跑一遍校验，不信任前端回传的结果 */
  async confirmImport(versionId: string, rows: ImportRowDto[], actor: AuthUser) {
    await this.assertVersionExists(versionId);
    const ctx = await this.buildContext();

    const prepared = rows
      .map((row) => parseImportRow(toRawRow(row), ctx))
      .filter((row) => row.errors.length === 0);

    if (prepared.length === 0) throw new BadRequestException('没有通过校验的行，未导入任何数据');

    const assigneeIds = [...new Set(prepared.map((r) => r.assigneeId).filter((id): id is string => !!id))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: assigneeIds } },
      select: { id: true },
    });
    const validUserIds = new Set(users.map((u) => u.id));

    const created = await this.prisma.$transaction(async (tx) => {
      let counter = 0;
      const ids: string[] = [];

      for (const row of prepared) {
        const task = await tx.task.create({
          data: {
            versionId,
            title: row.title.slice(0, 200),
            description: row.description,
            module: row.module,
            assigneeId: row.assigneeId && validUserIds.has(row.assigneeId) ? row.assigneeId : null,
            priority: row.priority,
            status: row.status,
            progress: row.progress,
            dueDate: row.dueDate ? toDateOnly(row.dueDate) : null,
            completedAt: row.status === TaskStatus.DONE ? new Date() : null,
            sortIndex: counter,
            createdById: actor.id,
          },
          select: { id: true, title: true },
        });
        counter += 1;
        ids.push(task.id);

        await this.activities.record(
          {
            taskId: task.id,
            actorId: actor.id,
            action: ActivityAction.TASK_CREATED,
            field: 'title',
            toValue: task.title,
          },
          tx,
        );
      }
      return ids;
    });

    await this.realtime.emitToVersion(versionId, 'task.batch-updated', {
      versionId,
      ids: created,
      by: actor.displayName,
    });

    return { success: true, createdCount: created.length, ids: created };
  }

  private readHeader(row: ExcelJS.Row): Map<keyof RawImportRow, number> {
    const map = new Map<keyof RawImportRow, number>();
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const text = String(cell.value ?? '').trim().replace(/\s/g, '');
      if (!text) return;
      const field = HEADER_ALIASES[text];
      if (field && field !== 'rowNo' && !map.has(field)) map.set(field, colNumber);
    });
    return map;
  }

  private readRows(sheet: ExcelJS.Worksheet, headerMap: Map<keyof RawImportRow, number>): RawImportRow[] {
    const rows: RawImportRow[] = [];
    const get = (row: ExcelJS.Row, field: string): string => {
      const col = headerMap.get(field as keyof RawImportRow);
      if (!col) return '';
      return cellToString(row.getCell(col));
    };

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const raw: RawImportRow = {
        rowNo: rowNumber,
        title: get(row, 'title'),
        module: get(row, 'module'),
        assignee: get(row, 'assignee'),
        priority: get(row, 'priority'),
        status: get(row, 'status'),
        progress: get(row, 'progress'),
        dueDate: get(row, 'dueDate'),
        description: get(row, 'description'),
      };
      // 整行空白直接跳过，避免 Excel 尾部的空行被当成错误行
      if (!raw.title && !raw.module && !raw.assignee && !raw.description) return;
      rows.push(raw);
    });

    return rows;
  }

  private async buildContext(): Promise<ImportContext> {
    const users = await this.prisma.user.findMany({
      where: { active: true },
      select: { id: true, username: true, displayName: true },
    });
    return { users };
  }

  private async assertVersionExists(versionId: string) {
    const version = await this.prisma.version.findUnique({
      where: { id: versionId },
      select: { id: true },
    });
    if (!version) throw new NotFoundException('版本不存在');
  }
}

function cellToString(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return formatDateOnly(value) ?? '';
  if (typeof value === 'number') {
    // 日期列在 Excel 里是数字 + 日期格式，需要按序列号还原
    if (cell.numFmt && /[ymd]/i.test(cell.numFmt)) return excelSerialToDate(value) ?? String(value);
    return String(value);
  }
  if (typeof value === 'object') {
    const obj = value as unknown as Record<string, unknown>;
    if (typeof obj.text === 'string') return obj.text;
    if (obj.result !== undefined) return String(obj.result ?? '');
    if (Array.isArray(obj.richText)) {
      return (obj.richText as { text: string }[]).map((part) => part.text).join('');
    }
    return '';
  }
  return String(value);
}

export function toRawRow(row: ImportRowDto): RawImportRow {
  return {
    rowNo: row.rowNo,
    title: row.title ?? '',
    module: row.module ?? '',
    assignee: row.assignee ?? '',
    priority: row.priority ?? '',
    status: row.status ?? '',
    progress: row.progress ?? '',
    dueDate: row.dueDate ?? '',
    description: row.description ?? '',
  };
}

export type { ParsedImportRow };
