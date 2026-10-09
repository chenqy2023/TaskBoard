import { Priority, TaskStatus } from '@prisma/client';
import {
  checkDateOrder,
  excelSerialToDate,
  normalizeDueDate,
  parseImportRow,
  splitNames,
  type ImportContext,
  type RawImportRow,
} from './import.rules';

const ctx: ImportContext = {
  users: [
    { id: 'u1', username: 'zhangsan', displayName: '张三' },
    { id: 'u2', username: 'lisi', displayName: '李四' },
    { id: 'u3', username: 'wangwu', displayName: '王五' },
  ],
};

function row(partial: Partial<RawImportRow>): RawImportRow {
  return {
    rowNo: 2,
    title: '',
    assignee: '',
    participants: '',
    priority: '',
    status: '',
    progress: '',
    plannedStartDate: '',
    plannedEndDate: '',
    actualStartDate: '',
    actualEndDate: '',
    description: '',
    ...partial,
  };
}

describe('Excel 导入行校验', () => {
  it('标题为空算错误，该行不会导入', () => {
    expect(parseImportRow(row({ title: '   ' }), ctx).errors).toContain('标题不能为空');
  });

  it('正常行解析出各字段', () => {
    const parsed = parseImportRow(
      row({
        title: '登录模块功能测试',
        assignee: '张三',
        participants: '李四、王五',
        priority: 'P1 高',
        status: '进行中',
        progress: '60',
        plannedStartDate: '2026/10/01',
        plannedEndDate: '2026/10/20',
        actualStartDate: '2026-10-02',
      }),
      ctx,
    );

    expect(parsed.errors).toEqual([]);
    expect(parsed.assigneeId).toBe('u1');
    expect(parsed.participantIds).toEqual(['u2', 'u3']);
    expect(parsed.priority).toBe(Priority.P1);
    expect(parsed.status).toBe(TaskStatus.IN_PROGRESS);
    expect(parsed.progress).toBe(60);
    expect(parsed.plannedStartDate).toBe('2026-10-01');
    expect(parsed.plannedEndDate).toBe('2026-10-20');
    expect(parsed.actualStartDate).toBe('2026-10-02');
    expect(parsed.actualEndDate).toBeNull();
  });

  it('优先级支持新描述（紧急/高/中/低）', () => {
    expect(parseImportRow(row({ title: 't', priority: '紧急' }), ctx).priority).toBe(Priority.P0);
    expect(parseImportRow(row({ title: 't', priority: '低' }), ctx).priority).toBe(Priority.P3);
  });

  it('优先级仍兼容旧的编号写法（老 Excel 导出可原样导回）', () => {
    expect(parseImportRow(row({ title: 't', priority: 'P1 高' }), ctx).priority).toBe(Priority.P1);
    expect(parseImportRow(row({ title: 't', priority: 'p2' }), ctx).priority).toBe(Priority.P2);
    expect(parseImportRow(row({ title: 't', priority: 'P0紧急' }), ctx).priority).toBe(Priority.P0);
  });

  it('形似编号但不合法的不当编号处理', () => {
    // P10 不应被当成 P1
    expect(parseImportRow(row({ title: 't', priority: 'P10' }), ctx).priority).toBe(Priority.P2);
    expect(parseImportRow(row({ title: 't', priority: 'P10' }), ctx).warnings.join()).toContain('无法识别');
  });

  it('负责人可用登录账号匹配', () => {
    expect(parseImportRow(row({ title: 't', assignee: 'lisi' }), ctx).assigneeId).toBe('u2');
  });

  it('负责人不存在时只警告并留空，不阻断导入', () => {
    const parsed = parseImportRow(row({ title: 't', assignee: '赵六' }), ctx);

    expect(parsed.errors).toEqual([]);
    expect(parsed.assigneeId).toBeNull();
    expect(parsed.warnings.join()).toContain('赵六');
  });

  it('参与人不存在时忽略该名字并给出警告', () => {
    const parsed = parseImportRow(row({ title: 't', participants: '李四、赵六' }), ctx);

    expect(parsed.errors).toEqual([]);
    expect(parsed.participantIds).toEqual(['u2']);
    expect(parsed.warnings.join()).toContain('赵六');
  });

  it('重复的参与人只保留一个', () => {
    const parsed = parseImportRow(row({ title: 't', participants: '李四 李四 lisi' }), ctx);

    expect(parsed.participantIds).toEqual(['u2']);
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
    expect(parseImportRow(row({ title: 't', progress: '180' }), ctx).progress).toBe(100);
    expect(parseImportRow(row({ title: 't', progress: '-10' }), ctx).progress).toBe(0);
  });

  it('进度是小数时四舍五入并提示', () => {
    const parsed = parseImportRow(row({ title: 't', progress: '66.4' }), ctx);

    expect(parsed.progress).toBe(66);
    expect(parsed.warnings.join()).toContain('整数');
  });

  it('带百分号的进度可以识别', () => {
    expect(parseImportRow(row({ title: 't', progress: '80%' }), ctx).progress).toBe(80);
  });

  it('日期无法识别时留空并提示', () => {
    const parsed = parseImportRow(row({ title: 't', plannedEndDate: '下周三' }), ctx);

    expect(parsed.plannedEndDate).toBeNull();
    expect(parsed.warnings.join()).toContain('计划结束日期');
  });

  it('计划开始晚于计划结束时给出提示', () => {
    const parsed = parseImportRow(
      row({ title: 't', plannedStartDate: '2026-10-20', plannedEndDate: '2026-10-01' }),
      ctx,
    );

    expect(checkDateOrder(parsed)).toContain('计划开始日期晚于计划结束日期');
  });

  it('日期顺序正常时不给提示', () => {
    const parsed = parseImportRow(
      row({ title: 't', plannedStartDate: '2026-10-01', plannedEndDate: '2026-10-20' }),
      ctx,
    );

    expect(checkDateOrder(parsed)).toEqual([]);
  });
});

describe('参与人拆分', () => {
  it.each([
    ['李四、王五', ['李四', '王五']],
    ['李四,王五', ['李四', '王五']],
    ['李四，王五', ['李四', '王五']],
    ['李四;王五', ['李四', '王五']],
    ['李四/王五', ['李四', '王五']],
    ['李四 王五', ['李四', '王五']],
    ['  李四  、  王五  ', ['李四', '王五']],
    ['', []],
  ])('%s -> %j', (input, expected) => {
    expect(splitNames(input)).toEqual(expected);
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
