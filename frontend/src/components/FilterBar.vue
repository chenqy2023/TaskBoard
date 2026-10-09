<script setup lang="ts">
import { computed } from 'vue';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import type { Priority, TaskFilters, TaskStatus, User } from '@/types';
import { PRIORITY_LABELS, PRIORITY_ORDER, TASK_STATUS_LABELS, TASK_STATUS_ORDER } from '@/utils/labels';

const props = withDefaults(
  defineProps<{
    filters: TaskFilters;
    users: User[];
    hideStatus?: boolean;
  }>(),
  { hideStatus: false },
);

const emit = defineEmits<{ (e: 'update:filters', value: TaskFilters): void }>();

function patch(partial: Partial<TaskFilters>) {
  emit('update:filters', { ...props.filters, ...partial });
}

function reset() {
  emit('update:filters', { keyword: '' });
}

const assigneeOptions = computed(() => [
  { value: 'unassigned', label: '未分配' },
  ...props.users.map((user) => ({ value: user.id, label: user.displayName })),
]);

const participantOptions = computed(() =>
  props.users.map((user) => ({ value: user.id, label: user.displayName })),
);

const hasFilter = computed(
  () =>
    !!props.filters.keyword ||
    !!props.filters.assigneeId ||
    !!props.filters.participantId ||
    !!props.filters.priority ||
    !!props.filters.status,
);

function filterByLabel(input: string, option: { label?: string }) {
  return String(option.label ?? '').toLowerCase().includes(input.toLowerCase());
}
</script>

<template>
  <div class="filter-bar">
    <a-input
      :value="filters.keyword"
      class="filter-keyword"
      placeholder="搜索标题或描述"
      allow-clear
      @update:value="(value: string) => patch({ keyword: value })"
    >
      <template #prefix><SearchOutlined /></template>
    </a-input>

    <a-select
      :value="filters.assigneeId"
      class="filter-item"
      placeholder="负责人"
      allow-clear
      show-search
      :options="assigneeOptions"
      :filter-option="filterByLabel"
      @update:value="(value: string | undefined) => patch({ assigneeId: value })"
    />

    <a-select
      :value="filters.participantId"
      class="filter-item"
      placeholder="参与人"
      allow-clear
      show-search
      :options="participantOptions"
      :filter-option="filterByLabel"
      @update:value="(value: string | undefined) => patch({ participantId: value })"
    />

    <a-select
      :value="filters.priority"
      class="filter-item-sm"
      placeholder="优先级"
      allow-clear
      :options="PRIORITY_ORDER.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))"
      @update:value="(value: Priority | undefined) => patch({ priority: value })"
    />

    <a-select
      v-if="!hideStatus"
      :value="filters.status"
      class="filter-item-sm"
      placeholder="状态"
      allow-clear
      :options="TASK_STATUS_ORDER.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] }))"
      @update:value="(value: TaskStatus | undefined) => patch({ status: value })"
    />

    <a-button v-if="hasFilter" size="small" @click="reset">
      <ReloadOutlined />
      重置
    </a-button>

    <slot name="extra" />
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-keyword {
  width: 200px;
}

.filter-item {
  width: 140px;
}

.filter-item-sm {
  width: 118px;
}
</style>
