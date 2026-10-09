import { Priority, TaskStatus } from '@prisma/client';
import { parsePriority, parseTaskStatus } from '../common/constants';
import { formatDateOnly, toDateOnly } from '../common/date.util';
import { clampProgress } from '../versions/version-summary';

export interface RawImportRow {
  rowNo: number;
  title: string;
  module: string;
  assignee: string;
  priority: string;
  status: string;
  progress: string;
  dueDate: string;
  description: string;
}

export interface UserLookup {
  id: string;
  username: string;
  displayName: string;
}

export interface ParsedImportRow {
  rowNo: number;
  title: string;
  module: string;
  assigneeName: string | null;
  assigneeId: string | null;
  priority: Priority;
  status: TaskStatus;
  progress: number;
  dueDate: string | null;
  description: string | null;
  errors: string[];
  warnings: string[];
}

export interface ImportContext {
  users: UserLookup[];
}

/**
 * 解析并校验一行导入数据。纯函数，便于单测覆盖各种脏数据。
 * 规则：标题缺失算错误（该行不导入）；优先级/状态/负责人识别不了只算警告（用默认值兜底）。
 */
export function parseImportRow(raw: RawImportRow, ctx: ImportContext): ParsedImportRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  const title = (raw.title ?? '').trim();
  if (!title) errors.push('标题不能为空');
  if (title.length > 200) errors.push('标题超过 200 字');

  const priority = parsePriority(raw.priority);
  if (raw.priority?.trim() && !priority) {
    warnings.push(`优先级「${raw.priority}」无法识别，已按 P2 处理`);
  }

  const status = parseTaskStatus(raw.status);
  if (raw.status?.trim() && !status) {
    warnings.push(`状态「${raw.status}」无法识别，已按未开始处理`);
  }

  const progressRaw = (raw.progress ?? '').toString().trim().replace('%', '');
  let progress = 0;
  if (progressRaw) {
    const parsed = Number(progressRaw);
    if (!Number.isFinite(parsed)) {
      warnings.push(`进度「${raw.progress}」不是数字，已按 0 处理`);
    } else {
      progress = clampProgress(parsed);
      if (parsed < 0 || parsed > 100) warnings.push('进度超出 0-100，已截断');
    }
  }

  const finalStatus = status ?? TaskStatus.TODO;
  if (finalStatus === TaskStatus.DONE && progress !== 100) {
    warnings.push('状态为已完成，进度已自动置为 100%');
  }
  const finalProgress = finalStatus === TaskStatus.DONE ? 100 : progress;

  let dueDate: string | null = null;
  const dueRaw = (raw.dueDate ?? '').toString().trim();
  if (dueRaw) {
    dueDate = normalizeDueDate(dueRaw);
    if (!dueDate) warnings.push(`截止日期「${raw.dueDate}」无法识别，已留空`);
  }

  const assigneeName = (raw.assignee ?? '').trim();
  let assigneeId: string | null = null;
  if (assigneeName) {
    const matched = ctx.users.find(
      (user) =>
        user.username.toLowerCase() === assigneeName.toLowerCase() ||
        user.displayName === assigneeName,
    );
    if (matched) {
      assigneeId = matched.id;
    } else {
      warnings.push(`负责人「${assigneeName}」在系统中不存在，已留空`);
    }
  }

  return {
    rowNo: raw.rowNo,
    title,
    module: (raw.module ?? '').trim(),
    assigneeName: assigneeName || null,
    assigneeId,
    priority: priority ?? Priority.P2,
    status: finalStatus,
    progress: finalProgress,
    dueDate,
    description: (raw.description ?? '').trim() || null,
    errors,
    warnings,
  };
}

export function normalizeDueDate(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  // 2026/10/20、2026.10.20、2026-10-20 统一成 2026-10-20
  const normalized = raw.replace(/[/.]/g, '-');
  const direct = toDateOnly(normalized);
  if (direct) return formatDateOnly(direct);

  // 2026-1-5 这类没补零的写法
  const loose = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (loose) {
    const pad = (value: string) => value.padStart(2, '0');
    return `${loose[1]}-${pad(loose[2])}-${pad(loose[3])}`;
  }

  // 2026年10月20日
  const cn = raw.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日?$/);
  if (cn) {
    const pad = (value: string) => value.padStart(2, '0');
    return `${cn[1]}-${pad(cn[2])}-${pad(cn[3])}`;
  }
  return null;
}

export function isValidRow(row: ParsedImportRow): boolean {
  return row.errors.length === 0;
}

/** Excel 单元格日期序列号（1900 起算）转 YYYY-MM-DD */
export function excelSerialToDate(serial: number): string | null {
  if (!Number.isFinite(serial) || serial <= 0) return null;
  const utcDays = Math.floor(serial - 25569); // 1970-01-01 的 Excel 序列号
  const date = new Date(utcDays * 86400 * 1000);
  return Number.isNaN(date.getTime()) ? null : formatDateOnly(date);
}
