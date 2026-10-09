/**
 * 初始化管理员：仅在库中没有任何用户时创建，重复执行安全。
 * 用纯 JS 写是为了生产镜像里不需要 ts-node，直接 node prisma/seed.js 即可。
 */
const { PrismaClient, Role } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const username = (process.env.ADMIN_USERNAME || 'admin').trim();
  const displayName = (process.env.ADMIN_DISPLAY_NAME || '系统管理员').trim();
  const password = process.env.ADMIN_INITIAL_PASSWORD;

  if (!password) {
    throw new Error('缺少环境变量 ADMIN_INITIAL_PASSWORD，无法创建初始管理员');
  }

  const count = await prisma.user.count();
  if (count > 0) {
    console.log(`[seed] 已存在 ${count} 个用户，跳过初始管理员创建`);
    return;
  }

  const admin = await prisma.user.create({
    data: {
      username,
      displayName,
      role: Role.ADMIN,
      passwordHash: await bcrypt.hash(password, 10),
    },
  });

  console.log(`[seed] 已创建初始管理员：${admin.username}（姓名：${admin.displayName}）`);
  console.log('[seed] 请登录后立即修改密码。');
}

main()
  .catch((error) => {
    console.error('[seed] 初始化失败：', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
