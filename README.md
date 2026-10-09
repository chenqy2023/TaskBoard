# 任务看板

小而完整的**项目与任务进度看板**。看板拖拽流转任务，进度按任务自动汇总；带评论、操作日志、Excel 导入导出、统计图表和多人实时同步。前后端全 TypeScript，`docker compose` 一条命令部署。

## 功能

| 模块 | 内容 |
| --- | --- |
| 项目 | 卡片墙首页：渐变封面、任务数徽章、平均进度与完成率、开始→结束日期；末尾一键创建 |
| 看板 | 四列拖拽改状态、列内排序、列自适应铺满、状态计数可点即筛 |
| 任务 | 新建/编辑/删除、负责人、参与人（多选）、优先级、0-100 整数进度、计划与实际四个日期 |
| 任务列表 | 表格视图、多条件筛选、排序、分页、行内改状态与负责人、批量修改 |
| 协作 | 评论、操作日志时间线（谁把哪条任务从什么状态改成了什么状态） |
| 统计 | ECharts：状态分布、优先级分布、各负责人任务数与平均进度 |
| 导入导出 | Excel 批量导入（先预览校验再落库）、按项目导出 |
| 实时同步 | Socket.IO 推送，别人改了看板自动刷新并提示是谁改的 |
| 权限 | 账号密码登录，管理员 / 成员两种角色 |

## 技术栈

| 层 | 选型 |
| --- | --- |
| 前端 | Vue 3 · Vite · TypeScript · Ant Design Vue · Pinia · ECharts · Socket.IO Client |
| 后端 | NestJS · Prisma · TypeScript · Passport JWT · Socket.IO |
| 数据库 | PostgreSQL 16 |
| 部署 | Docker Compose（nginx + api + postgres） |

## 快速开始

需要 Node.js 20+ 与 Docker。

```bash
# 1. 准备环境变量
cp .env.example .env

# 2. 只起数据库（默认映射到宿主机 5432，被占用就改 .env 里的 POSTGRES_PORT）
docker compose --env-file .env -f docker/docker-compose.dev.yml up -d

# 3. 后端
cd backend
npm install
npx prisma migrate deploy     # 建表
npx prisma db seed            # 创建初始管理员
npm run start:dev             # http://localhost:3000/api，接口文档 /api/docs

# 4. 前端（另开一个终端）
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

初始账号 `admin`，密码取自 `.env` 里的 `ADMIN_INITIAL_PASSWORD`（默认 `Admin@123456`），登录后请立即修改。

开发期前端通过 Vite 代理把 `/api` 与 `/socket.io` 转发到 `localhost:3000`，不用处理跨域。

## 部署到服务器

```bash
cp .env.example .env
# 至少改掉这三项：
#   JWT_SECRET=$(openssl rand -hex 32)
#   POSTGRES_PASSWORD=<强密码>
#   ADMIN_INITIAL_PASSWORD=<初始管理员密码>
docker compose --env-file .env -f docker/docker-compose.yml up -d --build
# 访问 http://<服务器IP>:8080
```

`api` 容器启动时会自动执行数据库迁移与初始管理员创建，两者都是幂等的，重启容器不会重复造数据。备份、恢复、排障见[部署与冒烟清单](docs/部署与冒烟清单.md)。

## 文档

- [设计决策](docs/设计决策.md) —— 产品层面的关键取舍与理由
- [数据模型与接口](docs/数据模型与接口.md) —— 表结构、全部接口、进度算法
- [部署与冒烟清单](docs/部署与冒烟清单.md) —— 本地开发、生产部署、手工验收清单、排障

## 测试

```bash
cd backend && npm run test          # 单元测试：进度汇总 / 状态与进度联动 / 权限规则 / 导入校验
cd frontend && npm run typecheck    # 前端类型检查

# 接口冒烟（需后端已启动）
python scripts/api-smoke.py
python scripts/api-smoke.py --base http://localhost:8080/api   # 也可直接打生产 nginx

# 实时通道冒烟（验证 WebSocket 能穿过 nginx，不会被降级成轮询）
cd frontend && node scripts/ws-smoke.mjs http://localhost:8080
```

## 目录结构

```
├─ backend/            NestJS + Prisma
│  ├─ prisma/          schema、migrations、seed
│  └─ src/             auth users projects tasks comments activities stats task-io realtime common
├─ frontend/           Vue 3 + Vite + Ant Design Vue
│  ├─ src/api          接口封装（axios 实例统一处理 401 与错误提示）
│  ├─ src/views        登录、项目卡片墙（首页）、看板、任务列表、统计、我的待办、成员管理
│  └─ src/components   看板卡片、任务表单、任务详情弹窗、筛选项、导入弹窗等
├─ docker/
│  ├─ docker-compose.yml       生产：nginx + api + postgres
│  └─ docker-compose.dev.yml   开发：仅 postgres
└─ scripts/api-smoke.py  接口级冒烟测试（仅用 Python 标准库）
```

## 两个容易踩的坑

1. **compose 不会自动读仓库根目录的 `.env`**。compose v2 的项目目录是 compose 文件所在目录（`docker/`），所以命令里必须带 `--env-file .env`，并且在仓库根目录执行。
2. **Socket.IO 走 nginx 必须带 `Upgrade` 头**，否则会静默退化成轮询，看板上看起来「实时同步」没反应。`frontend/nginx.conf` 里已经配好，自建反代时记得抄这两行。

## 参与贡献

见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE)
