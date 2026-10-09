<script setup lang="ts">
import { computed } from 'vue';
import type { TaskStatus, ProjectSummary } from '@/types';
import { TASK_STATUS_BAR_COLORS, TASK_STATUS_LABELS, progressColor } from '@/utils/labels';

const props = withDefaults(
  defineProps<{
    summary: ProjectSummary | null;
    showStatusBreakdown?: boolean;
  }>(),
  { showStatusBreakdown: false },
);

const avg = computed(() => props.summary?.avgProgress ?? 0);
const rate = computed(() => props.summary?.completionRate ?? 0);
const total = computed(() => props.summary?.total ?? 0);
const done = computed(() => props.summary?.done ?? 0);

/** 进度条颜色按整体进度分档；色值统一走 labels.ts，不在这里另存一份 */
const strokeColor = computed(() => progressColor('IN_PROGRESS', avg.value));

/** 状态小计：颜色与文案都从 labels.ts 取，避免各处各写一份导致失配 */
const STATUS_ORDER: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'];

const breakdown = computed(() => {
  const byStatus = props.summary?.byStatus;
  if (!byStatus) return [];
  return STATUS_ORDER.map((status) => ({
    key: status,
    label: TASK_STATUS_LABELS[status],
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
    <div class="summary-meta">
      <span class="rate">
        完成率
        <b>{{ rate }}%</b>
        <span class="text-muted">（{{ done }}/{{ total }}）</span>
      </span>
      <template v-if="showStatusBreakdown && breakdown.length">
        <a-divider type="vertical" />
        <span v-for="item in breakdown" :key="item.key" class="chip">
          <i class="dot" :style="{ background: item.color }" />
          {{ item.label }} {{ item.count }}
        </span>
      </template>
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

.summary-meta .rate b {
  font-variant-numeric: tabular-nums;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
</style>
