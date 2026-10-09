-- 任务字段调整：去掉模块与截止日期，改为计划/实际四个日期，并增加参与人（多对多）
--
-- 数据保全说明：
--   * "dueDate"（截止日期）与新的「计划结束日期」语义一致，先搬过去再删列，不丢已有数据。
--   * "module"（模块）是产品上移除的分类标签，没有后继字段，直接删除。
--     执行前已核对：库内非空的 module 值为 0 条（唯一一条任务的模块是空串）。
--
-- 生成方式：prisma migrate diff --from-schema-datasource ... --script
-- 人工在 DROP 之前插入了搬运 dueDate 的 UPDATE 语句。

-- AlterEnum
ALTER TYPE "ActivityAction" ADD VALUE 'PARTICIPANTS_CHANGED';

-- AlterTable：先加新列
ALTER TABLE "tasks"
ADD COLUMN     "actualEndDate" TIMESTAMP(3),
ADD COLUMN     "actualStartDate" TIMESTAMP(3),
ADD COLUMN     "plannedEndDate" TIMESTAMP(3),
ADD COLUMN     "plannedStartDate" TIMESTAMP(3);

-- 搬运数据：截止日期 -> 计划结束日期
UPDATE "tasks" SET "plannedEndDate" = "dueDate" WHERE "dueDate" IS NOT NULL;

-- AlterTable：再删掉被替换的列
ALTER TABLE "tasks"
DROP COLUMN "dueDate",
DROP COLUMN "module";

-- CreateTable：参与人关联表
CREATE TABLE "_TaskParticipants" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TaskParticipants_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_TaskParticipants_B_index" ON "_TaskParticipants"("B");

-- CreateIndex
CREATE INDEX "tasks_plannedEndDate_idx" ON "tasks"("plannedEndDate");

-- AddForeignKey
ALTER TABLE "_TaskParticipants" ADD CONSTRAINT "_TaskParticipants_A_fkey" FOREIGN KEY ("A") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskParticipants" ADD CONSTRAINT "_TaskParticipants_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
