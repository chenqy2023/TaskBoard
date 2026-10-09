import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityAction, TaskStatus } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { ActivitiesService } from '../activities/activities.service';
import { RealtimeService } from '../realtime/realtime.service';
import {
  DATE_FIELD_LABELS,
  PRIORITY_LABELS,
  TASK_EXCEL_COLUMNS,
  TASK_STATUS_LABELS,
} from '../common/constants';
import { formatDateOnly, toDateOnly } from '../common/date.util';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  checkDateOrder,
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
  负责人: 'assignee',
  指派给: 'assignee',
  执行人: 'assignee',
  参与人: 'participants',
  协作人: 'participants',
  参与者: 'participants',
  优先级: 'priority',
  状态: 'status',
  任务状态: 'status',
  进度: 'progress',
  完成度: 'progress',
  计划开始日期: 'plannedStartDate',
  计划开始: 'plannedStartDate',
  计划结束日期: 'plannedEndDate',
  计划结束: 'plannedEndDate',
  截止日期: 'plannedEndDate',
  实际开始日期: 'actualStartDate',
  实际开始: 'actualStartDate',
  实际结束日期: 'actualEndDate',
  实际结束: 'actualEndDate',
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

  async buildExport(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    });
    if (!project) throw new NotFoundException('项目不存在');

    const tasks = await this.prisma.task.findMany({
      where: { projectId, deletedAt: null },
      include: {
        assignee: { select: { displayName: true } },
        participants: { select: { displayName: true } },
      },
      orderBy: [{ status: 'asc' }, { sortIndex: 'asc' }],
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = '任务看板';
    const sheet = workbook.addWorksheet('任务清单');

    sheet.columns = [
      { header: TASK_EXCEL_COLUMNS[0], key: 'title', width: 40 },
      { header: TASK_EXCEL_COLUMNS[1], key: 'assignee', width: 12 },
      { header: TASK_EXCEL_COLUMNS[2], key: 'participants', width: 20 },
      { header: TASK_EXCEL_COLUMNS[3], key: 'priority', width: 12 },
      { header: TASK_EXCEL_COLUMNS[4], key: 'status', width: 12 },
      { header: TASK_EXCEL_COLUMNS[5], key: 'progress', width: 10 },
      { header: TASK_EXCEL_COLUMNS[6], key: 'plannedStartDate', width: 16 },
      { header: TASK_EXCEL_COLUMNS[7], key: 'plannedEndDate', width: 16 },
      { header: TASK_EXCEL_COLUMNS[8], key: 'actualStartDate', width: 16 },
      { header: TASK_EXCEL_COLUMNS[9], key: 'actualEndDate', width: 16 },
      { header: TASK_EXCEL_COLUMNS[10], key: 'description', width: 40 },
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
        assignee: task.assignee?.displayName ?? '',
        participants: task.participants.map((item) => item.displayName).join('、'),
        priority: PRIORITY_LABELS[task.priority],
        status: TASK_STATUS_LABELS[task.status],
        progress: task.progress,
        plannedStartDate: formatDateOnly(task.plannedStartDate) ?? '',
        plannedEndDate: formatDateOnly(task.plannedEndDate) ?? '',
        actualStartDate: formatDateOnly(task.actualStartDate) ?? '',
        actualEndDate: formatDateOnly(task.actualEndDate) ?? '',
        description: task.description ?? '',
      });
    }

    const guide = workbook.addWorksheet('填写说明');
    guide.columns = [
      { header: '字段', key: 'field', width: 16 },
      { header: '是否必填', key: 'required', width: 10 },
      { header: '可填值 / 说明', key: 'note', width: 70 },
    ];
    guide.getRow(1).font = { bold: true };
    [
      ['标题', '是', '任务名称，最长 200 字'],
      ['负责人', '否', '填登录账号或姓名，如 admin / 张三；只能填一个人；不存在时会提示警告并留空'],
      ['参与人', '否', '可填多人，用「、」「,」或空格分隔；不存在的名字会被忽略并给出警告'],
      ['优先级', '否', `${Object.values(PRIORITY_LABELS).join(' / ')}（也认 P0~P3 及「P0 紧急」这类旧写法）；默认「中」`],
      ['状态', '否', `${Object.values(TASK_STATUS_LABELS).join(' / ')}，也可只写 TODO/IN_PROGRESS/BLOCKED/DONE；默认未开始`],
      ['进度', '否', '0-100 的整数；状态为已完成时会强制为 100'],
      [DATE_FIELD_LABELS.plannedStartDate, '否', 'YYYY-MM-DD，也支持 2026/10/20、2026年10月20日'],
      [DATE_FIELD_LABELS.plannedEndDate, '否', '逾期判断以这个日期为准，也叫「截止日期」'],
      [DATE_FIELD_LABELS.actualStartDate, '否', 'YYYY-MM-DD'],
      [DATE_FIELD_LABELS.actualEndDate, '否', 'YYYY-MM-DD'],
      ['描述', '否', '补充说明'],
    ].forEach((row) => guide.addRow({ field: row[0], required: row[1], note: row[2] }));

    const buffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(buffer),
      filename: `${project.name}-任务清单.xlsx`,
    };
  }

  /** 解析上传的 xlsx 并逐行校验，不落库 */
  async previewImport(projectId: string, fileBuffer: Buffer) {
    await this.assertProjectExists(projectId);

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
    const parsed = rawRows.map((raw) => {
      const row = parseImportRow(raw, ctx);
      row.warnings.push(...checkDateOrder(row));
      return { raw, parsed: row };
    });

    return {
      total: parsed.length,
      validCount: parsed.filter((item) => item.parsed.errors.length === 0).length,
      errorCount: parsed.filter((item) => item.parsed.errors.length > 0).length,
      warningCount: parsed.filter((item) => item.parsed.warnings.length > 0).length,
      rows: parsed,
    };
  }

  /** 确认导入：服务端重新跑一遍校验，不信任前端回传的结果 */
  async confirmImport(projectId: string, rows: ImportRowDto[], actor: AuthUser) {
    await this.assertProjectExists(projectId);
    const ctx = await this.buildContext();

    const prepared = rows
      .map((row) => parseImportRow(toRawRow(row), ctx))
      .filter((row) => row.errors.length === 0);

    if (prepared.length === 0) throw new BadRequestException('没有通过校验的行，未导入任何数据');

    const validUserIds = new Set(ctx.users.map((user) => user.id));

    const created = await this.prisma.$transaction(async (tx) => {
      let counter = 0;
      const ids: string[] = [];

      for (const row of prepared) {
        const task = await tx.task.create({
          data: {
            projectId,
            title: row.title.slice(0, 200),
            description: row.description,
            assigneeId: row.assigneeId && validUserIds.has(row.assigneeId) ? row.assigneeId : null,
            participants: {
              connect: row.participantIds
                .filter((id) => validUserIds.has(id))
                .map((id) => ({ id })),
            },
            priority: row.priority,
            status: row.status,
            progress: row.progress,
            plannedStartDate: toDateOnly(row.plannedStartDate),
            plannedEndDate: toDateOnly(row.plannedEndDate),
            actualStartDate: toDateOnly(row.actualStartDate),
            actualEndDate: toDateOnly(row.actualEndDate),
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

    await this.realtime.emitToProject(projectId, 'task.batch-updated', {
      projectId,
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

  private readRows(
    sheet: ExcelJS.Worksheet,
    headerMap: Map<keyof RawImportRow, number>,
  ): RawImportRow[] {
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
        assignee: get(row, 'assignee'),
        participants: get(row, 'participants'),
        priority: get(row, 'priority'),
        status: get(row, 'status'),
        progress: get(row, 'progress'),
        plannedStartDate: get(row, 'plannedStartDate'),
        plannedEndDate: get(row, 'plannedEndDate'),
        actualStartDate: get(row, 'actualStartDate'),
        actualEndDate: get(row, 'actualEndDate'),
        description: get(row, 'description'),
      };
      // 整行空白直接跳过，避免 Excel 尾部的空行被当成错误行
      if (!raw.title && !raw.assignee && !raw.participants && !raw.description) return;
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

  private async assertProjectExists(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('项目不存在');
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
    assignee: row.assignee ?? '',
    participants: row.participants ?? '',
    priority: row.priority ?? '',
    status: row.status ?? '',
    progress: row.progress ?? '',
    plannedStartDate: row.plannedStartDate ?? '',
    plannedEndDate: row.plannedEndDate ?? '',
    actualStartDate: row.actualStartDate ?? '',
    actualEndDate: row.actualEndDate ?? '',
    description: row.description ?? '',
  };
}

export type { ParsedImportRow };
