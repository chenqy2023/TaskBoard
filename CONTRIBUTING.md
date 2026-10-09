# 参与贡献

感谢愿意改进这个项目。下面是几条能让改动顺利合入的约定。

## 开发环境

见 [README 的「快速开始」](README.md#快速开始)。简言之：`docker compose` 起数据库，前后端各自 `npm run dev`。

## 提交前请跑一遍

```bash
cd backend  && npx tsc --noEmit && npm run test
cd frontend && npm run typecheck && npm run build

# 后端与前端的数据库起来后，接口冒烟也应当全绿
python scripts/api-smoke.py
cd frontend && node scripts/ws-smoke.mjs http://localhost:3000
```

## 改数据库结构

- 改 `backend/prisma/schema.prisma` 后，用 `npx prisma migrate dev --name <说明>` 生成迁移。
- **已经合入的迁移不要修改**，需要变更就再加一个。
- 涉及删列/改列时请留意数据安全：`prisma migrate diff` 默认会生成 `DROP` + `ADD`，
  那会丢数据。确需保留数据时手工写成 `RENAME` / `UPDATE` 再 `ADD`，
  可参考 `prisma/migrations/20261009180000_rename_version_to_project/`。

## 代码约定

- **前后端都是 TypeScript**，不要用 `any` 绕开类型；确实需要时写明原因。
- 业务规则尽量抽成**纯函数**并配单测（参考 `src/projects/project-summary.ts`、
  `src/tasks/task.rules.ts`、`src/task-io/import.rules.ts`），这样规则本身能被验证，
  不依赖数据库。
- 前端样式统一用 `src/styles/main.css` 里的设计令牌（`--tk-*`），不要在组件里写死颜色、
  圆角、阴影；需要新令牌就往 `:root` 里加一个并写清用途。
- 用户可见的文案统一用中文，与现有措辞保持一致（例如状态用「未开始/进行中/阻塞/已完成」）。
- 注释写**为什么**，不写**做了什么**——代码本身能说明后者。

## 提交信息

用一句话说清这次改动解决了什么问题，正文里补充背景与验证方式。
如果修的是一个不容易复现的 bug，把复现条件写上，别人以后改到这里会用得上。

## 提 Issue

请附上：复现步骤、期望结果、实际结果，以及后端日志（`docker compose logs api`）。
涉及界面问题的话，附一张截图能省很多来回。
