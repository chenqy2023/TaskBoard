<script setup lang="ts">
import { computed } from 'vue';
import { CalendarOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons-vue';
import dayjs from 'dayjs';
import type { TaskView } from '@/types';
import { PRIORITY_LABELS, priorityColor, progressColor } from '@/utils/labels';

const props = defineProps<{ task: TaskView }>();

const emit = defineEmits<{
  (e: 'open', task: TaskView): void;
  (e: 'edit', task: TaskView): void;
}>();

const plannedEnd = computed(() =>
  props.task.plannedEndDate ? dayjs(props.task.plannedEndDate).format('MM-DD') : null,
);

const participantText = computed(() =>
  props.task.participants.map((item) => item.displayName).join('、'),
);
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
      <span class="assignee">
        <UserOutlined />
        {{ task.assignee?.displayName ?? '未分配' }}
      </span>
      <span v-if="task.participants.length" class="participants" :title="participantText">
        <TeamOutlined />
        {{ participantText }}
      </span>
      <span v-if="plannedEnd" class="due" :class="{ overdue: task.overdue }">
        <CalendarOutlined />
        {{ plannedEnd }}
        <template v-if="task.overdue">逾期</template>
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
  gap: 10px;
  flex-wrap: wrap;
  margin: 6px 0 4px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.55);
}

.assignee,
.participants,
.due {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-width: 0;
}

.participants {
  max-width: 130px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
