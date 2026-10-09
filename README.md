# 测试任务看板

面向测试团队的**版本测试进度与任务管理**看板。每个版本一个看板，任务在「未开始 / 进行中 / 阻塞 / 已完成」四列之间拖拽流转，版本进度由任务进度自动汇总。

- 后端：NestJS + Prisma + PostgreSQL 16
- 前端：Vue 3 + Vite + Ant Design Vue + ECharts
- 部署：docker compose（nginx + api + postgres）

## 功能

| 模块 | 内容 |
| --- | --- |
| 版本管理 | 版本列表、新建/编辑/归档、每个版本的进度条与完成率 |
| 看板 | 四列拖拽改状态、列内排序、顶部版本进度、按负责人/参与人/优先级/关键词筛选 |
| 任务 | 新建/编辑/删除、负责人、参与人（多选）、优先级、计划与实际四个日期、0-100 整数进度 |
| 任务列表 | 表格视图、多条件筛选、排序、分页、行内改状态与负责人、批量修改 |
| 协作 | 评论、操作日志时间线（谁把哪条任务从什么状态改成了什么状态） |
| 统计 | ECharts：状态分布、优先级分布、各负责人任务数与平均进度 |
| 导入导出 | Excel 批量导入（先预览校验再落库）、按当前版本导出 |
| 实时同步 | Socket.IO 推送，别人改了看板自动刷新并提示是谁改的 |
| 权限 | 账号密码登录，管理员 / 成员两种角色 |

## 快速开始（本机开发）

```bash
cp .env.example .env
docker compose --env-file .env -f docker/docker-compose.dev.yml up -d   # 只起 PostgreSQL

cd backend && npm install
npx prisma migrate dev
npx prisma db seed          # 创建初始管理员
npm run start:dev           # http://localhost:3000/api

cd ../frontend && npm install
npm run dev                 # http://localhost:5173
```

初始账号 `admin` / `Admin@123456`（改 `.env` 里的 `ADMIN_INITIAL_PASSWORD` 可换）。

> 开发库默认用宿主机 **5433** 端口：本机 5432 已被另一个项目的开发库占用，错开避免冲突。可在 `.env` 里改 `POSTGRES_PORT`。

## 目录结构

```
├─ backend/            NestJS + Prisma
│  ├─ prisma/          schema、migrations、seed.js
│  ├─ src/             auth users versions tasks comments activities stats task-io realtime common
│  └─ Dockerfile
├─ frontend/           Vue3 + Vite + Ant Design Vue
│  ├─ src/api          接口封装（axios 实例统一处理 401 与错误提示）
│  ├─ src/views        登录、版本列表、看板、任务列表、统计、我的待办、成员管理
│  ├─ src/components   看板卡片、任务表单、详情抽屉、筛选项、导入弹窗等
│  └─ Dockerfile nginx.conf
├─ docker/
│  ├─ docker-compose.yml       生产：nginx + api + postgres
│  └─ docker-compose.dev.yml   开发：仅 postgres
├─ docs/               需求确认结论 / 数据模型与接口 / 部署与冒烟清单
└─ scripts/api-smoke.py  接口级冒烟测试（37 项，仅用标准库）
```

## 文档

- [需求确认结论](docs/需求确认结论.md) —— 开工前逐项确认的需求，含进度口径与联动规则
- [数据模型与接口](docs/数据模型与接口.md) —— 表结构、全部接口、进度算法
- [部署与冒烟清单](docs/部署与冒烟清单.md) —— 本地开发、CentOS 7 生产部署、手工验收清单、排障

## 测试

```bash
cd backend && npm run test          # 51 项单元测试：进度汇总 / 状态与进度联动 / 权限规则 / 导入校验
cd frontend && npm run typecheck    # 前端类型检查

# 接口冒烟（需后端已启动）
python scripts/api-smoke.py                      # 默认打 localhost:3000
python scripts/api-smoke.py --base http://localhost:8080/api   # 也可直接打生产 nginx
python scripts/api-smoke.py --keep               # 保留测试数据便于界面查看

# 实时通道冒烟（验证 WebSocket 能穿过 nginx，不会被降级成轮询）
cd frontend && node scripts/ws-smoke.mjs http://localhost:8080
```

接口文档：后端启动后访问 `/api/docs`（Swagger）。

## 生产部署

```bash
cp .env.example .env
# 改掉 JWT_SECRET（openssl rand -hex 32）、POSTGRES_PASSWORD、ADMIN_INITIAL_PASSWORD
docker compose --env-file .env -f docker/docker-compose.yml up -d --build
# 访问 http://<服务器IP>:8080
```

`api` 容器启动时自动执行数据库迁移与初始管理员创建，两者幂等。详见[部署与冒烟清单](docs/部署与冒烟清单.md)。

### 两个容易踩的坑

1. **compose 的 `.env` 不会自动读仓库根目录**：compose v2 的项目目录是 compose 文件所在目录（`docker/`），所以命令里必须带 `--env-file .env`，并在仓库根目录执行。
2. **Socket.IO 走 nginx 必须带 `Upgrade` 头**，否则会静默退化成轮询，看板上看起来「实时同步」没反应。`frontend/nginx.conf` 里已配好。
