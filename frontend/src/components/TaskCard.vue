<script setup lang="ts">
import { computed } from 'vue';
import { CalendarOutlined } from '@ant-design/icons-vue';
import dayjs from 'dayjs';
import type { TaskView } from '@/types';
import {
  PRIORITY_LABELS,
  avatarColor,
  avatarInitial,
  priorityColor,
  progressColor,
} from '@/utils/labels';

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

const assignee = computed(() => props.task.assignee);

/** 紧急/高用实色饱和胶囊，中/低用淡底——要色彩浓度，但不能整板都是实色块 */
const isHot = computed(() => props.task.priority === 'P0' || props.task.priority === 'P1');
</script>

<template>
  <div class="card" :style="{ borderLeftColor: priorityColor(task.priority) }" @click="emit('open', task)">
    <div class="card-top">
      <span class="title" :class="{ done: task.status === 'DONE' }">{{ task.title }}</span>
      <span
        class="priority"
        :class="{ solid: isHot }"
        :style="{
          color: isHot ? '#fff' : priorityColor(task.priority),
          background: isHot ? priorityColor(task.priority) : 'transparent',
          borderColor: priorityColor(task.priority),
        }"
      >
        {{ PRIORITY_LABELS[task.priority] }}
      </span>
    </div>

    <div class="card-foot">
      <span
        v-if="dueLabel"
        class="due"
        :class="{ overdue: task.overdue }"
        :title="`计划结束日期：${task.plannedEndDate}${task.overdue ? '（已逾期）' : ''}`"
      >
        <CalendarOutlined />
        {{ dueLabel }}
      </span>
      <span v-else class="due muted">未排期</span>

      <div class="members">
        <span v-if="assignee" class="who" :title="`负责人：${assignee.displayName}`">
          <span class="avatar" :style="{ background: avatarColor(assignee.displayName) }">
            {{ avatarInitial(assignee.displayName) }}
          </span>
          <span class="who-name">{{ assignee.displayName }}</span>
        </span>
        <span v-else class="who muted" title="未分配负责人">未分配</span>

        <span
          v-for="person in task.participants"
          :key="person.id"
          class="avatar avatar-sm"
          :style="{ background: avatarColor(person.displayName) }"
          :title="`参与：${person.displayName}`"
        >
          {{ avatarInitial(person.displayName) }}
        </span>
      </div>
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
  padding: 10px 12px 8px;
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
  font-weight: 600;
  word-break: break-word;
}

.title.done {
  color: var(--tk-ink-3);
  text-decoration: line-through;
}

.priority {
  flex: none;
  font-size: 11px;
  font-weight: 700;
  line-height: 17px;
  min-width: 32px;
  padding: 0 7px;
  text-align: center;
  border: 1px solid;
  border-radius: var(--tk-radius-pill);
}

/* 实色胶囊由底色承担颜色，边框透明让边缘更干净 */
.priority.solid {
  border-color: transparent;
}

/* ---------- 底部：日期 + 头像 ---------- */

.card-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.due {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex: none;
  font-size: 12px;
  line-height: 18px;
  padding: 0 7px;
  border-radius: var(--tk-radius-pill);
  background: #f1f3f5;
  color: var(--tk-ink-2);
  font-variant-numeric: tabular-nums;
}

.due.overdue {
  background: #fdecec;
  color: var(--tk-danger);
  font-weight: 600;
}

.due.muted {
  background: transparent;
  color: var(--tk-ink-4);
  border: 1px dashed rgba(9, 30, 66, 0.16);
  padding: 0 6px;
}

.members {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  min-width: 0;
}

.who {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  margin-right: 2px;
}

.who-name {
  font-size: 12px;
  color: var(--tk-ink-2);
  max-width: 72px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.who.muted {
  font-size: 12px;
  color: var(--tk-ink-4);
}

/* 圆形字母头像：同一个人在任何地方都是同一个颜色（按姓名散列取色） */
.avatar {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  box-shadow: 0 0 0 1.5px #fff;
  user-select: none;
}

/* 参与人头像互相叠压，和负责人区分开 */
.avatar-sm {
  width: 20px;
  height: 20px;
  font-size: 10px;
  margin-left: -6px;
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
</style>
