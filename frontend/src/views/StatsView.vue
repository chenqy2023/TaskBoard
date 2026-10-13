<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { message } from 'ant-design-vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import type { ProjectStats, ProjectView } from '@/types';
import { statsApi, projectsApi } from '@/api';
import { errorText } from '@/api/http';
import ProjectTabs from '@/components/ProjectTabs.vue';
import ProgressSummary from '@/components/ProgressSummary.vue';
import EChart from '@/components/EChart.vue';
import type { EChartsOption } from 'echarts';
import { PRIORITY_COLORS, SEMANTIC, TASK_STATUS_BAR_COLORS } from '@/utils/labels';

const route = useRoute();
const { t, locale } = useI18n();
const projectId = computed(() => String(route.params.id ?? ''));

const project = ref<ProjectView | null>(null);
const stats = ref<ProjectStats | null>(null);
const loading = ref(false);

const statusOption = computed<EChartsOption>(() => {
  void locale.value;
  return {
    tooltip: { trigger: 'item', formatter: t('stats.pieFormatter') },
    legend: { bottom: 0, icon: 'circle' },
    series: [
      {
        type: 'pie',
        radius: ['42%', '68%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        label: { formatter: '{b}\n{c}' },
        data: (stats.value?.byStatus ?? [])
          .filter((item) => item.count > 0)
          .map((item) => ({
            name: t(`labels.taskStatus.${item.status}`),
            value: item.count,
            itemStyle: { color: TASK_STATUS_BAR_COLORS[item.status] },
          })),
      },
    ],
  };
});

const priorityOption = computed<EChartsOption>(() => {
  void locale.value;
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    xAxis: { type: 'value', minInterval: 1 },
    yAxis: {
      type: 'category',
      data: (stats.value?.byPriority ?? []).map((item) => t(`labels.priority.${item.priority}`)).reverse(),
    },
    series: [
      {
        type: 'bar',
        barWidth: 18,
        label: { show: true, position: 'right' },
        data: (stats.value?.byPriority ?? [])
          .map((item) => ({ value: item.count, itemStyle: { color: PRIORITY_COLORS[item.priority] } }))
          .reverse(),
      },
    ],
  };
});

const assigneeOption = computed<EChartsOption>(() => {
  void locale.value;
  const rows = stats.value?.byAssignee ?? [];
  const taskCount = t('stats.taskCount');
  const avgProgress = t('stats.avgProgress');
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { bottom: 0, data: [taskCount, avgProgress] },
    grid: { left: 8, right: 16, top: 24, bottom: 40, containLabel: true },
    xAxis: {
      type: 'category',
      data: rows.map((item) =>
        item.key === 'unassigned'
          ? t('stats.unassigned')
          : item.label === '未分配'
            ? t('stats.unassigned')
            : item.label === '未知成员'
              ? t('stats.unknownMember')
              : item.label,
      ),
      axisLabel: { interval: 0, rotate: rows.length > 6 ? 25 : 0 },
    },
    yAxis: [
      { type: 'value', name: taskCount, minInterval: 1 },
      { type: 'value', name: t('stats.progressPercent'), max: 100, min: 0 },
    ],
    series: [
      { name: taskCount, type: 'bar', barWidth: 20, data: rows.map((item) => item.total), itemStyle: { color: SEMANTIC.brand } },
      {
        name: avgProgress,
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbolSize: 7,
        data: rows.map((item) => item.avgProgress),
        itemStyle: { color: SEMANTIC.warn },
      },
    ],
  };
});

async function load() {
  const id = projectId.value;
  if (!id) return;
  loading.value = true;
  try {
    const [projectData, statsData] = await Promise.all([projectsApi.get(id), statsApi.byProject(id)]);
    project.value = projectData;
    stats.value = statsData;
  } catch (error) {
    message.error(errorText(error, t('stats.loadFailed')));
  } finally {
    loading.value = false;
  }
}

watch(projectId, load);
onMounted(load);
</script>

<template>
  <div class="page">
    <ProjectTabs v-if="project" :project="project" />

    <div class="toolbar" style="margin: 8px 0 12px">
      <a-button size="small" :loading="loading" @click="load">
        <ReloadOutlined />
        {{ t('common.refresh') }}
      </a-button>
    </div>

    <a-spin :spinning="loading">
      <a-card size="small" :title="t('stats.overall')" style="margin-bottom: 12px">
        <ProgressSummary :summary="stats?.summary ?? null" show-status-breakdown />
      </a-card>

      <a-row :gutter="12">
        <a-col :span="12">
          <a-card size="small" :title="t('stats.byStatus')">
            <EChart v-if="stats" :option="statusOption" />
          </a-card>
        </a-col>
        <a-col :span="12">
          <a-card size="small" :title="t('stats.byPriority')">
            <EChart v-if="stats" :option="priorityOption" />
          </a-card>
        </a-col>
      </a-row>

      <a-card size="small" :title="t('stats.byAssignee')" style="margin-top: 12px">
        <EChart v-if="stats" :option="assigneeOption" height="320px" />
      </a-card>
    </a-spin>
  </div>
</template>
