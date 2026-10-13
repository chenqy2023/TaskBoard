<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { TaskStatus, ProjectSummary } from '@/types';
import { TASK_STATUS_BAR_COLORS, TASK_STATUS_ORDER, progressColor } from '@/utils/labels';

const props = withDefaults(
  defineProps<{
    summary: ProjectSummary | null;
    showStatusBreakdown?: boolean;
  }>(),
  { showStatusBreakdown: false },
);

const { t, locale } = useI18n();

const avg = computed(() => props.summary?.avgProgress ?? 0);
const strokeColor = computed(() => progressColor('IN_PROGRESS', avg.value));

const breakdown = computed(() => {
  void locale.value;
  const byStatus = props.summary?.byStatus;
  if (!byStatus) return [];
  return TASK_STATUS_ORDER.map((status: TaskStatus) => ({
    key: status,
    label: t(`labels.taskStatus.${status}`),
    count: byStatus[status] ?? 0,
    color: TASK_STATUS_BAR_COLORS[status],
  })).filter((item) => item.count > 0);
});
</script>

<template>
  <div class="summary">
    <div class="summary-bar">
      <a-progress
        :percent="avg"
        :stroke-color="strokeColor"
        size="default"
        :format="(p: number) => `${p}%`"
      />
    </div>
    <div v-if="showStatusBreakdown && breakdown.length" class="summary-meta">
      <span v-for="item in breakdown" :key="item.key" class="chip">
        <i class="dot" :style="{ background: item.color }" />
        {{ item.label }} {{ item.count }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.summary {
  min-width: 240px;
}

.summary-bar :deep(.ant-progress-text) {
  font-variant-numeric: tabular-nums;
}

.summary-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.65);
  margin-top: 2px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
</style>
