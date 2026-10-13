<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import type { Priority, TaskFilters, TaskStatus, User } from '@/types';
import { PRIORITY_ORDER, TASK_STATUS_ORDER } from '@/utils/labels';

const props = withDefaults(
  defineProps<{
    filters: TaskFilters;
    users: User[];
    hideStatus?: boolean;
  }>(),
  { hideStatus: false },
);

const emit = defineEmits<{ (e: 'update:filters', value: TaskFilters): void }>();
const { t, locale } = useI18n();

function patch(partial: Partial<TaskFilters>) {
  emit('update:filters', { ...props.filters, ...partial });
}

function reset() {
  emit('update:filters', { keyword: '' });
}

const assigneeOptions = computed(() => {
  void locale.value;
  return [
    { value: 'unassigned', label: t('common.unassigned') },
    ...props.users.map((user) => ({ value: user.id, label: user.displayName })),
  ];
});

const participantOptions = computed(() =>
  props.users.map((user) => ({ value: user.id, label: user.displayName })),
);

const priorityOptions = computed(() => {
  void locale.value;
  return PRIORITY_ORDER.map((value) => ({
    value,
    label: t(`labels.priority.${value}`),
  }));
});

const statusOptions = computed(() => {
  void locale.value;
  return TASK_STATUS_ORDER.map((value) => ({
    value,
    label: t(`labels.taskStatus.${value}`),
  }));
});

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
      :placeholder="t('filter.keywordPlaceholder')"
      allow-clear
      @update:value="(value: string) => patch({ keyword: value })"
    >
      <template #prefix><SearchOutlined /></template>
    </a-input>

    <a-select
      :value="filters.assigneeId"
      class="filter-item"
      :placeholder="t('filter.assignee')"
      allow-clear
      show-search
      :options="assigneeOptions"
      :filter-option="filterByLabel"
      @update:value="(value: string | undefined) => patch({ assigneeId: value })"
    />

    <a-select
      :value="filters.participantId"
      class="filter-item"
      :placeholder="t('filter.participant')"
      allow-clear
      show-search
      :options="participantOptions"
      :filter-option="filterByLabel"
      @update:value="(value: string | undefined) => patch({ participantId: value })"
    />

    <a-select
      :value="filters.priority"
      class="filter-item-sm"
      :placeholder="t('filter.priority')"
      allow-clear
      :options="priorityOptions"
      @update:value="(value: Priority | undefined) => patch({ priority: value })"
    />

    <a-select
      v-if="!hideStatus"
      :value="filters.status"
      class="filter-item-sm"
      :placeholder="t('filter.status')"
      allow-clear
      :options="statusOptions"
      @update:value="(value: TaskStatus | undefined) => patch({ status: value })"
    />

    <a-button v-if="hasFilter" size="small" @click="reset">
      <ReloadOutlined />
      {{ t('filter.clear') }}
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
