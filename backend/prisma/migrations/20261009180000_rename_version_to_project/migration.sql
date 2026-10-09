-- 重命名：Version -> Project，让模型名与产品概念（项目 / 任务）一致。
--
-- 全部使用 RENAME，不涉及任何数据搬移，已有数据原样保留。
-- 索引与约束名也一并改掉，否则库里会留下 versions_* 这类与新模型不符的名字。
--
-- 生成方式：手工编写（Prisma 的 migrate diff 会生成 DROP + CREATE，
-- 那会丢数据，所以这里改成 RENAME）。

-- 枚举：VersionStatus -> ProjectStatus，并把两个值改成通用说法
ALTER TYPE "VersionStatus" RENAME TO "ProjectStatus";
ALTER TYPE "ProjectStatus" RENAME VALUE 'TESTING' TO 'ACTIVE';
ALTER TYPE "ProjectStatus" RENAME VALUE 'RELEASED' TO 'DONE';

-- 主表与其字段
ALTER TABLE "versions" RENAME TO "projects";
ALTER TABLE "projects" RENAME COLUMN "testStartDate" TO "startDate";
ALTER TABLE "projects" RENAME COLUMN "plannedReleaseDate" TO "endDate";

-- 任务的外键列
ALTER TABLE "tasks" RENAME COLUMN "versionId" TO "projectId";

-- 约束改名（主键约束改名会连带改掉同名索引）
ALTER TABLE "projects" RENAME CONSTRAINT "versions_pkey" TO "projects_pkey";
ALTER TABLE "projects" RENAME CONSTRAINT "versions_createdById_fkey" TO "projects_createdById_fkey";
ALTER TABLE "tasks" RENAME CONSTRAINT "tasks_versionId_fkey" TO "tasks_projectId_fkey";

-- 普通索引改名。
-- 注意：@unique 在 Postgres 里建的是唯一索引而不是约束，
-- 对 versions_name_key 用 RENAME CONSTRAINT 会报「constraint does not exist」。
ALTER INDEX "versions_name_key" RENAME TO "projects_name_key";
ALTER INDEX "versions_status_idx" RENAME TO "projects_status_idx";
ALTER INDEX "tasks_versionId_status_sortIndex_idx" RENAME TO "tasks_projectId_status_sortIndex_idx";
