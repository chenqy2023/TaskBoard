<script setup lang="ts">
import { computed } from 'vue';
import type { VersionSummary } from '@/types';

const props = withDefaults(
  defineProps<{
    summary: VersionSummary | null;
    showStatusBreakdown?: boolean;
  }>(),
  { showStatusBreakdown: false },
);

const avg = computed(() => props.summary?.avgProgress ?? 0);
const rate = computed(() => props.summary?.completionRate ?? 0);
const total = computed(() => props.summary?.total ?? 0);
const done = computed(() => props.summary?.done ?? 0);

const strokeColor = computed(() => {
  if (avg.value >= 100) return '#52c41a';
  if (avg.value >= 60) return '#1677ff';
  if (avg.value >= 30) return '#faad14';
  return '#ff7875';
});

const breakdown = computed(() => {
  const byStatus = props.summary?.byStatus;
  if (!byStatus) return [];
  return [
    { label: '未开始', key: 'TODO', count: byStatus.TODO ?? 0, color: '#8c8c8c' },
    { label: '进行中', key: 'IN_PROGRESS', count: byStatus.IN_PROGRESS ?? 0, color: '#1677ff' },
    { label: '阻塞', key: 'BLOCKED', count: byStatus.BLOCKED ?? 0, color: '#ff4d4f' },
    { label: '已完成', key: 'DONE', count: byStatus.DONE ?? 0, color: '#52c41a' },
  ].filter((item) => item.count > 0);
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
