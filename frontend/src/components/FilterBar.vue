<script setup lang="ts">
import { computed } from 'vue';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import type { Priority, TaskFilters, TaskStatus, User } from '@/types';
import { PRIORITY_LABELS, PRIORITY_ORDER, TASK_STATUS_LABELS, TASK_STATUS_ORDER } from '@/utils/labels';

const props = withDefaults(
  defineProps<{
    filters: TaskFilters;
    users: User[];
    modules: string[];
    hideStatus?: boolean;
  }>(),
  { hideStatus: false },
);

const emit = defineEmits<{ (e: 'update:filters', value: TaskFilters): void; (e: 'change'): void }>();

function patch(partial: Partial<TaskFilters>) {
  emit('update:filters', { ...props.filters, ...partial });
  emit('change');
}

function reset() {
  emit('update:filters', { keyword: '' });
  emit('change');
}

const userOptions = computed(() => [
  { value: 'unassigned', label: '未分配' },
  ...props.users.map((user) => ({ value: user.id, label: user.displayName })),
]);

const moduleOptions = computed(() => props.modules.map((value) => ({ value, label: value })));

const hasFilter = computed(
  () =>
    !!props.filters.keyword ||
    !!props.filters.assigneeId ||
    !!props.filters.priority ||
    !!props.filters.module ||
    !!props.filters.status,
);
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
      :options="userOptions"
      @update:value="(value: string | undefined) => patch({ assigneeId: value })"
    />

    <a-select
      :value="filters.module"
      class="filter-item"
      placeholder="模块"
      allow-clear
      show-search
      :options="moduleOptions"
      @update:value="(value: string | undefined) => patch({ module: value })"
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
  width: 220px;
}

.filter-item {
  width: 150px;
}

.filter-item-sm {
  width: 120px;
}
</style>
