/**
 * 日期型字段（提测日期、计划发布、截止日期）在库里以 UTC 零点存储，
 * 读写一律用 YYYY-MM-DD，避免时区换算导致前后端差一天。
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function toDateOnly(input: string | Date | null | undefined): Date | null {
  if (input === null || input === undefined || input === '') return null;
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null;
    return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
  }
  const raw = input.trim();
  const match = DATE_ONLY.test(raw) ? raw : raw.slice(0, 10);
  if (!DATE_ONLY.test(match)) return null;
  const parsed = new Date(`${match}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateOnly(value: Date | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function formatDateTime(value: Date | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
