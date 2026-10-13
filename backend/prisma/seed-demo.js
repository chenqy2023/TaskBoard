/**
 * 演示数据：供本地截图 / GitHub README 展示。
 * 全部为虚构账号与项目，不含真实身份信息。
 * 库内写入英文文案；前端按界面语言自动映射中/英展示（见 frontend/src/utils/demo-content.ts）。
 *
 * 用法（仓库根目录已配置 .env，且库已 migrate）：
 *   cd backend && npm run db:seed:demo
 *
 * 幂等：按项目名跳过已存在的演示项目，可重复执行以补齐新增项目。
 */
const { PrismaClient, Role, Priority, TaskStatus, ActivityAction, ProjectStatus } =
  require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD || 'Demo@123456';

const MEMBERS = [
  { username: 'alice', displayName: 'Alice' },
  { username: 'bob', displayName: 'Bob' },
  { username: 'carol', displayName: 'Carol' },
];

function utcDate(ymd) {
  return new Date(`${ymd}T00:00:00.000Z`);
}

async function ensureMember(spec, passwordHash) {
  const existing = await prisma.user.findUnique({ where: { username: spec.username } });
  if (existing) return existing;
  return prisma.user.create({
    data: {
      username: spec.username,
      displayName: spec.displayName,
      role: Role.MEMBER,
      passwordHash,
    },
  });
}

async function ensureAdmin() {
  let admin = await prisma.user.findFirst({
    where: { role: Role.ADMIN, active: true },
    orderBy: { createdAt: 'asc' },
  });
  if (admin) return admin;

  const password = process.env.ADMIN_INITIAL_PASSWORD;
  if (!password) {
    throw new Error('库中无管理员，且缺少 ADMIN_INITIAL_PASSWORD，无法创建演示数据');
  }
  admin = await prisma.user.create({
    data: {
      username: (process.env.ADMIN_USERNAME || 'admin').trim(),
      displayName: (process.env.ADMIN_DISPLAY_NAME || 'admin').trim(),
      role: Role.ADMIN,
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
  console.log(`[seed-demo] 已创建管理员 ${admin.username}`);
  return admin;
}

/** @param {{ alice: any, bob: any, carol: any }} u */
function buildProjects(u) {
  const { alice, bob, carol } = u;

  return [
    {
      name: 'Product Launch Demo',
      aliases: ['Product Launch Demo', '产品发布 Demo'],
      description:
        'Sample project for the open-source README and local demos. Safe to edit or delete.',
      status: ProjectStatus.ACTIVE,
      startDate: utcDate('2026-10-01'),
      endDate: utcDate('2026-10-31'),
      tasks: [
        {
          title: 'Define scope and acceptance criteria',
          status: TaskStatus.DONE,
          priority: Priority.P1,
          progress: 100,
          assigneeId: alice.id,
          participantIds: [bob.id],
          plannedStartDate: utcDate('2026-10-01'),
          plannedEndDate: utcDate('2026-10-05'),
          actualStartDate: utcDate('2026-10-01'),
          actualEndDate: utcDate('2026-10-04'),
          sortIndex: 0,
          description: 'Align must-haves vs. deferrals into a one-page acceptance checklist.',
          comment: 'Scope confirmed; see the meeting notes for attachments.',
        },
        {
          title: 'Login & permission smoke cases',
          status: TaskStatus.DONE,
          priority: Priority.P0,
          progress: 100,
          assigneeId: bob.id,
          participantIds: [alice.id],
          plannedStartDate: utcDate('2026-10-03'),
          plannedEndDate: utcDate('2026-10-08'),
          actualStartDate: utcDate('2026-10-03'),
          actualEndDate: utcDate('2026-10-07'),
          sortIndex: 1,
          description: 'Cover admin vs member differences and deactivated accounts.',
        },
        {
          title: 'Board drag & progress regression',
          status: TaskStatus.IN_PROGRESS,
          priority: Priority.P0,
          progress: 65,
          assigneeId: alice.id,
          participantIds: [carol.id],
          plannedStartDate: utcDate('2026-10-08'),
          plannedEndDate: utcDate('2026-10-15'),
          actualStartDate: utcDate('2026-10-09'),
          sortIndex: 0,
          description: 'Moving to Done must set 100%; leaving Done must not clear progress.',
          comment: 'In progress → Done verified; blocked column still needs one pass.',
        },
        {
          title: 'Stats chart data cross-check',
          status: TaskStatus.TODO,
          priority: Priority.P2,
          progress: 0,
          assigneeId: bob.id,
          participantIds: [],
          plannedStartDate: utcDate('2026-10-16'),
          plannedEndDate: utcDate('2026-10-22'),
          sortIndex: 0,
          description: 'Cross-check status / priority / assignee charts against the task list.',
        },
        {
          title: 'Realtime sync two-browser check',
          status: TaskStatus.TODO,
          priority: Priority.P1,
          progress: 0,
          assigneeId: carol.id,
          participantIds: [bob.id],
          plannedStartDate: utcDate('2026-10-18'),
          plannedEndDate: utcDate('2026-10-25'),
          sortIndex: 1,
          description: 'Two browser sessions on the same board; verify push and reconnect.',
        },
        {
          title: 'Waiting on staging TLS certificate',
          status: TaskStatus.BLOCKED,
          priority: Priority.P0,
          progress: 20,
          assigneeId: alice.id,
          participantIds: [carol.id],
          plannedStartDate: utcDate('2026-10-12'),
          plannedEndDate: utcDate('2026-10-14'),
          actualStartDate: utcDate('2026-10-12'),
          sortIndex: 0,
          description: 'Ops has not issued the cert yet; HTTPS smoke is on hold.',
          comment: 'Followed up; expect recovery this week.',
        },
        {
          title: 'Draft release notes',
          status: TaskStatus.TODO,
          priority: Priority.P3,
          progress: 0,
          assigneeId: null,
          participantIds: [alice.id],
          plannedStartDate: utcDate('2026-10-20'),
          plannedEndDate: utcDate('2026-10-28'),
          sortIndex: 2,
          description: 'User-facing changes, known issues, and rollback steps.',
        },
      ],
    },
    {
      name: 'Website Redesign',
      aliases: ['Website Redesign', '官网改版'],
      description:
        'Marketing site refresh: brand, IA, and launch content. Design-heavy demo with creative tasks.',
      status: ProjectStatus.ACTIVE,
      startDate: utcDate('2026-09-15'),
      endDate: utcDate('2026-11-15'),
      tasks: [
        {
          title: 'Brand moodboard & color tokens',
          status: TaskStatus.DONE,
          priority: Priority.P1,
          progress: 100,
          assigneeId: carol.id,
          participantIds: [alice.id],
          plannedStartDate: utcDate('2026-09-15'),
          plannedEndDate: utcDate('2026-09-22'),
          actualStartDate: utcDate('2026-09-15'),
          actualEndDate: utcDate('2026-09-20'),
          sortIndex: 0,
          description: 'Lock primary / accent / neutral tokens and type pairing for the new site.',
          comment: 'Tokens checked into the design system; Figma link in the brief.',
        },
        {
          title: 'Information architecture wireframes',
          status: TaskStatus.DONE,
          priority: Priority.P1,
          progress: 100,
          assigneeId: alice.id,
          participantIds: [carol.id],
          plannedStartDate: utcDate('2026-09-20'),
          plannedEndDate: utcDate('2026-09-30'),
          actualStartDate: utcDate('2026-09-21'),
          actualEndDate: utcDate('2026-09-29'),
          sortIndex: 1,
          description: 'Home, product, pricing, and docs nav; mobile breakpoints annotated.',
        },
        {
          title: 'Hero & landing page high-fidelity',
          status: TaskStatus.IN_PROGRESS,
          priority: Priority.P0,
          progress: 55,
          assigneeId: carol.id,
          participantIds: [bob.id],
          plannedStartDate: utcDate('2026-10-01'),
          plannedEndDate: utcDate('2026-10-18'),
          actualStartDate: utcDate('2026-10-02'),
          sortIndex: 0,
          description: 'Full-bleed hero, one headline, single CTA group — no card clutter.',
          comment: 'Desktop locked; polishing motion for the scroll-linked brand mark.',
        },
        {
          title: 'CMS content migration checklist',
          status: TaskStatus.IN_PROGRESS,
          priority: Priority.P2,
          progress: 40,
          assigneeId: bob.id,
          participantIds: [alice.id],
          plannedStartDate: utcDate('2026-10-05'),
          plannedEndDate: utcDate('2026-10-25'),
          actualStartDate: utcDate('2026-10-07'),
          sortIndex: 1,
          description: 'Map old pages to new templates; flag broken embeds and redirects.',
        },
        {
          title: 'Photography brief for product shots',
          status: TaskStatus.TODO,
          priority: Priority.P2,
          progress: 0,
          assigneeId: carol.id,
          participantIds: [],
          plannedStartDate: utcDate('2026-10-20'),
          plannedEndDate: utcDate('2026-10-28'),
          sortIndex: 0,
          description: 'Shot list, lighting notes, and usage rights for launch assets.',
        },
        {
          title: 'Awaiting legal copy review',
          status: TaskStatus.BLOCKED,
          priority: Priority.P1,
          progress: 10,
          assigneeId: alice.id,
          participantIds: [carol.id],
          plannedStartDate: utcDate('2026-10-08'),
          plannedEndDate: utcDate('2026-10-12'),
          actualStartDate: utcDate('2026-10-08'),
          sortIndex: 0,
          description: 'Privacy / terms footer wording blocked on counsel feedback.',
          comment: 'Sent reminder; target Friday.',
        },
        {
          title: 'SEO meta & Open Graph pass',
          status: TaskStatus.TODO,
          priority: Priority.P3,
          progress: 0,
          assigneeId: bob.id,
          participantIds: [],
          plannedStartDate: utcDate('2026-10-28'),
          plannedEndDate: utcDate('2026-11-05'),
          sortIndex: 1,
          description: 'Title/description templates and social preview images per locale.',
        },
        {
          title: 'Launch day cutover runbook',
          status: TaskStatus.TODO,
          priority: Priority.P0,
          progress: 0,
          assigneeId: alice.id,
          participantIds: [bob.id, carol.id],
          plannedStartDate: utcDate('2026-11-08'),
          plannedEndDate: utcDate('2026-11-14'),
          sortIndex: 2,
          description: 'DNS, CDN cache purge, rollback URL, and on-call contacts.',
        },
      ],
    },
    {
      name: 'Mobile Sprint 14',
      aliases: ['Mobile Sprint 14', '移动端 Sprint 14'],
      description:
        'Two-week engineering sprint for the mobile app. Dense Done column, story-style tasks.',
      status: ProjectStatus.ACTIVE,
      startDate: utcDate('2026-10-06'),
      endDate: utcDate('2026-10-17'),
      tasks: [
        {
          title: 'Push notification deep-link fix',
          status: TaskStatus.DONE,
          priority: Priority.P0,
          progress: 100,
          assigneeId: bob.id,
          participantIds: [alice.id],
          plannedStartDate: utcDate('2026-10-06'),
          plannedEndDate: utcDate('2026-10-08'),
          actualStartDate: utcDate('2026-10-06'),
          actualEndDate: utcDate('2026-10-07'),
          sortIndex: 0,
          description: 'Cold-start from notification must land on the correct task detail.',
          comment: 'Merged; QA signed off on iOS + Android.',
        },
        {
          title: 'Offline draft queue queue',
          status: TaskStatus.DONE,
          priority: Priority.P1,
          progress: 100,
          assigneeId: alice.id,
          participantIds: [carol.id],
          plannedStartDate: utcDate('2026-10-06'),
          plannedEndDate: utcDate('2026-10-10'),
          actualStartDate: utcDate('2026-10-06'),
          actualEndDate: utcDate('2026-10-09'),
          sortIndex: 1,
          description: 'Retry with exponential backoff; surface conflict when server wins.',
        },
        {
          title: 'Biometric unlock for session restore',
          status: TaskStatus.DONE,
          priority: Priority.P2,
          progress: 100,
          assigneeId: carol.id,
          participantIds: [],
          plannedStartDate: utcDate('2026-10-07'),
          plannedEndDate: utcDate('2026-10-11'),
          actualStartDate: utcDate('2026-10-08'),
          actualEndDate: utcDate('2026-10-11'),
          sortIndex: 2,
          description: 'Face ID / fingerprint gate before restoring the JWT from secure storage.',
        },
        {
          title: 'Board column virtualization',
          status: TaskStatus.IN_PROGRESS,
          priority: Priority.P1,
          progress: 70,
          assigneeId: bob.id,
          participantIds: [alice.id],
          plannedStartDate: utcDate('2026-10-09'),
          plannedEndDate: utcDate('2026-10-15'),
          actualStartDate: utcDate('2026-10-09'),
          sortIndex: 0,
          description: 'Keep 60fps while scrolling 200+ cards on mid-tier Android.',
          comment: 'RecyclerView path done; measuring Flutter list next.',
        },
        {
          title: 'Dark mode contrast audit',
          status: TaskStatus.IN_PROGRESS,
          priority: Priority.P2,
          progress: 35,
          assigneeId: carol.id,
          participantIds: [bob.id],
          plannedStartDate: utcDate('2026-10-10'),
          plannedEndDate: utcDate('2026-10-16'),
          actualStartDate: utcDate('2026-10-11'),
          sortIndex: 1,
          description: 'WCAG AA on priority chips and status badges in dark theme.',
        },
        {
          title: 'Crashlytics spike on empty board',
          status: TaskStatus.BLOCKED,
          priority: Priority.P0,
          progress: 15,
          assigneeId: alice.id,
          participantIds: [bob.id],
          plannedStartDate: utcDate('2026-10-12'),
          plannedEndDate: utcDate('2026-10-14'),
          actualStartDate: utcDate('2026-10-12'),
          sortIndex: 0,
          description: 'NPE when project has zero tasks; waiting on symbolicated stack from 1.14.2.',
          comment: 'Need the dSYM from CI before we can pinpoint.',
        },
        {
          title: 'Sprint demo script',
          status: TaskStatus.TODO,
          priority: Priority.P3,
          progress: 0,
          assigneeId: alice.id,
          participantIds: [bob.id, carol.id],
          plannedStartDate: utcDate('2026-10-16'),
          plannedEndDate: utcDate('2026-10-17'),
          sortIndex: 0,
          description: 'Five-minute walkthrough: deep link, offline draft, biometric unlock.',
        },
        {
          title: 'Release candidate smoke on TestFlight',
          status: TaskStatus.TODO,
          priority: Priority.P0,
          progress: 0,
          assigneeId: bob.id,
          participantIds: [carol.id],
          plannedStartDate: utcDate('2026-10-15'),
          plannedEndDate: utcDate('2026-10-17'),
          sortIndex: 1,
          description: 'Install RC, login, create task, kill app, restore session.',
        },
      ],
    },
    {
      name: 'Infra Reliability',
      aliases: ['Infra Reliability', '基础设施可靠性'],
      description:
        'SRE / on-call style board: incidents, capacity, and platform hardening. Heavy on P0 and Blocked.',
      status: ProjectStatus.ACTIVE,
      startDate: utcDate('2026-10-01'),
      endDate: utcDate('2026-12-31'),
      tasks: [
        {
          title: 'Postgres connection pool tuning',
          status: TaskStatus.DONE,
          priority: Priority.P1,
          progress: 100,
          assigneeId: bob.id,
          participantIds: [alice.id],
          plannedStartDate: utcDate('2026-10-01'),
          plannedEndDate: utcDate('2026-10-05'),
          actualStartDate: utcDate('2026-10-01'),
          actualEndDate: utcDate('2026-10-04'),
          sortIndex: 0,
          description: 'Raise max connections carefully; add PgBouncer metrics dashboard.',
          comment: 'p95 wait dropped from 80ms to 12ms after roll-out.',
        },
        {
          title: 'API latency alert playbook',
          status: TaskStatus.DONE,
          priority: Priority.P0,
          progress: 100,
          assigneeId: alice.id,
          participantIds: [carol.id],
          plannedStartDate: utcDate('2026-10-03'),
          plannedEndDate: utcDate('2026-10-08'),
          actualStartDate: utcDate('2026-10-03'),
          actualEndDate: utcDate('2026-10-07'),
          sortIndex: 1,
          description: 'PagerDuty runbook for /api p99 > 500ms lasting 5 minutes.',
        },
        {
          title: 'Disk pressure on staging volume',
          status: TaskStatus.BLOCKED,
          priority: Priority.P0,
          progress: 30,
          assigneeId: carol.id,
          participantIds: [bob.id],
          plannedStartDate: utcDate('2026-10-09'),
          plannedEndDate: utcDate('2026-10-11'),
          actualStartDate: utcDate('2026-10-09'),
          sortIndex: 0,
          description: 'Volume at 92%; resize ticket pending cloud quota approval.',
          comment: 'Quota request submitted; ETA unknown.',
        },
        {
          title: 'Redis failover drill',
          status: TaskStatus.BLOCKED,
          priority: Priority.P1,
          progress: 5,
          assigneeId: bob.id,
          participantIds: [alice.id],
          plannedStartDate: utcDate('2026-10-10'),
          plannedEndDate: utcDate('2026-10-12'),
          actualStartDate: utcDate('2026-10-10'),
          sortIndex: 1,
          description: 'Blocked until staging Redis Sentinel is rebuilt after last drill.',
        },
        {
          title: 'Blue/green deploy dry-run',
          status: TaskStatus.IN_PROGRESS,
          priority: Priority.P0,
          progress: 50,
          assigneeId: alice.id,
          participantIds: [bob.id, carol.id],
          plannedStartDate: utcDate('2026-10-08'),
          plannedEndDate: utcDate('2026-10-20'),
          actualStartDate: utcDate('2026-10-09'),
          sortIndex: 0,
          description: 'Flip traffic with zero dropped WebSocket sessions.',
          comment: 'Canary at 10%; watching reconnect spikes.',
        },
        {
          title: 'Backup restore verification',
          status: TaskStatus.IN_PROGRESS,
          priority: Priority.P1,
          progress: 25,
          assigneeId: carol.id,
          participantIds: [],
          plannedStartDate: utcDate('2026-10-13'),
          plannedEndDate: utcDate('2026-10-24'),
          actualStartDate: utcDate('2026-10-14'),
          sortIndex: 1,
          description: 'Restore yesterday’s dump into isolated instance; checksum tables.',
        },
        {
          title: 'TLS cipher suite cleanup',
          status: TaskStatus.TODO,
          priority: Priority.P2,
          progress: 0,
          assigneeId: bob.id,
          participantIds: [],
          plannedStartDate: utcDate('2026-10-20'),
          plannedEndDate: utcDate('2026-10-27'),
          sortIndex: 0,
          description: 'Drop legacy CBC suites; document client impact for old Android WebView.',
        },
        {
          title: 'Cost review: idle preview environments',
          status: TaskStatus.TODO,
          priority: Priority.P3,
          progress: 0,
          assigneeId: alice.id,
          participantIds: [carol.id],
          plannedStartDate: utcDate('2026-11-01'),
          plannedEndDate: utcDate('2026-11-15'),
          sortIndex: 1,
          description: 'Auto-sleep PR previews after 48h idle; estimate monthly savings.',
        },
      ],
    },
    {
      name: 'Customer Onboarding',
      aliases: ['Customer Onboarding', '客户开通手册'],
      description:
        'Process playbook for bringing a new customer live. Checklist-style tasks, mostly sequential.',
      status: ProjectStatus.ACTIVE,
      startDate: utcDate('2026-09-01'),
      endDate: utcDate('2026-10-31'),
      tasks: [
        {
          title: 'Kickoff questionnaire received',
          status: TaskStatus.DONE,
          priority: Priority.P1,
          progress: 100,
          assigneeId: alice.id,
          participantIds: [],
          plannedStartDate: utcDate('2026-09-01'),
          plannedEndDate: utcDate('2026-09-05'),
          actualStartDate: utcDate('2026-09-01'),
          actualEndDate: utcDate('2026-09-03'),
          sortIndex: 0,
          description: 'Org size, SSO needs, data residency, and go-live date captured.',
          comment: 'All fields complete; SSO = SAML.',
        },
        {
          title: 'Provision tenant & admin seats',
          status: TaskStatus.DONE,
          priority: Priority.P0,
          progress: 100,
          assigneeId: bob.id,
          participantIds: [alice.id],
          plannedStartDate: utcDate('2026-09-04'),
          plannedEndDate: utcDate('2026-09-08'),
          actualStartDate: utcDate('2026-09-04'),
          actualEndDate: utcDate('2026-09-06'),
          sortIndex: 1,
          description: 'Create workspace, seed roles, invite customer admins.',
        },
        {
          title: 'SAML SSO configuration workshop',
          status: TaskStatus.DONE,
          priority: Priority.P0,
          progress: 100,
          assigneeId: carol.id,
          participantIds: [bob.id],
          plannedStartDate: utcDate('2026-09-08'),
          plannedEndDate: utcDate('2026-09-15'),
          actualStartDate: utcDate('2026-09-09'),
          actualEndDate: utcDate('2026-09-14'),
          sortIndex: 2,
          description: 'Metadata exchange, attribute mapping, and test login with IdP.',
        },
        {
          title: 'Import sample project template',
          status: TaskStatus.IN_PROGRESS,
          priority: Priority.P2,
          progress: 60,
          assigneeId: alice.id,
          participantIds: [carol.id],
          plannedStartDate: utcDate('2026-09-16'),
          plannedEndDate: utcDate('2026-09-30'),
          actualStartDate: utcDate('2026-09-17'),
          sortIndex: 0,
          description: 'Load starter boards the customer can clone for their teams.',
          comment: 'Two of three templates imported; waiting on their column names.',
        },
        {
          title: 'Admin training session',
          status: TaskStatus.IN_PROGRESS,
          priority: Priority.P1,
          progress: 40,
          assigneeId: carol.id,
          participantIds: [alice.id],
          plannedStartDate: utcDate('2026-10-01'),
          plannedEndDate: utcDate('2026-10-10'),
          actualStartDate: utcDate('2026-10-02'),
          sortIndex: 1,
          description: '90-minute live session: users, projects, permissions, audit log.',
        },
        {
          title: 'Waiting on customer logo assets',
          status: TaskStatus.BLOCKED,
          priority: Priority.P2,
          progress: 0,
          assigneeId: bob.id,
          participantIds: [],
          plannedStartDate: utcDate('2026-09-20'),
          plannedEndDate: utcDate('2026-09-25'),
          sortIndex: 0,
          description: 'Need SVG + PNG for white-label header before branding can ship.',
          comment: 'Pinged brand contact twice; still no files.',
        },
        {
          title: 'Go-live checklist sign-off',
          status: TaskStatus.TODO,
          priority: Priority.P0,
          progress: 0,
          assigneeId: alice.id,
          participantIds: [bob.id, carol.id],
          plannedStartDate: utcDate('2026-10-20'),
          plannedEndDate: utcDate('2026-10-28'),
          sortIndex: 0,
          description: 'SSO, backups, support channel, and success criteria signed by both sides.',
        },
        {
          title: '30-day success review scheduled',
          status: TaskStatus.TODO,
          priority: Priority.P3,
          progress: 0,
          assigneeId: carol.id,
          participantIds: [alice.id],
          plannedStartDate: utcDate('2026-10-25'),
          plannedEndDate: utcDate('2026-10-31'),
          sortIndex: 1,
          description: 'Calendar hold + agenda: adoption metrics and open risks.',
        },
      ],
    },
  ];
}

async function seedProject(admin, projectDef) {
  const existed = await prisma.project.findFirst({
    where: { name: { in: projectDef.aliases } },
  });
  if (existed) {
    console.log(`[seed-demo] 演示项目「${existed.name}」已存在，跳过`);
    return { created: false, name: existed.name, tasks: 0 };
  }

  const project = await prisma.project.create({
    data: {
      name: projectDef.name,
      description: projectDef.description,
      status: projectDef.status,
      startDate: projectDef.startDate,
      endDate: projectDef.endDate,
      createdById: admin.id,
    },
  });

  for (const def of projectDef.tasks) {
    const { participantIds, comment, ...rest } = def;
    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        title: rest.title,
        description: rest.description ?? null,
        assigneeId: rest.assigneeId,
        priority: rest.priority,
        status: rest.status,
        progress: rest.progress,
        plannedStartDate: rest.plannedStartDate ?? null,
        plannedEndDate: rest.plannedEndDate ?? null,
        actualStartDate: rest.actualStartDate ?? null,
        actualEndDate: rest.actualEndDate ?? null,
        sortIndex: rest.sortIndex,
        completedAt: rest.status === TaskStatus.DONE ? new Date() : null,
        createdById: admin.id,
        participants: participantIds.length
          ? { connect: participantIds.map((id) => ({ id })) }
          : undefined,
      },
    });

    await prisma.activityLog.create({
      data: {
        taskId: task.id,
        actorId: admin.id,
        action: ActivityAction.TASK_CREATED,
        field: 'title',
        toValue: task.title,
      },
    });

    if (comment) {
      await prisma.comment.create({
        data: {
          taskId: task.id,
          authorId: rest.assigneeId || admin.id,
          body: comment,
        },
      });
      await prisma.activityLog.create({
        data: {
          taskId: task.id,
          actorId: rest.assigneeId || admin.id,
          action: ActivityAction.COMMENT_ADDED,
          field: 'body',
          toValue: comment.slice(0, 200),
        },
      });
    }
  }

  console.log(`[seed-demo] 已创建演示项目「${projectDef.name}」与 ${projectDef.tasks.length} 条任务`);
  return { created: true, name: projectDef.name, tasks: projectDef.tasks.length };
}

async function main() {
  const admin = await ensureAdmin();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const [alice, bob, carol] = await Promise.all(MEMBERS.map((m) => ensureMember(m, passwordHash)));

  const projects = buildProjects({ alice, bob, carol });
  let createdCount = 0;
  let taskCount = 0;
  for (const def of projects) {
    const result = await seedProject(admin, def);
    if (result.created) {
      createdCount += 1;
      taskCount += result.tasks;
    }
  }

  console.log(
    `[seed-demo] 完成：新建 ${createdCount} 个项目 / ${taskCount} 条任务（共 ${projects.length} 个演示项目定义）`,
  );
  console.log(`[seed-demo] 演示成员：alice / bob / carol ，初始密码 ${DEMO_PASSWORD}`);
  console.log('[seed-demo] UI 语言切换时，演示项目/任务文案会自动中英切换（无需改库）。');
}

main()
  .catch((error) => {
    console.error('[seed-demo] 失败：', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
