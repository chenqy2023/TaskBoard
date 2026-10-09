#!/bin/sh
# 容器启动流程：迁移 -> 初始化管理员 -> 启动 API
# 三步都是幂等的，容器重启不会重复造数据。
set -e

echo "[entrypoint] 执行数据库迁移 (prisma migrate deploy)……"
npx prisma migrate deploy

echo "[entrypoint] 检查并初始化管理员账号……"
node prisma/seed.js

echo "[entrypoint] 启动 API 服务……"
exec node dist/main
