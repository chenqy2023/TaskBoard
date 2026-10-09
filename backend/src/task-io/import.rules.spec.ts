import { Priority, TaskStatus } from '@prisma/client';
import {
  excelSerialToDate,
  normalizeDueDate,
  parseImportRow,
  type ImportContext,
  type RawImportRow,
} from './import.rules';

const ctx: ImportContext = {
  users: [
    { id: 'u1', username: 'zhangsan', displayName: '张三' },
    { id: 'u2', username: 'lisi', displayName: '李四' },
  ],
};

function row(partial: Partial<RawImportRow>): RawImportRow {
  return {
    rowNo: 2,
    title: '',
    module: '',
    assignee: '',
    priority: '',
    status: '',
    progress: '',
    dueDate: '',
    description: '',
    ...partial,
  };
}

describe('Excel 导入行校验', () => {
  it('标题为空算错误，该行不会导入', () => {
    const parsed = parseImportRow(row({ title: '   ' }), ctx);

    expect(parsed.errors).toContain('标题不能为空');
  });

  it('正常行解析出各字段', () => {
    const parsed = parseImportRow(
      row({
        title: '登录模块功能测试',
        module: '登录鉴权',
        assignee: '张三',
        priority: 'P1 高',
        status: '进行中',
        progress: '60',
        dueDate: '2026/10/20',
      }),
      ctx,
    );

    expect(parsed.errors).toEqual([]);
    expect(parsed.assigneeId).toBe('u1');
    expect(parsed.priority).toBe(Priority.P1);
    expect(parsed.status).toBe(TaskStatus.IN_PROGRESS);
    expect(parsed.progress).toBe(60);
    expect(parsed.dueDate).toBe('2026-10-20');
  });

  it('负责人可用登录账号匹配', () => {
    expect(parseImportRow(row({ title: 't', assignee: 'lisi' }), ctx).assigneeId).toBe('u2');
  });

  it('负责人不存在时只警告并留空，不阻断导入', () => {
    const parsed = parseImportRow(row({ title: 't', assignee: '王五' }), ctx);

    expect(parsed.errors).toEqual([]);
    expect(parsed.assigneeId).toBeNull();
    expect(parsed.warnings.join()).toContain('王五');
  });

  it('优先级/状态无法识别时用默认值兜底并给出警告', () => {
    const parsed = parseImportRow(row({ title: 't', priority: '超高', status: '待办' }), ctx);

    expect(parsed.priority).toBe(Priority.P2);
    expect(parsed.status).toBe(TaskStatus.TODO);
    expect(parsed.warnings).toHaveLength(2);
  });

  it('状态为已完成时进度强制 100 并提示', () => {
    const parsed = parseImportRow(row({ title: 't', status: '已完成', progress: '30' }), ctx);

    expect(parsed.progress).toBe(100);
    expect(parsed.warnings.join()).toContain('100');
  });

  it('进度非数字时按 0 处理并提示', () => {
    const parsed = parseImportRow(row({ title: 't', progress: '一半' }), ctx);

    expect(parsed.progress).toBe(0);
    expect(parsed.warnings.join()).toContain('不是数字');
  });

  it('进度超出范围时截断', () => {
    const parsed = parseImportRow(row({ title: 't', progress: '180' }), ctx);

    expect(parsed.progress).toBe(100);
    expect(parsed.warnings.join()).toContain('截断');
  });

  it('带百分号的进度可以识别', () => {
    expect(parseImportRow(row({ title: 't', progress: '80%' }), ctx).progress).toBe(80);
  });

  it('日期无法识别时留空并提示', () => {
    const parsed = parseImportRow(row({ title: 't', dueDate: '下周三' }), ctx);

    expect(parsed.dueDate).toBeNull();
    expect(parsed.warnings.join()).toContain('无法识别');
  });
});

describe('日期归一化', () => {
  it.each([
    ['2026-10-20', '2026-10-20'],
    ['2026/10/20', '2026-10-20'],
    ['2026.10.20', '2026-10-20'],
    ['2026年10月20日', '2026-10-20'],
    ['2026-1-5', '2026-01-05'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeDueDate(input)).toBe(expected);
  });

  it('无法识别的返回 null', () => {
    expect(normalizeDueDate('不是日期')).toBeNull();
  });

  it('Excel 日期序列号可以还原', () => {
    // 2026-10-20 的 Excel 序列号是 46315（1970-01-01 = 25569）
    expect(excelSerialToDate(46315)).toBe('2026-10-20');
    expect(excelSerialToDate(25569)).toBe('1970-01-01');
  });

  it('非法序列号返回 null', () => {
    expect(excelSerialToDate(0)).toBeNull();
    expect(excelSerialToDate(Number.NaN)).toBeNull();
  });
});
