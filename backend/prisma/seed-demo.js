/**
 * 演示数据：供本地截图 / GitHub README 展示。
 * 全部为虚构账号与项目，不含真实身份信息。
 * 库内写入英文文案；前端按界面语言自动映射中/英展示（见 frontend/src/utils/demo-content.ts）。
 *
 * 用法（仓库根目录已配置 .env，且库已 migrate）：
 *   cd backend && npm run db:seed:demo
 *
 * 幂等：若已存在中文或英文同名演示项目则跳过，可重复执行。
 */
const { PrismaClient, Role, Priority, TaskStatus, ActivityAction, ProjectStatus } =
  require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const DEMO_PROJECT_NAME = 'Product Launch Demo';
const DEMO_PROJECT_NAMES = ['Product Launch Demo', '产品发布 Demo'];
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

async function main() {
  const existed = await prisma.project.findFirst({
    where: { name: { in: DEMO_PROJECT_NAMES } },
  });
  if (existed) {
    console.log(`[seed-demo] 演示项目「${existed.name}」已存在，跳过`);
    return;
  }

  const admin = await ensureAdmin();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const [alice, bob, carol] = await Promise.all(MEMBERS.map((m) => ensureMember(m, passwordHash)));

  const project = await prisma.project.create({
    data: {
      name: DEMO_PROJECT_NAME,
      description:
        'Sample project for the open-source README and local demos. Safe to edit or delete.',
      status: ProjectStatus.ACTIVE,
      startDate: utcDate('2026-10-01'),
      endDate: utcDate('2026-10-31'),
      createdById: admin.id,
    },
  });

  const taskDefs = [
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
  ];

  for (const def of taskDefs) {
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

  console.log(`[seed-demo] 已创建演示项目「${DEMO_PROJECT_NAME}」与 ${taskDefs.length} 条任务`);
  console.log(`[seed-demo] 演示成员：alice / bob / carol ，初始密码 ${DEMO_PASSWORD}`);
  console.log('[seed-demo] UI 语言切换时，演示项目/任务文案会自动中英切换（无需改库）。');
  console.log('[seed-demo] 可用管理员或任一演示成员登录查看看板、列表与统计。');
}

main()
  .catch((error) => {
    console.error('[seed-demo] 失败：', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
