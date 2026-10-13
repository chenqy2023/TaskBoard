<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { TaskStatus, ProjectSummary } from '@/types';

const props = defineProps<{ summary: ProjectSummary | null }>();
const { t, locale } = useI18n();

const SEGMENTS: { status: TaskStatus; color: string }[] = [
  { status: 'TODO', color: 'var(--tk-status-todo)' },
  { status: 'IN_PROGRESS', color: 'var(--tk-status-doing)' },
  { status: 'BLOCKED', color: 'var(--tk-status-blocked)' },
  { status: 'DONE', color: 'var(--tk-status-done)' },
];

const total = computed(() => props.summary?.total ?? 0);
const done = computed(() => props.summary?.done ?? 0);
const blocked = computed(() => props.summary?.byStatus?.BLOCKED ?? 0);
const avg = computed(() => Math.min(100, Math.max(0, props.summary?.avgProgress ?? 0)));
const rate = computed(() => props.summary?.completionRate ?? 0);

/** 分段条按任务条数占比，和上面的「平均进度」是两个不同口径，图例里写清楚 */
const segments = computed(() => {
  void locale.value;
  return SEGMENTS.map((segment) => {
    const count = props.summary?.byStatus?.[segment.status] ?? 0;
    return {
      ...segment,
      label: t(`labels.taskStatus.${segment.status}`),
      count,
      percent: total.value === 0 ? 0 : (count / total.value) * 100,
    };
  });
});

const visibleLegend = computed(() => segments.value.filter((segment) => segment.count > 0));

const avgTone = computed(() => {
  if (avg.value >= 100) return 'done';
  if (blocked.value > 0) return 'blocked';
  if (avg.value >= 60) return 'doing';
  return 'todo';
});
</script>

<template>
  <div class="vp">
    <div class="vp-head">
      <div class="vp-metric">
        <span class="vp-value num" :class="`tone-${avgTone}`">{{ avg }}</span>
        <span class="vp-unit">%</span>
        <span class="vp-label">{{ t('progress.average') }}</span>
      </div>
      <div class="vp-rate">
        {{ t('progress.completion') }}
        <b class="num">{{ rate }}%</b>
        <em class="num">{{ done }}/{{ total }}</em>
      </div>
    </div>

    <div class="vp-foot">
      <div class="vp-bar" :class="{ empty: total === 0 }">
        <template v-if="total > 0">
          <span
            v-for="segment in segments"
            :key="segment.status"
            class="vp-seg"
            :style="{ width: `${segment.percent}%`, background: segment.color }"
            :title="t('stats.segmentTitle', { label: segment.label, n: segment.count })"
          />
        </template>
      </div>

      <div class="vp-legend">
        <span v-if="total === 0" class="text-muted">{{ t('stats.noTasks') }}</span>
        <template v-else>
          <span
            v-for="segment in visibleLegend"
            :key="segment.status"
            class="vp-chip"
            :class="{ risk: segment.status === 'BLOCKED' }"
          >
            <i class="dot" :style="{ background: segment.color }" />
            {{ segment.label }}
            <b class="num">{{ segment.count }}</b>
          </span>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vp {
  min-width: 0;
}

.vp-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}

.vp-metric {
  display: flex;
  align-items: baseline;
  gap: 0;
}

.vp-value {
  font-size: 22px;
  font-weight: 650;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.vp-value.tone-done {
  color: var(--tk-success);
}

.vp-value.tone-blocked {
  color: var(--tk-danger);
}

.vp-value.tone-doing {
  color: var(--tk-brand);
}

.vp-value.tone-todo {
  color: var(--tk-ink-2);
}

.vp-unit {
  font-size: 13px;
  color: var(--tk-ink-3);
}

.vp-label {
  font-size: 12px;
  color: var(--tk-ink-4);
  margin-left: 6px;
}

.vp-rate {
  font-size: 12px;
  color: var(--tk-ink-3);
  white-space: nowrap;
}

.vp-rate b {
  color: var(--tk-ink-2);
  font-weight: 600;
}

.vp-rate em {
  font-style: normal;
  color: var(--tk-ink-4);
  margin-left: 4px;
}

/* 任务条数占比：固定宽度的图例色块条。
   故意不铺满整列——否则只有一个状态时看起来像"100% 进度条"，
   会和上面的平均进度混淆。 */
.vp-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}

.vp-bar {
  display: flex;
  flex: none;
  /* 收窄到 108px：宽度够时图例能一行放完，不至于把「已完成」挤到第二行 */
  width: 108px;
  height: 8px;
  border-radius: var(--tk-radius-pill);
  overflow: hidden;
  background: var(--tk-line);
}

.vp-bar.empty {
  background: repeating-linear-gradient(
    90deg,
    var(--tk-line) 0 6px,
    transparent 6px 12px
  );
}

.vp-seg {
  transition: width 0.3s cubic-bezier(0.22, 0.68, 0.36, 1);
}

.vp-legend {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--tk-ink-3);
}

.vp-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.vp-chip b {
  color: var(--tk-ink-2);
  font-weight: 600;
}

.vp-chip.risk {
  color: var(--tk-danger);
}

.vp-chip.risk b {
  color: var(--tk-danger);
}
</style>
