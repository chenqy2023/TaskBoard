import { i18n, tGlobal } from '@/i18n';

/**
 * 演示种子文案（中/英任一存库）→ i18n key。
 * 切换界面语言时，已知演示字符串按当前 locale 重渲染，无需改库。
 */
const DEMO_TEXT_KEYS: Record<string, string> = {
  '产品发布 Demo': 'demo.project.name',
  'Product Launch Demo': 'demo.project.name',
  '开源 README 与本地演示用示例项目。可删可改，不影响真实业务。': 'demo.project.description',
  'Sample project for the open-source README and local demos. Safe to edit or delete.':
    'demo.project.description',

  '整理需求范围与验收标准': 'demo.tasks.scope.title',
  'Define scope and acceptance criteria': 'demo.tasks.scope.title',
  '对齐本期必做 / 可延后项，形成一页验收清单。': 'demo.tasks.scope.description',
  'Align must-haves vs. deferrals into a one-page acceptance checklist.':
    'demo.tasks.scope.description',
  '范围已确认，附件以会议纪要为准。': 'demo.tasks.scope.comment',
  'Scope confirmed; see the meeting notes for attachments.': 'demo.tasks.scope.comment',

  '登录与权限冒烟用例': 'demo.tasks.auth.title',
  'Login & permission smoke cases': 'demo.tasks.auth.title',
  '覆盖管理员 / 成员角色差异与停用账号场景。': 'demo.tasks.auth.description',
  'Cover admin vs member differences and deactivated accounts.': 'demo.tasks.auth.description',

  '看板拖拽与进度联动回归': 'demo.tasks.board.title',
  'Board drag & progress regression': 'demo.tasks.board.title',
  '拖到已完成须置 100%；拖出已完成进度不清零。': 'demo.tasks.board.description',
  'Moving to Done must set 100%; leaving Done must not clear progress.':
    'demo.tasks.board.description',
  '进行中 → 已完成 已验过，阻塞列还差一轮。': 'demo.tasks.board.comment',
  'In progress → Done verified; blocked column still needs one pass.': 'demo.tasks.board.comment',

  '统计页图表数据核对': 'demo.tasks.stats.title',
  'Stats chart data cross-check': 'demo.tasks.stats.title',
  '状态 / 优先级 / 负责人三张图与任务列表交叉核对。': 'demo.tasks.stats.description',
  'Cross-check status / priority / assignee charts against the task list.':
    'demo.tasks.stats.description',

  '实时同步双人联调': 'demo.tasks.realtime.title',
  'Realtime sync two-browser check': 'demo.tasks.realtime.title',
  '两个浏览器账号同时看同一看板，验证推送与重连。': 'demo.tasks.realtime.description',
  'Two browser sessions on the same board; verify push and reconnect.':
    'demo.tasks.realtime.description',

  '等待测试环境域名证书': 'demo.tasks.cert.title',
  'Waiting on staging TLS certificate': 'demo.tasks.cert.title',
  '环境组尚未签发证书，HTTPS 冒烟暂挂起。': 'demo.tasks.cert.description',
  'Ops has not issued the cert yet; HTTPS smoke is on hold.': 'demo.tasks.cert.description',
  '已催促，预计本周内恢复。': 'demo.tasks.cert.comment',
  'Followed up; expect recovery this week.': 'demo.tasks.cert.comment',

  '编写发布说明草稿': 'demo.tasks.release.title',
  'Draft release notes': 'demo.tasks.release.title',
  '用户可见变更、已知问题、回滚步骤。': 'demo.tasks.release.description',
  'User-facing changes, known issues, and rollback steps.': 'demo.tasks.release.description',
};

/** 展示层：命中演示文案则按当前语言翻译，否则原样返回 */
export function localizeDemoText(raw: string | null | undefined): string {
  void i18n.global.locale.value;
  if (raw == null || raw === '') return raw ?? '';
  const key = DEMO_TEXT_KEYS[raw];
  return key ? tGlobal(key) : raw;
}
