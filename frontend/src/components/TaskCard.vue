<script setup lang="ts">
import { computed } from 'vue';
import { CalendarOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons-vue';
import dayjs from 'dayjs';
import type { TaskView } from '@/types';
import { PRIORITY_LABELS, PRIORITY_TINTS, priorityColor, progressColor } from '@/utils/labels';

const props = defineProps<{ task: TaskView }>();

const emit = defineEmits<{
  (e: 'open', task: TaskView): void;
  (e: 'edit', task: TaskView): void;
}>();

/** 只显示 月-日；跨年的日期补上年份，避免误读成今年 */
const dueLabel = computed(() => {
  if (!props.task.plannedEndDate) return null;
  const date = dayjs(props.task.plannedEndDate);
  return date.year() === dayjs().year() ? date.format('MM-DD') : date.format('YYYY-MM-DD');
});

const dueTitle = computed(() => {
  if (!props.task.plannedEndDate) return '未设计划结束日期';
  return `计划结束日期：${props.task.plannedEndDate}${props.task.overdue ? '（已逾期）' : ''}`;
});

const participantText = computed(() => props.task.participants.map((item) => item.displayName).join('、'));
</script>

<template>
  <div class="card" :style="{ borderLeftColor: priorityColor(task.priority) }" @click="emit('open', task)">
    <div class="card-top">
      <span class="title" :class="{ done: task.status === 'DONE' }">{{ task.title }}</span>
      <span
        class="priority"
        :style="{
          color: priorityColor(task.priority),
          background: PRIORITY_TINTS[task.priority],
          borderColor: priorityColor(task.priority),
        }"
      >
        {{ PRIORITY_LABELS[task.priority] }}
      </span>
    </div>

    <!-- 负责人与计划结束日期构成稳定的一行：谁是主责、何时到期，一眼可见 -->
    <div class="card-who">
      <span class="assignee">
        <UserOutlined />
        {{ task.assignee?.displayName ?? '未分配' }}
      </span>
      <span v-if="dueLabel" class="due" :class="{ overdue: task.overdue }" :title="dueTitle">
        <CalendarOutlined />
        {{ dueLabel }}
        <em v-if="task.overdue">逾期</em>
      </span>
    </div>

    <div v-if="task.participants.length" class="card-participants" :title="participantText">
      <TeamOutlined />
      参与 {{ participantText }}
    </div>

    <div class="card-progress">
      <a-progress
        :percent="task.progress"
        size="small"
        :stroke-color="progressColor(task.status, task.progress)"
        :show-info="false"
      />
      <span class="percent num">{{ task.progress }}%</span>
    </div>

    <div class="card-actions">
      <a @click.stop="emit('edit', task)">编辑</a>
    </div>
  </div>
</template>

<style scoped>
.card {
  background: #fff;
  border: 1px solid var(--tk-hairline);
  /* 左侧色条跟随优先级，是快速扫视时最直接的线索 */
  border-left: 3px solid var(--tk-ink-4);
  border-radius: var(--tk-radius-sm);
  box-shadow: var(--tk-shadow-card);
  padding: 10px 12px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.15s;
}

.card:hover {
  box-shadow: var(--tk-shadow-card-hover);
  transform: translateY(-1px);
}

.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.title {
  font-size: 13px;
  line-height: 20px;
  font-weight: 500;
  word-break: break-word;
}

.title.done {
  color: var(--tk-ink-3);
  text-decoration: line-through;
}

/** 优先级用带底色的徽章，和继承自卡片的左色条互为呼应。
    文案是「紧急/高/中/低」，用 min-width 让单字与双字的徽章宽度一致。 */
.priority {
  flex: none;
  font-size: 11px;
  font-weight: 700;
  line-height: 16px;
  min-width: 32px;
  padding: 0 7px;
  text-align: center;
  border: 1px solid;
  border-radius: var(--tk-radius-pill);
}

.card-who {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 7px;
  font-size: 12px;
}

.assignee {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--tk-ink-2);
  font-weight: 500;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.due {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: auto;
  flex: none;
  color: var(--tk-ink-3);
  font-family: var(--tk-num);
  font-variant-numeric: tabular-nums;
}

.due.overdue {
  color: var(--tk-danger);
  font-weight: 600;
}

.due em {
  font-style: normal;
  margin-left: 2px;
}

.card-participants {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  font-size: 12px;
  color: var(--tk-ink-4);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.card-progress :deep(.ant-progress) {
  flex: 1;
  margin: 0;
  min-width: 0;
}

.percent {
  font-size: 12px;
  color: var(--tk-ink-3);
  flex: none;
}

.card-actions {
  text-align: right;
  font-size: 12px;
  line-height: 18px;
  margin-top: 2px;
  /* 只用透明度切换，避免 hover 时卡片高度跳动 */
  opacity: 0;
  transition: opacity 0.15s;
}

.card:hover .card-actions {
  opacity: 1;
}
</style>
