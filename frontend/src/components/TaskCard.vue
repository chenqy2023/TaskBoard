<script setup lang="ts">
import { computed } from 'vue';
import { ClockCircleOutlined, UserOutlined } from '@ant-design/icons-vue';
import dayjs from 'dayjs';
import type { TaskView } from '@/types';
import { PRIORITY_LABELS, priorityColor, progressColor } from '@/utils/labels';

const props = defineProps<{ task: TaskView }>();

const emit = defineEmits<{
  (e: 'open', task: TaskView): void;
  (e: 'edit', task: TaskView): void;
}>();

const dueText = computed(() => (props.task.dueDate ? dayjs(props.task.dueDate).format('MM-DD') : null));
</script>

<template>
  <div class="card" :style="{ borderLeftColor: priorityColor(task.priority) }" @click="emit('open', task)">
    <div class="card-top">
      <span class="title" :class="{ done: task.status === 'DONE' }">{{ task.title }}</span>
      <a-tooltip :title="PRIORITY_LABELS[task.priority]">
        <span class="priority" :style="{ color: priorityColor(task.priority) }">
          {{ task.priority }}
        </span>
      </a-tooltip>
    </div>

    <div class="card-meta">
      <a-tag v-if="task.module" class="module-tag">{{ task.module }}</a-tag>
      <span class="assignee">
        <UserOutlined />
        {{ task.assignee?.displayName ?? '未分配' }}
      </span>
      <span v-if="dueText" class="due" :class="{ overdue: task.overdue }">
        <ClockCircleOutlined />
        {{ dueText }}
      </span>
    </div>

    <div class="card-progress">
      <a-progress
        :percent="task.progress"
        size="small"
        :stroke-color="progressColor(task.status, task.progress)"
        :show-info="false"
      />
      <span class="percent">{{ task.progress }}%</span>
    </div>

    <div class="card-actions">
      <a @click.stop="emit('edit', task)">编辑</a>
    </div>
  </div>
</template>

<style scoped>
.card {
  background: #fff;
  border: 1px solid #f0f0f0;
  border-left: 3px solid #8c8c8c;
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.15s;
}

.card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
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
  color: rgba(0, 0, 0, 0.45);
  text-decoration: line-through;
}

.priority {
  font-size: 11px;
  font-weight: 700;
  flex: none;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin: 6px 0 4px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.55);
}

.module-tag {
  margin-inline-end: 0;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.assignee,
.due {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.due.overdue {
  color: #ff4d4f;
  font-weight: 600;
}

.card-progress {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-progress :deep(.ant-progress) {
  flex: 1;
  margin: 0;
}

.percent {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  font-variant-numeric: tabular-nums;
  flex: none;
}

.card-actions {
  text-align: right;
  font-size: 12px;
  opacity: 0;
  transition: opacity 0.15s;
}

.card:hover .card-actions {
  opacity: 1;
}
</style>
