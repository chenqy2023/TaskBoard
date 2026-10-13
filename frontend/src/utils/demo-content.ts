import { i18n, tGlobal } from '@/i18n';

/**
 * 演示种子文案（中/英任一存库）→ i18n key。
 * 切换界面语言时，已知演示字符串按当前 locale 重渲染，无需改库。
 */
const DEMO_TEXT_KEYS: Record<string, string> = {
  // —— Product Launch Demo ——
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

  // —— Website Redesign ——
  官网改版: 'demo.website.project.name',
  'Website Redesign': 'demo.website.project.name',
  '营销站焕新：品牌、信息架构与上线内容。偏设计向的演示项目。': 'demo.website.project.description',
  'Marketing site refresh: brand, IA, and launch content. Design-heavy demo with creative tasks.':
    'demo.website.project.description',

  '品牌情绪板与色彩 Token': 'demo.website.tasks.moodboard.title',
  'Brand moodboard & color tokens': 'demo.website.tasks.moodboard.title',
  '敲定主色 / 强调色 / 中性色与字体搭配。': 'demo.website.tasks.moodboard.description',
  'Lock primary / accent / neutral tokens and type pairing for the new site.':
    'demo.website.tasks.moodboard.description',
  'Token 已入库设计系统，简报里有 Figma 链接。': 'demo.website.tasks.moodboard.comment',
  'Tokens checked into the design system; Figma link in the brief.':
    'demo.website.tasks.moodboard.comment',

  信息架构线框: 'demo.website.tasks.ia.title',
  'Information architecture wireframes': 'demo.website.tasks.ia.title',
  '首页、产品、定价、文档导航；标注移动端断点。': 'demo.website.tasks.ia.description',
  'Home, product, pricing, and docs nav; mobile breakpoints annotated.':
    'demo.website.tasks.ia.description',

  '首屏与落地页高保真': 'demo.website.tasks.hero.title',
  'Hero & landing page high-fidelity': 'demo.website.tasks.hero.title',
  '通栏 Hero、一条标题、一组 CTA，避免卡片堆叠。': 'demo.website.tasks.hero.description',
  'Full-bleed hero, one headline, single CTA group — no card clutter.':
    'demo.website.tasks.hero.description',
  '桌面稿已定，正在打磨滚动联动品牌动效。': 'demo.website.tasks.hero.comment',
  'Desktop locked; polishing motion for the scroll-linked brand mark.':
    'demo.website.tasks.hero.comment',

  'CMS 内容迁移清单': 'demo.website.tasks.cms.title',
  'CMS content migration checklist': 'demo.website.tasks.cms.title',
  '旧页面映射到新模板，标出失效嵌入与重定向。': 'demo.website.tasks.cms.description',
  'Map old pages to new templates; flag broken embeds and redirects.':
    'demo.website.tasks.cms.description',

  产品摄影拍摄简报: 'demo.website.tasks.photo.title',
  'Photography brief for product shots': 'demo.website.tasks.photo.title',
  '镜头清单、布光说明与上线素材使用授权。': 'demo.website.tasks.photo.description',
  'Shot list, lighting notes, and usage rights for launch assets.':
    'demo.website.tasks.photo.description',

  等待法务文案审核: 'demo.website.tasks.legal.title',
  'Awaiting legal copy review': 'demo.website.tasks.legal.title',
  '隐私 / 条款页脚文案卡在法务反馈。': 'demo.website.tasks.legal.description',
  'Privacy / terms footer wording blocked on counsel feedback.':
    'demo.website.tasks.legal.description',
  '已催办，目标周五前。': 'demo.website.tasks.legal.comment',
  'Sent reminder; target Friday.': 'demo.website.tasks.legal.comment',

  'SEO Meta 与 Open Graph': 'demo.website.tasks.seo.title',
  'SEO meta & Open Graph pass': 'demo.website.tasks.seo.title',
  '各语言标题描述模板与社交预览图。': 'demo.website.tasks.seo.description',
  'Title/description templates and social preview images per locale.':
    'demo.website.tasks.seo.description',

  上线日切换手册: 'demo.website.tasks.cutover.title',
  'Launch day cutover runbook': 'demo.website.tasks.cutover.title',
  'DNS、CDN 清缓存、回滚地址与值班联系人。': 'demo.website.tasks.cutover.description',
  'DNS, CDN cache purge, rollback URL, and on-call contacts.':
    'demo.website.tasks.cutover.description',

  // —— Mobile Sprint 14 ——
  '移动端 Sprint 14': 'demo.mobile.project.name',
  'Mobile Sprint 14': 'demo.mobile.project.name',
  '移动 App 两周研发冲刺。已完成列较满，任务偏用户故事风格。': 'demo.mobile.project.description',
  'Two-week engineering sprint for the mobile app. Dense Done column, story-style tasks.':
    'demo.mobile.project.description',

  推送深链跳转修复: 'demo.mobile.tasks.deeplink.title',
  'Push notification deep-link fix': 'demo.mobile.tasks.deeplink.title',
  '冷启动从通知必须落到正确任务详情。': 'demo.mobile.tasks.deeplink.description',
  'Cold-start from notification must land on the correct task detail.':
    'demo.mobile.tasks.deeplink.description',
  '已合入；iOS / Android QA 通过。': 'demo.mobile.tasks.deeplink.comment',
  'Merged; QA signed off on iOS + Android.': 'demo.mobile.tasks.deeplink.comment',

  离线草稿同步队列: 'demo.mobile.tasks.offline.title',
  'Offline draft sync queue': 'demo.mobile.tasks.offline.title',
  '指数退避重试；服务端胜出时提示冲突。': 'demo.mobile.tasks.offline.description',
  'Retry with exponential backoff; surface conflict when server wins.':
    'demo.mobile.tasks.offline.description',

  生物识别解锁恢复会话: 'demo.mobile.tasks.biometric.title',
  'Biometric unlock for session restore': 'demo.mobile.tasks.biometric.title',
  '从安全存储恢复 JWT 前先过 Face ID / 指纹。': 'demo.mobile.tasks.biometric.description',
  'Face ID / fingerprint gate before restoring the JWT from secure storage.':
    'demo.mobile.tasks.biometric.description',

  看板列虚拟滚动: 'demo.mobile.tasks.virtualize.title',
  'Board column virtualization': 'demo.mobile.tasks.virtualize.title',
  '中端 Android 上 200+ 卡片仍保持 60fps。': 'demo.mobile.tasks.virtualize.description',
  'Keep 60fps while scrolling 200+ cards on mid-tier Android.':
    'demo.mobile.tasks.virtualize.description',
  'RecyclerView 路径完成，接着量 Flutter 列表。': 'demo.mobile.tasks.virtualize.comment',
  'RecyclerView path done; measuring Flutter list next.': 'demo.mobile.tasks.virtualize.comment',

  深色模式对比度审计: 'demo.mobile.tasks.dark.title',
  'Dark mode contrast audit': 'demo.mobile.tasks.dark.title',
  '深色主题下优先级芯片与状态徽章达到 WCAG AA。': 'demo.mobile.tasks.dark.description',
  'WCAG AA on priority chips and status badges in dark theme.': 'demo.mobile.tasks.dark.description',

  '空看板 Crashlytics 尖峰': 'demo.mobile.tasks.crash.title',
  'Crashlytics spike on empty board': 'demo.mobile.tasks.crash.title',
  '项目零任务时 NPE；等待 1.14.2 符号化堆栈。': 'demo.mobile.tasks.crash.description',
  'NPE when project has zero tasks; waiting on symbolicated stack from 1.14.2.':
    'demo.mobile.tasks.crash.description',
  '需要 CI 产出的 dSYM 才能定位。': 'demo.mobile.tasks.crash.comment',
  'Need the dSYM from CI before we can pinpoint.': 'demo.mobile.tasks.crash.comment',

  'Sprint 演示脚本': 'demo.mobile.tasks.demo.title',
  'Sprint demo script': 'demo.mobile.tasks.demo.title',
  '五分钟演示：深链、离线草稿、生物识别解锁。': 'demo.mobile.tasks.demo.description',
  'Five-minute walkthrough: deep link, offline draft, biometric unlock.':
    'demo.mobile.tasks.demo.description',

  'TestFlight RC 冒烟': 'demo.mobile.tasks.rc.title',
  'Release candidate smoke on TestFlight': 'demo.mobile.tasks.rc.title',
  '安装 RC、登录、建任务、杀进程、恢复会话。': 'demo.mobile.tasks.rc.description',
  'Install RC, login, create task, kill app, restore session.': 'demo.mobile.tasks.rc.description',

  // —— Infra Reliability ——
  基础设施可靠性: 'demo.infra.project.name',
  'Infra Reliability': 'demo.infra.project.name',
  'SRE / 值班风格看板：故障、容量与平台加固。P0 与阻塞偏多。': 'demo.infra.project.description',
  'SRE / on-call style board: incidents, capacity, and platform hardening. Heavy on P0 and Blocked.':
    'demo.infra.project.description',

  'Postgres 连接池调优': 'demo.infra.tasks.pool.title',
  'Postgres connection pool tuning': 'demo.infra.tasks.pool.title',
  '审慎提高最大连接，并加上 PgBouncer 指标看板。': 'demo.infra.tasks.pool.description',
  'Raise max connections carefully; add PgBouncer metrics dashboard.':
    'demo.infra.tasks.pool.description',
  '上线后 p95 等待从 80ms 降到 12ms。': 'demo.infra.tasks.pool.comment',
  'p95 wait dropped from 80ms to 12ms after roll-out.': 'demo.infra.tasks.pool.comment',

  'API 延迟告警手册': 'demo.infra.tasks.alert.title',
  'API latency alert playbook': 'demo.infra.tasks.alert.title',
  '/api p99 > 500ms 持续 5 分钟的 PagerDuty 处置流程。': 'demo.infra.tasks.alert.description',
  'PagerDuty runbook for /api p99 > 500ms lasting 5 minutes.': 'demo.infra.tasks.alert.description',

  预发卷磁盘告警: 'demo.infra.tasks.disk.title',
  'Disk pressure on staging volume': 'demo.infra.tasks.disk.title',
  '用量 92%；扩容工单卡在云配额审批。': 'demo.infra.tasks.disk.description',
  'Volume at 92%; resize ticket pending cloud quota approval.': 'demo.infra.tasks.disk.description',
  '配额申请已提，ETA 未知。': 'demo.infra.tasks.disk.comment',
  'Quota request submitted; ETA unknown.': 'demo.infra.tasks.disk.comment',

  'Redis 故障切换演练': 'demo.infra.tasks.redis.title',
  'Redis failover drill': 'demo.infra.tasks.redis.title',
  '上次演练后预发 Sentinel 待重建，当前阻塞。': 'demo.infra.tasks.redis.description',
  'Blocked until staging Redis Sentinel is rebuilt after last drill.':
    'demo.infra.tasks.redis.description',

  蓝绿发布干跑: 'demo.infra.tasks.bluegreen.title',
  'Blue/green deploy dry-run': 'demo.infra.tasks.bluegreen.title',
  '切换流量且 WebSocket 会话零丢弃。': 'demo.infra.tasks.bluegreen.description',
  'Flip traffic with zero dropped WebSocket sessions.': 'demo.infra.tasks.bluegreen.description',
  '金丝雀 10%，观察重连尖峰。': 'demo.infra.tasks.bluegreen.comment',
  'Canary at 10%; watching reconnect spikes.': 'demo.infra.tasks.bluegreen.comment',

  备份恢复校验: 'demo.infra.tasks.backup.title',
  'Backup restore verification': 'demo.infra.tasks.backup.title',
  '把昨日 dump 恢复到隔离实例并校验表校验和。': 'demo.infra.tasks.backup.description',
  'Restore yesterday’s dump into isolated instance; checksum tables.':
    'demo.infra.tasks.backup.description',

  'TLS 套件清理': 'demo.infra.tasks.tls.title',
  'TLS cipher suite cleanup': 'demo.infra.tasks.tls.title',
  '去掉遗留 CBC 套件，并记录旧 Android WebView 影响。': 'demo.infra.tasks.tls.description',
  'Drop legacy CBC suites; document client impact for old Android WebView.':
    'demo.infra.tasks.tls.description',

  '成本复查：空闲预览环境': 'demo.infra.tasks.cost.title',
  'Cost review: idle preview environments': 'demo.infra.tasks.cost.title',
  'PR 预览 48 小时空闲自动休眠，估算月省费用。': 'demo.infra.tasks.cost.description',
  'Auto-sleep PR previews after 48h idle; estimate monthly savings.':
    'demo.infra.tasks.cost.description',

  // —— Customer Onboarding ——
  客户开通手册: 'demo.onboarding.project.name',
  'Customer Onboarding': 'demo.onboarding.project.name',
  '新客户上线流程手册。清单式任务，偏顺序推进。': 'demo.onboarding.project.description',
  'Process playbook for bringing a new customer live. Checklist-style tasks, mostly sequential.':
    'demo.onboarding.project.description',

  收到启动问卷: 'demo.onboarding.tasks.questionnaire.title',
  'Kickoff questionnaire received': 'demo.onboarding.tasks.questionnaire.title',
  '组织规模、SSO、数据驻留与上线日已采集。': 'demo.onboarding.tasks.questionnaire.description',
  'Org size, SSO needs, data residency, and go-live date captured.':
    'demo.onboarding.tasks.questionnaire.description',
  '字段齐全；SSO = SAML。': 'demo.onboarding.tasks.questionnaire.comment',
  'All fields complete; SSO = SAML.': 'demo.onboarding.tasks.questionnaire.comment',

  开通租户与管理员席位: 'demo.onboarding.tasks.provision.title',
  'Provision tenant & admin seats': 'demo.onboarding.tasks.provision.title',
  '创建工作区、预置角色、邀请客户管理员。': 'demo.onboarding.tasks.provision.description',
  'Create workspace, seed roles, invite customer admins.':
    'demo.onboarding.tasks.provision.description',

  'SAML SSO 配置工作坊': 'demo.onboarding.tasks.sso.title',
  'SAML SSO configuration workshop': 'demo.onboarding.tasks.sso.title',
  '元数据交换、属性映射，并用 IdP 测登录。': 'demo.onboarding.tasks.sso.description',
  'Metadata exchange, attribute mapping, and test login with IdP.':
    'demo.onboarding.tasks.sso.description',

  导入示例项目模板: 'demo.onboarding.tasks.template.title',
  'Import sample project template': 'demo.onboarding.tasks.template.title',
  '装入客户可克隆的启动看板。': 'demo.onboarding.tasks.template.description',
  'Load starter boards the customer can clone for their teams.':
    'demo.onboarding.tasks.template.description',
  '三套模板已导两套，等他们确认列名。': 'demo.onboarding.tasks.template.comment',
  'Two of three templates imported; waiting on their column names.':
    'demo.onboarding.tasks.template.comment',

  管理员培训场次: 'demo.onboarding.tasks.training.title',
  'Admin training session': 'demo.onboarding.tasks.training.title',
  '90 分钟直播：用户、项目、权限、审计日志。': 'demo.onboarding.tasks.training.description',
  '90-minute live session: users, projects, permissions, audit log.':
    'demo.onboarding.tasks.training.description',

  '等待客户 Logo 素材': 'demo.onboarding.tasks.logo.title',
  'Waiting on customer logo assets': 'demo.onboarding.tasks.logo.title',
  '白标页眉需要 SVG + PNG，素材未到无法上品牌。': 'demo.onboarding.tasks.logo.description',
  'Need SVG + PNG for white-label header before branding can ship.':
    'demo.onboarding.tasks.logo.description',
  '已催品牌对接两次，仍无文件。': 'demo.onboarding.tasks.logo.comment',
  'Pinged brand contact twice; still no files.': 'demo.onboarding.tasks.logo.comment',

  上线清单双方签字: 'demo.onboarding.tasks.golive.title',
  'Go-live checklist sign-off': 'demo.onboarding.tasks.golive.title',
  'SSO、备份、支持渠道与成功标准双方确认。': 'demo.onboarding.tasks.golive.description',
  'SSO, backups, support channel, and success criteria signed by both sides.':
    'demo.onboarding.tasks.golive.description',

  '预约 30 天成功回顾': 'demo.onboarding.tasks.review.title',
  '30-day success review scheduled': 'demo.onboarding.tasks.review.title',
  '日历占位 + 议程：采用指标与未闭环风险。': 'demo.onboarding.tasks.review.description',
  'Calendar hold + agenda: adoption metrics and open risks.':
    'demo.onboarding.tasks.review.description',
};

/** 展示层：命中演示文案则按当前语言翻译，否则原样返回 */
export function localizeDemoText(raw: string | null | undefined): string {
  void i18n.global.locale.value;
  if (raw == null || raw === '') return raw ?? '';
  const key = DEMO_TEXT_KEYS[raw];
  return key ? tGlobal(key) : raw;
}
